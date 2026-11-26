import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.documents import DocGroup, Visibility


class DocumentIn(BaseModel):
    group: DocGroup
    doc_type: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=160)
    file_id: uuid.UUID
    visibility: Visibility | None = None  # default: internal for the internal group, customer otherwise


class VisibilityIn(BaseModel):
    visibility: Visibility


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    group: DocGroup
    doc_type: str
    title: str
    version: int
    visibility: Visibility
    url: str | None = None
    content_type: str = ""
    versions: int = 1
    created_at: datetime


class HandoverItemIn(BaseModel):
    item: str = Field(min_length=1, max_length=160)
    quantity: str | None = Field(default=None, max_length=60)
    note: str | None = None


class HandoverItemUpdate(BaseModel):
    item: str | None = Field(default=None, min_length=1, max_length=160)
    quantity: str | None = Field(default=None, max_length=60)
    note: str | None = None
    photo_file_id: uuid.UUID | None = None
    checked: bool | None = None


class HandoverItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    seq: int
    item: str
    quantity: str | None
    note: str | None
    photo_url: str | None = None
    checked: bool


class HandoverOut(BaseModel):
    items: list[HandoverItemOut]
    all_checked: bool
    signed_by_name: str | None
    signed_at: datetime | None
