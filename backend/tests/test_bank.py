import io
from datetime import date

from openpyxl import Workbook

from app.services.bank_statement import parse_narration, read_statement
from tests.helpers import setup_project
from tests.test_books import payee

HEADERS = ["S No.", "Value Date", "Transaction Date", "Cheque Number", "Transaction Remarks",
           "Withdrawal Amount (INR )", "Deposit Amount (INR )", "Balance (INR )"]


def icici_xlsx(rows: list[tuple]) -> bytes:
    """Mimic the ICICI net-banking download: title and account rows above the table, a footer below."""
    wb = Workbook()
    ws = wb.active
    ws.append([])
    ws.append([None, "DETAILED STATEMENT"])
    ws.append([None, "Account Number", "XXXXXXXX1234 ( INR ) - SAI CONSTRUCTIONS"])
    ws.append([None, "Transaction Date from", "01/11/2026", "to", "30/11/2026"])
    ws.append([])
    ws.append([None, *HEADERS])
    bal = 10_00_000.0
    for i, (d, remarks, wd, dep) in enumerate(rows, 1):
        bal = bal - wd + dep
        ws.append([None, i, d, d, "-", remarks, f"{wd:,.2f}" if wd else "0.00", f"{dep:,.2f}" if dep else "0.00", f"{bal:,.2f}"])
    ws.append([])
    ws.append([None, "Legends Used in Account Statement"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


ROWS = [
    ("03/11/2026", "UPI/431122334455/RAV cement/sriram.traders@okaxis/AXIS BANK/AXI1234", 18_000, 0),
    ("05/11/2026", "UPI/431199887766/Payment from Ph/ramesh.mason@ybl/YES BANK LIMITED YBS", 5_000, 0),
    ("07/11/2026", "NFS/CASH WDL/07-11-26/ANNA NAGAR", 10_000, 0),
    ("10/11/2026", "MMT/IMPS/431455667788/RAVI KUMAR/HDFC BANK", 0, 2_00_000),
    ("12/11/2026", "UPI/431500011122/groceries/bigbasket@icici/ICICI Bank", 2_350, 0),
    ("14/11/2026", "UPI/431600022233/wages/ramesh.mason@ybl/YES BANK LIMITED YBS", 6_000, 0),
]


def _upload(client, owner, data: bytes, name="OpTransactionHistory.xlsx"):
    return client.post("/bank/import", files={"file": (name, data, "application/octet-stream")}, headers=owner)


def test_reader_and_narration():
    rows = read_statement(icici_xlsx(ROWS), "x.xlsx")
    assert len(rows) == 6 and rows[0].txn_date == date(2026, 11, 3) and rows[0].debit_paise == 18_000_00
    assert rows[3].credit_paise == 2_00_000_00 and rows[0].balance_paise == 9_82_000_00
    n = parse_narration(ROWS[1][1])
    assert n.ref == "431199887766" and n.key == "ramesh.mason@ybl" and n.mode == "upi" and not n.is_cash
    assert parse_narration(ROWS[2][1]).is_cash
    assert parse_narration(ROWS[3][1]).counterparty == "Ravi Kumar"
    assert parse_narration(ROWS[1][1]).counterparty == "ramesh.mason@ybl"
    html = b"<table><tr><td>Transaction Date</td><td>Transaction Remarks</td><td>Withdrawal Amount</td><td>Deposit Amount</td></tr>" \
           b"<tr><td>01-Nov-2026</td><td>UPI/431100000001/x/a@ybl</td><td>1,200.00</td><td></td></tr></table>"
    assert read_statement(html, "a.xls")[0].debit_paise == 1_200_00


def test_import_match_explain(client, owner):
    p, cust = setup_project(client, owner)
    proj = client.get(f"/projects/{p['id']}", headers=owner).json()
    assert proj["site_code"] == "RAV"
    # Already recorded by hand: the cement payment, so it should match itself.
    sriram = client.post("/payees", json={"name": "Sriram Traders", "type": "supplier"}, headers=owner).json()
    client.post("/expenses", json={"payee_id": sriram["id"], "amount_paise": 18_000_00, "mode": "upi", "paid_on": "2026-11-03",
                                   "project_id": p["id"], "category": "material", "bank_txn_id": "431122334455"}, headers=owner)

    r = _upload(client, owner, icici_xlsx(ROWS)).json()
    assert r == {**r, "rows": 6, "added": 6, "duplicates": 0, "matched": 1, "to_explain": 5}
    assert _upload(client, owner, icici_xlsx(ROWS)).json()["duplicates"] == 6  # same file again: nothing doubled

    todo = {t["narration"][:12]: t for t in client.get("/bank/txns", headers=owner).json()}
    assert todo["NFS/CASH WDL"]["suggestion"]["kind"] == "cash"
    credit = todo["MMT/IMPS/431"]
    assert credit["suggestion"]["project_id"] == p["id"] and credit["suggestion"]["why"] == "customer_name"

    # Ramesh: first time asks, second time remembered.
    first = next(t for t in todo.values() if t["ref"] == "431199887766")
    assert first["suggestion"]["payee_id"] is None
    done = client.post(f"/bank/txns/{first['id']}/expense", json={"new_payee": {"name": "Ramesh mason", "type": "labour"},
                                                                  "project_id": p["id"], "category": "labour", "reason": "Wages"}, headers=owner)
    assert done.json()["status"] == "done" and done.json()["linked"]["label"] == "Ramesh mason · Ravi house"
    second = client.get(f"/bank/txns/{next(t for t in todo.values() if t['ref'] == '431600022233')['id']}", headers=owner).json()
    assert second["suggestion"]["payee_name"] == "Ramesh mason" and second["suggestion"]["project_id"] == p["id"]
    assert second["suggestion"]["category"] == "labour"

    # Customer credit -> money received, waiting for the customer to confirm.
    rec = client.post(f"/bank/txns/{credit['id']}/receipt", json={"project_id": p["id"]}, headers=owner).json()
    assert rec["linked"]["kind"] == "payment"
    pays = client.get(f"/projects/{p['id']}/payments", headers=owner).json()
    assert pays[0]["amount_paise"] == 2_00_000_00 and pays[0]["reference"] == "431455667788"

    # ATM -> cash box; groceries -> personal (then undo).
    client.post(f"/bank/txns/{todo['NFS/CASH WDL']['id']}/cash", headers=owner)
    groc = next(t for t in todo.values() if t["ref"] == "431500011122")
    assert client.post(f"/bank/txns/{groc['id']}/personal", headers=owner).json()["status"] == "personal"
    assert client.post(f"/bank/txns/{groc['id']}/reopen", headers=owner).json()["status"] == "to_explain"
    client.post(f"/bank/txns/{groc['id']}/personal", headers=owner)

    left = client.get("/bank/txns", headers=owner).json()
    assert [t["ref"] for t in left] == ["431600022233"]
    assert client.post(f"/bank/txns/{groc['id']}/personal", headers=owner).status_code == 409
    kinds = {n["kind"] for n in client.get("/notifications", headers=owner).json()}
    assert "bank_to_explain" in kinds


def test_bank_rules(client, owner):
    p, cust = setup_project(client, owner)
    assert client.get("/bank/txns", headers=cust).status_code == 403
    assert _upload(client, owner, b"hello", "notes.txt").status_code == 422
    assert client.patch(f"/projects/{p['id']}", json={"site_code": "tmb"}, headers=owner).json()["site_code"] == "TMB"
    assert client.patch(f"/projects/{p['id']}", json={"site_code": "a b"}, headers=owner).status_code == 422
    _upload(client, owner, icici_xlsx([("03/11/2026", "UPI/431122334455/TMB tiles/x@okaxis", 500, 0)]))
    t = client.get("/bank/txns", headers=owner).json()[0]
    assert t["suggestion"]["project_id"] == p["id"] and t["suggestion"]["why"] == "site_code"
    assert client.post(f"/bank/txns/{t['id']}/receipt", json={"project_id": p["id"]}, headers=owner).status_code == 422
    ramesh = payee(client, owner)
    g = client.post(f"/bank/txns/{t['id']}/expense", json={"payee_id": ramesh["id"], "category": "other"}, headers=owner).json()
    assert g["linked"]["label"].endswith("General")


# ---------- PDF statements ----------

def icici_pdf(rows: list[tuple], password: str | None = None, ruled: bool = True) -> bytes:
    """ICICI e-statement style: DATE | MODE | PARTICULARS | DEPOSITS | WITHDRAWALS | BALANCE.
    Long remarks wrap onto a second table row; the table continues onto page 2 without a header."""
    import pytest

    rl = pytest.importorskip("reportlab")  # noqa: F841  (test-only dependency)
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.pdfencrypt import StandardEncryption
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet

    buf = io.BytesIO()
    enc = StandardEncryption(password, canPrint=1) if password else None
    doc = SimpleDocTemplate(buf, pagesize=A4, encrypt=enc)
    style = getSampleStyleSheet()["Normal"]
    head = [["DATE", "MODE**", "PARTICULARS", "DEPOSITS", "WITHDRAWALS", "BALANCE"]]
    body, bal = [], 10_00_000.0
    body.append(["", "", "B/F", "", "", f"{bal:,.2f}"])
    for d, remarks, wd, dep in rows:
        bal = bal - wd + dep
        first, rest = remarks[:34], remarks[34:]
        body.append([d, "", first, f"{dep:,.2f}" if dep else "", f"{wd:,.2f}" if wd else "", f"{bal:,.2f}"])
        if rest:
            body.append(["", "", rest, "", "", ""])
    ts = TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)] if ruled else [])
    half = len(body) // 2
    story = [Paragraph("Statement of Transactions in Savings Account Number: XXXXXXXX1234", style),
             Table(head + body[:half], style=ts), PageBreak(), Table(body[half:], style=ts)]
    doc.build(story)
    return buf.getvalue()


