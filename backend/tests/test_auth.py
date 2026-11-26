from tests.conftest import OWNER_PHONE, login


def test_unknown_phone_gets_no_code(client):
    r = client.post("/auth/otp/request", json={"phone": "9000000001"})
    assert r.status_code == 200
    assert r.json()["dev_code"] is None


def test_owner_login_and_me(client, owner):
    r = client.get("/me", headers=owner)
    assert r.status_code == 200
    assert r.json()["role"] == "owner"
    assert r.json()["phone"] == OWNER_PHONE


def test_wrong_code_then_lockout(client, owner):
    code = client.post("/auth/otp/request", json={"phone": OWNER_PHONE}).json()["dev_code"]
    wrong = "111111" if code != "111111" else "222222"
    for _ in range(5):
        assert client.post("/auth/otp/verify", json={"phone": OWNER_PHONE, "code": wrong}).status_code == 400
    # the right code no longer works once that OTP hit max attempts
    assert client.post("/auth/otp/verify", json={"phone": OWNER_PHONE, "code": code}).status_code == 400


def test_language_update(client, owner):
    r = client.patch("/me", json={"language": "ta"}, headers=owner)
    assert r.json()["language"] == "ta"


def test_no_token_is_401(client):
    assert client.get("/me").status_code == 401


def test_otp_rate_limit(client, owner):
    statuses = [client.post("/auth/otp/request", json={"phone": OWNER_PHONE}).status_code for _ in range(6)]
    assert statuses[-1] == 429
