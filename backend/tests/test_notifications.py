from tests.helpers import setup_project


def test_customer_notifications(client, owner):
    p, cust = setup_project(client, owner)
    ms = client.get(f"/projects/{p['id']}/milestones", headers=owner).json()
    client.post(f"/milestones/{ms[0]['id']}/status", json={"status": "done"}, headers=owner)
    client.post(f"/milestones/{ms[0]['id']}/status", json={"status": "payment_due", "due_date": "2026-12-10"}, headers=owner)
    co = client.post(f"/projects/{p['id']}/change-orders", json={"title": "Extra wardrobe", "amount_paise": 40_000_00}, headers=owner).json()
    client.post(f"/change-orders/{co['id']}/send", headers=owner)
    client.post(f"/projects/{p['id']}/progress", json={"trade": "civil", "note": "Footing"}, headers=owner)
    client.post(f"/projects/{p['id']}/payments", json={"amount_paise": 1_000_00, "mode": "cash", "paid_on": "2026-11-26"}, headers=owner)

    items = client.get("/notifications", headers=cust).json()
    kinds = [i["kind"] for i in items]
    assert {"payment_due", "extra_work", "check_payment", "photos"} <= set(kinds)
    assert all(i["action"] for i in items[:3]) and items[-1]["kind"] == "photos"
    due = next(i for i in items if i["kind"] == "payment_due")
    assert due["amount_paise"] == 5_00_000_00 and due["due_date"] == "2026-12-10"
    assert client.get("/notifications", headers=owner).status_code == 403
