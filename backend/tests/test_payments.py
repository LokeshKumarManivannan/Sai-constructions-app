from tests.helpers import add_supervisor, setup_project

TODAY = "2026-11-26"


def pay(client, headers, project_id, rupees, mode="upi", **extra):
    body = {"amount_paise": rupees * 100, "mode": mode, "paid_on": TODAY, **extra}
    return client.post(f"/projects/{project_id}/payments", json=body, headers=headers)


def summary(client, headers, project_id):
    return client.get(f"/projects/{project_id}/summary", headers=headers).json()


def test_customer_logs_owner_confirms_and_receipt(client, owner):
    p, cust = setup_project(client, owner)
    r = pay(client, cust, p["id"], 3_00_000, reference="UTR123")
    assert r.status_code == 201
    pay_id = r.json()["id"]
    assert r.json()["status"] == "unconfirmed"
    assert r.json()["can_confirm"] is False  # own entry

    assert summary(client, owner, p["id"])["paid_paise"] == 0  # unconfirmed doesn't count

    # customer cannot confirm own entry
    assert client.post(f"/payments/{pay_id}/confirm", headers=cust).status_code == 409
    listed = client.get(f"/projects/{p['id']}/payments", headers=owner).json()
    assert listed[0]["can_confirm"] is True
    r = client.post(f"/payments/{pay_id}/confirm", headers=owner)
    assert r.json()["status"] == "confirmed"
    assert r.json()["receipt_no"] >= 1

    s = summary(client, cust, p["id"])
    assert s["paid_paise"] == 3_00_000_00
    assert s["outstanding_paise"] == 42_00_000_00

    rc = client.get(f"/payments/{pay_id}/receipt", headers=cust).json()
    assert rc["customer_name"] == "Ravi Kumar" and rc["amount_paise"] == 3_00_000_00 and rc["reference"] == "UTR123"


def test_cash_rules(client, owner):
    p, cust = setup_project(client, owner)
    assert pay(client, cust, p["id"], 50_000, mode="cash").status_code == 403  # customer can't log cash

    assert pay(client, owner, p["id"], 1_50_000, mode="cash").status_code == 201
    r = pay(client, owner, p["id"], 50_000, mode="cash")  # would reach ₹2,00,000
    assert r.status_code == 409 and r.json()["detail"]["code"] == "cash_limit"
    assert r.json()["detail"]["new_total_paise"] == 2_00_000_00
    assert pay(client, owner, p["id"], 50_000, mode="cash", acknowledge_cash_limit=True).status_code == 201

    # owner cash entries wait for the customer's confirmation
    pending = [x for x in client.get(f"/projects/{p['id']}/payments", headers=cust).json() if x["can_confirm"]]
    assert len(pending) == 2
    assert summary(client, owner, p["id"])["cash_received_paise"] == 2_00_000_00


def test_dispute_then_correction(client, owner):
    p, cust = setup_project(client, owner)
    wrong = pay(client, owner, p["id"], 60_000, mode="cash").json()
    r = client.post(f"/payments/{wrong['id']}/dispute", json={"reason": "I paid 50,000 only"}, headers=cust)
    assert r.json()["status"] == "disputed"

    fixed = pay(client, owner, p["id"], 50_000, mode="cash", corrects_id=wrong["id"]).json()
    assert fixed["corrects_id"] == wrong["id"]
    statuses = {x["id"]: x["status"] for x in client.get(f"/projects/{p['id']}/payments", headers=owner).json()}
    assert statuses[wrong["id"]] == "void"
    client.post(f"/payments/{fixed['id']}/confirm", headers=cust)
    assert summary(client, owner, p["id"])["paid_paise"] == 50_000_00
    # a void entry no longer counts towards cash received
    assert summary(client, owner, p["id"])["cash_received_paise"] == 50_000_00


def test_milestone_billing_and_auto_paid(client, owner):
    p, cust = setup_project(client, owner)
    ms = client.get(f"/projects/{p['id']}/milestones", headers=owner).json()
    foundation, slab = ms[0]["id"], ms[1]["id"]

    assert client.post(f"/milestones/{foundation}/status", json={"status": "done"}, headers=owner).status_code == 200
    client.post(f"/milestones/{foundation}/status", json={"status": "payment_due", "due_date": "2026-12-10"}, headers=owner)
    nd = summary(client, cust, p["id"])["next_due"]
    assert nd["name"] == "Foundation" and nd["amount_paise"] == 5_00_000_00 and nd["due_date"] == "2026-12-10"

    part = pay(client, cust, p["id"], 2_00_000, milestone_id=foundation).json()
    client.post(f"/payments/{part['id']}/confirm", headers=owner)
    assert summary(client, cust, p["id"])["next_due"]["amount_paise"] == 3_00_000_00

    rest = pay(client, cust, p["id"], 3_00_000).json()
    client.post(f"/payments/{rest['id']}/confirm", headers=owner)
    ms = {m["name"]: m["status"] for m in client.get(f"/projects/{p['id']}/milestones", headers=owner).json()}
    assert ms == {"Foundation": "paid", "Roof slab": "pending"}
    assert summary(client, cust, p["id"])["next_due"] is None

    # a milestone already covered by payments becomes paid as soon as it is due
    client.post(f"/milestones/{slab}/status", json={"status": "payment_due"}, headers=owner)
    assert summary(client, cust, p["id"])["next_due"]["amount_paise"] == 10_00_000_00


def test_supervisor_has_no_money_access(client, owner):
    p, _ = setup_project(client, owner)
    _, sup = add_supervisor(client, owner, p["id"])
    assert client.get(f"/projects/{p['id']}/summary", headers=sup).status_code == 403
    assert client.get(f"/projects/{p['id']}/payments", headers=sup).status_code == 403


def test_proof_upload_and_signed_url(client, owner):
    p, cust = setup_project(client, owner)
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    up = client.post(
        "/files", data={"project_id": p["id"]}, files={"file": ("proof.png", png, "image/png")}, headers=cust
    )
    assert up.status_code == 201
    r = pay(client, cust, p["id"], 10_000, proof_file_id=up.json()["id"])
    url = r.json()["proof_url"]
    assert url and "/files/" in url
    path = url.split("localhost:8000")[1]
    assert client.get(path).content == png
    assert client.get(path.replace("sig=", "sig=x")).status_code == 403

    bad = client.post("/files", data={"project_id": p["id"]}, files={"file": ("x.exe", b"MZ", "application/x-msdownload")}, headers=cust)
    assert bad.status_code == 415


def test_project_reports_stage_progress(client, owner):
    p, cust = setup_project(client, owner)
    ms = client.get(f"/projects/{p['id']}/milestones", headers=owner).json()
    client.post(f"/milestones/{ms[0]['id']}/status", json={"status": "done"}, headers=owner)
    got = client.get(f"/projects/{p['id']}", headers=owner).json()
    assert (got["milestones_total"], got["milestones_done"]) == (2, 1)
