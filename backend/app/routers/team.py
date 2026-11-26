import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_owner
from app.auth.phone import InvalidPhone, normalize_phone
from app.db import get_db
from app.models import Role, SupervisorAssignment, User
from app.schemas import AssignmentIn, AssignmentOut, SupervisorIn, UserOut
from app.services import audit
from app.services.access import get_project_for

router = APIRouter(tags=["team"])


@router.get("/supervisors", response_model=list[UserOut])
def list_supervisors(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    return db.scalars(select(User).where(User.role == Role.supervisor).order_by(User.full_name)).all()


@router.post("/supervisors", response_model=UserOut, status_code=201)
def create_supervisor(body: SupervisorIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    try:
        phone = normalize_phone(body.phone)
    except InvalidPhone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid phone number") from None
    if db.scalar(select(User).where(User.phone == phone)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "a user with this phone already exists")
    u = User(phone=phone, full_name=body.full_name, role=Role.supervisor)
    db.add(u)
    db.flush()
    audit.record(db, owner, "create", "user", u.id, after=audit.snapshot(u))
    db.commit()
    return u


def _assignment_out(db: Session, a: SupervisorAssignment) -> AssignmentOut:
    u = db.get(User, a.user_id)
    return AssignmentOut.model_validate(a).model_copy(update={"user_name": u.full_name, "user_phone": u.phone})


@router.get("/projects/{project_id}/assignments", response_model=list[AssignmentOut])
def list_assignments(project_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    get_project_for(db, owner, project_id)
    rows = db.scalars(
        select(SupervisorAssignment)
        .where(SupervisorAssignment.project_id == project_id, SupervisorAssignment.active.is_(True))
        .order_by(SupervisorAssignment.trade)
    ).all()
    return [_assignment_out(db, a) for a in rows]


@router.post("/projects/{project_id}/assignments", response_model=AssignmentOut, status_code=201)
def assign_supervisor(
    project_id: uuid.UUID, body: AssignmentIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)
):
    get_project_for(db, owner, project_id)
    sup = db.get(User, body.user_id)
    if sup is None or sup.role != Role.supervisor:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "user is not a supervisor")
    a = db.scalar(
        select(SupervisorAssignment).where(
            SupervisorAssignment.project_id == project_id,
            SupervisorAssignment.user_id == body.user_id,
            SupervisorAssignment.trade == body.trade,
        )
    )
    if a is None:
        a = SupervisorAssignment(project_id=project_id, user_id=body.user_id, trade=body.trade)
        db.add(a)
    else:
        a.active = True
    db.flush()
    audit.record(db, owner, "create", "assignment", a.id, after=audit.snapshot(a))
    db.commit()
    return _assignment_out(db, a)


@router.delete("/assignments/{assignment_id}", status_code=204)
def remove_assignment(assignment_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    a = db.get(SupervisorAssignment, assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "assignment not found")
    before = audit.snapshot(a)
    a.active = False  # kept for history
    audit.record(db, owner, "update", "assignment", a.id, before=before, after=audit.snapshot(a))
    db.commit()
