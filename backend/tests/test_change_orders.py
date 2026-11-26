from tests.helpers import add_supervisor, setup_project


def co(client, owner, pid, title="Extra bathroom tiles", rupees=45_000, **extra):
    r = client.post(
        f"/projects/{pid}/change-orders",
        json={"title": title, "amount_paise": rupees * 100, "trade": "civil", **extra},
        headers=owner,
    )
    assert r.status_code == 201, r.text
    return r.json()


def total_due(client, h, pid):
    return client.get(f"/projects/{pid}/summary", headers=h).json()


def test_approve_adds_to_total(client, owner):
    p, cust = setup_project(client, owner)
    c = co(client, owner, p["id"])
    # customer cannot see drafts
    assert client.get(f"/projects/{p['id']}/change-orders", headers=cust).json() == []
    assert client.post(f"/change-orders/{c['id']}/approve", headers=cust).status_code == 404

    client.post(f"/change-orders/{c['id']}/send", headers=owner)
    assert client.patch(f"/change-orders/{c['id']}", json={"amount_paise": 1}, headers=owner).status_code == 409
    assert total_due(client, cust, p["id"])["approved_extras_paise"] == 0  # sent is not approved

    assert client.post(f"/change-orders/{c['id']}/approve", headers=owner).status_code == 403  # owner can't approve
    r = client.post(f"/change-orders/{c['id']}/approve", headers=cust).json()
    assert r["status"] == "approved" and r["decided_by_name"] == "Ravi Kumar"

    s = total_due(client, cust, p["id"])
    assert s["approved_extras_paise"] == 45_000_00
    assert s["total_due_paise"] == 45_45_000_00

    client.post(f"/change-orders/{c['id']}/start", headers=owner)
    client.post(f"/change-orders/{c['id']}/complete", headers=owner)
    assert total_due(client, cust, p["id"])["approved_extras_paise"] == 45_000_00


def test_reject_and_revise(client, owner):
    p, cust = setup_project(client, owner)
    c = co(client, owner, p["id"], rupees=80_000)
    client.post(f"/change-orders/{c['id']}/send", headers=owner)
    r = client.post(f"/change-orders/{c['id']}/reject", json={"reason": "Too costly"}, headers=cust).json()
    assert r["status"] == "rejected" and r["reject_reason"] == "Too costly"
    assert total_due(client, cust, p["id"])["approved_extras_paise"] == 0

    v2 = client.post(f"/change-orders/{c['id']}/revise", headers=owner).json()
    assert v2["version"] == 2 and v2["revises_id"] == c["id"] and v2["status"] == "draft"
    client.patch(f"/change-orders/{v2['id']}", json={"amount_paise": 60_000_00}, headers=owner)
    client.post(f"/change-orders/{v2['id']}/send", headers=owner)
    client.post(f"/change-orders/{v2['id']}/approve", headers=cust)
    assert total_due(client, cust, p["id"])["approved_extras_paise"] == 60_000_00


def test_draft_delete_and_supervisor_blocked(client, owner):
    p, _ = setup_project(client, owner)
    c = co(client, owner, p["id"])
    _, sup = add_supervisor(client, owner, p["id"])
    assert client.get(f"/projects/{p['id']}/change-orders", headers=sup).status_code == 403
    assert client.delete(f"/change-orders/{c['id']}", headers=owner).status_code == 204
