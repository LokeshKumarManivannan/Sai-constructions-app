# Sai Constructions app

The company's master record for every project: contract, money in and out, progress, documents.
Three roles: **owner** (company admin), **supervisor** (per project, per trade), **customer** (own project only).

Spec: [Sai Constructions App — Build Spec](https://claude.ai/artifact/Xeoz47Bek7q1ecxaZmLRQm)

```
backend/   FastAPI + PostgreSQL + Alembic   (API, access control, audit log)
app/       Expo (React Native + TypeScript) (Android, iOS and web from one codebase)
```

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Phone OTP login, roles, English/Tamil, customers, projects, payment milestones, supervisor assignments, customer invites, audit log | Done |
| 2 | Customer payments (bank/UPI/cash), two-sided confirmation, receipts, ₹2 lakh cash warning | Next |
| 3 | Change orders (extra work) with customer approval | |
| 4 | Progress photos by trade | |
| 5 | Internal books, untagged payments, cash book, petty cash | |
| 6 | Document vault, handover checklist | |

## Run locally

### Backend

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # edit DATABASE_URL if needed
createdb sai                      # PostgreSQL 14+
alembic upgrade head
python -m app.cli create-owner --phone 98xxxxxxxx --name "Owner Name"
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs. Tests (need a `sai_test` database): `python -m pytest`.

### App

```bash
cd app
npm install
cp .env.example .env
npx expo start            # press w for web, or scan the QR code with Expo Go
```

With `DEV_EXPOSE_OTP=true` the login screen shows the OTP ("Test code"), so no SMS provider is needed for testing.

## How login works

- Owner is created once with `app.cli create-owner`.
- Owner adds supervisors (Supervisors screen); they log in with their phone number.
- Owner creates a customer and project, then taps **Invite customer** and sends the link. The customer opens it, logs in with that phone number, and is linked to the project. Numbers that are not owners, supervisors or invited customers cannot log in.

## Rules the code follows

- Money is integer paise everywhere (`*_paise`); the app formats it as ₹12,50,000.
- Access is checked in the API (`backend/app/services/access.py`), never only in the UI. Customers see only their own projects; supervisors see only assigned sites and no money.
- Every write is recorded in `audit_log`.
- All app text goes through `app/src/i18n/{en,ta}.json`. Tamil strings need review by a native speaker.

## Before production

- Set a real `JWT_SECRET`, `DEV_EXPOSE_OTP=false`, and an SMS provider (MSG91 or Firebase) in `backend/app/auth/sms.py`.
- Host in an India region with daily database backups.
