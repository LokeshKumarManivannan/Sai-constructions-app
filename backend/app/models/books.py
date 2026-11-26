"""Internal books: money the company pays out. Owner only (supervisors see their own entries)."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import Trade, created_at_col, uuid_pk


class PayeeType(str, enum.Enum):
    labour = "labour"
    supplier = "supplier"
    supervisor = "supervisor"
    other = "other"


class ExpenseCategory(str, enum.Enum):
    labour = "labour"
    material = "material"
    supplier = "supplier"
    transport = "transport"
    equipment = "equipment"
    other = "other"
    advance = "advance"  # petty cash handed to a supervisor; not a project cost until spent


class OutMode(str, enum.Enum):
    bank = "bank"
    upi = "upi"
    cash = "cash"


class ExpenseStatus(str, enum.Enum):
    active = "active"
    void = "void"


class CashTransferKind(str, enum.Enum):
    withdrawal = "withdrawal"  # bank -> cash (ATM): cash in, NOT an expense
    deposit = "deposit"  # cash -> bank: cash out
    adjustment = "adjustment"  # opening balance or count correction (signed amount)


class Payee(Base):
    __tablename__ = "payees"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    type: Mapped[PayeeType] = mapped_column(Enum(PayeeType, name="payee_type"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))  # set for supervisors
    default_project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"))
    default_category: Mapped[ExpenseCategory | None] = mapped_column(Enum(ExpenseCategory, name="expense_category"))
    created_at: Mapped[datetime] = created_at_col()


class Expense(Base):
    """A payment out. Amount, mode, payee and date never change; tagging fields (project, category,
    reason, bill) can be filled in later. A wrong amount is voided and re-entered."""

    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    payee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payees.id"), index=True)
    category: Mapped[ExpenseCategory | None] = mapped_column(Enum(ExpenseCategory, name="expense_category", create_type=False))
    trade: Mapped[Trade | None] = mapped_column(Enum(Trade, name="trade", create_type=False))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    mode: Mapped[OutMode] = mapped_column(Enum(OutMode, name="out_mode"))
    bank_txn_id: Mapped[str | None] = mapped_column(String(120))
    reason: Mapped[str | None] = mapped_column(Text)
    bill_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id"))
    paid_on: Mapped[date] = mapped_column(Date)
    # Spent by a supervisor out of petty cash they were advanced (not from the owner's cash/bank).
    spent_from_advance_of: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    recipient_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[ExpenseStatus] = mapped_column(Enum(ExpenseStatus, name="expense_status"), default=ExpenseStatus.active)
    corrects_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("expenses.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = created_at_col()


class CashTransfer(Base):
    __tablename__ = "cash_transfers"

    id: Mapped[uuid.UUID] = uuid_pk()
    kind: Mapped[CashTransferKind] = mapped_column(Enum(CashTransferKind, name="cash_transfer_kind"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)  # adjustment may be negative
    on_date: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = created_at_col()
