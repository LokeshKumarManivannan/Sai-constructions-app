"""End-to-end phase 1: owner sets up a project, invites the customer, assigns a supervisor; each role sees only its share."""

from tests.conftest import login

CUSTOMER_PHONE = "9876500002"
SUPERVISOR_PHONE = "9876500003"
OTHER_CUSTOMER_PHONE = "9876500004"


def _setup(client, owner):
    c = client.post(
        "/customers", json={"name": "Ravi Kumar", "phone": CUSTOMER_PHONE, "address": "Chennai"}, headers=owner
    ).json()
    p = client.post(
        "/projects",
        json={
            "customer_id": c["id"],
            "name": "Ravi house, Tambaram",
            "site_address": "12 Main Rd, Tambaram",
            "google_maps_url": "https://maps.google.com/?q=12.92,80.12",
            "contract_value_paise": 45_00_000_00,
        },
        headers=owner,
    ).json()
    for name, amt in [("Foundation", 5_00_000_00), ("Roof slab", 10_00_000_00)]:
        assert (
            client.post(
                f"/projects/{p['id']}/milestones", json={"name": name, "amount_due_paise": amt}, headers=owner
            ).status_code
            == 201
        )
    return c, p


def test_customer_invite_flow(client, owner):
    c, p = _setup(client, owner)
    assert c["phone"] == "+919876500002"

    inv = client.post(f"/projects/{p['id']}/invites", json={}, headers=owner).json()
    assert inv["link"].endswith(inv["link"].split("/")[-1])
    token = inv["link"].split("/")[-1]

    pub = client.get(f"/public/invites/{token}").json()
    assert pub == {
        "company": "Sai Constructions",
        "project_name": "Ravi house, Tambaram",
        "phone_masked": "+91******0002",
        "usable": True,
    }

    cust = login(client, CUSTOMER_PHONE)
    me = client.get("/me", headers=cust).json()
    assert me["role"] == "customer" and me["full_name"] == "Ravi Kumar"

    projects = client.get("/projects", headers=cust).json()
    assert [x["id"] for x in projects] == [p["id"]]

    # milestones hidden until contract is signed
    assert client.get(f"/projects/{p['id']}/milestones", headers=cust).json() == []
    client.patch(f"/projects/{p['id']}", json={"status": "contract_signed"}, headers=owner)
    ms = client.get(f"/projects/{p['id']}/milestones", headers=cust).json()
    assert [m["name"] for m in ms] == ["Foundation", "Roof slab"]
    assert [m["seq"] for m in ms] == [1, 2]

    # invite is single-use
    assert client.get(f"/public/invites/{token}").json()["usable"] is False

    # customer cannot reach owner endpoints
    assert client.get("/customers", headers=cust).status_code == 403
    assert client.post(f"/projects/{p['id']}/milestones", json={"name": "x"}, headers=cust).status_code == 403


def test_customer_cannot_see_other_projects(client, owner):
    _, p1 = _setup(client, owner)
    c2 = client.post("/customers", json={"name": "Other", "phone": OTHER_CUSTOMER_PHONE}, headers=owner).json()
    p2 = client.post("/projects", json={"customer_id": c2["id"], "name": "Other house"}, headers=owner).json()
    client.post(f"/projects/{p2['id']}/invites", json={}, headers=owner)

    other = login(client, OTHER_CUSTOMER_PHONE)
    assert [x["id"] for x in client.get("/projects", headers=other).json()] == [p2["id"]]
    assert client.get(f"/projects/{p1['id']}", headers=other).status_code == 404


def test_supervisor_sees_only_assigned_sites_without_money(client, owner):
    _, p = _setup(client, owner)
    sup = client.post(
        "/supervisors", json={"phone": SUPERVISOR_PHONE, "full_name": "Murugan"}, headers=owner
    ).json()
    a = client.post(
        f"/projects/{p['id']}/assignments", json={"user_id": sup["id"], "trade": "painting"}, headers=owner
    ).json()
    assert a["user_name"] == "Murugan"

    s = login(client, SUPERVISOR_PHONE)
    sites = client.get("/projects", headers=s).json()
    assert len(sites) == 1
    assert sites[0]["my_trades"] == ["painting"]
    assert "contract_value_paise" not in sites[0]
    assert client.get(f"/projects/{p['id']}/milestones", headers=s).status_code == 403

    client.delete(f"/assignments/{a['id']}", headers=owner)
    assert client.get("/projects", headers=s).json() == []


def test_audit_log_records_writes(client, owner):
    from sqlalchemy import func, select

    from app.db import SessionLocal
    from app.models import AuditLog

    _setup(client, owner)
    with SessionLocal() as db:
        entities = set(db.scalars(select(AuditLog.entity)).all())
        assert {"customer", "project", "milestone"} <= entities
        assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "login")) >= 1


def test_bad_phone_rejected(client, owner):
    assert client.post("/customers", json={"name": "X", "phone": "123"}, headers=owner).status_code == 422


def test_bootstrap_disabled_without_token(client):
    assert client.post("/admin/bootstrap", json={"token": "x"}).status_code == 404


def test_database_url_accepts_plain_postgres_scheme():
    from app.config import Settings

    s = Settings(database_url="postgres://u:p@host.neon.tech/db?sslmode=require")
    assert s.database_url == "postgresql+psycopg://u:p@host.neon.tech/db?sslmode=require"
