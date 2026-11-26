import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_role
from app.db import get_db
from app.models import (
    Customer,
    CustomerPayment,
    Milestone,
    PaymentMode,
    PaymentStatus,
    Project,
    Role,
    StoredFile,
    User,
)
from app.models.payments import receipt_no_seq
from app.schemas.payments import DisputeIn, PaymentIn, PaymentOut, ReceiptOut, SummaryOut
from app.services import audit, money
from app.services.access import get_project_for
from app.services.files import signed_url

router = APIRouter(tags=["payments"])

owner_or_customer = require_role(Role.owner, Role.customer)


def _is_other_side(user: User, p: CustomerPayment) -> bool:
    return p.status == PaymentStatus.unconfirmed and user.role != p.logged_by_role


def _out(db: Session, user: User, p: CustomerPayment) -> PaymentOut:
    m = db.get(Milestone, p.milestone_id) if p.milestone_id else None
    by = db.get(User, p.logged_by)
    return PaymentOut.model_validate(p).model_copy(
        update={
            "milestone_name": m.name if m else None,
            "logged_by_name": by.full_name if by else "",
            "proof_url": signed_url(p.proof_file_id),
            "can_confirm": _is_other_side(user, p),
        }
    )


def _payment_for(db: Session, user: User, payment_id: uuid.UUID) -> CustomerPayment:
    p = db.get(CustomerPayment, payment_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "payment not found")
    get_project_for(db, user, p.project_id)  # 404 if the user can't see the project
    return p


@router.get("/projects/{project_id}/summary", response_model=SummaryOut)
def project_summary(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    return money.summary(db, get_project_for(db, user, project_id))


@router.get("/projects/{project_id}/payments", response_model=list[PaymentOut])
def list_payments(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    get_project_for(db, user, project_id)
    rows = db.scalars(
        select(CustomerPayment)
        .where(CustomerPayment.project_id == project_id)
        .order_by(CustomerPayment.paid_on.desc(), CustomerPayment.created_at.desc())
    ).all()
    return [_out(db, user, p) for p in rows]


@router.post("/projects/{project_id}/payments", response_model=PaymentOut, status_code=201)
def log_payment(
    project_id: uuid.UUID, body: PaymentIn, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)
):
    get_project_for(db, user, project_id)

    if user.role == Role.customer:
        if body.mode == PaymentMode.cash:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "cash payments are recorded by Sai Constructions")
        if body.corrects_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "only the owner can correct an entry")

    if body.milestone_id:
        m = db.get(Milestone, body.milestone_id)
        if m is None or m.project_id != project_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "milestone is not part of this project")
    if body.proof_file_id:
        f = db.get(StoredFile, body.proof_file_id)
        if f is None or f.project_id != project_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "proof file is not part of this project")

    if body.mode == PaymentMode.cash and not body.acknowledge_cash_limit:
        new_total = money.cash_received_paise(db, project_id) + body.amount_paise
        if new_total >= money.CASH_LIMIT_PAISE:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                {
                    "code": "cash_limit",
                    "cash_received_paise": new_total - body.amount_paise,
                    "new_total_paise": new_total,
                    "limit_paise": money.CASH_LIMIT_PAISE,
                },
            )

    old = None
    if body.corrects_id:
        old = db.get(CustomerPayment, body.corrects_id)
        if old is None or old.project_id != project_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "entry to correct not found")
        if old.status not in (PaymentStatus.unconfirmed, PaymentStatus.disputed):
            raise HTTPException(status.HTTP_409_CONFLICT, "only unconfirmed or disputed entries can be corrected")

    p = CustomerPayment(
        project_id=project_id,
        **body.model_dump(exclude={"acknowledge_cash_limit"}),
        logged_by=user.id,
        logged_by_role=user.role,
    )
    db.add(p)
    db.flush()
    if old is not None:
        before = audit.snapshot(old)
        old.status = PaymentStatus.void
        audit.record(db, user, "void", "customer_payment", old.id, before=before, after=audit.snapshot(old))
    audit.record(db, user, "create", "customer_payment", p.id, after=audit.snapshot(p))
    db.commit()
    return _out(db, user, p)


@router.post("/payments/{payment_id}/confirm", response_model=PaymentOut)
def confirm_payment(payment_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    p = _payment_for(db, user, payment_id)
    if not _is_other_side(user, p):
        raise HTTPException(status.HTTP_409_CONFLICT, "this entry must be confirmed by the other side")
    before = audit.snapshot(p)
    p.status = PaymentStatus.confirmed
    p.confirmed_by = user.id
    p.confirmed_at = datetime.now(UTC)
    p.receipt_no = db.scalar(receipt_no_seq.next_value())
    db.flush()
    money.refresh_milestones(db, p.project_id)
    audit.record(db, user, "confirm", "customer_payment", p.id, before=before, after=audit.snapshot(p))
    db.commit()
    return _out(db, user, p)


@router.post("/payments/{payment_id}/dispute", response_model=PaymentOut)
def dispute_payment(
    payment_id: uuid.UUID, body: DisputeIn, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)
):
    p = _payment_for(db, user, payment_id)
    if not _is_other_side(user, p):
        raise HTTPException(status.HTTP_409_CONFLICT, "only the other side can dispute an unconfirmed entry")
    before = audit.snapshot(p)
    p.status = PaymentStatus.disputed
    p.dispute_reason = body.reason
    audit.record(db, user, "dispute", "customer_payment", p.id, before=before, after=audit.snapshot(p))
    db.commit()
    return _out(db, user, p)


@router.get("/payments/{payment_id}/receipt", response_model=ReceiptOut)
def receipt(payment_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    p = _payment_for(db, user, payment_id)
    if p.status != PaymentStatus.confirmed:
        raise HTTPException(status.HTTP_409_CONFLICT, "receipt is issued after confirmation")
    project = db.get(Project, p.project_id)
    customer = db.get(Customer, project.customer_id)
    m = db.get(Milestone, p.milestone_id) if p.milestone_id else None
    return ReceiptOut(
        receipt_no=p.receipt_no,
        project_name=project.name,
        customer_name=customer.name,
        site_address=project.site_address,
        amount_paise=p.amount_paise,
        mode=p.mode,
        reference=p.reference,
        paid_on=p.paid_on,
        milestone_name=m.name if m else None,
        confirmed_at=p.confirmed_at,
    )
