"""Downloads for the owner. The app asks for a short-lived signed link, then opens it,
so the download works in any browser or phone without auth headers."""

import hashlib
import hmac
import os
import time
import uuid
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_owner
from app.config import settings
from app.db import get_db
from app.models import Project, User
from app.services import exports

router = APIRouter(tags=["exports"])
LINK_TTL = 600
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class ExportIn(BaseModel):
    kind: Literal["project", "year", "bills"]
    project_id: uuid.UUID | None = None
    fy: str | None = None  # e.g. 2026-27


def _sig(kind: str, project_id: str, fy: str, exp: int) -> str:
    msg = f"export:{kind}:{project_id}:{fy}:{exp}".encode()
    return hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()[:32]


def _check(body: ExportIn, db: Session) -> None:
    if body.kind == "project" and not body.project_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "choose a project")
    if body.kind == "year" and not body.fy:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "choose a financial year")
    if body.kind == "bills" and not (body.project_id or body.fy):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "choose a project or a financial year")
    if body.fy:
        try:
            exports.fy_range(body.fy)
        except ValueError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from None
    if body.project_id and db.get(Project, body.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")


@router.post("/exports/link")
def export_link(body: ExportIn, db: Session = Depends(get_db), _: User = Depends(require_owner)) -> dict:
    _check(body, db)
    exp = int(time.time()) + LINK_TTL
    pid, fy = str(body.project_id or ""), body.fy or ""
    q = f"kind={body.kind}&project_id={pid}&fy={fy}&exp={exp}&sig={_sig(body.kind, pid, fy, exp)}"
    return {"url": f"{settings.api_base_url}/exports/download?{q}"}


@router.get("/exports/download")
def export_download(
    kind: Literal["project", "year", "bills"],
    exp: int,
    sig: str,
    background: BackgroundTasks,
    project_id: str = "",
    fy: str = "",
    db: Session = Depends(get_db),
):
    if exp < int(time.time()) or not hmac.compare_digest(_sig(kind, project_id, fy, exp), sig):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "link expired; download again from the app")
    pid = uuid.UUID(project_id) if project_id else None

    if kind == "project":
        project = db.get(Project, pid)
        data = exports.project_workbook(db, project)
        name = f"{exports._safe(project.name)}-statement.xlsx"
        return Response(data, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})
    if kind == "year":
        data = exports.year_workbook(db, fy)
        name = f"Sai-Constructions-FY{fy}.xlsx"
        return Response(data, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})

    path = exports.bills_zip_path(db, pid, fy or None)
    background.add_task(os.remove, path)
    label = exports._safe(db.get(Project, pid).name) if pid else f"FY{fy}"
    return FileResponse(path, media_type="application/zip", filename=f"Sai-Constructions-bills-{label}.zip")
