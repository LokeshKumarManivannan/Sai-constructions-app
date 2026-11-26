import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class Role(str, enum.Enum):
    owner = "owner"
    supervisor = "supervisor"
    customer = "customer"


class Language(str, enum.Enum):
    en = "en"
    ta = "ta"


class Trade(str, enum.Enum):
    civil = "civil"
    painting = "painting"
    carpentry = "carpentry"
    plumbing = "plumbing"
    electrical = "electrical"


class ProjectStatus(str, enum.Enum):
    quote = "quote"
    contract_signed = "contract_signed"
    in_progress = "in_progress"
    handed_over = "handed_over"
    closed = "closed"


class MilestoneStatus(str, enum.Enum):
    pending = "pending"
    done = "done"
    payment_due = "payment_due"
    paid = "paid"


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def created_at_col() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
