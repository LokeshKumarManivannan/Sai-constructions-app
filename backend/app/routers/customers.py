import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.deps import require_owner
from app.auth.phone import InvalidPhone, normalize_phone
from app.db import get_db
from app.models import Customer, Project, User
from app.schemas import CustomerIn, CustomerOut, CustomerUpdate
from app.services import audit

router = APIRouter(prefix="/customers", tags=["customers"])


def _norm(raw: str | None) -> str | None:
    if raw is None or raw.strip() == "":
        return None
    try:
        return normalize_phone(raw)
    except InvalidPhone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"invalid phone number: {raw}") from None


def _out(db: Session, c: Customer) -> CustomerOut:
    count = db.scalar(select(func.count()).select_from(Project).where(Project.customer_id == c.id))
    return CustomerOut.model_validate(c).model_copy(update={"project_count": count})


@router.get("", response_model=list[CustomerOut])
def list_customers(q: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    stmt = select(Customer).order_by(Customer.created_at.desc())
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.phone.ilike(like)))
    return [_out(db, c) for c in db.scalars(stmt).all()]


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(body: CustomerIn, db: Session = Depends(get_db), user: User = Depends(require_owner)):
    data = body.model_dump()
    data["phone"] = _norm(body.phone)
    data["alt_phone"] = _norm(body.alt_phone)
    if data["phone"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "phone is required")
    c = Customer(**data, created_by=user.id)
    db.add(c)
    db.flush()
    audit.record(db, user, "create", "customer", c.id, after=audit.snapshot(c))
    db.commit()
    return _out(db, c)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    c = db.get(Customer, customer_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    return _out(db, c)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: uuid.UUID, body: CustomerUpdate, db: Session = Depends(get_db), user: User = Depends(require_owner)
):
    c = db.get(Customer, customer_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    before = audit.snapshot(c)
    data = body.model_dump(exclude_unset=True)
    if "phone" in data:
        data["phone"] = _norm(data["phone"])
        if data["phone"] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "phone is required")
    if "alt_phone" in data:
        data["alt_phone"] = _norm(data["alt_phone"])
    if "name" in data and data["name"] is None:
        del data["name"]
    for field, value in data.items():
        setattr(c, field, value)
    audit.record(db, user, "update", "customer", c.id, before=before, after=audit.snapshot(c))
    db.commit()
    return _out(db, c)
