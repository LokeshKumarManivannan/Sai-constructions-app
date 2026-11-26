import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.config import settings
from app.db import get_db
from app.models import StoredFile, User
from app.services import audit
from app.services.access import get_project_for
from app.services.files import ALLOWED_TYPES, check_signature, new_storage_key, path_for, signed_url

router = APIRouter(tags=["files"])


@router.post("/files", status_code=201)
async def upload(
    project_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """Upload a photo or PDF for a project the user can see. Returns its id and a signed URL."""
    get_project_for(db, user, project_id)
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "only photos (jpg, png, webp, heic) or PDF")
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"file larger than {settings.max_upload_mb} MB")
    key = new_storage_key(file.content_type)
    path_for(key).write_bytes(data)
    f = StoredFile(
        project_id=project_id,
        original_name=(file.filename or "")[:255],
        content_type=file.content_type,
        size_bytes=len(data),
        storage_key=key,
        uploaded_by=user.id,
    )
    db.add(f)
    db.flush()
    audit.record(db, user, "create", "file", f.id, after={"project_id": str(project_id), "name": f.original_name})
    db.commit()
    return {"id": str(f.id), "url": signed_url(f.id)}


@router.get("/files/{file_id}")
def download(file_id: uuid.UUID, exp: int, sig: str, db: Session = Depends(get_db)):
    if not check_signature(file_id, exp, sig):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "link expired or invalid")
    f = db.get(StoredFile, file_id)
    if f is None or not path_for(f.storage_key).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    return FileResponse(path_for(f.storage_key), media_type=f.content_type, filename=f.original_name or None)
