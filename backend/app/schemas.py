"""API request/response shapes. Money is always integer paise (₹1 = 100 paise)."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import InviteStatus, Language, MilestoneStatus, ProjectStatus, Role, Trade


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / me ----------
class OtpRequestIn(BaseModel):
    phone: str


class OtpRequestOut(BaseModel):
    sent: bool = True
    dev_code: str | None = None  # only when DEV_EXPOSE_OTP is on


class OtpVerifyIn(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6)


class UserOut(ORM):
    id: uuid.UUID
    phone: str
    full_name: str
    role: Role
    language: Language


class TokenOut(BaseModel):
    access_token: str
    user: UserOut


class MeUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    language: Language | None = None


# ---------- customers ----------
class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str
    alt_phone: str | None = None
    address: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = None
    alt_phone: str | None = None
    address: str | None = None
    notes: str | None = None


class CustomerOut(ORM):
    id: uuid.UUID
    name: str
    phone: str
    alt_phone: str | None
    address: str | None
    notes: str | None
    created_at: datetime
    project_count: int = 0


# ---------- projects ----------
class ProjectIn(BaseModel):
    customer_id: uuid.UUID
    name: str = Field(min_length=1, max_length=160)
    site_address: str = ""
    google_maps_url: str | None = None
    plot_size: str | None = None
    floors: str | None = None
    status: ProjectStatus = ProjectStatus.quote
    contract_value_paise: int = Field(default=0, ge=0)
    start_date: date | None = None
    target_end_date: date | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    site_address: str | None = None
    google_maps_url: str | None = None
    plot_size: str | None = None
    floors: str | None = None
    status: ProjectStatus | None = None
    contract_value_paise: int | None = Field(default=None, ge=0)
    start_date: date | None = None
    target_end_date: date | None = None


class ProjectOut(ORM):
    """Owner and customer view."""

    id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str = ""
    name: str
    site_address: str
    google_maps_url: str | None
    plot_size: str | None
    floors: str | None
    status: ProjectStatus
    contract_value_paise: int
    start_date: date | None
    target_end_date: date | None


class ProjectSiteOut(BaseModel):
    """Supervisor view: where the site is and which trades they cover. No money."""

    id: uuid.UUID
    name: str
    site_address: str
    google_maps_url: str | None
    status: ProjectStatus
    my_trades: list[Trade]


# ---------- milestones ----------
class MilestoneIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount_due_paise: int = Field(default=0, ge=0)
    due_date: date | None = None


class MilestoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    amount_due_paise: int | None = Field(default=None, ge=0)
    due_date: date | None = None
    seq: int | None = Field(default=None, ge=1)


class MilestoneOut(ORM):
    id: uuid.UUID
    project_id: uuid.UUID
    seq: int
    name: str
    amount_due_paise: int
    due_date: date | None
    status: MilestoneStatus


# ---------- team ----------
class SupervisorIn(BaseModel):
    phone: str
    full_name: str = Field(min_length=1, max_length=120)


class AssignmentIn(BaseModel):
    user_id: uuid.UUID
    trade: Trade


class AssignmentOut(ORM):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str = ""
    user_phone: str = ""
    trade: Trade
    active: bool


# ---------- invites ----------
class InviteIn(BaseModel):
    phone: str | None = None  # defaults to the customer's phone


class InviteOut(ORM):
    id: uuid.UUID
    project_id: uuid.UUID
    phone: str
    status: InviteStatus
    expires_at: datetime
    link: str = ""


class PublicInviteOut(BaseModel):
    company: str = "Sai Constructions"
    project_name: str
    phone_masked: str
    usable: bool
