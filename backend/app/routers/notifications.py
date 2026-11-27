"""In-app notifications for customers and the owner, built from what already exists (no separate table).

`action` items stay until someone deals with them. Other items are news from the last 30 days;
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
    Expense,
    ExpenseStatus,
    Document,
    Milestone,
    MilestoneStatus,
    PaymentStatus,
    ProgressUpdate,
    Role,
    User,
    Visibility,
)
from app.services import books
from app.services.access import visible_projects_query
from app.services.time import today_ist

router = APIRouter(tags=["notifications"])
NEWS_DAYS = 30


class NotificationOut(BaseModel):
    id: str
    # customer: payment_due | extra_work | check_payment | payment_confirmed | photos | document
    # owner: confirm_payment | disputed | overdue | untagged | extra_decided | photos | supervisor_spent
    #        | bank_to_explain | bank_statement_due | bank_gap
    kind: str
    action: bool
    project_id: str | None = None
    project_name: str | None = None
    at: datetime
    amount_paise: int | None = None
    name: str | None = None  # stage / extra work / document title / trade
    due_date: str | None = None
    status: str | None = None  # extra_decided: approved | rejected
    by: str | None = None  # who did it (owner view)
    count: int | None = None  # untagged


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(db: Session = Depends(get_db), user: User = Depends(require_role(Role.customer, Role.owner))):
    since = datetime.now(UTC) - timedelta(days=NEWS_DAYS)
    out = _owner(db, user, since) if user.role == Role.owner else _customer(db, user, since)
    out.sort(key=lambda n: (not n.action, -n.at.timestamp()))
    return out



def _customer(db: Session, user: User, since: datetime) -> list[NotificationOut]:
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

    return out


def _owner(db: Session, user: User, since: datetime) -> list[NotificationOut]:
    out: list[NotificationOut] = []
    today = today_ist()
    names: dict = {}

    def who(uid) -> str:
        if uid not in names:
            u = db.get(User, uid)
            names[uid] = u.full_name if u else ""
        return names[uid]

    for p in db.scalars(visible_projects_query(user)):
        base = {"project_id": str(p.id), "project_name": p.name}

        for pay in db.scalars(select(CustomerPayment).where(CustomerPayment.project_id == p.id)):
            if pay.status == PaymentStatus.unconfirmed and pay.logged_by_role == Role.customer:
                out.append(NotificationOut(id=f"cf-{pay.id}", kind="confirm_payment", action=True, at=pay.created_at,
                                           amount_paise=pay.amount_paise, by=who(pay.logged_by), **base))
            elif pay.status == PaymentStatus.disputed:
                out.append(NotificationOut(id=f"dp-{pay.id}", kind="disputed", action=True, at=pay.created_at,
                                           amount_paise=pay.amount_paise, **base))

        for m in db.scalars(select(Milestone).where(Milestone.project_id == p.id, Milestone.status == MilestoneStatus.payment_due,
                                                    Milestone.due_date < today)):
            out.append(NotificationOut(id=f"od-{m.id}", kind="overdue", action=True, at=datetime.combine(m.due_date, time(), UTC),
                                       amount_paise=m.amount_due_paise, name=m.name, due_date=m.due_date.isoformat(), **base))

        for c in db.scalars(select(ChangeOrder).where(ChangeOrder.project_id == p.id, ChangeOrder.decided_at >= since,
                                                      ChangeOrder.status.in_([ChangeOrderStatus.approved, ChangeOrderStatus.rejected]))):
            out.append(NotificationOut(id=f"cd-{c.id}", kind="extra_decided", action=False, at=c.decided_at, amount_paise=c.amount_paise,
                                       name=c.title, status=c.status.value, **base))

        for u in db.scalars(select(ProgressUpdate).where(ProgressUpdate.project_id == p.id, ProgressUpdate.created_at >= since,
                                                         ProgressUpdate.posted_by != user.id)):
            out.append(NotificationOut(id=f"pg-{u.id}", kind="photos", action=False, at=u.created_at, name=u.trade.value,
                                       by=who(u.posted_by), **base))

        for e in db.scalars(select(Expense).where(Expense.project_id == p.id, Expense.status == ExpenseStatus.active,
                                                  Expense.spent_from_advance_of.is_not(None), Expense.created_at >= since)):
            out.append(NotificationOut(id=f"sp-{e.id}", kind="supervisor_spent", action=False, at=e.created_at,
                                       amount_paise=e.amount_paise, name=e.reason, by=who(e.created_by), **base))

    active = list(db.scalars(select(Expense).where(Expense.status == ExpenseStatus.active)))
    missing = [e for e in active if not books.is_tagged(e)]
    if missing:
        out.append(NotificationOut(id="untagged", kind="untagged", action=True, at=max(e.created_at for e in missing), count=len(missing)))

    from app.routers.bank import bank_summary  # local import: bank router imports books/payments routers

    b = bank_summary(db)
    now = datetime.now(UTC)
    if b.to_explain:
        out.append(NotificationOut(id="bank", kind="bank_to_explain", action=True, at=now, count=b.to_explain))
    for i, (before, after) in enumerate(b.gaps):
        out.append(NotificationOut(id=f"bank-gap-{i}", kind="bank_gap", action=True, at=now,
                                   name=before.isoformat(), due_date=after.isoformat()))
    if b.statement_due:
        out.append(NotificationOut(id="bank-stmt", kind="bank_statement_due", action=True, at=now,
                                   due_date=b.last_statement_date.isoformat() if b.last_statement_date else None))
    return out
