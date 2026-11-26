# Deploying to Vercel (test setup)

Two Vercel projects from this one repo, plus a Neon database and a Vercel Blob store:

```
sai-app  (root: app/)      Expo web build, static
sai-api  (root: backend/)  FastAPI -> Neon Postgres + Vercel Blob (photos, bills, PDFs)
```

Everything is done in the browser. Keep a notes file open: you will copy two URLs and two secrets.

> **Test data only for now.** `DEV_EXPOSE_OTP=true` shows the login code on screen, so anyone who
> knows a registered phone number can log in. Turn it off once an SMS provider is connected.

---

## 1. Create the API project

1. Go to vercel.com and sign in with GitHub.
2. **Add New → Project** → import `Sai-constructions-app`.
3. **Root Directory**: click Edit → choose `backend`. Framework should show **FastAPI**.
4. Click **Deploy**. It may fail or show errors; that's expected until the database is attached.
5. Note the URL, e.g. `https://sai-api-xxxx.vercel.app`. This is your **API URL**.

## 2. Add the database (Neon)

1. In the `sai-api` project → **Storage** tab → **Create Database** → **Neon** (Postgres).
2. Pick the region closest to India (Singapore or Mumbai if offered), free plan.
3. Connect it to `sai-api` for **Production** and **Preview**.
4. In **Settings → Environment Variables**, check there is a `DATABASE_URL`. It should be the
   **pooled** connection (its host contains `-pooler`). If Neon added several URLs, set
   `DATABASE_URL` to the pooled one.

## 3. Add file storage (Blob)

1. `sai-api` → **Storage** → **Create** → **Blob**, access **Private**.
2. Connect it to `sai-api`. Vercel adds the credentials automatically.

## 4. API environment variables

`sai-api` → **Settings → Environment Variables**, add for Production (and Preview):

| Name | Value |
| --- | --- |
| `STORAGE_BACKEND` | `vercel_blob` |
| `DB_NULL_POOL` | `true` |
| `JWT_SECRET` | a long random string (e.g. from a password generator, 48+ characters) |
| `BOOTSTRAP_TOKEN` | another random string (used once in step 7) |
| `DEV_EXPOSE_OTP` | `true` (testing only) |
| `MAX_UPLOAD_MB` | `4` (Vercel accepts request bodies up to 4.5 MB) |
| `API_BASE_URL` | your API URL, e.g. `https://sai-api-xxxx.vercel.app` (no trailing slash) |

Leave `APP_BASE_URL` and `CORS_ORIGINS` for step 6.

## 5. Create the web app project

1. **Add New → Project** → import the same repo again.
2. **Root Directory**: `app`. Framework preset: **Other** (the `app/vercel.json` sets the build).
3. Environment variables:

| Name | Value |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | your API URL |
| `EXPO_PUBLIC_COMPANY_PHONE` | the office number, e.g. `+919876543210` |

4. **Deploy**. Note the URL, e.g. `https://sai-app-xxxx.vercel.app`. This is your **web URL**.

## 6. Connect the two

Back in `sai-api` → **Settings → Environment Variables**, add:

| Name | Value |
| --- | --- |
| `APP_BASE_URL` | your web URL (invite links point here) |
| `CORS_ORIGINS` | `["https://sai-app-xxxx.vercel.app"]` (the web URL, in brackets and quotes) |

Then **Deployments** → latest → **⋯ → Redeploy**. Environment changes only apply after a redeploy.

## 7. Set up the database and the owner (once)

1. Open `https://<API URL>/docs`.
2. Find **POST /admin/bootstrap** → **Try it out** → body:

```json
{ "token": "<your BOOTSTRAP_TOKEN>", "owner_phone": "98XXXXXXXX", "owner_name": "Owner name" }
```

3. **Execute**. Expect `{"migrated": true, "owner_exists": true}`.
4. Delete `BOOTSTRAP_TOKEN` from the API's environment variables and redeploy. The endpoint then
   returns 404 for everyone.

After any future change that adds a database migration, set `BOOTSTRAP_TOKEN` again, run step 7
with only the token, then remove it.

## 8. Test

Open the web URL on your phone → log in with the owner number → the test code shows on screen.
Create a supervisor and a customer, send an invite link, and log in as them in another browser.

If something fails: `sai-api` → **Logs** shows the API errors.

---

## Later: your own domain

1. Buy the domain (e.g. `saiconstructions.in`).
2. `sai-app` → **Settings → Domains** → add `app.saiconstructions.in` → add the DNS record Vercel shows
   at your domain registrar.
3. Optional: `sai-api` → add `api.saiconstructions.in` the same way.
4. Update: `APP_BASE_URL`, `CORS_ORIGINS`, `API_BASE_URL` (API project) and `EXPO_PUBLIC_API_URL`
   (web project), then redeploy both.

## Before real customers

- Connect an SMS provider and set `DEV_EXPOSE_OTP=false`.
- Decide on hosting region and backups for customer data (Neon has point-in-time restore on paid plans).
