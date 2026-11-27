"""Bank inbox (owner only): upload a statement, then explain every line that the books don't already cover."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.deps import require_owner
from app.config import settings
from app.db import get_db
from app.models import (
    BankDirection,
    BankSource,
    BankTxn,
    BankTxnStatus,
    CashTransfer,
    CustomerPayment,
    Expense,
    Payee,
    Project,
    User,
)
from app.routers.books import create_expense
from app.routers.payments import log_payment
from app.schemas.bank import (
    BankSummaryOut,
    BankTxnOut,
    ExplainExpenseIn,
    ExplainReceiptIn,
    ImportOut,
    LinkedOut,
    LinkIn,
    SuggestionOut,
)
from app.schemas.books import ExpenseIn
from app.schemas.payments import PaymentIn
from app.services import audit, bank
from app.services.bank_statement import PasswordNeeded, StatementError, read_statement
from app.services.time import today_ist

router = APIRouter(tags=["bank"])


def _txn(db: Session, txn_id: uuid.UUID) -> BankTxn:
    t = db.get(BankTxn, txn_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "bank entry not found")
    return t


def _open(t: BankTxn) -> None:
    if t.status != BankTxnStatus.to_explain:
        raise HTTPException(status.HTTP_409_CONFLICT, "this bank entry is already explained")


def _linked(db: Session, t: BankTxn) -> LinkedOut | None:
    if t.expense_id:
        e = db.get(Expense, t.expense_id)
        site = db.get(Project, e.project_id).name if e.project_id else "General"
        return LinkedOut(kind="expense", id=e.id, label=f"{db.get(Payee, e.payee_id).name} · {site}")
    if t.payment_id:
        p = db.get(CustomerPayment, t.payment_id)
        return LinkedOut(kind="payment", id=p.id, label=db.get(Project, p.project_id).name)
    if t.cash_transfer_id:
        return LinkedOut(kind="cash", id=t.cash_transfer_id, label="Cash box")
    return None


def _out(db: Session, t: BankTxn, with_suggestion: bool) -> BankTxnOut:
    sug = None
    if with_suggestion and t.status == BankTxnStatus.to_explain:
        s = bank.suggest(db, t)
        sug = SuggestionOut(
            **s.__dict__,
            payee_name=db.get(Payee, s.payee_id).name if s.payee_id else None,
            project_name=db.get(Project, s.project_id).name if s.project_id else None,
        )
    return BankTxnOut(
        id=t.id,
        txn_date=t.txn_date,
        amount_paise=t.amount_paise,
        direction=t.direction,
        narration=t.narration,
        raw_line=t.raw_line,
        balance_paise=t.balance_paise,
        verified=t.verified,
        ref=t.ref,
        counterparty=t.counterparty,
        source=t.source,
        status=t.status,
        auto_matched=t.auto_matched,
        linked=_linked(db, t),
        suggestion=sug,
        reviewed_at=t.reviewed_at,
    )


def _done(db: Session, owner: User, t: BankTxn, action: str) -> BankTxnOut:
    t.reviewed_by, t.reviewed_at = owner.id, datetime.now(UTC)
    audit.record(db, owner, action, "bank_txn", t.id, after=audit.snapshot(t))
    db.commit()
    return _out(db, t, False)


@router.post("/bank/import", response_model=ImportOut)
async def import_statement(
    file: UploadFile = File(...),
    password: str | None = Form(None),  # for locked PDFs
    db: Session = Depends(get_db),
    owner: User = Depends(require_owner),
):
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"file is larger than {settings.max_upload_mb} MB")
    try:
        rows = read_statement(data, file.filename or "", password)
    except PasswordNeeded as e:
        raise HTTPException(status.HTTP_423_LOCKED, str(e)) from None
    except StatementError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from None
    except Exception:  # unreadable/corrupt workbook
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Could not read this file. Download it again from net banking (Excel or PDF).") from None
    try:
        r = bank.import_rows(db, rows)
        audit.record(db, owner, "import", "bank_statement", None, after={"file": file.filename, **{k: str(v) for k, v in r.__dict__.items()}})
        db.commit()  # all lines or none
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Another upload was saving at the same time. Upload the file again.") from None
    return ImportOut(**r.__dict__)


@router.get("/bank/txns", response_model=list[BankTxnOut])
def list_txns(state: BankTxnStatus = BankTxnStatus.to_explain, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    bank.refresh_links(db)
    db.commit()
    rows = db.scalars(select(BankTxn).where(BankTxn.status == state).order_by(BankTxn.txn_date.desc(), BankTxn.created_at).limit(300))
    return [_out(db, t, state == BankTxnStatus.to_explain) for t in rows]


@router.get("/bank/txns/{txn_id}", response_model=BankTxnOut)
def get_txn(txn_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    bank.refresh_links(db)
    db.commit()
    return _out(db, _txn(db, txn_id), True)


@router.get("/bank/txns/{txn_id}/candidates")
def txn_candidates(txn_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_owner)) -> list[dict]:
    """Entries already in the books that could be this bank line (same amount, within 3 days)."""
    t = _txn(db, txn_id)
    out = []
    for c in bank.candidates(db, t):
        if isinstance(c, Expense):
            site = db.get(Project, c.project_id).name if c.project_id else "General"
            out.append({"kind": "expense", "id": str(c.id), "date": c.paid_on.isoformat(), "label": f"{db.get(Payee, c.payee_id).name} · {site}"})
        else:
            out.append({"kind": "payment", "id": str(c.id), "date": c.paid_on.isoformat(), "label": db.get(Project, c.project_id).name})
    return out


@router.get("/bank/summary", response_model=BankSummaryOut)
def summary(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    out = bank_summary(db)
    db.commit()
    return out


def bank_summary(db: Session) -> BankSummaryOut:
    bank.refresh_links(db)
    today = today_ist()
    month_start = today.replace(day=1)
    last_month_end = month_start - timedelta(days=1)
    in_month = select(func.count()).select_from(BankTxn).where(BankTxn.txn_date >= month_start)
    last = db.scalar(select(func.max(BankTxn.txn_date)).where(BankTxn.source == BankSource.statement))
    return BankSummaryOut(
        to_explain=db.scalar(select(func.count()).select_from(BankTxn).where(BankTxn.status == BankTxnStatus.to_explain)) or 0,
        month_total=db.scalar(in_month) or 0,
        month_explained=db.scalar(in_month.where(BankTxn.status != BankTxnStatus.to_explain)) or 0,
        last_statement_date=last,
        # Due from the 1st until a statement reaching the last days of last month is uploaded.
        statement_due=last is None or last < last_month_end - timedelta(days=3),
        gaps=bank.balance_gaps(db),
    )


@router.post("/bank/txns/{txn_id}/expense", response_model=BankTxnOut)
def explain_expense(txn_id: uuid.UUID, body: ExplainExpenseIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    t = _txn(db, txn_id)
    _open(t)
    if t.direction != BankDirection.debit:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "money received is recorded as a customer payment")
    payee_id = body.payee_id
    if payee_id is None:
        if body.new_payee is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "choose who was paid")
        payee = Payee(name=body.new_payee.name.strip(), type=body.new_payee.type)
        db.add(payee)
        db.flush()
        audit.record(db, owner, "create", "payee", payee.id, after=audit.snapshot(payee))
        payee_id = payee.id
    e = create_expense(
        ExpenseIn(
            payee_id=payee_id,
            amount_paise=t.amount_paise,
            mode=bank.out_mode(t),
            paid_on=t.txn_date,
            project_id=body.project_id,
            category=body.category,
            trade=body.trade,
            bank_txn_id=t.ref,
            reason=body.reason,
            bill_file_id=body.bill_file_id,
        ),
        db,
        owner,
    )
    expense = db.get(Expense, e.id)
    if body.project_id is None:
        expense.project_id = None  # "General" was chosen; don't fall back to the payee's last site
    bank.link(t, expense)
    return _done(db, owner, t, "explain_expense")


@router.post("/bank/txns/{txn_id}/receipt", response_model=BankTxnOut)
def explain_receipt(txn_id: uuid.UUID, body: ExplainReceiptIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    t = _txn(db, txn_id)
    _open(t)
    if t.direction != BankDirection.credit:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "money paid out is recorded as Money paid")
    p = log_payment(
        body.project_id,
        PaymentIn(amount_paise=t.amount_paise, mode=bank.payment_mode(t), paid_on=t.txn_date, reference=t.ref, milestone_id=body.milestone_id,
                  note="From bank statement"),
        db,
        owner,
    )
    bank.link(t, db.get(CustomerPayment, p.id))
    return _done(db, owner, t, "explain_receipt")


@router.post("/bank/txns/{txn_id}/cash", response_model=BankTxnOut)
def explain_cash(txn_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    """ATM / cash withdrawal goes into the cash box; a cash deposit comes out of it."""
    t = _txn(db, txn_id)
    _open(t)
    c = CashTransfer(kind=bank.cash_kind(t), amount_paise=t.amount_paise, on_date=t.txn_date, note="From bank statement", created_by=owner.id)
    db.add(c)
    db.flush()
    audit.record(db, owner, "create", "cash_transfer", c.id, after=audit.snapshot(c))
    bank.link(t, c)
    return _done(db, owner, t, "explain_cash")


@router.post("/bank/txns/{txn_id}/link", response_model=BankTxnOut)
def link_existing(txn_id: uuid.UUID, body: LinkIn, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    t = _txn(db, txn_id)
    _open(t)
    allowed = {c.id: c for c in bank.candidates(db, t)}
    target = body.expense_id or body.payment_id
    if target not in allowed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "that entry does not match this bank line")
    bank.link(t, allowed[target])
    return _done(db, owner, t, "link")


@router.post("/bank/txns/{txn_id}/personal", response_model=BankTxnOut)
def mark_personal(txn_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    t = _txn(db, txn_id)
    _open(t)
    t.status = BankTxnStatus.personal
    return _done(db, owner, t, "personal")


@router.post("/bank/txns/{txn_id}/reopen", response_model=BankTxnOut)
def reopen(txn_id: uuid.UUID, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    """Undo "personal" or an automatic match. Entries created from this line stay; void them in Money paid if wrong."""
    t = _txn(db, txn_id)
    if t.status == BankTxnStatus.to_explain:
        return _out(db, t, True)
    if t.status == BankTxnStatus.done and not t.auto_matched:
        raise HTTPException(status.HTTP_409_CONFLICT, "void the Money paid / Money received entry instead")
    t.status, t.expense_id, t.payment_id, t.cash_transfer_id, t.auto_matched = BankTxnStatus.to_explain, None, None, None, False
    return _done(db, owner, t, "reopen")
