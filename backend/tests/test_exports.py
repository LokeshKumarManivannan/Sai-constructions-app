import io
import zipfile

from openpyxl import load_workbook

from tests.helpers import setup_project
from tests.test_books import bill, payee

D = "2026-11-26"


def _download(client, owner, body):
    r = client.post("/exports/link", json=body, headers=owner)
    assert r.status_code == 200, r.text
    return client.get(r.json()["url"].split("localhost:8000")[1])


def test_project_year_and_bills(client, owner):
    p, cust = setup_project(client, owner)
    pay = client.post(f"/projects/{p['id']}/payments", json={"amount_paise": 2_00_000_00, "mode": "upi", "paid_on": D, "reference": "UTR9"}, headers=cust).json()
    client.post(f"/payments/{pay['id']}/confirm", headers=owner)
    ramesh = payee(client, owner)
    b = bill(client, owner, p["id"])
    client.post("/expenses", json={"payee_id": ramesh["id"], "amount_paise": 12_000_00, "mode": "upi", "paid_on": D, "project_id": p["id"], "category": "labour", "reason": "Wages", "bill_file_id": b}, headers=owner)
    client.post("/expenses", json={"payee_id": ramesh["id"], "amount_paise": 3_000_00, "mode": "cash", "paid_on": D, "project_id": p["id"], "category": "labour"}, headers=owner)

    r = _download(client, owner, {"kind": "project", "project_id": p["id"]})
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Summary", "Money in", "Money out"]
    out = list(wb["Money out"].iter_rows(min_row=2, values_only=True))
    assert len(out) == 2 and out[0][-1].endswith(".png") and "MISSING" in [row[-1] for row in out]
    summary = dict(wb["Summary"].iter_rows(values_only=True))
    assert summary["Received (confirmed)"] == 200000 and summary["Spent"] == 15000

    r = _download(client, owner, {"kind": "year", "fy": "2026-27"})
    wb = load_workbook(io.BytesIO(r.content))
    first = wb["FY 2026-27"]
    nov = next(row for row in first.iter_rows(values_only=True) if row[0] == "Nov")
    assert nov[1] == 200000 and nov[2] == 15000

    r = _download(client, owner, {"kind": "bills", "fy": "2026-27"})
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert len(names) == 1 and names[0] == out[0][-1]


def test_export_rules(client, owner):
    p, cust = setup_project(client, owner)
    assert client.post("/exports/link", json={"kind": "year", "fy": "2026-28"}, headers=owner).status_code == 422
    assert client.post("/exports/link", json={"kind": "project", "project_id": p["id"]}, headers=cust).status_code == 403
    url = client.post("/exports/link", json={"kind": "year", "fy": "2026-27"}, headers=owner).json()["url"]
    assert client.get(url.split("localhost:8000")[1].replace("sig=", "sig=0")).status_code == 403
