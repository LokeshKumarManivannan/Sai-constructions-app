"""Read a bank statement file (ICICI net-banking download first) into plain transaction rows.

Tolerant by design: finds the header row by its words (remarks / withdrawal / deposit), so the bank's
title rows, account details and footer lines are skipped. Accepts .xls, .xlsx, .csv and the HTML-in-.xls
files some banks send.
"""

import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser

import pdfplumber
import xlrd
from openpyxl import load_workbook
from pdfminer.pdfdocument import PDFPasswordIncorrect


@dataclass
class Row:
    txn_date: date
    debit_paise: int
    credit_paise: int
    narration: str
    balance_paise: int | None
    cheque: str | None


class StatementError(ValueError):
    pass


class PasswordNeeded(StatementError):
    """The PDF is locked; ask for the password (ICICI: usually date of birth as DDMMYYYY)."""


# ---------- file -> grid of cells ----------

class _Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


_DATE_START = re.compile(r"^\s*(\d{1,2}[/\-. ](\d{1,2}|[A-Za-z]{3})[/\-. ,]+\d{2,4})\b")
_AMOUNT = re.compile(r"(?<![\w/])-?\d{1,3}(?:,\d{2,3})*(?:\.\d{2})(?![\w/])|(?<![\w/,])-?\d+\.\d{2}(?![\w/])")


def _open_pdf(data: bytes, password: str | None):
    try:
        return pdfplumber.open(io.BytesIO(data), password=password or "")
    except PDFPasswordIncorrect:
        raise PasswordNeeded("This PDF is locked. Enter its password (for ICICI, usually the date of birth as DDMMYYYY).") from None
    except Exception as e:  # pdfminer raises several types for locked files
        if "password" in str(e).lower() or "encrypt" in str(e).lower():
            raise PasswordNeeded("This PDF is locked. Enter its password (for ICICI, usually the date of birth as DDMMYYYY).") from None
        raise


def _join_wrapped(prev: str, extra: str) -> str:
    """Bank remarks like "UPI/4311.../ramesh.mason@ybl" have no spaces, so a PDF wraps them mid-word:
    glue those back without a space; ordinary words get a space."""
    prev, extra = prev.rstrip(), extra.strip()
    last = prev.split(" ")[-1] if prev else ""
    glue = ("/" in last or "@" in last or len(last) > 20) and not prev.endswith((" ", "-"))
    return f"{prev}{'' if glue else ' '}{extra}".strip()


def _pdf_grid(data: bytes, password: str | None) -> list[list]:
    """Every table row on every page, top to bottom. Pages after the first usually repeat no header,
    so the rows simply continue under the header found on page 1."""
    rows: list[list] = []
    with _open_pdf(data, password) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables() or page.extract_tables({"vertical_strategy": "text", "horizontal_strategy": "text"})
            for tbl in tables:
                rows.extend([[" ".join(str(c or "").split()) for c in r] for r in tbl])
    return rows


def _pdf_lines(data: bytes, password: str | None) -> list[Row]:
    """Fallback for PDFs without a readable table: one transaction per line that starts with a date.
    In/out comes from the running balance (balance went down = money out)."""
    out: list[Row] = []
    prev_bal: int | None = None
    current: dict | None = None

    def flush():
        nonlocal prev_bal, current
        if current is None:
            return
        amounts = current["amounts"]
        if len(amounts) >= 2:
            amount, bal = abs(amounts[-2]), amounts[-1]
            if prev_bal is not None:
                debit = bal < prev_bal
            else:
                debit = bool(re.search(r"\b(DR|WDL|DEBIT|TO)\b", current["text"].upper()))
            out.append(Row(current["date"], amount if debit else 0, 0 if debit else amount, current["text"].strip(), bal, None))
            prev_bal = bal
        elif len(amounts) == 1 and re.search(r"opening|b/f|brought", current["text"], re.I):
            prev_bal = amounts[0]
        current = None

    with _open_pdf(data, password) as pdf:
        for page in pdf.pages:
            for line in (page.extract_text() or "").splitlines():
                m = _DATE_START.match(line)
                if m and parse_date(m.group(1)):
                    flush()
                    rest = line[m.end():]
                    nums = [parse_paise(a) for a in _AMOUNT.findall(rest)]
                    current = {"date": parse_date(m.group(1)), "text": _AMOUNT.sub(" ", rest), "amounts": nums}
                elif current is not None and not _AMOUNT.search(line) and len(line) < 120:
                    current["text"] = _join_wrapped(current["text"], line)  # wrapped remarks
                else:
                    flush()
                    if re.search(r"opening balance|\bb/f\b|brought forward", line, re.I) and _AMOUNT.search(line):
                        prev_bal = parse_paise(_AMOUNT.findall(line)[-1])
        flush()
    return out


