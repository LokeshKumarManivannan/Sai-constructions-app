import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://sai:sai@localhost:5432/sai_test")
os.environ["DEV_EXPOSE_OTP"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402,F401
from app.cli import create_owner  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

OWNER_PHONE = "+919876500001"


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean():
    with engine.begin() as conn:
        names = ", ".join(t.name for t in Base.metadata.sorted_tables)
        conn.execute(text(f"TRUNCATE {names} CASCADE"))
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def login(client: TestClient, phone: str) -> dict:
    r = client.post("/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r = client.post("/auth/otp/verify", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def owner(client) -> dict:
    create_owner(OWNER_PHONE, "Owner")
    return login(client, OWNER_PHONE)
