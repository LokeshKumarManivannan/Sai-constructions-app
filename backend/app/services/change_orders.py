import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.change_orders import COUNTED, ChangeOrder


def approved_total(db: Session, project_id: uuid.UUID) -> int:
    """Sum of change orders the customer approved (including ones in progress or done)."""
    return int(
        db.scalar(
            select(func.coalesce(func.sum(ChangeOrder.amount_paise), 0)).where(
                ChangeOrder.project_id == project_id, ChangeOrder.status.in_(COUNTED)
            )
        )
    )
