"""Bank inbox: every line from the bank (statement upload now, SMS later), so nothing goes unexplained."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import created_at_col, uuid_pk


class BankDirection(str, enum.Enum):
    debit = "debit"  # money out of the account
    credit = "credit"  # money into the account


class BankSource(str, enum.Enum):
    statement = "statement"
    sms = "sms"


class BankTxnStatus(str, enum.Enum):
    to_explain = "to_explain"
    done = "done"  # linked to a Money paid / Money received / cash entry
    personal = "personal"  # not business; kept out of the books


class BankTxn(Base):
    __tablename__ = "bank_txns"

    id: Mapped[uuid.UUID] = uuid_pk()
    txn_date: Mapped[date] = mapped_column(Date, index=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    direction: Mapped[BankDirection] = mapped_column(Enum(BankDirection, name="bank_direction"))
    narration: Mapped[str] = mapped_column(Text, default="")
    ref: Mapped[str | None] = mapped_column(String(64))  # UPI RRN / IMPS / NEFT UTR / cheque no.
    counterparty: Mapped[str | None] = mapped_column(String(160))  # name or UPI ID read from the narration
    counterparty_key: Mapped[str | None] = mapped_column(String(160), index=True)  # normalised, for payee memory
    balance_paise: Mapped[int | None] = mapped_column(BigInteger)
    source: Mapped[BankSource] = mapped_column(Enum(BankSource, name="bank_source"))
    dedup_key: Mapped[str] = mapped_column(String(128), unique=True)
    status: Mapped[BankTxnStatus] = mapped_column(Enum(BankTxnStatus, name="bank_txn_status"), default=BankTxnStatus.to_explain, index=True)
    expense_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("expenses.id"))
    payment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_payments.id"))
    cash_transfer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cash_transfers.id"))
    auto_matched: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()