def test_pdf_table_and_wrapped_remarks():
    rows = read_statement(icici_pdf(ROWS), "Statement.pdf")
    assert len(rows) == 6
    assert rows[1].debit_paise == 5_000_00 and "ramesh.mason@ybl" in rows[1].narration  # wrapped part joined
    assert rows[3].credit_paise == 2_00_000_00 and rows[3].txn_date == date(2026, 11, 10)
    assert parse_narration(rows[1].narration).ref == "431199887766"


def test_pdf_without_table_lines_uses_balance():
    rows = read_statement(icici_pdf(ROWS, ruled=False), "Statement.pdf")
    assert [r.debit_paise // 100 for r in rows] == [18_000, 5_000, 10_000, 0, 2_350, 6_000]
    assert rows[3].credit_paise == 2_00_000_00


def test_locked_pdf(client, owner):
    data = icici_pdf(ROWS, password="01011960")
    r = client.post("/bank/import", files={"file": ("Statement.pdf", data, "application/pdf")}, headers=owner)
    assert r.status_code == 423
    r = client.post("/bank/import", files={"file": ("Statement.pdf", data, "application/pdf")}, data={"password": "01011960"}, headers=owner)
    assert r.status_code == 200 and r.json()["added"] == 6


# ---------- integrity: nothing doubled, nothing missed, nothing changed ----------

def test_excel_then_pdf_same_month_not_doubled(client, owner):
    assert _upload(client, owner, icici_xlsx(ROWS)).json()["added"] == 6
    r = client.post("/bank/import", files={"file": ("s.pdf", icici_pdf(ROWS), "application/pdf")}, headers=owner).json()
    assert r["added"] == 0 and r["duplicates"] == 6
    # Overlapping download (same days plus one new day) adds only the new day.
    more = ROWS + [("20/11/2026", "UPI/431700099911/tiles/kumar.tiles@okhdfc", 7_500, 0)]
    r = _upload(client, owner, icici_xlsx(more)).json()
    assert r["added"] == 1 and r["duplicates"] == 6


def test_genuine_repeats_kept():
    # ₹500 out, ₹500 back (failed payment refund), ₹500 out again: two lines end on the same balance.
    rows = [("05/11/2026", "UPI/431100000001/retry/a@ybl", 500, 0),
            ("05/11/2026", "UPI/431100000001/REV/a@ybl", 0, 500),
            ("05/11/2026", "UPI/431100000002/retry/a@ybl", 500, 0)]
    parsed = read_statement(icici_xlsx(rows), "x.xlsx")
    from app.services.bank import dedup_keys
    assert len(parsed) == 3 and len(set(dedup_keys(parsed))) == 3


def test_missing_or_misread_line_rejects_whole_file(client, owner):
    data = icici_xlsx(ROWS)
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(data))
    ws = wb.active
    ws.delete_rows(9)  # drop one transaction but keep the others' balances
    buf = io.BytesIO()
    wb.save(buf)
    r = _upload(client, owner, buf.getvalue())
    assert r.status_code == 422 and "balance does not add up" in r.json()["detail"]
    assert client.get("/bank/txns", headers=owner).json() == []  # nothing imported

    wb = load_workbook(io.BytesIO(data))
    wb.active["G9"] = "50,000.00"  # misread amount
    buf = io.BytesIO()
    wb.save(buf)
    assert _upload(client, owner, buf.getvalue()).status_code == 422


