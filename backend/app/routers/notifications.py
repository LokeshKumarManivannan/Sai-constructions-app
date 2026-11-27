"""In-app notifications for customers, built from what already exists (no separate table).

`action` items stay until the customer deals with them (payment due, extra work to approve,
payment to check). Other items are news from the last 30 days (photos, documents, payment confirmed);
the app marks them read by remembering when the list was last opened.
"""

from datetime import UTC, datetime, time, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import require_role
from app.db import get_db
from app.models import (
    ChangeOrder,
    ChangeOrderStatus,
    CustomerPayment,
    Document,
    Milestone,
    MilestoneStatus,
    PaymentStatus,
    ProgressUpdate,
    Role,
    User,
    Visibility,
)
from app.services.access import visible_projects_query

router = APIRouter(tags=["notifications"])
NEWS_DAYS = 30


class NotificationOut(BaseModel):
    id: str
    kind: str  # payment_due | extra_work | check_payment | payment_confirmed | photos | document
    action: bool
    project_id: str
    project_name: str
    at: datetime
    amount_paise: int | None = None
    name: str | None = None  # stage / extra work / document title / trade
    due_date: str | None = None


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(db: Session = Depends(get_db), user: User = Depends(require_role(Role.customer))):
    since = datetime.now(UTC) - timedelta(days=NEWS_DAYS)
    out: list[NotificationOut] = []
    for p in db.scalars(visible_projects_query(user)):
        base = {"project_id": str(p.id), "project_name": p.name}

        for m in db.scalars(select(Milestone).where(Milestone.project_id == p.id, Milestone.status == MilestoneStatus.payment_due)):
            at = datetime.combine(m.due_date, time(), UTC) if m.due_date else m.created_at
            out.append(NotificationOut(id=f"due-{m.id}", kind="payment_due", action=True, at=at, amount_paise=m.amount_due_paise,
                                       name=m.name, due_date=m.due_date.isoformat() if m.due_date else None, **base))

        for c in db.scalars(select(ChangeOrder).where(ChangeOrder.project_id == p.id, ChangeOrder.status == ChangeOrderStatus.sent)):
            out.append(NotificationOut(id=f"co-{c.id}", kind="extra_work", action=True, at=c.sent_at or c.created_at,
                                       amount_paise=c.amount_paise, name=c.title, **base))

        for pay in db.scalars(select(CustomerPayment).where(CustomerPayment.project_id == p.id)):
            if pay.status == PaymentStatus.unconfirmed and pay.logged_by_role == Role.owner:
                out.append(NotificationOut(id=f"chk-{pay.id}", kind="check_payment", action=True, at=pay.created_at,
                                           amount_paise=pay.amount_paise, **base))
            elif pay.status == PaymentStatus.confirmed and pay.confirmed_at and pay.confirmed_at >= since and pay.logged_by_role == Role.customer:
                out.append(NotificationOut(id=f"ok-{pay.id}", kind="payment_confirmed", action=False, at=pay.confirmed_at,
                                           amount_paise=pay.amount_paise, **base))

        for u in db.scalars(select(ProgressUpdate).where(ProgressUpdate.project_id == p.id, ProgressUpdate.created_at >= since)):
            out.append(NotificationOut(id=f"pg-{u.id}", kind="photos", action=False, at=u.created_at, name=u.trade.value, **base))

        for d in db.scalars(select(Document).where(Document.project_id == p.id, Document.visibility == Visibility.customer, Document.created_at >= since)):
            out.append(NotificationOut(id=f"doc-{d.id}", kind="document", action=False, at=d.created_at, name=d.title, **base))

    out.sort(key=lambda n: (not n.action, -n.at.timestamp()))
    return out
