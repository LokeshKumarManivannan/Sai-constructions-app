"""Bank inbox logic: add statement rows once, match them to entries already in the books, and suggest
who / which site for the rest (payee memory + site codes typed in UPI remarks)."""

import hashlib
import re
import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    BankDirection,
    BankSource,
    BankTxn,
    BankTxnStatus,
    CashTransfer,
    CashTransferKind,
    Customer,
    CustomerPayment,
    Expense,
    ExpenseStatus,
    OutMode,
    Payee,
    PaymentMode,
    PaymentStatus,
    Project,
)
from app.services import money
from app.services.bank_statement import Row, parse_narration

MATCH_DAYS = 3


# ---------- site codes ----------

def _code_from_name(name: str) -> str:
    # "Ravi house, Tambaram" -> TAM (the place after the comma), else the first word.
    part = name.split(",")[-1] if "," in name else name
    letters = re.sub(r"[^A-Za-z]", "", part.strip().split(" ")[0] if part.strip() else name)
    return (letters[:3] or "SITE").upper()


def ensure_site_codes(db: Session) -> None:
    taken = {c for c in db.scalars(select(Project.site_code).where(Project.site_code.is_not(None)))}
    for p in db.scalars(select(Project).where(Project.site_code.is_(None)).order_by(Project.created_at)):
        base = _code_from_name(p.name)
        code, n = base, 2
        while code in taken:
            code, n = f"{base}{n}", n + 1
        p.site_code = code
        taken.add(code)
    db.flush()


def site_from_text(db: Session, text: str) -> Project | None:
    words = set(re.findall(r"[A-Z0-9]+", (text or "").upper()))
    for p in db.scalars(select(Project).where(Project.site_code.is_not(None))):
        if p.site_code.upper() in words:
            return p
    return None


# ---------- import ----------

def dedup_keys(rows: list[Row]) -> list[str]:
    """Same bank line -> same key, whether it came from the Excel or the PDF of the same month.

    The running balance pins a line to its place in the account. The occurrence number keeps genuine
    repeats apart (e.g. ₹500 out, ₹500 back, ₹500 out again the same day can end on the same balance).
    Statements always cover whole days, so the count is the same in every file holding that day.
    """
    seen: dict[str, int] = {}
    keys = []
    for r in rows:
        direction = "debit" if r.debit_paise else "credit"
        amount = r.debit_paise or r.credit_paise
        if r.balance_paise is not None:
            base = f"{r.txn_date}|{direction}|{amount}|bal{r.balance_paise}"
        else:
            base = f"{r.txn_date}|{direction}|{amount}|{re.sub(r'[^A-Za-z0-9]', '', r.narration).upper()[:60]}"
        seen[base] = seen.get(base, 0) + 1
        keys.append(hashlib.sha256(f"{base}|#{seen[base]}".encode()).hexdigest()[:40])
    return keys


@dataclass
class ImportResult:
    rows: int
    added: int
    duplicates: int
    matched: int
    to_explain: int
    first_date: date | None
    last_date: date | None
    verified: bool  # every line proved by the running balance


def import_rows(db: Session, rows: list[Row], source: BankSource = BankSource.statement) -> ImportResult:
    """Rows must be oldest first (read_statement guarantees it). All-or-nothing: the caller commits once."""
    ensure_site_codes(db)
    added = dup = matched = 0
    day_pos: dict[date, int] = {}
    for r, key in zip(rows, dedup_keys(rows)):
        day_pos[r.txn_date] = day_pos.get(r.txn_date, 0) + 1
        if db.scalar(select(BankTxn.id).where(BankTxn.dedup_key == key)):
            dup += 1
            continue
        n = parse_narration(r.narration, r.cheque)
        t = BankTxn(
            txn_date=r.txn_date,
            amount_paise=r.debit_paise or r.credit_paise,
            direction=BankDirection.debit if r.debit_paise else BankDirection.credit,
            narration=r.narration,
            ref=n.ref,
            counterparty=n.counterparty,
            counterparty_key=n.key,
            balance_paise=r.balance_paise,
            day_seq=day_pos[r.txn_date],
            raw_line=r.raw or r.narration,
            verified=r.verified,
            source=source,
            dedup_key=key,
        )
        db.add(t)
        db.flush()
        added += 1
        if auto_match(db, t):
            matched += 1
    dates = [r.txn_date for r in rows]
    return ImportResult(len(rows), added, dup, matched, added - matched, min(dates, default=None), max(dates, default=None),
                        all(r.verified for r in rows))


def balance_gaps(db: Session) -> list[tuple[date, date]]:
    """Across everything uploaded so far: places where the running balance jumps, i.e. a period whose
    statement is missing. Returns (last date before the jump, first date after it)."""
    prev = None
    gaps = []
    rows = db.scalars(
        select(BankTxn).where(BankTxn.balance_paise.is_not(None)).order_by(BankTxn.txn_date, BankTxn.day_seq, BankTxn.created_at)
    )
    for t in rows:
        if prev is not None:
            delta = -t.amount_paise if t.direction == BankDirection.debit else t.amount_paise
            if prev.balance_paise + delta != t.balance_paise:
                gaps.append((prev.txn_date, t.txn_date))
        prev = t
    return gaps


# ---------- matching to entries already in the books ----------

def _linked_ids(db: Session, col) -> set:
    return set(db.scalars(select(col).where(col.is_not(None))))


