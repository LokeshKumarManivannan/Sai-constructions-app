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
