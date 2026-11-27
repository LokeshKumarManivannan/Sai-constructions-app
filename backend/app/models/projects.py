import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import MilestoneStatus, ProjectStatus, Trade, created_at_col, uuid_pk


class Customer(Base):
    """The company's record of a client. Login accounts are linked per project via ProjectCustomer."""

    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    alt_phone: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = uuid_pk()
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    # Short code typed in UPI remarks (e.g. "TAM cement") so bank lines file themselves under this site.
    site_code: Mapped[str | None] = mapped_column(String(12), unique=True)
    site_address: Mapped[str] = mapped_column(Text, default="")
    google_maps_url: Mapped[str | None] = mapped_column(Text)
    plot_size: Mapped[str | None] = mapped_column(String(60))
    floors: Mapped[str | None] = mapped_column(String(60))
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status"), default=ProjectStatus.quote
    )
    contract_value_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    start_date: Mapped[date | None] = mapped_column(Date)
    target_end_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = created_at_col()
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class ProjectCustomer(Base):
    """A customer login account with access to a project (several per project allowed)."""

    __tablename__ = "project_customers"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = created_at_col()


class SupervisorAssignment(Base):
    __tablename__ = "supervisor_assignments"
    __table_args__ = (UniqueConstraint("project_id", "user_id", "trade"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    trade: Mapped[Trade] = mapped_column(Enum(Trade, name="trade"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = created_at_col()


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(120))
    amount_due_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus, name="milestone_status"), default=MilestoneStatus.pending
    )
    created_at: Mapped[datetime] = created_at_col()
