from tests.helpers import setup_project

PDF = b"%PDF-1.4\n%test\n"


def upload(client, h, pid, name="patta.pdf"):
    return client.post("/files", data={"project_id": pid}, files={"file": (name, PDF, "application/pdf")}, headers=h).json()["id"]


def add_doc(client, owner, pid, group, doc_type, title):
    r = client.post(f"/projects/{pid}/documents", json={"group": group, "doc_type": doc_type, "title": title, "file_id": upload(client, owner, pid)}, headers=owner)
    assert r.status_code == 201, r.text
    return r.json()


def test_versions_and_visibility(client, owner):
    p, cust = setup_project(client, owner)
    v1 = add_doc(client, owner, p["id"], "property", "patta", "Patta")
    v2 = add_doc(client, owner, p["id"], "property", "patta", "patta")  # same doc, case-insensitive
    assert v2["version"] == 2
    add_doc(client, owner, p["id"], "internal", "supplier_bill", "Cement bill")

    cust_docs = client.get(f"/projects/{p['id']}/documents", headers=cust).json()
    assert [(d["title"], d["version"], d["versions"]) for d in cust_docs] == [("patta", 2, 2)]  # internal hidden
    assert len(client.get(f"/documents/{v1['id']}/versions", headers=cust).json()) == 2

    client.post(f"/documents/{v1['id']}/visibility", json={"visibility": "internal"}, headers=owner)
    assert client.get(f"/projects/{p['id']}/documents", headers=cust).json() == []
    assert client.post(f"/projects/{p['id']}/documents", json={"group": "property", "doc_type": "x", "title": "x", "file_id": v1["id"]}, headers=cust).status_code == 403


def test_handover_checklist_and_signoff(client, owner):
    p, cust = setup_project(client, owner)
    h = client.post(f"/projects/{p['id']}/handover/seed", json={}, headers=owner).json()
    assert len(h["items"]) == 10 and h["all_checked"] is False
    h = client.post(f"/projects/{p['id']}/handover/items", json={"item": "Gas connection papers"}, headers=owner).json()
    assert len(h["items"]) == 11

    assert client.post(f"/projects/{p['id']}/handover/sign", headers=cust).status_code == 409  # not all ticked
    first = h["items"][0]["id"]
    client.patch(f"/handover/items/{first}", json={"quantity": "6 keys", "checked": True}, headers=owner)
    for it in h["items"][1:]:
        client.patch(f"/handover/items/{it['id']}", json={"checked": True}, headers=owner)

    r = client.post(f"/projects/{p['id']}/handover/sign", headers=cust)
    assert r.status_code == 200 and r.json()["signed_by_name"] == "Ravi Kumar"
    assert client.get(f"/projects/{p['id']}", headers=owner).json()["status"] == "handed_over"
    # locked after signing
    assert client.patch(f"/handover/items/{first}", json={"checked": False}, headers=owner).status_code == 409
    assert client.post(f"/projects/{p['id']}/handover/sign", headers=cust).status_code == 409
