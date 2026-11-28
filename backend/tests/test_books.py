from tests.helpers import add_supervisor, setup_project
from tests.test_payments import pay

PNG = b"\x89PNG\r\n\x1a\n" + b"2" * 32
D = "2026-11-26"


def bill(client, h, pid=None):
    data = {"project_id": pid} if pid else {}
    return client.post("/files", data=data, files={"file": ("bill.png", PNG, "image/png")}, headers=h).json()["id"]


def payee(client, owner, name="Ramesh", type_="labour"):
    return client.post("/payees", json={"name": name, "type": type_}, headers=owner).json()


def expense(client, owner, **body):
    r = client.post("/expenses", json={"mode": "upi", "paid_on": D, **body}, headers=owner)
    assert r.status_code == 201, r.text
    return r.json()


def test_untagged_then_tag_and_defaults(client, owner):
    p, _ = setup_project(client, owner)
    ramesh = payee(client, owner)
    e = expense(client, owner, payee_id=ramesh["id"], amount_paise=10_000_00, bank_txn_id="UPI123")
    assert e["tagged"] is False and e["project_id"] is None
    assert client.get("/books/summary", headers=owner).json()["untagged_count"] == 1

    b = bill(client, owner, p["id"])
    t = client.patch(
        f"/expenses/{e['id']}",
        json={"project_id": p["id"], "category": "labour", "trade": "civil", "reason": "Week 3 wages", "bill_file_id": b},
        headers=owner,
    ).json()
    assert t["tagged"] is True and t["bill_url"]
    assert client.get("/books/summary", headers=owner).json()["untagged_count"] == 0

    # next payment to Ramesh pre-fills site + category
    e2 = expense(client, owner, payee_id=ramesh["id"], amount_paise=5_000_00)
    assert e2["project_id"] == p["id"] and e2["category"] == "labour"
    assert len(client.get("/expenses?untagged=true", headers=owner).json()) == 1


def test_cash_book_and_site_ledger(client, owner):
    p, cust = setup_project(client, owner)
    client.post("/cash-transfers", json={"kind": "withdrawal", "amount_paise": 50_000_00, "on_date": D, "note": "ATM"}, headers=owner)
    supplier = payee(client, owner, "Sri Murugan Cements", "supplier")
    expense(client, owner, payee_id=supplier["id"], amount_paise=30_000_00, mode="cash", project_id=p["id"], category="material", reason="Cement 60 bags", bill_file_id=bill(client, owner))
    cash_in = pay(client, owner, p["id"], 20_000, mode="cash").json()
    client.post(f"/payments/{cash_in['id']}/confirm", headers=cust)

    cb = client.get("/cash-book", headers=owner).json()
    assert cb["balance_paise"] == (50_000 - 30_000 + 20_000) * 100
    kinds = {e["kind"] for e in cb["entries"]}
    assert kinds == {"withdrawal", "expense", "customer_cash"}  # the ATM withdrawal is not an expense

    s = client.get("/books/summary", headers=owner).json()
    site = s["sites"][0]
    assert site["received_paise"] == 20_000_00 and site["spent_paise"] == 30_000_00 and site["net_paise"] == -10_000_00
    assert s["cash_in_hand_paise"] == 40_000_00


def test_void_and_correct(client, owner):
    p, _ = setup_project(client, owner)
    ramesh = payee(client, owner)
    wrong = expense(client, owner, payee_id=ramesh["id"], amount_paise=12_000_00, project_id=p["id"], category="labour")
    fixed = expense(client, owner, payee_id=ramesh["id"], amount_paise=10_000_00, project_id=p["id"], category="labour", corrects_id=wrong["id"])
    rows = client.get("/expenses?include_void=true", headers=owner).json()
    assert {r["id"]: r["status"] for r in rows} == {wrong["id"]: "void", fixed["id"]: "active"}
    assert client.get("/books/summary", headers=owner).json()["sites"][0]["spent_paise"] == 10_000_00


