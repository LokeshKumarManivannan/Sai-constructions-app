"""Customer-side money: totals, milestone coverage, cash limit. Only confirmed payments count."""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CustomerPayment, Milestone, MilestoneStatus, PaymentMode, PaymentStatus, Project

# Income Tax Act s.269ST: receiving ₹2,00,000 or more in cash for one transaction is penalised.
CASH_LIMIT_PAISE = 2_00_000 * 100


def approved_extras_paise(db: Session, project_id: uuid.UUID) -> int:
    """Approved extra work (change orders). Filled in by the change-orders feature."""
    from app.services.change_orders import approved_total  # local import: optional feature module

    return approved_total(db, project_id)


def paid_paise(db: Session, project_id: uuid.UUID) -> int:
    return int(db.scalar(
        select(func.coalesce(func.sum(CustomerPayment.amount_paise), 0)).where(
            CustomerPayment.project_id == project_id, CustomerPayment.status == PaymentStatus.confirmed
        )
    ))


def cash_received_paise(db: Session, project_id: uuid.UUID) -> int:
    """Cash logged for the project, confirmed or still awaiting confirmation."""
    return int(db.scalar(
        select(func.coalesce(func.sum(CustomerPayment.amount_paise), 0)).where(
            CustomerPayment.project_id == project_id,
            CustomerPayment.mode == PaymentMode.cash,
            CustomerPayment.status.in_([PaymentStatus.unconfirmed, PaymentStatus.confirmed]),
        )
    ))  # SUM() returns NUMERIC; keep money as int


@dataclass
class NextDue:
    milestone_id: uuid.UUID
    name: str
    amount_paise: int  # still owed for this milestone
    due_date: str | None


def refresh_milestones(db: Session, project_id: uuid.UUID) -> None:
    """Mark milestones paid, in order, as far as confirmed payments cover them."""
    paid = paid_paise(db, project_id)
    covered = 0
    for m in db.scalars(select(Milestone).where(Milestone.project_id == project_id).order_by(Milestone.seq)):
        covered += m.amount_due_paise
        if covered <= paid and m.status == MilestoneStatus.payment_due:
            m.status = MilestoneStatus.paid


def next_due(db: Session, project_id: uuid.UUID) -> NextDue | None:
    paid = paid_paise(db, project_id)
    cumulative = 0
    for m in db.scalars(select(Milestone).where(Milestone.project_id == project_id).order_by(Milestone.seq)):
        cumulative += m.amount_due_paise
        if m.status == MilestoneStatus.payment_due:
            owed = min(m.amount_due_paise, max(cumulative - paid, 0))
            if owed > 0:
                return NextDue(m.id, m.name, owed, m.due_date.isoformat() if m.due_date else None)
    return None


def summary(db: Session, project: Project) -> dict:
    extras = approved_extras_paise(db, project.id)
    total = project.contract_value_paise + extras
    paid = paid_paise(db, project.id)
    awaiting = db.scalar(
        select(func.count()).select_from(CustomerPayment).where(
            CustomerPayment.project_id == project.id, CustomerPayment.status == PaymentStatus.unconfirmed
        )
    )
    nd = next_due(db, project.id)
    return {
        "contract_value_paise": project.contract_value_paise,
        "approved_extras_paise": extras,
        "total_due_paise": total,
        "paid_paise": paid,
        "outstanding_paise": max(total - paid, 0),
        "awaiting_confirmation": awaiting,
        "cash_received_paise": cash_received_paise(db, project.id),
        "cash_limit_paise": CASH_LIMIT_PAISE,
        "next_due": nd.__dict__ if nd else None,
    }
