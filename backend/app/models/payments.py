import enum
import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Enum, ForeignKey, Integer, Sequence, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import Role, created_at_col, uuid_pk

# Receipt numbers are company-wide and gap-free enough for paper trails.
receipt_no_seq = Sequence("receipt_no_seq", start=1, metadata=Base.metadata)


class PaymentMode(str, enum.Enum):
    upi = "upi"
    bank_transfer = "bank_transfer"
    cheque = "cheque"
    cash = "cash"


class PaymentStatus(str, enum.Enum):
    unconfirmed = "unconfirmed"
    confirmed = "confirmed"
    disputed = "disputed"
    void = "void"  # replaced by a correcting entry


class CustomerPayment(Base):
    """Money received from a customer. Amount and details never change after logging;
    only the status moves, and a mistake is fixed by a new entry that points at the old one."""

    __tablename__ = "customer_payments"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("milestones.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    mode: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode, name="payment_mode"))
    reference: Mapped[str | None] = mapped_column(String(120))  # UTR / UPI ref / cheque no
    paid_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    proof_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id"))
    logged_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    logged_by_role: Mapped[Role] = mapped_column(Enum(Role, name="role", create_type=False))
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.unconfirmed
    )
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispute_reason: Mapped[str | None] = mapped_column(Text)
    receipt_no: Mapped[int | None] = mapped_column(Integer, unique=True)
    corrects_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_payments.id"))
    created_at: Mapped[datetime] = created_at_col()
