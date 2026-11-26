from tests.helpers import add_supervisor, setup_project

PNG = b"\x89PNG\r\n\x1a\n" + b"1" * 32


def upload(client, h, pid):
    return client.post("/files", data={"project_id": pid}, files={"file": ("a.png", PNG, "image/png")}, headers=h).json()["id"]


def test_supervisor_posts_own_trade_only(client, owner):
    p, cust = setup_project(client, owner)
    _, painter = add_supervisor(client, owner, p["id"], trade="painting")

    photo = upload(client, painter, p["id"])
    r = client.post(f"/projects/{p['id']}/progress", json={"trade": "painting", "note": "First coat done", "photo_file_ids": [photo], "lat": 12.92, "lng": 80.12}, headers=painter)
    assert r.status_code == 201 and len(r.json()["photo_urls"]) == 1 and r.json()["posted_by_name"] == "Murugan"
    assert client.post(f"/projects/{p['id']}/progress", json={"trade": "civil", "note": "x"}, headers=painter).status_code == 403
    assert client.post(f"/projects/{p['id']}/progress", json={"trade": "painting"}, headers=painter).status_code == 422

    client.post(f"/projects/{p['id']}/progress", json={"trade": "civil", "note": "Slab cured"}, headers=owner)
    # painter sees only painting; owner sees all
    assert [u["trade"] for u in client.get(f"/projects/{p['id']}/progress", headers=painter).json()] == ["painting"]
    assert len(client.get(f"/projects/{p['id']}/progress", headers=owner).json()) == 2

    # customer: nothing before the contract is signed, everything after; filter by trade
    assert client.get(f"/projects/{p['id']}/progress", headers=cust).json() == []
    client.patch(f"/projects/{p['id']}", json={"status": "in_progress"}, headers=owner)
    assert len(client.get(f"/projects/{p['id']}/progress", headers=cust).json()) == 2
    assert len(client.get(f"/projects/{p['id']}/progress?trade=civil", headers=cust).json()) == 1
    assert client.post(f"/projects/{p['id']}/progress", json={"trade": "civil", "note": "x"}, headers=cust).status_code == 403
