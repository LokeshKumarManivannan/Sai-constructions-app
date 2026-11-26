"""Excel statements and bill-photo ZIPs for a project or a financial year (April–March).

Money in = confirmed customer payments. Money out = recorded payments, excluding petty-cash
advances to supervisors (what they spend from it is listed instead, so nothing is counted twice).
Each bill photo is named the same in the Excel sheet and in the ZIP, so the CA can match them.
"""

import io
import re
import tempfile
import uuid
import zipfile
from collections import defaultdict
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Customer,
    CustomerPayment,
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    Milestone,
    Payee,
    PaymentStatus,
    Project,
    StoredFile,
)
from app.services import storage
from app.services.change_orders import approved_total
from app.services.files import ALLOWED_TYPES

RUPEE = '"₹"#,##,##0.00'
HEADER_FILL = PatternFill("solid", fgColor="8E3B2E")
MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]


def fy_range(fy: str) -> tuple[date, date]:
    """'2026-27' -> (2026-04-01, 2027-03-31)."""
    m = re.fullmatch(r"(\d{4})-(\d{2})", fy)
    if not m or (int(m.group(1)) + 1) % 100 != int(m.group(2)):
        raise ValueError("financial year must look like 2026-27")
    start = int(m.group(1))
    return date(start, 4, 1), date(start + 1, 3, 31)


