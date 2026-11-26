from tests.conftest import login

CUSTOMER_PHONE = "9876500002"
SUPERVISOR_PHONE = "9876500003"


def setup_project(client, owner, contract_rupees=45_00_000, milestones=(("Foundation", 5_00_000), ("Roof slab", 10_00_000))):
    """Owner creates customer + project + milestones and invites the customer. Returns (project, customer_headers)."""
    c = client.post("/customers", json={"name": "Ravi Kumar", "phone": CUSTOMER_PHONE}, headers=owner).json()
    p = client.post(
        "/projects",
        json={"customer_id": c["id"], "name": "Ravi house", "contract_value_paise": contract_rupees * 100},
        headers=owner,
    ).json()
    for name, rupees in milestones:
        client.post(f"/projects/{p['id']}/milestones", json={"name": name, "amount_due_paise": rupees * 100}, headers=owner)
    client.post(f"/projects/{p['id']}/invites", json={}, headers=owner)
    return p, login(client, CUSTOMER_PHONE)


def add_supervisor(client, owner, project_id, trade="painting", phone=SUPERVISOR_PHONE, name="Murugan"):
    sup = client.post("/supervisors", json={"phone": phone, "full_name": name}, headers=owner).json()
    client.post(f"/projects/{project_id}/assignments", json={"user_id": sup["id"], "trade": trade}, headers=owner)
    return sup, login(client, phone)
