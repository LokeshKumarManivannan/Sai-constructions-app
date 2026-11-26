import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.db import get_db
from app.models import Milestone, ProjectStatus, Role, StoredFile, Trade, User
from app.models.progress import ProgressUpdate
from app.schemas.progress import ProgressIn, ProgressOut
from app.services import audit
from app.services.access import get_project_for, supervisor_trades
from app.services.files import signed_url

router = APIRouter(tags=["progress"])


def _out(db: Session, u: ProgressUpdate) -> ProgressOut:
    m = db.get(Milestone, u.milestone_id) if u.milestone_id else None
    by = db.get(User, u.posted_by)
    return ProgressOut.model_validate(u).model_copy(
        update={
            "milestone_name": m.name if m else None,
            "posted_by_name": by.full_name if by else "",
            "photo_urls": [signed_url(uuid.UUID(f)) for f in u.photo_file_ids],
        }
    )


@router.get("/projects/{project_id}/progress", response_model=list[ProgressOut])
def list_progress(
    project_id: uuid.UUID, trade: Trade | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    project = get_project_for(db, user, project_id)
    stmt = select(ProgressUpdate).where(ProgressUpdate.project_id == project_id)
    if user.role == Role.customer and project.status == ProjectStatus.quote:
        return []
    if user.role == Role.supervisor:
        stmt = stmt.where(ProgressUpdate.trade.in_(supervisor_trades(db, user, project_id)))
    if trade is not None:
        stmt = stmt.where(ProgressUpdate.trade == trade)
    rows = db.scalars(stmt.order_by(ProgressUpdate.taken_at.desc())).all()
    return [_out(db, u) for u in rows]


@router.post("/projects/{project_id}/progress", response_model=ProgressOut, status_code=201)
def post_progress(project_id: uuid.UUID, body: ProgressIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    get_project_for(db, user, project_id)
    if user.role == Role.customer:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "customers cannot post progress")
    if user.role == Role.supervisor and body.trade not in supervisor_trades(db, user, project_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "you can only post for your own trade on this site")
    if not body.photo_file_ids and not body.note.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "add a photo or a note")
    for fid in body.photo_file_ids:
        f = db.get(StoredFile, fid)
        if f is None or f.project_id != project_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "photo is not part of this project")
    if body.milestone_id:
        m = db.get(Milestone, body.milestone_id)
        if m is None or m.project_id != project_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "milestone is not part of this project")
    u = ProgressUpdate(
        project_id=project_id,
        trade=body.trade,
        milestone_id=body.milestone_id,
        note=body.note.strip(),
        photo_file_ids=[str(i) for i in body.photo_file_ids],
        lat=body.lat,
        lng=body.lng,
        posted_by=user.id,
    )
    db.add(u)
    db.flush()
    audit.record(db, user, "create", "progress_update", u.id, after=audit.snapshot(u))
    db.commit()
    db.refresh(u)
    return _out(db, u)
