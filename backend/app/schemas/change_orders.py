import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import Trade
from app.models.change_orders import ChangeOrderStatus


class ChangeOrderIn(BaseModel):
    trade: Trade | None = None
    title: str = Field(min_length=1, max_length=160)
    description: str = ""
    amount_paise: int = Field(gt=0)
    photo_file_ids: list[uuid.UUID] = []


class ChangeOrderUpdate(BaseModel):
    trade: Trade | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    amount_paise: int | None = Field(default=None, gt=0)
    photo_file_ids: list[uuid.UUID] | None = None


class RejectIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class ChangeOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    trade: Trade | None
    title: str
    description: str
    amount_paise: int
    photo_urls: list[str] = []
    status: ChangeOrderStatus
    version: int
    revises_id: uuid.UUID | None
    sent_at: datetime | None
    decided_by_name: str | None = None
    decided_at: datetime | None
    reject_reason: str | None
    created_at: datetime