def test_newest_first_download_and_raw_kept(client, owner):
    wb_rows = icici_xlsx(ROWS)
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(wb_rows))
    ws = wb.active
    body = [list(r) for r in ws.iter_rows(min_row=7, max_row=12, values_only=True)]
    for i, r in enumerate(reversed(body)):
        for j, v in enumerate(r, 1):
            ws.cell(7 + i, j, v)
    buf = io.BytesIO()
    wb.save(buf)
    rows = read_statement(buf.getvalue(), "x.xlsx")
    assert [r.txn_date.day for r in rows] == [3, 5, 7, 10, 12, 14] and all(r.verified for r in rows)
    r = _upload(client, owner, buf.getvalue()).json()
    assert r["verified"] and r["added"] == 6
    t = client.get("/bank/txns", headers=owner).json()[0]
    assert "ramesh.mason@ybl" in t["raw_line"] and t["verified"]


def test_amount_alone_never_auto_links(client, owner):
    p, _ = setup_project(client, owner)
    ramesh = payee(client, owner)
    # Recorded by hand without a transaction id; the bank line has the same amount and date.
    client.post("/expenses", json={"payee_id": ramesh["id"], "amount_paise": 5_000_00, "mode": "upi", "paid_on": "2026-11-05"}, headers=owner)
    r = _upload(client, owner, icici_xlsx(ROWS)).json()
    assert r["matched"] == 0
    line = next(t for t in client.get("/bank/txns", headers=owner).json() if t["ref"] == "431199887766")
    cands = client.get(f"/bank/txns/{line['id']}/candidates", headers=owner).json()
    assert len(cands) == 1  # offered, owner taps to confirm
    done = client.post(f"/bank/txns/{line['id']}/link", json={"expense_id": cands[0]["id"]}, headers=owner).json()
    assert done["status"] == "done" and done["amount_paise"] == 5_000_00


