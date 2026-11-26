"""Internal books: payees, payments out, untagged queue, cash book, per-site ledger.
Owner only, except the supervisor's own 'my money' endpoints at the bottom."""

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.deps import require_owner, require_role
from app.auth.phone import InvalidPhone, normalize_phone
from app.db import get_db
from app.models import (
    CashTransfer,
    CashTransferKind,
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    Payee,
    PayeeType,
    Project,
    Role,
    StoredFile,
    User,
)
from app.schemas.books import (
    BooksSummaryOut,
    CashBookOut,
    CashTransferIn,
    ExpenseIn,
    ExpenseOut,
    ExpenseTag,
    MyMoneyOut,
    PayeeIn,
    PayeeOut,
    PayeeUpdate,
    SpendIn,
)
from app.services import audit, books
from app.services.access import get_project_for, supervisor_trades
from app.services.files import signed_url
from app.services.time import today_ist

router = APIRouter(tags=["books"])


# ---------- helpers ----------
def _out(db: Session, e: Expense) -> ExpenseOut:
    payee = db.get(Payee, e.payee_id)
    project = db.get(Project, e.project_id) if e.project_id else None
    return ExpenseOut.model_validate(e).model_copy(
        update={
            "payee_name": payee.name if payee else "",
            "payee_type": payee.type if payee else None,
            "project_name": project.name if project else None,
            "bill_url": signed_url(e.bill_file_id),
            "tagged": books.is_tagged(e),
        }
    )


def _check_project(db: Session, project_id: uuid.UUID | None) -> None:
    if project_id is not None and db.get(Project, project_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "project not found")


def _check_bill(db: Session, file_id: uuid.UUID | None, project_id: uuid.UUID | None) -> None:
    if file_id is None:
        return
    f = db.get(StoredFile, file_id)
    if f is None or (f.project_id is not None and project_id is not None and f.project_id != project_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "bill photo not found for this site")


def _norm_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        return normalize_phone(raw)
    except InvalidPhone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid phone number") from None


def ensure_supervisor_payee(db: Session, user: User) -> Payee:
    payee = db.scalar(select(Payee).where(Payee.user_id == user.id))
    if payee is None:
        payee = Payee(name=user.full_name, phone=user.phone, type=PayeeType.supervisor, user_id=user.id)
        db.add(payee)
        db.flush()
    return payee


