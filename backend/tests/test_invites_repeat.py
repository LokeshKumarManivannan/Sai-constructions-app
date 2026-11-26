from tests.conftest import login
from tests.helpers import CUSTOMER_PHONE


def test_two_invites_same_project_then_login(client, owner):
    c = client.post("/customers", json={"name": "Ravi Kumar", "phone": CUSTOMER_PHONE}, headers=owner).json()
    p = client.post("/projects", json={"customer_id": c["id"], "name": "Ravi house", "contract_value_paise": 100}, headers=owner).json()
    client.post(f"/projects/{p['id']}/invites", json={}, headers=owner)
    client.post(f"/projects/{p['id']}/invites", json={}, headers=owner)
    cust = login(client, CUSTOMER_PHONE)
    assert client.get("/projects", headers=cust).json()[0]["id"] == p["id"]
