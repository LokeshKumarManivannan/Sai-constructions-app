import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import created_at_col, uuid_pk


class DocGroup(str, enum.Enum):
    property = "property"
    approvals = "approvals"
    technical = "technical"
    utilities = "utilities"
    contract = "contract"
    internal = "internal"


class Visibility(str, enum.Enum):
    customer = "customer"
    internal = "internal"


class Document(Base):
    """One version of a project document. Uploading again with the same type and title adds a version;
    old versions are kept."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    group: Mapped[DocGroup] = mapped_column(Enum(DocGroup, name="doc_group"))
    doc_type: Mapped[str] = mapped_column(String(40))  # e.g. patta, approved_plan, signed_agreement
    title: Mapped[str] = mapped_column(String(160))
    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("files.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility, name="doc_visibility"), default=Visibility.customer)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = created_at_col()


class HandoverItem(Base):
    __tablename__ = "handover_items"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    item: Mapped[str] = mapped_column(String(160))
    quantity: Mapped[str | None] = mapped_column(String(60))
    note: Mapped[str | None] = mapped_column(Text)
    photo_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id"))
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = created_at_col()


class HandoverSignoff(Base):
    __tablename__ = "handover_signoffs"
    __table_args__ = (UniqueConstraint("project_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    signed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
