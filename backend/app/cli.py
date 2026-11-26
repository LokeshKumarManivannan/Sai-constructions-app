"""Admin commands. Usage: python -m app.cli create-owner --phone 9876543210 --name "Owner Name" """

import argparse

from sqlalchemy import select

from app.auth.phone import normalize_phone
from app.db import SessionLocal
from app.models import Role, User
from app.services import audit


def create_owner(phone: str, name: str) -> None:
    phone = normalize_phone(phone)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.phone == phone)):
            print(f"User {phone} already exists")
            return
        u = User(phone=phone, full_name=name, role=Role.owner)
        db.add(u)
        db.flush()
        audit.record(db, None, "create", "user", u.id, after=audit.snapshot(u))
        db.commit()
        print(f"Owner created: {name} {phone}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("create-owner")
    p.add_argument("--phone", required=True)
    p.add_argument("--name", required=True)
    args = parser.parse_args()
    if args.cmd == "create-owner":
        create_owner(args.phone, args.name)


if __name__ == "__main__":
    main()
