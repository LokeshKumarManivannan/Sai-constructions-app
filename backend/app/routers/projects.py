import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import current_user, require_owner
from app.db import get_db
from app.models import Customer, Project, Role, User
from app.schemas import ProjectIn, ProjectOut, ProjectSiteOut, ProjectUpdate
from app.services import audit
from app.services.access import get_project_for, supervisor_trades, visible_projects_query

router = APIRouter(prefix="/projects", tags=["projects"])


def _out(db: Session, user: User, p: Project) -> ProjectOut | ProjectSiteOut:
    if user.role == Role.supervisor:
        return ProjectSiteOut(
            id=p.id,
            name=p.name,
            site_address=p.site_address,
            google_maps_url=p.google_maps_url,
            status=p.status,
            my_trades=supervisor_trades(db, user, p.id),
        )
    customer = db.get(Customer, p.customer_id)
    return ProjectOut.model_validate(p).model_copy(update={"customer_name": customer.name if customer else ""})


@router.get("", response_model=list[ProjectOut] | list[ProjectSiteOut])
def list_projects(
    customer_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    stmt = visible_projects_query(user).order_by(Project.created_at.desc())
    if customer_id is not None:
        stmt = stmt.where(Project.customer_id == customer_id)
    return [_out(db, user, p) for p in db.scalars(stmt).all()]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(get_db), user: User = Depends(require_owner)):
    if db.get(Customer, body.customer_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "customer not found")
    p = Project(**body.model_dump(), created_by=user.id)
    db.add(p)
    db.flush()
    audit.record(db, user, "create", "project", p.id, after=audit.snapshot(p))
    db.commit()
    return _out(db, user, p)


@router.get("/{project_id}", response_model=ProjectOut | ProjectSiteOut)
def get_project(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _out(db, user, get_project_for(db, user, project_id))


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID, body: ProjectUpdate, db: Session = Depends(get_db), user: User = Depends(require_owner)
):
    p = get_project_for(db, user, project_id)
    before = audit.snapshot(p)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None and field in ("name", "status", "contract_value_paise", "site_address"):
            continue  # required columns: ignore explicit nulls
        setattr(p, field, value)
    audit.record(db, user, "update", "project", p.id, before=before, after=audit.snapshot(p))
    db.commit()
    return _out(db, user, p)
