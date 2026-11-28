"""Internal books calculations: tagging, cash book, supervisor petty cash, per-site profit."""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    CashTransfer,
    CashTransferKind,
    CustomerPayment,
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    OutMode,
    Payee,
    PaymentMode,
    PaymentStatus,
    Project,
)


def is_tagged(e: Expense) -> bool:
    """Complete enough for the books: has a category, a reason, proof, and a site (advances may be general).
    Proof is a bill/voucher photo; for petty cash handed to a supervisor, the supervisor tapping
    "Yes, I received this" is the proof (there is no bill for handing over cash)."""
    if e.category == ExpenseCategory.advance:
        return bool(e.reason and e.reason.strip() and (e.bill_file_id or e.recipient_confirmed_at))
    return bool(e.category and e.reason and e.reason.strip() and e.bill_file_id and e.project_id)


@dataclass
class CashEntry:
    on_date: date
    direction: str  # in / out
    amount_paise: int
    label: str
    kind: str  # customer_cash / expense / withdrawal / deposit / adjustment
    ref_id: uuid.UUID
    balance_paise: int = 0


def cash_book(db: Session) -> list[CashEntry]:
    entries: list[tuple[date, int, CashEntry]] = []  # (date, tie-breaker, entry)

    for p, proj in db.execute(
        select(CustomerPayment, Project)
        .join(Project, Project.id == CustomerPayment.project_id)
        .where(
            CustomerPayment.mode == PaymentMode.cash,
            CustomerPayment.status.in_([PaymentStatus.unconfirmed, PaymentStatus.confirmed]),
        )
    ):
        entries.append((p.paid_on, 0, CashEntry(p.paid_on, "in", p.amount_paise, proj.name, "customer_cash", p.id)))

    for e, payee in db.execute(
        select(Expense, Payee)
        .join(Payee, Payee.id == Expense.payee_id)
        .where(
            Expense.mode == OutMode.cash,
            Expense.status == ExpenseStatus.active,
            Expense.spent_from_advance_of.is_(None),  # supervisor spends come from their advance, not this box
        )
    ):
        entries.append((e.paid_on, 1, CashEntry(e.paid_on, "out", e.amount_paise, payee.name, "expense", e.id)))

    for t in db.scalars(select(CashTransfer)):
        if t.kind == CashTransferKind.adjustment:
            direction, amount = ("in", t.amount_paise) if t.amount_paise >= 0 else ("out", -t.amount_paise)
        else:
            direction, amount = ("in", t.amount_paise) if t.kind == CashTransferKind.withdrawal else ("out", t.amount_paise)
        entries.append((t.on_date, 0, CashEntry(t.on_date, direction, amount, t.note or t.kind.value, t.kind.value, t.id)))

    entries.sort(key=lambda x: (x[0], x[1]))
    balance = 0
    out = []
    for _, _, ce in entries:
        balance += ce.amount_paise if ce.direction == "in" else -ce.amount_paise
        ce.balance_paise = balance
        out.append(ce)
    return out


def advance_balance(db: Session, supervisor_user_id: uuid.UUID) -> dict:
    given = db.scalar(
        select(func.coalesce(func.sum(Expense.amount_paise), 0))
        .join(Payee, Payee.id == Expense.payee_id)
        .where(
            Payee.user_id == supervisor_user_id,
            Expense.category == ExpenseCategory.advance,
            Expense.status == ExpenseStatus.active,
        )
    )
    spent = db.scalar(
        select(func.coalesce(func.sum(Expense.amount_paise), 0)).where(
            Expense.spent_from_advance_of == supervisor_user_id, Expense.status == ExpenseStatus.active
        )
    )
    return {"given_paise": int(given), "spent_paise": int(spent), "holding_paise": int(given) - int(spent)}


def site_ledger(db: Session) -> list[dict]:
    received = dict(
        db.execute(
            select(CustomerPayment.project_id, func.sum(CustomerPayment.amount_paise))
            .where(CustomerPayment.status == PaymentStatus.confirmed)
            .group_by(CustomerPayment.project_id)
        ).all()
    )
    spent = dict(
        db.execute(
            select(Expense.project_id, func.sum(Expense.amount_paise))
            .where(
                Expense.status == ExpenseStatus.active,
                Expense.project_id.is_not(None),
                Expense.category.is_distinct_from(ExpenseCategory.advance),
            )
            .group_by(Expense.project_id)
        ).all()
    )
    from app.services.change_orders import approved_total

    rows = []
    for p in db.scalars(select(Project).order_by(Project.created_at.desc())):
        r, s = int(received.get(p.id, 0)), int(spent.get(p.id, 0))
        extras = approved_total(db, p.id)
        rows.append(
            {
                "project_id": p.id,
                "project_name": p.name,
                "received_paise": r,
                "spent_paise": s,
                "net_paise": r - s,
                "contract_paise": p.contract_value_paise,
                "extras_paise": extras,
                # what the job should leave once everything is collected, if no more is spent
                "expected_margin_paise": p.contract_value_paise + extras - s,
            }
        )
    return rows


def month_totals(db: Session, today: date) -> tuple[int, int]:
    """Confirmed money received and money paid out (site costs and general, not advances) this calendar month."""
    start = today.replace(day=1)
    received = db.scalar(
        select(func.coalesce(func.sum(CustomerPayment.amount_paise), 0)).where(
            CustomerPayment.status == PaymentStatus.confirmed, CustomerPayment.paid_on >= start, CustomerPayment.paid_on <= today
        )
    )
    spent = db.scalar(
        select(func.coalesce(func.sum(Expense.amount_paise), 0)).where(
            Expense.status == ExpenseStatus.active,
            Expense.category.is_distinct_from(ExpenseCategory.advance),
            Expense.paid_on >= start,
            Expense.paid_on <= today,
        )
    )
    return int(received), int(spent)


def to_collect(db: Session) -> int:
    """What customers still owe across all signed projects."""
    from app.models import ProjectStatus
    from app.services import money

    total = 0
    for p in db.scalars(select(Project).where(Project.status != ProjectStatus.quote)):
        total += money.summary(db, p)["outstanding_paise"]
    return total