def _grid(data: bytes, filename: str) -> list[list]:
    name = filename.lower()
    head = data[:512].lstrip().lower()
    if head.startswith(b"<"):
        p = _Tables()
        p.feed(data.decode("utf-8", errors="replace"))
        return p.rows
    if data[:4] == b"PK\x03\x04" or name.endswith(".xlsx"):
        ws = load_workbook(io.BytesIO(data), read_only=True, data_only=True).active
        return [list(r) for r in ws.iter_rows(values_only=True)]
    if data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" or name.endswith(".xls"):
        book = xlrd.open_workbook(file_contents=data)
        sh = book.sheet_by_index(0)
        out = []
        for r in range(sh.nrows):
            row = []
            for c in range(sh.ncols):
                cell = sh.cell(r, c)
                if cell.ctype == xlrd.XL_CELL_DATE:
                    row.append(xlrd.xldate.xldate_as_datetime(cell.value, book.datemode))
                else:
                    row.append(cell.value)
            out.append(row)
        return out
    if name.endswith(".csv") or b"," in data[:2000]:
        return list(csv.reader(io.StringIO(data.decode("utf-8-sig", errors="replace"))))
    raise StatementError("Upload the statement as Excel (.xls or .xlsx) or CSV from net banking.")


# ---------- header detection ----------

def _norm(v) -> str:
    return " ".join(str(v or "").lower().replace("\n", " ").split())


def _find_columns(grid: list[list]) -> tuple[int, dict[str, int]]:
    for i, row in enumerate(grid[:80]):
        cells = [_norm(c) for c in row]
        cols: dict[str, int] = {}
        for j, c in enumerate(cells):
            if not c:
                continue
            if "narration" not in cols and re.search(r"remark|narration|particular|description|details", c):
                cols["narration"] = j
            elif "debit" not in cols and re.search(r"withdrawal|debit|\bdr\b", c):
                cols["debit"] = j
            elif "credit" not in cols and re.search(r"deposit|credit|\bcr\b", c):
                cols["credit"] = j
            elif "balance" not in cols and "balance" in c:
                cols["balance"] = j
            elif "cheque" not in cols and re.search(r"cheque|chq|ref", c):
                cols["cheque"] = j
            elif re.search(r"date", c):
                # Prefer the transaction date over the value date.
                if "date" not in cols or "transaction" in c or "txn" in c:
                    cols["date"] = j
        if {"narration", "debit", "credit", "date"} <= cols.keys():
            return i, cols
    raise StatementError("Could not find the transactions table (Date, Remarks, Withdrawal, Deposit) in this file.")


# ---------- cell parsing ----------

_MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def parse_date(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)) and 20000 < v < 80000:  # Excel serial number
        return date(1899, 12, 30) + timedelta(days=int(v))
    s = str(v or "").strip()
    m = re.match(r"^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})", s)
    if m:
        d, mo, y = map(int, m.groups())
        y = y + 2000 if y < 100 else y
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    m = re.match(r"^(\d{1,2})[/\-. ]([A-Za-z]{3})[A-Za-z]*[/\-. ,]+(\d{2,4})", s)
    if m and m.group(2).lower() in _MONTHS:
        y = int(m.group(3))
        y = y + 2000 if y < 100 else y
        return date(y, _MONTHS[m.group(2).lower()], int(m.group(1)))
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return date(*map(int, m.groups()))
    return None


def parse_paise(v) -> int:
    if v is None or v == "":
        return 0
    if isinstance(v, (int, float)):
        return int(round(Decimal(str(v)) * 100))
    s = re.sub(r"[,\s₹]|INR|Rs\.?|\(?(Cr|Dr)\)?", "", str(v), flags=re.I)
    if s in ("", "-", "--"):
        return 0
    try:
        return int((Decimal(s) * 100).to_integral_value())
    except InvalidOperation:
        return 0


