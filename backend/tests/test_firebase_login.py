import pytest

from app.auth import firebase
from app.config import settings
from tests.helpers import setup_project


@pytest.fixture
def firebase_mode(monkeypatch):
    """Call it to switch the server to Firebase login (after any setup that logs in with test codes)."""
    return lambda: _switch(monkeypatch)


def _switch(monkeypatch):
    monkeypatch.setattr(settings, "auth_provider", "firebase")
    monkeypatch.setattr(settings, "firebase_project_id", "sai-test")
    monkeypatch.setattr(settings, "firebase_api_key", "AIza-test")
    tokens = {"good-owner": "+919876500001", "good-customer": "+919876500002", "stranger": "+919000000009"}

    def fake(token):
        if token not in tokens:
            raise firebase.FirebaseTokenError("bad signature")
        return tokens[token]

    monkeypatch.setattr(firebase, "verified_phone", fake)


def test_config_otp_by_default(client):
    assert client.get("/auth/config").json() == {"provider": "otp", "firebase": None}
    assert client.post("/auth/firebase", json={"id_token": "x"}).status_code == 404


def test_firebase_login(client, owner, firebase_mode):
    setup_project(client, owner)  # creates and accepts the customer's invite with test codes
    firebase_mode()
    cfg = client.get("/auth/config").json()
    assert cfg["provider"] == "firebase" and cfg["firebase"]["projectId"] == "sai-test"
    r = client.post("/auth/firebase", json={"id_token": "good-customer"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "customer"
    assert client.post("/auth/firebase", json={"id_token": "good-owner"}).json()["user"]["role"] == "owner"
    assert client.post("/auth/firebase", json={"id_token": "forged"}).status_code == 401
    assert client.post("/auth/firebase", json={"id_token": "stranger"}).status_code == 403
    # The test-code login is off, so it can't be used to get around Firebase.
    assert client.post("/auth/otp/request", json={"phone": "9876500001"}).status_code == 404


def test_firebase_accepts_invite(client, owner, firebase_mode, monkeypatch):
    c = client.post("/customers", json={"name": "Meena", "phone": "9876500011"}, headers=owner).json()
    p = client.post("/projects", json={"customer_id": c["id"], "name": "Meena house", "site_address": "Adyar", "contract_value_paise": 100}, headers=owner).json()
    client.post(f"/projects/{p['id']}/invites", json={}, headers=owner)
    firebase_mode()
    monkeypatch.setattr(firebase, "verified_phone", lambda t: "+919876500011")
    r = client.post("/auth/firebase", json={"id_token": "any"}).json()
    me = {"Authorization": f"Bearer {r['access_token']}"}
    assert [x["id"] for x in client.get("/projects", headers=me).json()] == [p["id"]]
