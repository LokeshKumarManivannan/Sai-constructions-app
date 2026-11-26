"""One-time setup from a browser: run database migrations and create the first owner.

Enabled only while BOOTSTRAP_TOKEN is set. Use it from the API's /docs page, then remove
the variable in Vercel so the endpoint is switched off.
"""

import hmac
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.cli import create_owner
from app.config import settings
from app.db import SessionLocal
from app.models import Role, User

router = APIRouter(tags=["admin"])

BACKEND_DIR = Path(__file__).resolve().parents[2]


class BootstrapIn(BaseModel):
    token: str
    owner_phone: str | None = None
    owner_name: str | None = None


@router.post("/admin/bootstrap")
def bootstrap(body: BootstrapIn) -> dict:
    if not settings.bootstrap_token or not hmac.compare_digest(body.token, settings.bootstrap_token):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")

    with SessionLocal() as db:
        has_owner = db.scalar(select(User).where(User.role == Role.owner)) is not None
    if not has_owner and body.owner_phone and body.owner_name:
        create_owner(body.owner_phone, body.owner_name)
        has_owner = True
    return {"migrated": True, "owner_exists": has_owner}
