import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_owner, require_role
from app.db import get_db
from app.models import Role, StoredFile, User
from app.models.change_orders import ChangeOrder, ChangeOrderStatus as S
from app.schemas.change_orders import ChangeOrderIn, ChangeOrderOut, ChangeOrderUpdate, RejectIn
from app.services import audit
from app.services.access import get_project_for
from app.services.files import signed_url

router = APIRouter(tags=["change orders"])
owner_or_customer = require_role(Role.owner, Role.customer)


def _out(db: Session, co: ChangeOrder) -> ChangeOrderOut:
    decider = db.get(User, co.decided_by) if co.decided_by else None
    return ChangeOrderOut.model_validate(co).model_copy(
        update={
            "photo_urls": [signed_url(uuid.UUID(f)) for f in co.photo_file_ids],
            "decided_by_name": decider.full_name if decider else None,
        }
    )


def _check_files(db: Session, project_id: uuid.UUID, ids: list[uuid.UUID]) -> list[str]:
    for fid in ids:
        f = db.get(StoredFile, fid)
        if f is None or f.project_id != project_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "photo is not part of this project")
    return [str(i) for i in ids]


def _get(db: Session, user: User, co_id: uuid.UUID) -> ChangeOrder:
    co = db.get(ChangeOrder, co_id)
    if co is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "change order not found")
    get_project_for(db, user, co.project_id)
    if user.role == Role.customer and co.status == S.draft:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "change order not found")
    return co


def _move(db: Session, user: User, co: ChangeOrder, frm: tuple[S, ...], to: S, **fields) -> ChangeOrderOut:
    if co.status not in frm:
        raise HTTPException(status.HTTP_409_CONFLICT, f"cannot move from {co.status.value} to {to.value}")
    before = audit.snapshot(co)
    co.status = to
    for k, v in fields.items():
        setattr(co, k, v)
    audit.record(db, user, to.value, "change_order", co.id, before=before, after=audit.snapshot(co))
    db.commit()
    return _out(db, co)


@router.get("/projects/{project_id}/change-orders", response_model=list[ChangeOrderOut])
def list_change_orders(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    get_project_for(db, user, project_id)
    stmt = select(ChangeOrder).where(ChangeOrder.project_id == project_id).order_by(ChangeOrder.created_at.desc())
    if user.role == Role.customer:
        stmt = stmt.where(ChangeOrder.status != S.draft)
    return [_out(db, co) for co in db.scalars(stmt).all()]


@router.post("/projects/{project_id}/change-orders", response_model=ChangeOrderOut, status_code=201)
def create_change_order(
    project_id: uuid.UUID, body: ChangeOrderIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)
):
    get_project_for(db, owner, project_id)
    data = body.model_dump()
    data["photo_file_ids"] = _check_files(db, project_id, body.photo_file_ids)
    co = ChangeOrder(project_id=project_id, created_by=owner.id, **data)
    db.add(co)
    db.flush()
    audit.record(db, owner, "create", "change_order", co.id, after=audit.snapshot(co))
    db.commit()
    return _out(db, co)


@router.patch("/change-orders/{co_id}", response_model=ChangeOrderOut)
def update_draft(co_id: uuid.UUID, body: ChangeOrderUpdate, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    co = _get(db, owner, co_id)
    if co.status != S.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "only a draft can be edited; revise it instead")
    before = audit.snapshot(co)
    data = body.model_dump(exclude_unset=True)
    if data.get("photo_file_ids") is not None:
        data["photo_file_ids"] = _check_files(db, co.project_id, body.photo_file_ids)
    for k, v in data.items():
        if v is not None or k == "trade":
            setattr(co, k, v)
    audit.record(db, owner, "update", "change_order", co.id, before=before, after=audit.snapshot(co))
    db.commit()
    return _out(db, co)


@router.delete("/change-orders/{co_id}", status_code=204)
def delete_draft(co_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    co = _get(db, owner, co_id)
    if co.status != S.draft:
        raise HTTPException(status.HTTP_409_CONFLICT, "only a draft can be deleted")
    audit.record(db, owner, "delete", "change_order", co.id, before=audit.snapshot(co))
    db.delete(co)
    db.commit()


@router.post("/change-orders/{co_id}/send", response_model=ChangeOrderOut)
def send(co_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    return _move(db, owner, _get(db, owner, co_id), (S.draft,), S.sent, sent_at=datetime.now(UTC))


@router.post("/change-orders/{co_id}/approve", response_model=ChangeOrderOut)
def approve(co_id: uuid.UUID, db: Session = Depends(get_db), customer: User = Depends(require_role(Role.customer))):
    co = _get(db, customer, co_id)
    return _move(db, customer, co, (S.sent,), S.approved, decided_by=customer.id, decided_at=datetime.now(UTC))


@router.post("/change-orders/{co_id}/reject", response_model=ChangeOrderOut)
def reject(
    co_id: uuid.UUID, body: RejectIn, db: Session = Depends(get_db), customer: User = Depends(require_role(Role.customer))
):
    co = _get(db, customer, co_id)
    return _move(
        db, customer, co, (S.sent,), S.rejected,
        decided_by=customer.id, decided_at=datetime.now(UTC), reject_reason=body.reason,
    )


@router.post("/change-orders/{co_id}/start", response_model=ChangeOrderOut)
def start(co_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    return _move(db, owner, _get(db, owner, co_id), (S.approved,), S.in_progress)


@router.post("/change-orders/{co_id}/complete", response_model=ChangeOrderOut)
def complete(co_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    return _move(db, owner, _get(db, owner, co_id), (S.approved, S.in_progress), S.done)


@router.post("/change-orders/{co_id}/revise", response_model=ChangeOrderOut, status_code=201)
def revise(co_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    """Copy a rejected change order into a new draft (version + 1) for the owner to adjust and resend."""
    old = _get(db, owner, co_id)
    if old.status != S.rejected:
        raise HTTPException(status.HTTP_409_CONFLICT, "only a rejected change order can be revised")
    co = ChangeOrder(
        project_id=old.project_id,
        trade=old.trade,
        title=old.title,
        description=old.description,
        amount_paise=old.amount_paise,
        photo_file_ids=list(old.photo_file_ids),
        version=old.version + 1,
        revises_id=old.id,
        created_by=owner.id,
    )
    db.add(co)
    db.flush()
    audit.record(db, owner, "create", "change_order", co.id, after=audit.snapshot(co))
    db.commit()
    return _out(db, co)
