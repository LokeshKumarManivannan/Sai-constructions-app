import enum
import uuid
from datetime import date, datetime

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models import AuditLog, User


def snapshot(obj) -> dict:
    """Column values of a model instance as JSON-safe values."""
    out = {}
    for col in inspect(obj).mapper.column_attrs:
        value = getattr(obj, col.key)
        if isinstance(value, uuid.UUID | date | datetime):
            value = value.isoformat() if not isinstance(value, uuid.UUID) else str(value)
        elif isinstance(value, enum.Enum):
            value = value.value
        out[col.key] = value
    return out


def record(
    db: Session,
    actor: User | None,
    action: str,
    entity: str,
    entity_id: uuid.UUID | None,
    before: dict | None = None,
    after: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            entity=entity,
            entity_id=entity_id,
            before=before,
            after=after,
        )
    )