def candidates(db: Session, t: BankTxn) -> list:
    lo, hi = t.txn_date - timedelta(days=MATCH_DAYS), t.txn_date + timedelta(days=MATCH_DAYS)
    if t.direction == BankDirection.debit:
        used = _linked_ids(db, BankTxn.expense_id)
        rows = db.scalars(
            select(Expense).where(
                Expense.status == ExpenseStatus.active,
                Expense.amount_paise == t.amount_paise,
                Expense.mode != OutMode.cash,
                Expense.spent_from_advance_of.is_(None),
                Expense.paid_on.between(lo, hi),
            )
        )
        return [e for e in rows if e.id not in used]
    used = _linked_ids(db, BankTxn.payment_id)
    rows = db.scalars(
        select(CustomerPayment).where(
            CustomerPayment.status != PaymentStatus.void,
            CustomerPayment.amount_paise == t.amount_paise,
            CustomerPayment.mode != PaymentMode.cash,
            CustomerPayment.paid_on.between(lo, hi),
        )
    )
    return [p for p in rows if p.id not in used]


def _ref_of(entry) -> str:
    return (getattr(entry, "bank_txn_id", None) or getattr(entry, "reference", None) or "").upper()


def auto_match(db: Session, t: BankTxn) -> bool:
    """Link automatically only on the same transaction reference (UPI / IMPS / NEFT / cheque number).
    Same amount alone is never enough: two ₹5,000 payments to different people would get swapped.
    Those are offered as "Already recorded?" for the owner to tap."""
    if not t.ref:
        return False
    ref = t.ref.upper()
    same = [c for c in candidates(db, t) if _ref_of(c) and (ref in _ref_of(c) or _ref_of(c) in ref)]
    if len(same) != 1:
        return False
    link(t, same[0])
    t.auto_matched = True
    return True


def refresh_links(db: Session) -> None:
    """If an entry a bank line was explained with is later voided, follow it to its correction
    (same amount) or put the bank line back on the "to explain" list, so it can't silently drop out."""
    for t in db.scalars(select(BankTxn).where(BankTxn.status == BankTxnStatus.done)):
        entry = db.get(Expense, t.expense_id) if t.expense_id else db.get(CustomerPayment, t.payment_id) if t.payment_id else None
        if entry is None or entry.status.value != "void":
            continue
        model = type(entry)
        fix = db.scalar(select(model).where(model.corrects_id == entry.id, model.status != entry.status))
        if fix is not None and fix.amount_paise == t.amount_paise:
            link(t, fix)
        else:
            t.status, t.expense_id, t.payment_id, t.auto_matched = BankTxnStatus.to_explain, None, None, False
    db.flush()


def link(t: BankTxn, entry) -> None:
    if isinstance(entry, Expense):
        t.expense_id = entry.id
    elif isinstance(entry, CustomerPayment):
        t.payment_id = entry.id
    elif isinstance(entry, CashTransfer):
        t.cash_transfer_id = entry.id
    t.status = BankTxnStatus.done


# ---------- suggestions for unexplained lines ----------

@dataclass
class Suggestion:
    kind: str  # expense | receipt | cash
    payee_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    category: str | None = None
    milestone_id: uuid.UUID | None = None
    why: str | None = None  # memory | site_code | customer_name | atm


def suggest(db: Session, t: BankTxn) -> Suggestion:
    n = parse_narration(t.narration)
    if n.is_cash:
        return Suggestion(kind="cash", why="atm")
    site = site_from_text(db, t.narration)

    if t.direction == BankDirection.debit:
        s = Suggestion(kind="expense", project_id=site.id if site else None, why="site_code" if site else None)
        if t.counterparty_key:
            prev = db.scalar(
                select(Expense)
                .join(BankTxn, BankTxn.expense_id == Expense.id)
                .where(BankTxn.counterparty_key == t.counterparty_key, BankTxn.id != t.id)
                .order_by(BankTxn.txn_date.desc())
                .limit(1)
            )
            if prev:
                payee = db.get(Payee, prev.payee_id)
                s.payee_id = payee.id
                s.category = (payee.default_category or prev.category).value if (payee.default_category or prev.category) else None
                if s.project_id is None:
                    s.project_id = payee.default_project_id or prev.project_id
                s.why = s.why or "memory"
        return s

    s = Suggestion(kind="receipt", project_id=site.id if site else None, why="site_code" if site else None)
    if s.project_id is None and t.counterparty:
        words = {w.lower() for w in re.findall(r"[A-Za-z]{3,}", t.counterparty)}
        for cust in db.scalars(select(Customer)):
            if words & {w.lower() for w in re.findall(r"[A-Za-z]{3,}", cust.name)}:
                proj = db.scalar(select(Project).where(Project.customer_id == cust.id).order_by(Project.created_at.desc()).limit(1))
                if proj:
                    s.project_id, s.why = proj.id, "customer_name"
                    break
    if s.project_id:
        nd = money.next_due(db, s.project_id)
        if nd:
            s.milestone_id = nd.milestone_id
    return s


def payment_mode(t: BankTxn) -> PaymentMode:
    return PaymentMode.upi if parse_narration(t.narration).mode == "upi" else PaymentMode.bank_transfer


def out_mode(t: BankTxn) -> OutMode:
    return OutMode.upi if parse_narration(t.narration).mode == "upi" else OutMode.bank


def cash_kind(t: BankTxn) -> CashTransferKind:
    # Money leaving the bank as cash goes into the cash box, and the reverse.
    return CashTransferKind.withdrawal if t.direction == BankDirection.debit else CashTransferKind.deposit
