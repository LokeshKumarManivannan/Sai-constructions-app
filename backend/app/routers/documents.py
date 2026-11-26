import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import require_owner, require_role
from app.db import get_db
from app.models import ProjectStatus, Role, StoredFile, User
from app.models.documents import DocGroup, Document, HandoverItem, HandoverSignoff, Visibility
from app.schemas.documents import (
    DocumentIn,
    DocumentOut,
    HandoverItemIn,
    HandoverItemOut,
    HandoverItemUpdate,
    HandoverOut,
    VisibilityIn,
)
from app.services import audit
from app.services.access import get_project_for
from app.services.files import signed_url

router = APIRouter(tags=["documents & handover"])
owner_or_customer = require_role(Role.owner, Role.customer)

DEFAULT_HANDOVER = [
    "Keys: main door, rooms, gate (count each)",
    "EB card, meter numbers and readings",
    "Water connection documents",
    "Motor / pump warranty card",
    "Warranty cards: taps, sanitaryware, fans, inverter, water heater",
    "Paint shade codes per room",
    "Photos of concealed plumbing and electrical lines",
    "Electrical distribution board layout and circuit labels",
    "Leftover materials handed over",
    "As-built drawings uploaded",
]


# ---------- documents ----------
def _doc_out(db: Session, d: Document, versions: int = 1) -> DocumentOut:
    f = db.get(StoredFile, d.file_id)
    return DocumentOut.model_validate(d).model_copy(
        update={"url": signed_url(d.file_id), "content_type": f.content_type if f else "", "versions": versions}
    )


