import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import PaymentMode, PaymentStatus, Role


class PaymentIn(BaseModel):
    amount_paise: int = Field(gt=0)
    mode: PaymentMode
    paid_on: date
    reference: str | None = Field(default=None, max_length=120)
    note: str | None = None
    milestone_id: uuid.UUID | None = None
    proof_file_id: uuid.UUID | None = None
    corrects_id: uuid.UUID | None = None  # owner only: replaces a disputed/unconfirmed entry
    acknowledge_cash_limit: bool = False


class DisputeIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    milestone_id: uuid.UUID | None
    milestone_name: str | None = None
    amount_paise: int
    mode: PaymentMode
    reference: str | None
    paid_on: date
    note: str | None
    proof_url: str | None = None
    logged_by_role: Role
    logged_by_name: str = ""
    status: PaymentStatus
    confirmed_at: datetime | None
    dispute_reason: str | None
    receipt_no: int | None
    corrects_id: uuid.UUID | None
    created_at: datetime
    can_confirm: bool = False  # true when the viewer is the other side of an unconfirmed entry


class NextDueOut(BaseModel):
    milestone_id: uuid.UUID
    name: str
    amount_paise: int
    due_date: str | None


class SummaryOut(BaseModel):
    contract_value_paise: int
    approved_extras_paise: int
    total_due_paise: int
    paid_paise: int
    outstanding_paise: int
    awaiting_confirmation: int
    cash_received_paise: int
    cash_limit_paise: int
    next_due: NextDueOut | None


class ReceiptOut(BaseModel):
    company: str = "Sai Constructions"
    receipt_no: int
    project_name: str
    customer_name: str
    site_address: str
    amount_paise: int
    mode: PaymentMode
    reference: str | None
    paid_on: date
    milestone_name: str | None
    confirmed_at: datetime
