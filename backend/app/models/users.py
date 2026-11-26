import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import Language, Role, created_at_col, uuid_pk


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # E.164
    full_name: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"))
    language: Mapped[Language] = mapped_column(Enum(Language, name="language"), default=Language.en)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = created_at_col()


class OtpCode(Base):
    """One row per OTP request. Only a hash of the code is stored."""

    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = uuid_pk()
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = created_at_col()
