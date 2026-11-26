import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import CashTransferKind, ExpenseCategory, ExpenseStatus, OutMode, PayeeType, Trade


class PayeeIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = None
    type: PayeeType


class PayeeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = None
    type: PayeeType | None = None


class PayeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str | None
    type: PayeeType
    user_id: uuid.UUID | None
    default_project_id: uuid.UUID | None
    default_category: ExpenseCategory | None
    total_paid_paise: int = 0


class ExpenseIn(BaseModel):
    payee_id: uuid.UUID
    amount_paise: int = Field(gt=0)
    mode: OutMode
    paid_on: date
    bank_txn_id: str | None = Field(default=None, max_length=120)
    project_id: uuid.UUID | None = None
    category: ExpenseCategory | None = None
    trade: Trade | None = None
    reason: str | None = None
    bill_file_id: uuid.UUID | None = None
    corrects_id: uuid.UUID | None = None


class ExpenseTag(BaseModel):
    """Fields that may be filled in after the payment was recorded."""

    project_id: uuid.UUID | None = None
    category: ExpenseCategory | None = None
    trade: Trade | None = None
    reason: str | None = None
    bill_file_id: uuid.UUID | None = None


class SpendIn(BaseModel):
    """A supervisor paying someone out of the petty cash advanced to them."""

    project_id: uuid.UUID
    paid_to: str = Field(min_length=1, max_length=120)
    amount_paise: int = Field(gt=0)
    category: ExpenseCategory = ExpenseCategory.labour
    reason: str = Field(min_length=1)
    bill_file_id: uuid.UUID | None = None
    paid_on: date


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID | None
    project_name: str | None = None
    payee_id: uuid.UUID
    payee_name: str = ""
    payee_type: PayeeType | None = None
    category: ExpenseCategory | None
    trade: Trade | None
    amount_paise: int
    mode: OutMode
    bank_txn_id: str | None
    reason: str | None
    bill_url: str | None = None
    paid_on: date
    spent_from_advance_of: uuid.UUID | None
    recipient_confirmed_at: datetime | None
    status: ExpenseStatus
    corrects_id: uuid.UUID | None
    tagged: bool = False
    created_at: datetime


class CashTransferIn(BaseModel):
    kind: CashTransferKind
    amount_paise: int  # positive; adjustment may be negative
    on_date: date
    note: str | None = None


class CashEntryOut(BaseModel):
    on_date: date
    direction: str
    amount_paise: int
    label: str
    kind: str
    ref_id: uuid.UUID
    balance_paise: int


class CashBookOut(BaseModel):
    balance_paise: int
    entries: list[CashEntryOut]


class SiteLedgerRow(BaseModel):
    project_id: uuid.UUID
    project_name: str
    received_paise: int
    spent_paise: int
    net_paise: int
    contract_paise: int
    extras_paise: int
    expected_margin_paise: int


class BooksSummaryOut(BaseModel):
    sites: list[SiteLedgerRow]
    received_paise: int
    spent_paise: int
    cash_in_hand_paise: int
    untagged_count: int
    received_month_paise: int
    spent_month_paise: int
    to_collect_paise: int


class AdvanceOut(BaseModel):
    given_paise: int
    spent_paise: int
    holding_paise: int


class MyMoneyOut(BaseModel):
    received: list[ExpenseOut]
    advance: AdvanceOut
    my_spends: list[ExpenseOut]