def test_voided_entry_puts_bank_line_back(client, owner):
    p, _ = setup_project(client, owner)
    _upload(client, owner, icici_xlsx(ROWS))
    line = next(t for t in client.get("/bank/txns", headers=owner).json() if t["ref"] == "431199887766")
    done = client.post(f"/bank/txns/{line['id']}/expense", json={"new_payee": {"name": "Ramesh", "type": "labour"}, "category": "labour"}, headers=owner).json()
    client.post(f"/expenses/{done['linked']['id']}/void", headers=owner)
    again = client.get(f"/bank/txns/{line['id']}", headers=owner).json()
    assert again["status"] == "to_explain" and again["linked"] is None


def test_gap_between_uploads_is_flagged(client, owner):
    _upload(client, owner, icici_xlsx(ROWS[:2]))
    # Next upload starts from a balance that doesn't follow on: the lines in between were never uploaded.
    later = icici_xlsx([("25/11/2026", "UPI/431900000001/x/b@ybl", 1_000, 0), ("26/11/2026", "UPI/431900000002/y/b@ybl", 1_000, 0)])
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(later))
    wb.active["I7"], wb.active["I8"] = "5,00,000.00", "4,99,000.00"
    buf = io.BytesIO()
    wb.save(buf)
    assert _upload(client, owner, buf.getvalue()).status_code == 200
    s = client.get("/bank/summary", headers=owner).json()
    assert s["gaps"] == [["2026-11-05", "2026-11-25"]]
    assert "bank_gap" in {n["kind"] for n in client.get("/notifications", headers=owner).json()}


def test_reference_match_even_when_entered_late(client, owner):
    p, _ = setup_project(client, owner)
    ramesh = payee(client, owner)
    # Entered in the app three weeks after paying, with the UPI reference.
    client.post("/expenses", json={"payee_id": ramesh["id"], "amount_paise": 5_000_00, "mode": "upi", "paid_on": "2026-11-26",
                                   "bank_txn_id": "431199887766"}, headers=owner)
    assert _upload(client, owner, icici_xlsx(ROWS)).json()["matched"] == 1
