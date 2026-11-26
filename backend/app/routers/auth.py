from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.auth.phone import InvalidPhone, normalize_phone
from app.auth.security import create_access_token, hash_otp, new_otp, otp_matches
from app.auth.sms import send_otp
from app.config import settings
from app.db import get_db
from app.models import Customer, Invite, InviteStatus, OtpCode, Project, ProjectCustomer, Role, User
from app.schemas import MeUpdate, OtpRequestIn, OtpRequestOut, OtpVerifyIn, TokenOut, UserOut
from app.services import audit

router = APIRouter(tags=["auth"])

OTP_REQUESTS_PER_WINDOW = 5
OTP_WINDOW = timedelta(minutes=15)


def _phone_or_422(raw: str) -> str:
    try:
        return normalize_phone(raw)
    except InvalidPhone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid phone number") from None


def _pending_invites(db: Session, phone: str) -> list[Invite]:
    now = datetime.now(UTC)
    return list(
        db.scalars(
            select(Invite).where(Invite.phone == phone, Invite.status == InviteStatus.sent, Invite.expires_at > now)
        ).all()
    )


@router.post("/auth/otp/request", response_model=OtpRequestOut)
def request_otp(body: OtpRequestIn, db: Session = Depends(get_db)) -> OtpRequestOut:
    phone = _phone_or_422(body.phone)
    now = datetime.now(UTC)

    recent = db.scalar(
        select(func.count()).select_from(OtpCode).where(OtpCode.phone == phone, OtpCode.created_at > now - OTP_WINDOW)
    )
    if recent >= OTP_REQUESTS_PER_WINDOW:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many OTP requests, try again later")

    # Only known users or invited phones get an SMS (stops strangers burning SMS credit).
    # The response looks the same either way so it doesn't reveal who is registered.
    known = db.scalar(select(User).where(User.phone == phone, User.is_active.is_(True))) is not None
    if not known and not _pending_invites(db, phone):
        return OtpRequestOut()

    code = new_otp()
    db.add(OtpCode(phone=phone, code_hash=hash_otp(phone, code), expires_at=now + timedelta(seconds=settings.otp_ttl_seconds)))
    db.commit()
    send_otp(phone, code)
    return OtpRequestOut(dev_code=code if settings.dev_expose_otp else None)


@router.post("/auth/otp/verify", response_model=TokenOut)
def verify_otp(body: OtpVerifyIn, db: Session = Depends(get_db)) -> TokenOut:
    phone = _phone_or_422(body.phone)
    now = datetime.now(UTC)

    otp = db.scalars(
        select(OtpCode)
        .where(OtpCode.phone == phone, OtpCode.consumed.is_(False), OtpCode.expires_at > now)
        .order_by(OtpCode.created_at.desc())
    ).first()
    bad = HTTPException(status.HTTP_400_BAD_REQUEST, "wrong or expired code")
    if otp is None or otp.attempts >= settings.otp_max_attempts:
        raise bad
    if not otp_matches(phone, body.code, otp.code_hash):
        otp.attempts += 1
        db.commit()
        raise bad
    otp.consumed = True

    user = db.scalar(select(User).where(User.phone == phone))
    invites = _pending_invites(db, phone)

    if user is None:
        if not invites:
            db.commit()
            raise HTTPException(status.HTTP_403_FORBIDDEN, "this number is not registered with Sai Constructions")
        first_project = db.get(Project, invites[0].project_id)
        customer = db.get(Customer, first_project.customer_id)
        user = User(phone=phone, full_name=customer.name, role=Role.customer)
        db.add(user)
        db.flush()
        audit.record(db, user, "create", "user", user.id, after=audit.snapshot(user))
    elif not user.is_active:
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "account disabled")

    if user.role == Role.customer:
        linked = set(db.scalars(select(ProjectCustomer.project_id).where(ProjectCustomer.user_id == user.id)))
        for inv in invites:
            if inv.project_id not in linked:  # several invites for one project must link it once
                db.add(ProjectCustomer(project_id=inv.project_id, user_id=user.id))
                linked.add(inv.project_id)
            inv.status = InviteStatus.accepted
            inv.accepted_by = user.id
            audit.record(db, user, "accept_invite", "invite", inv.id)

    audit.record(db, user, "login", "user", user.id)
    db.commit()
    return TokenOut(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    before = audit.snapshot(user)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, field, value)
    audit.record(db, user, "update", "user", user.id, before=before, after=audit.snapshot(user))
    db.commit()
    return user
