import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import Trade, created_at_col, uuid_pk


class ProgressUpdate(Base):
    """Photos and a short note from site, tagged with the trade. Never edited."""

    __tablename__ = "progress_updates"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    trade: Mapped[Trade] = mapped_column(Enum(Trade, name="trade", create_type=False))
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("milestones.id"))
    note: Mapped[str] = mapped_column(Text, default="")
    photo_file_ids: Mapped[list] = mapped_column(JSONB, default=list)
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    posted_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = created_at_col()


class TradeState(str, enum.Enum):
    not_started = "not_started"
    ongoing = "ongoing"
    done = "done"


class TradeStatus(Base):
    """Which work is going on at a site: one row per project and trade, set by the owner."""

    __tablename__ = "trade_statuses"
    __table_args__ = (UniqueConstraint("project_id", "trade"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    trade: Mapped[Trade] = mapped_column(Enum(Trade, name="trade", create_type=False))
    state: Mapped[TradeState] = mapped_column(Enum(TradeState, name="trade_state"), default=TradeState.not_started)
    changed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