@router.get("/projects/{project_id}/documents", response_model=list[DocumentOut])
def list_documents(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    """Latest version of each document (same type + title)."""
    get_project_for(db, user, project_id)
    stmt = select(Document).where(Document.project_id == project_id)
    if user.role == Role.customer:
        stmt = stmt.where(Document.visibility == Visibility.customer)
    latest: dict[tuple[str, str], Document] = {}
    counts: dict[tuple[str, str], int] = {}
    for d in db.scalars(stmt.order_by(Document.version)):
        key = (d.doc_type, d.title.lower())
        latest[key] = d
        counts[key] = counts.get(key, 0) + 1
    rows = sorted(latest.items(), key=lambda kv: (kv[1].group.value, kv[1].title))
    return [_doc_out(db, d, counts[k]) for k, d in rows]


@router.get("/documents/{doc_id}/versions", response_model=list[DocumentOut])
def document_versions(doc_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    d = db.get(Document, doc_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    get_project_for(db, user, d.project_id)
    stmt = select(Document).where(
        Document.project_id == d.project_id, Document.doc_type == d.doc_type, func.lower(Document.title) == d.title.lower()
    )
    if user.role == Role.customer:
        stmt = stmt.where(Document.visibility == Visibility.customer)
    return [_doc_out(db, v) for v in db.scalars(stmt.order_by(Document.version.desc()))]


@router.post("/projects/{project_id}/documents", response_model=DocumentOut, status_code=201)
def add_document(project_id: uuid.UUID, body: DocumentIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    get_project_for(db, owner, project_id)
    f = db.get(StoredFile, body.file_id)
    if f is None or f.project_id != project_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "file is not part of this project")
    prev = db.scalar(
        select(func.max(Document.version)).where(
            Document.project_id == project_id,
            Document.doc_type == body.doc_type,
            func.lower(Document.title) == body.title.strip().lower(),
        )
    )
    visibility = body.visibility or (Visibility.internal if body.group == DocGroup.internal else Visibility.customer)
    d = Document(
        project_id=project_id,
        group=body.group,
        doc_type=body.doc_type,
        title=body.title.strip(),
        file_id=body.file_id,
        version=(prev or 0) + 1,
        visibility=visibility,
        uploaded_by=owner.id,
    )
    db.add(d)
    db.flush()
    audit.record(db, owner, "create", "document", d.id, after=audit.snapshot(d))
    db.commit()
    return _doc_out(db, d)


@router.post("/documents/{doc_id}/visibility", response_model=DocumentOut)
def set_visibility(doc_id: uuid.UUID, body: VisibilityIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    d = db.get(Document, doc_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    before = audit.snapshot(d)
    # applies to every version of this document
    for v in db.scalars(
        select(Document).where(
            Document.project_id == d.project_id, Document.doc_type == d.doc_type, func.lower(Document.title) == d.title.lower()
        )
    ):
        v.visibility = body.visibility
    audit.record(db, owner, "update", "document", d.id, before=before, after=audit.snapshot(d))
    db.commit()
    return _doc_out(db, d)


# ---------- handover ----------
def _handover(db: Session, project_id: uuid.UUID) -> HandoverOut:
    items = db.scalars(select(HandoverItem).where(HandoverItem.project_id == project_id).order_by(HandoverItem.seq)).all()
    sign = db.scalar(select(HandoverSignoff).where(HandoverSignoff.project_id == project_id))
    signer = db.get(User, sign.signed_by) if sign else None
    return HandoverOut(
        items=[HandoverItemOut.model_validate(i).model_copy(update={"photo_url": signed_url(i.photo_file_id)}) for i in items],
        all_checked=bool(items) and all(i.checked for i in items),
        signed_by_name=signer.full_name if signer else None,
        signed_at=sign.signed_at if sign else None,
    )


def _not_signed(db: Session, project_id: uuid.UUID) -> None:
    if db.scalar(select(HandoverSignoff).where(HandoverSignoff.project_id == project_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "handover already signed")


@router.get("/projects/{project_id}/handover", response_model=HandoverOut)
def get_handover(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(owner_or_customer)):
    get_project_for(db, user, project_id)
    return _handover(db, project_id)


@router.post("/projects/{project_id}/handover/seed", response_model=HandoverOut)
def seed_handover(project_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    get_project_for(db, owner, project_id)
    if db.scalar(select(func.count()).select_from(HandoverItem).where(HandoverItem.project_id == project_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "checklist already exists")
    for i, text in enumerate(DEFAULT_HANDOVER, start=1):
        db.add(HandoverItem(project_id=project_id, seq=i, item=text))
    audit.record(db, owner, "create", "handover_checklist", project_id)
    db.commit()
    return _handover(db, project_id)


@router.post("/projects/{project_id}/handover/items", response_model=HandoverOut, status_code=201)
def add_item(project_id: uuid.UUID, body: HandoverItemIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    get_project_for(db, owner, project_id)
    _not_signed(db, project_id)
    seq = (db.scalar(select(func.max(HandoverItem.seq)).where(HandoverItem.project_id == project_id)) or 0) + 1
    it = HandoverItem(project_id=project_id, seq=seq, **body.model_dump())
    db.add(it)
    db.flush()
    audit.record(db, owner, "create", "handover_item", it.id, after=audit.snapshot(it))
    db.commit()
    return _handover(db, project_id)


@router.patch("/handover/items/{item_id}", response_model=HandoverOut)
def update_item(item_id: uuid.UUID, body: HandoverItemUpdate, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    it = db.get(HandoverItem, item_id)
    if it is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    _not_signed(db, it.project_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("photo_file_id"):
        f = db.get(StoredFile, data["photo_file_id"])
        if f is None or f.project_id != it.project_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "photo is not part of this project")
    before = audit.snapshot(it)
    for k, v in data.items():
        if v is not None or k in ("quantity", "note"):
            setattr(it, k, v)
    audit.record(db, owner, "update", "handover_item", it.id, before=before, after=audit.snapshot(it))
    db.commit()
    return _handover(db, it.project_id)


@router.delete("/handover/items/{item_id}", response_model=HandoverOut)
def delete_item(item_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    it = db.get(HandoverItem, item_id)
    if it is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    _not_signed(db, it.project_id)
    pid = it.project_id
    audit.record(db, owner, "delete", "handover_item", it.id, before=audit.snapshot(it))
    db.delete(it)
    db.commit()
    return _handover(db, pid)


@router.post("/projects/{project_id}/handover/sign", response_model=HandoverOut)
def sign_handover(project_id: uuid.UUID, db: Session = Depends(get_db), customer: User = Depends(require_role(Role.customer))):
    project = get_project_for(db, customer, project_id)
    _not_signed(db, project_id)
    if not _handover(db, project_id).all_checked:
        raise HTTPException(status.HTTP_409_CONFLICT, "every checklist item must be ticked before signing")
    db.add(HandoverSignoff(project_id=project_id, signed_by=customer.id, signed_at=datetime.now(UTC)))
    before = audit.snapshot(project)
    project.status = ProjectStatus.handed_over
    audit.record(db, customer, "sign_handover", "project", project.id, before=before, after=audit.snapshot(project))
    db.commit()
    return _handover(db, project_id)
