import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import Trade


class ProgressIn(BaseModel):
    trade: Trade
    note: str = Field(default="", max_length=1000)
    photo_file_ids: list[uuid.UUID] = Field(default=[], max_length=10)
    milestone_id: uuid.UUID | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class ProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    trade: Trade
    milestone_id: uuid.UUID | None
    milestone_name: str | None = None
    note: str
    photo_urls: list[str] = []
    taken_at: datetime
    lat: float | None
    lng: float | None
    posted_by_name: str = ""
