"""Which work is going on at a site (civil, electrical, ...): not started / going on / done. Set by the owner."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import current_user, require_owner
from app.db import get_db
from app.models import Trade, TradeState, TradeStatus, User
from app.services import audit
from app.services.access import get_project_for

router = APIRouter(tags=["progress"])
ORDER = [Trade.civil, Trade.plumbing, Trade.electrical, Trade.carpentry, Trade.painting]  # usual build order


class TradeStatusOut(BaseModel):
    trade: Trade
    state: TradeState
    changed_at: datetime | None


class TradeStateIn(BaseModel):
    state: TradeState


def _board(db: Session, project_id: uuid.UUID) -> list[TradeStatusOut]:
    rows = {r.trade: r for r in db.scalars(select(TradeStatus).where(TradeStatus.project_id == project_id))}
    return [
        TradeStatusOut(trade=t, state=rows[t].state if t in rows else TradeState.not_started, changed_at=rows[t].changed_at if t in rows else None)
        for t in ORDER
    ]


@router.get("/projects/{project_id}/trades", response_model=list[TradeStatusOut])
def get_board(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    get_project_for(db, user, project_id)  # owner, this project's customer, or its supervisors
    return _board(db, project_id)


@router.put("/projects/{project_id}/trades/{trade}", response_model=list[TradeStatusOut])
def set_state(project_id: uuid.UUID, trade: Trade, body: TradeStateIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    get_project_for(db, owner, project_id)
    row = db.scalar(select(TradeStatus).where(TradeStatus.project_id == project_id, TradeStatus.trade == trade))
    before = audit.snapshot(row) if row else None
    if row is None:
        row = TradeStatus(project_id=project_id, trade=trade, changed_by=owner.id)
        db.add(row)
    if row.state != body.state or before is None:
        row.state, row.changed_by, row.changed_at = body.state, owner.id, datetime.now(UTC)
        db.flush()
        audit.record(db, owner, "update", "trade_status", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    return _board(db, project_id)
