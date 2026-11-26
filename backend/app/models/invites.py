import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import created_at_col, uuid_pk


class InviteStatus(str, enum.Enum):
    sent = "sent"
    accepted = "accepted"
    revoked = "revoked"


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[InviteStatus] = mapped_column(Enum(InviteStatus, name="invite_status"), default=InviteStatus.sent)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = created_at_col()
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