# ---------- payees ----------
@router.get("/payees", response_model=list[PayeeOut])
def list_payees(q: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    for u in db.scalars(select(User).where(User.role == Role.supervisor)):
        ensure_supervisor_payee(db, u)  # supervisors are always payable
    db.commit()
    totals = dict(
        db.execute(
            select(Expense.payee_id, func.sum(Expense.amount_paise))
            .where(Expense.status == ExpenseStatus.active)
            .group_by(Expense.payee_id)
        ).all()
    )
    stmt = select(Payee).order_by(Payee.name)
    if q:
        stmt = stmt.where(or_(Payee.name.ilike(f"%{q}%"), Payee.phone.ilike(f"%{q}%")))
    return [
        PayeeOut.model_validate(p).model_copy(update={"total_paid_paise": int(totals.get(p.id, 0))})
        for p in db.scalars(stmt)
    ]


@router.post("/payees", response_model=PayeeOut, status_code=201)
def create_payee(body: PayeeIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    p = Payee(name=body.name.strip(), phone=_norm_phone(body.phone), type=body.type)
    db.add(p)
    db.flush()
    audit.record(db, owner, "create", "payee", p.id, after=audit.snapshot(p))
    db.commit()
    return p


@router.patch("/payees/{payee_id}", response_model=PayeeOut)
def update_payee(payee_id: uuid.UUID, body: PayeeUpdate, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    p = db.get(Payee, payee_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "payee not found")
    before = audit.snapshot(p)
    data = body.model_dump(exclude_unset=True)
    if "phone" in data:
        data["phone"] = _norm_phone(data["phone"])
    for k, v in data.items():
        if v is not None or k == "phone":
            setattr(p, k, v)
    audit.record(db, owner, "update", "payee", p.id, before=before, after=audit.snapshot(p))
    db.commit()
    return p


# ---------- payments out ----------
@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(body: ExpenseIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    payee = db.get(Payee, body.payee_id)
    if payee is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "payee not found")
    data = body.model_dump()
    # Repeat payments are one tap: fall back to the payee's last site and category.
    if data["project_id"] is None:
        data["project_id"] = payee.default_project_id
    if data["category"] is None:
        data["category"] = payee.default_category
    _check_project(db, data["project_id"])
    _check_bill(db, body.bill_file_id, data["project_id"])

    old = None
    if body.corrects_id:
        old = db.get(Expense, body.corrects_id)
        if old is None or old.status != ExpenseStatus.active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "entry to correct not found")

    e = Expense(**data, created_by=owner.id)
    db.add(e)
    payee.default_project_id = data["project_id"] or payee.default_project_id
    payee.default_category = data["category"] or payee.default_category
    db.flush()
    if old is not None:
        before = audit.snapshot(old)
        old.status = ExpenseStatus.void
        audit.record(db, owner, "void", "expense", old.id, before=before, after=audit.snapshot(old))
    audit.record(db, owner, "create", "expense", e.id, after=audit.snapshot(e))
    db.commit()
    return _out(db, e)


@router.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(
    project_id: uuid.UUID | None = None,
    payee_id: uuid.UUID | None = None,
    category: ExpenseCategory | None = None,
    untagged: bool = False,
    include_void: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    stmt = select(Expense).order_by(Expense.paid_on.desc(), Expense.created_at.desc())
    if not include_void:
        stmt = stmt.where(Expense.status == ExpenseStatus.active)
    if project_id:
        stmt = stmt.where(Expense.project_id == project_id)
    if payee_id:
        stmt = stmt.where(Expense.payee_id == payee_id)
    if category:
        stmt = stmt.where(Expense.category == category)
    if date_from:
        stmt = stmt.where(Expense.paid_on >= date_from)
    if date_to:
        stmt = stmt.where(Expense.paid_on <= date_to)
    rows = db.scalars(stmt).all()
    if untagged:
        rows = [e for e in rows if not books.is_tagged(e)]
    return [_out(db, e) for e in rows]


@router.patch("/expenses/{expense_id}", response_model=ExpenseOut)
def tag_expense(expense_id: uuid.UUID, body: ExpenseTag, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    e = db.get(Expense, expense_id)
    if e is None or e.status != ExpenseStatus.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "expense not found")
    data = body.model_dump(exclude_unset=True)
    _check_project(db, data.get("project_id"))
    _check_bill(db, data.get("bill_file_id"), data.get("project_id", e.project_id))
    before = audit.snapshot(e)
    for k, v in data.items():
        setattr(e, k, v)
    payee = db.get(Payee, e.payee_id)
    payee.default_project_id = e.project_id or payee.default_project_id
    payee.default_category = e.category or payee.default_category
    audit.record(db, owner, "tag", "expense", e.id, before=before, after=audit.snapshot(e))
    db.commit()
    return _out(db, e)


@router.post("/expenses/{expense_id}/void", response_model=ExpenseOut)
def void_expense(expense_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    e = db.get(Expense, expense_id)
    if e is None or e.status != ExpenseStatus.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "expense not found")
    before = audit.snapshot(e)
    e.status = ExpenseStatus.void
    audit.record(db, owner, "void", "expense", e.id, before=before, after=audit.snapshot(e))
    db.commit()
    return _out(db, e)


# ---------- cash book & summary ----------
@router.get("/cash-book", response_model=CashBookOut)
def get_cash_book(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    entries = books.cash_book(db)
    return CashBookOut(
        balance_paise=entries[-1].balance_paise if entries else 0,
        entries=[e.__dict__ for e in reversed(entries)],  # newest first
    )


@router.post("/cash-transfers", status_code=201)
def add_cash_transfer(body: CashTransferIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)) -> dict:
    if body.kind != CashTransferKind.adjustment and body.amount_paise <= 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "amount must be positive")
    t = CashTransfer(**body.model_dump(), created_by=owner.id)
    db.add(t)
    db.flush()
    audit.record(db, owner, "create", "cash_transfer", t.id, after=audit.snapshot(t))
    db.commit()
    return {"id": str(t.id)}


@router.get("/books/summary", response_model=BooksSummaryOut)
def books_summary(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    sites = books.site_ledger(db)
    entries = books.cash_book(db)
    active = db.scalars(select(Expense).where(Expense.status == ExpenseStatus.active)).all()
    received_month, spent_month = books.month_totals(db, today_ist())
    return BooksSummaryOut(
        received_month_paise=received_month,
        spent_month_paise=spent_month,
        to_collect_paise=books.to_collect(db),
        sites=sites,
        received_paise=sum(s["received_paise"] for s in sites),
        spent_paise=sum(s["spent_paise"] for s in sites),
        cash_in_hand_paise=entries[-1].balance_paise if entries else 0,
        untagged_count=sum(1 for e in active if not books.is_tagged(e)),
    )


# ---------- supervisor: my money ----------
require_supervisor = require_role(Role.supervisor)


@router.get("/me/money", response_model=MyMoneyOut)
def my_money(db: Session = Depends(get_db), user: User = Depends(require_supervisor)):
    payee = ensure_supervisor_payee(db, user)
    db.commit()
    received = db.scalars(
        select(Expense)
        .where(Expense.payee_id == payee.id, Expense.status == ExpenseStatus.active)
        .order_by(Expense.paid_on.desc())
    ).all()
    spends = db.scalars(
        select(Expense)
        .where(Expense.spent_from_advance_of == user.id, Expense.status == ExpenseStatus.active)
        .order_by(Expense.paid_on.desc())
    ).all()
    return MyMoneyOut(
        received=[_out(db, e) for e in received],
        advance=books.advance_balance(db, user.id),
        my_spends=[_out(db, e) for e in spends],
    )


@router.post("/expenses/{expense_id}/acknowledge", response_model=ExpenseOut)
def acknowledge(expense_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_supervisor)):
    """Supervisor confirms they received this money."""
    e = db.get(Expense, expense_id)
    payee = db.get(Payee, e.payee_id) if e else None
    if e is None or payee is None or payee.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "payment not found")
    if e.recipient_confirmed_at is None:
        e.recipient_confirmed_at = datetime.now(UTC)
        audit.record(db, user, "acknowledge", "expense", e.id)
        db.commit()
    return _out(db, e)


@router.post("/petty-cash/spend", response_model=ExpenseOut, status_code=201)
def spend_from_advance(body: SpendIn, db: Session = Depends(get_db), user: User = Depends(require_supervisor)):
    get_project_for(db, user, body.project_id)
    if not supervisor_trades(db, user, body.project_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not assigned to this site")
    if body.category == ExpenseCategory.advance:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid category")
    _check_bill(db, body.bill_file_id, body.project_id)
    payee = db.scalar(select(Payee).where(func.lower(Payee.name) == body.paid_to.strip().lower()))
    if payee is None:
        payee = Payee(name=body.paid_to.strip(), type=PayeeType.labour if body.category == ExpenseCategory.labour else PayeeType.other)
        db.add(payee)
        db.flush()
    e = Expense(
        project_id=body.project_id,
        payee_id=payee.id,
        category=body.category,
        amount_paise=body.amount_paise,
        mode="cash",
        reason=body.reason,
        bill_file_id=body.bill_file_id,
        paid_on=body.paid_on,
        spent_from_advance_of=user.id,
        created_by=user.id,
    )
    db.add(e)
    db.flush()
    audit.record(db, user, "create", "expense", e.id, after=audit.snapshot(e))
    db.commit()
    return _out(db, e)