def _safe(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")[:40] or "x"


def bill_name(e: Expense, payee: Payee, f: StoredFile) -> str:
    ext = ALLOWED_TYPES.get(f.content_type, ".bin")
    return f"{e.paid_on.isoformat()}_{_safe(payee.name)}_{e.amount_paise // 100}_{str(e.id)[:8]}{ext}"


def _money_in(db: Session, project_id: uuid.UUID | None, start: date | None, end: date | None):
    stmt = (
        select(CustomerPayment, Project, Customer)
        .join(Project, Project.id == CustomerPayment.project_id)
        .join(Customer, Customer.id == Project.customer_id)
        .where(CustomerPayment.status == PaymentStatus.confirmed)
        .order_by(CustomerPayment.paid_on)
    )
    if project_id:
        stmt = stmt.where(CustomerPayment.project_id == project_id)
    if start:
        stmt = stmt.where(CustomerPayment.paid_on >= start, CustomerPayment.paid_on <= end)
    return db.execute(stmt).all()


def _money_out(db: Session, project_id: uuid.UUID | None, start: date | None, end: date | None):
    stmt = (
        select(Expense, Payee)
        .join(Payee, Payee.id == Expense.payee_id)
        .where(Expense.status == ExpenseStatus.active, Expense.category.is_distinct_from(ExpenseCategory.advance))
        .order_by(Expense.paid_on)
    )
    if project_id:
        stmt = stmt.where(Expense.project_id == project_id)
    if start:
        stmt = stmt.where(Expense.paid_on >= start, Expense.paid_on <= end)
    return db.execute(stmt).all()


def _sheet(wb: Workbook, title: str, headers: list[str], rows: list[list], money_cols: set[int], first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = HEADER_FILL
    for r in rows:
        ws.append(r)
    for col in money_cols:
        for row in ws.iter_rows(min_row=2, min_col=col, max_col=col):
            row[0].number_format = RUPEE
    for i, h in enumerate(headers, start=1):
        width = max([len(str(h))] + [len(str(r[i - 1])) for r in rows if r[i - 1] is not None] + [8])
        ws.column_dimensions[get_column_letter(i)].width = min(width + 2, 45)
    ws.freeze_panes = "A2"
    return ws


def _in_rows(rows, with_project: bool, db: Session) -> list[list]:
    out = []
    for p, proj, cust in rows:
        m = db.get(Milestone, p.milestone_id) if p.milestone_id else None
        row = [p.paid_on, p.amount_paise / 100, p.mode.value.replace("_", " "), p.reference or "", m.name if m else "", p.receipt_no]
        if with_project:
            row = [p.paid_on, proj.name, cust.name] + row[1:]
        out.append(row)
    return out


def _out_rows(rows, with_project: bool, db: Session) -> list[list]:
    out = []
    names = {}
    for e, payee in rows:
        f = db.get(StoredFile, e.bill_file_id) if e.bill_file_id else None
        if e.project_id and e.project_id not in names:
            names[e.project_id] = db.get(Project, e.project_id).name
        row = [
            e.paid_on,
            payee.name,
            payee.type.value,
            e.category.value if e.category else "",
            e.trade.value if e.trade else "",
            e.amount_paise / 100,
            e.mode.value,
            e.bank_txn_id or "",
            e.reason or "",
            "supervisor petty cash" if e.spent_from_advance_of else "",
            bill_name(e, payee, f) if f else "MISSING",
        ]
        if with_project:
            row.insert(1, names.get(e.project_id, "General"))
        out.append(row)
    return out


IN_HEADERS = ["Date", "Amount (₹)", "Mode", "Reference / UTR", "Stage", "Receipt no."]
OUT_HEADERS = ["Date", "Paid to", "Payee type", "Category", "Trade", "Amount (₹)", "Mode", "Bank / UPI txn id", "Reason", "Paid from", "Bill file"]


def project_workbook(db: Session, project: Project) -> bytes:
    cust = db.get(Customer, project.customer_id)
    ins = _money_in(db, project.id, None, None)
    outs = _money_out(db, project.id, None, None)
    received = sum(p.amount_paise for p, _, _ in ins) / 100
    spent = sum(e.amount_paise for e, _ in outs) / 100
    extras = approved_total(db, project.id) / 100
    contract = project.contract_value_paise / 100

    wb = Workbook()
    summary = [
        ["Project", project.name],
        ["Customer", cust.name],
        ["Site", project.site_address],
        ["Contract value", contract],
        ["Approved extra work", extras],
        ["Received (confirmed)", received],
        ["Spent", spent],
        ["Received − spent", received - spent],
        ["Still to collect", contract + extras - received],
        ["Expected margin (contract + extras − spent)", contract + extras - spent],
    ]
    ws = _sheet(wb, "Summary", ["Item", "Value"], summary, set(), first=True)
    for row in ws.iter_rows(min_row=5, min_col=2, max_col=2):
        row[0].number_format = RUPEE
    _sheet(wb, "Money in", IN_HEADERS, _in_rows(ins, False, db), {2})
    _sheet(wb, "Money out", OUT_HEADERS, _out_rows(outs, False, db), {6})
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def year_workbook(db: Session, fy: str) -> bytes:
    start, end = fy_range(fy)
    ins = _money_in(db, None, start, end)
    outs = _money_out(db, None, start, end)

    by_month_in = defaultdict(float)
    by_month_out = defaultdict(float)
    for p, _, _ in ins:
        by_month_in[(p.paid_on.month - 4) % 12] += p.amount_paise / 100
    for e, _ in outs:
        by_month_out[(e.paid_on.month - 4) % 12] += e.amount_paise / 100
    by_cat = defaultdict(float)
    for e, _ in outs:
        by_cat[e.category.value if e.category else "not categorised"] += e.amount_paise / 100
    missing_bills = sum(1 for e, _ in outs if not e.bill_file_id)

    wb = Workbook()
    rows = [[MONTHS[i], by_month_in[i], by_month_out[i], by_month_in[i] - by_month_out[i]] for i in range(12)]
    rows.append(["Total", sum(by_month_in.values()), sum(by_month_out.values()), sum(by_month_in.values()) - sum(by_month_out.values())])
    ws = _sheet(wb, f"FY {fy}", ["Month", "Money in (₹)", "Money out (₹)", "Net (₹)"], rows, {2, 3, 4}, first=True)
    ws.append([])
    ws.append(["Money out by category"])
    ws.cell(ws.max_row, 1).font = Font(bold=True)
    for cat, amt in sorted(by_cat.items()):
        ws.append([cat, amt])
        ws.cell(ws.max_row, 2).number_format = RUPEE
    ws.append([])
    ws.append(["Payments without a bill photo", missing_bills])
    ws.append(["Period", f"{start.isoformat()} to {end.isoformat()}"])
    _sheet(wb, "Money in", ["Date", "Project", "Customer"] + IN_HEADERS[1:], _in_rows(ins, True, db), {4})
    _sheet(wb, "Money out", ["Date", "Project"] + OUT_HEADERS[1:], _out_rows(outs, True, db), {7})
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def bills_zip_path(db: Session, project_id: uuid.UUID | None, fy: str | None) -> str:
    """Write the ZIP to a temp file (bills can be large) and return its path."""
    start, end = fy_range(fy) if fy else (None, None)
    tmp = tempfile.NamedTemporaryFile(prefix="bills-", suffix=".zip", delete=False)
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for e, payee in _money_out(db, project_id, start, end):
            if not e.bill_file_id:
                continue
            f = db.get(StoredFile, e.bill_file_id)
            data = storage.load(f.storage_key) if f else None
            if data is not None:
                z.writestr(bill_name(e, payee, f), data)
    tmp.close()
    return tmp.name
