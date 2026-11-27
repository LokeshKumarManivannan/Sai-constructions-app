import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models import BankDirection, BankSource, BankTxnStatus, ExpenseCategory, PayeeType, Trade


class ImportOut(BaseModel):
    rows: int
    added: int
    duplicates: int
    matched: int
    to_explain: int
    first_date: date | None
    last_date: date | None
    verified: bool  # every line proved by the bank's running balance


class SuggestionOut(BaseModel):
    kind: str  # expense | receipt | cash
    payee_id: uuid.UUID | None = None
    payee_name: str | None = None
    project_id: uuid.UUID | None = None
    project_name: str | None = None
    category: str | None = None
    milestone_id: uuid.UUID | None = None
    why: str | None = None


class LinkedOut(BaseModel):
    kind: str  # expense | payment | cash
    id: uuid.UUID
    label: str  # e.g. "Ramesh mason · Ravi house"


class BankTxnOut(BaseModel):
    id: uuid.UUID
    txn_date: date
    amount_paise: int
    direction: BankDirection
    narration: str
    raw_line: str
    balance_paise: int | None
    verified: bool
    ref: str | None
    counterparty: str | None
    source: BankSource
    status: BankTxnStatus
    auto_matched: bool
    linked: LinkedOut | None = None
    suggestion: SuggestionOut | None = None
    reviewed_at: datetime | None


class BankSummaryOut(BaseModel):
    to_explain: int
    month_total: int
    month_explained: int
    last_statement_date: date | None
    statement_due: bool  # last month's statement not uploaded yet
    gaps: list[tuple[date, date]]  # balance jumps between uploads: a statement period is missing


class NewPayeeIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: PayeeType = PayeeType.labour


class ExplainExpenseIn(BaseModel):
    payee_id: uuid.UUID | None = None
    new_payee: NewPayeeIn | None = None
    project_id: uuid.UUID | None = None  # None = General (office, vehicle, tools)
    category: ExpenseCategory
    trade: Trade | None = None
    reason: str | None = None
    bill_file_id: uuid.UUID | None = None


class ExplainReceiptIn(BaseModel):
    project_id: uuid.UUID
    milestone_id: uuid.UUID | None = None


class LinkIn(BaseModel):
    expense_id: uuid.UUID | None = None
    payment_id: uuid.UUID | None = None
