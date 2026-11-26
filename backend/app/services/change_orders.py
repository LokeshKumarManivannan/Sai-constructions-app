import uuid

from sqlalchemy.orm import Session


def approved_total(db: Session, project_id: uuid.UUID) -> int:
    """Sum of approved change orders. Change orders arrive in phase 3."""
    return 0
