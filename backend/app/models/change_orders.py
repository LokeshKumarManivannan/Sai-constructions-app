import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import Trade, created_at_col, uuid_pk


class ChangeOrderStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    done = "done"


# Statuses whose amount counts towards what the customer owes.
COUNTED = (ChangeOrderStatus.approved, ChangeOrderStatus.in_progress, ChangeOrderStatus.done)


class ChangeOrder(Base):
    """Extra work beyond the contract. Only an approved one adds to the total due.
    Once sent, its title, description and amount never change; a rejected one is revised as a new version."""

    __tablename__ = "change_orders"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    trade: Mapped[Trade | None] = mapped_column(Enum(Trade, name="trade", create_type=False))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    photo_file_ids: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[ChangeOrderStatus] = mapped_column(
        Enum(ChangeOrderStatus, name="change_order_status"), default=ChangeOrderStatus.draft
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    revises_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("change_orders.id"))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reject_reason: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = created_at_col()
