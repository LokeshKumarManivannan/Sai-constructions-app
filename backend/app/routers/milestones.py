import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import current_user, require_owner
from app.db import get_db
from app.models import Milestone, MilestoneStatus, ProjectStatus, Role, User
from app.schemas import MilestoneIn, MilestoneOut, MilestoneStatusIn, MilestoneUpdate
from app.services import audit, money
from app.services.access import get_project_for

router = APIRouter(tags=["milestones"])


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role == Role.supervisor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not allowed for this role")
    project = get_project_for(db, user, project_id)
    if user.role == Role.customer and project.status == ProjectStatus.quote:
        return []  # payment schedule opens to the customer after the contract is signed
    return db.scalars(select(Milestone).where(Milestone.project_id == project_id).order_by(Milestone.seq)).all()


@router.post("/projects/{project_id}/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(
    project_id: uuid.UUID, body: MilestoneIn, db: Session = Depends(get_db), user: User = Depends(require_owner)
):
    get_project_for(db, user, project_id)
    next_seq = (db.scalar(select(func.max(Milestone.seq)).where(Milestone.project_id == project_id)) or 0) + 1
    m = Milestone(project_id=project_id, seq=next_seq, **body.model_dump())
    db.add(m)
    db.flush()
    audit.record(db, user, "create", "milestone", m.id, after=audit.snapshot(m))
    db.commit()
    return m


def _milestone_or_404(db: Session, milestone_id: uuid.UUID) -> Milestone:
    m = db.get(Milestone, milestone_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "milestone not found")
    return m


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: uuid.UUID, body: MilestoneUpdate, db: Session = Depends(get_db), user: User = Depends(require_owner)
):
    m = _milestone_or_404(db, milestone_id)
    before = audit.snapshot(m)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None and field in ("name", "amount_due_paise", "seq"):
            continue
        setattr(m, field, value)
    audit.record(db, user, "update", "milestone", m.id, before=before, after=audit.snapshot(m))
    db.commit()
    return m


@router.post("/milestones/{milestone_id}/status", response_model=MilestoneOut)
def set_milestone_status(
    milestone_id: uuid.UUID, body: MilestoneStatusIn, db: Session = Depends(get_db), user: User = Depends(require_owner)
):
    """Owner moves a milestone forward: pending → done (work finished) → payment_due. 'paid' is automatic."""
    m = _milestone_or_404(db, milestone_id)
    allowed = {
        MilestoneStatus.pending: {MilestoneStatus.done, MilestoneStatus.payment_due},
        MilestoneStatus.done: {MilestoneStatus.payment_due, MilestoneStatus.pending},
        MilestoneStatus.payment_due: {MilestoneStatus.done},
    }
    if body.status not in allowed.get(m.status, set()):
        raise HTTPException(status.HTTP_409_CONFLICT, f"cannot move from {m.status.value} to {body.status.value}")
    before = audit.snapshot(m)
    m.status = body.status
    if body.due_date is not None:
        m.due_date = body.due_date
    db.flush()
    money.refresh_milestones(db, m.project_id)
    audit.record(db, user, "update", "milestone", m.id, before=before, after=audit.snapshot(m))
    db.commit()
    return m


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_owner)):
    m = _milestone_or_404(db, milestone_id)
    if m.status != MilestoneStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "only pending milestones can be deleted")
    audit.record(db, user, "delete", "milestone", m.id, before=audit.snapshot(m))
    db.delete(m)
    db.commit()
