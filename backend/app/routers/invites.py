import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_owner
from app.auth.phone import InvalidPhone, mask_phone, normalize_phone
from app.auth.security import new_invite_token
from app.config import settings
from app.db import get_db
from app.models import Customer, Invite, InviteStatus, Project, User
from app.schemas import InviteIn, InviteOut, PublicInviteOut
from app.services import audit
from app.services.access import get_project_for

router = APIRouter(tags=["invites"])


def _link(token: str) -> str:
    return f"{settings.app_base_url}/invite/{token}"


def _out(inv: Invite) -> InviteOut:
    return InviteOut.model_validate(inv).model_copy(update={"link": _link(inv.token)})


@router.post("/projects/{project_id}/invites", response_model=InviteOut, status_code=201)
def create_invite(
    project_id: uuid.UUID, body: InviteIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)
):
    project = get_project_for(db, owner, project_id)
    raw = body.phone or db.get(Customer, project.customer_id).phone
    try:
        phone = normalize_phone(raw)
    except InvalidPhone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid phone number") from None
    inv = Invite(
        project_id=project_id,
        phone=phone,
        token=new_invite_token(),
        expires_at=datetime.now(UTC) + timedelta(days=settings.invite_ttl_days),
        created_by=owner.id,
    )
    db.add(inv)
    db.flush()
    audit.record(db, owner, "create", "invite", inv.id, after={"project_id": str(project_id), "phone": phone})
    db.commit()
    return _out(inv)


@router.get("/projects/{project_id}/invites", response_model=list[InviteOut])
def list_invites(project_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    get_project_for(db, owner, project_id)
    rows = db.scalars(select(Invite).where(Invite.project_id == project_id).order_by(Invite.created_at.desc())).all()
    return [_out(i) for i in rows]


@router.post("/invites/{invite_id}/revoke", response_model=InviteOut)
def revoke_invite(invite_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    inv = db.get(Invite, invite_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invite not found")
    if inv.status == InviteStatus.sent:
        inv.status = InviteStatus.revoked
        audit.record(db, owner, "update", "invite", inv.id, after={"status": "revoked"})
        db.commit()
    return _out(inv)


@router.get("/public/invites/{token}", response_model=PublicInviteOut)
def public_invite(token: str, db: Session = Depends(get_db)):
    """Shown on the invite landing page before login. Reveals only the project name and a masked phone."""
    inv = db.scalar(select(Invite).where(Invite.token == token))
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invite not found")
    project = db.get(Project, inv.project_id)
    usable = inv.status == InviteStatus.sent and inv.expires_at > datetime.now(UTC)
    return PublicInviteOut(project_name=project.name, phone_masked=mask_phone(inv.phone), usable=usable)