def test_supervisor_money_and_petty_cash(client, owner):
    p, cust = setup_project(client, owner)
    sup, s = add_supervisor(client, owner, p["id"], trade="civil")
    sup_payee = next(x for x in client.get("/payees", headers=owner).json() if x["user_id"] == sup["id"])
    adv = expense(client, owner, payee_id=sup_payee["id"], amount_paise=20_000_00, mode="cash", category="advance", project_id=p["id"], reason="Petty cash")
    wage = expense(client, owner, payee_id=sup_payee["id"], amount_paise=25_000_00, mode="bank", category="labour", project_id=p["id"], reason="Nov salary")

    me = client.get("/me/money", headers=s).json()
    assert {e["id"] for e in me["received"]} == {adv["id"], wage["id"]}
    assert me["advance"] == {"given_paise": 20_000_00, "spent_paise": 0, "holding_paise": 20_000_00}
    assert client.post(f"/expenses/{wage['id']}/acknowledge", headers=s).json()["recipient_confirmed_at"]

    b = bill(client, s, p["id"])
    r = client.post("/petty-cash/spend", json={"project_id": p["id"], "paid_to": "Mason Kumar", "amount_paise": 8_000_00, "reason": "2 days", "bill_file_id": b, "paid_on": D}, headers=s)
    assert r.status_code == 201
    me = client.get("/me/money", headers=s).json()
    assert me["advance"]["holding_paise"] == 12_000_00
    # spend counts as a site cost; the advance itself does not; cash box only lost the advance once
    s_sum = client.get("/books/summary", headers=owner).json()
    assert s_sum["sites"][0]["spent_paise"] == (25_000 + 8_000) * 100
    assert s_sum["cash_in_hand_paise"] == -20_000_00

    # supervisors and customers cannot read the books
    for h in (s, cust):
        assert client.get("/books/summary", headers=h).status_code == 403
        assert client.get("/expenses", headers=h).status_code == 403


def test_home_numbers_and_expected_margin(client, owner):
    from app.services.time import today_ist

    today = today_ist().isoformat()
    p, cust = setup_project(client, owner)  # contract 45,00,000
    client.patch(f"/projects/{p['id']}", json={"status": "in_progress"}, headers=owner)
    r = client.post(
        f"/projects/{p['id']}/payments", json={"amount_paise": 5_00_000_00, "mode": "upi", "paid_on": today}, headers=cust
    ).json()
    client.post(f"/payments/{r['id']}/confirm", headers=owner)
    ramesh = payee(client, owner)
    client.post("/expenses", json={"payee_id": ramesh["id"], "amount_paise": 1_00_000_00, "mode": "upi", "paid_on": today, "project_id": p["id"], "category": "labour"}, headers=owner)
    s = client.get("/books/summary", headers=owner).json()
    assert s["received_month_paise"] == 5_00_000_00
    assert s["spent_month_paise"] == 1_00_000_00
    assert s["to_collect_paise"] == 40_00_000_00
    site = s["sites"][0]
    assert site["expected_margin_paise"] == 44_00_000_00


def test_advance_proved_by_supervisor_acknowledgement(client, owner):
    from tests.helpers import add_supervisor, setup_project

    p, _ = setup_project(client, owner)
    sup, sup_h = add_supervisor(client, owner, p["id"], trade="civil")
    murugan = next(x for x in client.get("/payees", headers=owner).json() if x["type"] == "supervisor")
    e = client.post("/expenses", json={"payee_id": murugan["id"], "amount_paise": 20_000_00, "mode": "cash", "paid_on": "2026-11-15",
                                       "category": "advance", "reason": "Petty cash"}, headers=owner).json()
    assert client.get("/books/summary", headers=owner).json()["untagged_count"] == 1
    client.post(f"/expenses/{e['id']}/acknowledge", headers=sup_h)
    assert client.get("/books/summary", headers=owner).json()["untagged_count"] == 0