def read_statement(data: bytes, filename: str, password: str | None = None) -> list[Row]:
    if data[:5] == b"%PDF-" or filename.lower().endswith(".pdf"):
        grid = _pdf_grid(data, password)
        try:
            hdr, cols = _find_columns(grid)
        except StatementError:
            rows = _pdf_lines(data, password)
            if not rows:
                raise StatementError("Could not read the transactions in this PDF. Try the Excel download from net banking.") from None
            return rows
    else:
        grid = _grid(data, filename)
        hdr, cols = _find_columns(grid)
    rows: list[Row] = []
    for raw in grid[hdr + 1 :]:
        cell = lambda k: raw[cols[k]] if k in cols and cols[k] < len(raw) else None  # noqa: E731
        d = parse_date(cell("date"))
        if d is None:
            # A remark that wrapped onto the next table row (PDFs): add it to the previous transaction.
            extra = " ".join(str(cell("narration") or "").split())
            if rows and extra and not parse_paise(cell("debit")) and not parse_paise(cell("credit")):
                rows[-1].narration = _join_wrapped(rows[-1].narration, extra)
            continue  # blank lines, page breaks, footer totals
        debit, credit = abs(parse_paise(cell("debit"))), abs(parse_paise(cell("credit")))
        if debit == 0 and credit == 0:
            continue
        bal = cell("balance")
        chq = str(cell("cheque") or "").strip() or None
        rows.append(
            Row(
                txn_date=d,
                debit_paise=debit,
                credit_paise=credit,
                narration=" ".join(str(cell("narration") or "").split()),
                balance_paise=parse_paise(bal) if bal not in (None, "") else None,
                cheque=None if chq in ("-", "0", "0.0") else chq,
            )
        )
    if not rows:
        raise StatementError("No transactions found in this file.")
    return rows


# ---------- narration: reference, counterparty, cash ----------

_STOP = {
    "upi", "neft", "imps", "rtgs", "mmt", "inf", "inft", "bil", "onl", "ach", "nach", "pos", "atm", "nfs", "cash", "wdl",
    "payment", "pay", "paid", "to", "from", "by", "transfer", "trf", "bank", "ltd", "limited", "the", "ph", "phone",
    "sent", "using", "paytm", "gpay", "phonepe", "mob", "na", "rev", "chq", "clg", "icici", "sbi", "hdfc", "axis",
}


@dataclass
class Narration:
    ref: str | None
    counterparty: str | None
    key: str | None
    is_cash: bool  # ATM / cash withdrawal or deposit
    mode: str  # upi | bank


def parse_narration(text: str, cheque: str | None = None) -> Narration:
    t = text or ""
    up = t.upper()
    ref = None
    m = re.search(r"(?<!\d)(\d{12})(?!\d)", t)  # UPI RRN / IMPS
    if m:
        ref = m.group(1)
    else:
        m = re.search(r"\b([A-Z]{4}[A-Z0-9]{11,18})\b", up)  # NEFT / RTGS UTR
        if m:
            ref = m.group(1)
    if ref is None and cheque:
        ref = cheque

    vpa = re.search(r"([A-Za-z0-9._\-]+@[A-Za-z]+)", t)
    name = None
    for part in re.split(r"[/\-:|]", t):
        p = " ".join(part.split())
        words = [w for w in re.findall(r"[A-Za-z]+", p)]
        if not words or "@" in p or sum(ch.isdigit() for ch in p) > 3:
            continue
        if all(w.lower() in _STOP for w in words) or len("".join(words)) < 3:
            continue
        name = p.title()
        break
    key = (vpa.group(1).lower() if vpa else None) or (re.sub(r"[^a-z]", "", name.lower()) if name else None)
    is_cash = bool(re.search(r"\b(ATM|NFS|CASH ?WDL|CASH ?WITHDRAWAL|CASH DEP|BY CASH|CASH DEPOSIT|CDM)\b", up))
    return Narration(
        ref=ref,
        # A UPI ID identifies the person exactly; the free text around it is often the remark or bank name.
        counterparty=(vpa.group(1).lower() if vpa else name),
        key=key[:160] if key else None,
        is_cash=is_cash,
        mode="upi" if up.startswith("UPI") or "/UPI" in up or vpa else "bank",
    )
