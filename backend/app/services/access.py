"""Who can see which project. Every project-scoped endpoint goes through here."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, ProjectCustomer, Role, SupervisorAssignment, Trade, User


def visible_projects_query(user: User):
    q = select(Project)
    if user.role == Role.owner:
        return q
    if user.role == Role.customer:
        return q.join(ProjectCustomer, ProjectCustomer.project_id == Project.id).where(
            ProjectCustomer.user_id == user.id
        )
    # supervisor
    return (
        q.join(SupervisorAssignment, SupervisorAssignment.project_id == Project.id)
        .where(SupervisorAssignment.user_id == user.id, SupervisorAssignment.active.is_(True))
        .distinct()
    )


def get_project_for(db: Session, user: User, project_id: uuid.UUID) -> Project:
    """Return the project if the user may see it; 404 otherwise (never reveal it exists)."""
    project = db.scalars(visible_projects_query(user).where(Project.id == project_id)).first()
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    return project


def supervisor_trades(db: Session, user: User, project_id: uuid.UUID) -> list[Trade]:
    rows = db.scalars(
        select(SupervisorAssignment.trade).where(
            SupervisorAssignment.project_id == project_id,
            SupervisorAssignment.user_id == user.id,
            SupervisorAssignment.active.is_(True),
        )
    ).all()
    return sorted(rows, key=lambda t: t.value)
