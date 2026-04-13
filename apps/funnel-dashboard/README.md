# Solar funnel dashboard

Next.js app (Vercel) with Google OAuth for `@mvfglobal.com` users, Heroku Postgres storage, and a public ingest API for the solar booking iframe.

## Setup

1. **Postgres** — Create a Heroku Postgres database and run the migration from the repo root:

   ```bash
   psql "$DATABASE_URL" -f ../../db/migrations/001_journey_events.sql
   ```

2. **Environment** — Copy `.env.example` to `.env.local` and fill values.

   - **AUTH_SECRET** — `openssl rand -base64 32`
   - **Google OAuth** — [Google Cloud Console](https://console.cloud.google.com/) OAuth client (Web). Authorized redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local dev).

3. **Install & run**

   ```bash
   npm install
   npm run dev
   ```

4. **Solar form** — Point the iframe app at this ingest URL (full path):

   - `VITE_FUNNEL_TELEMETRY_URL=https://YOUR_DASHBOARD_DOMAIN/api/telemetry`
   - `VITE_FUNNEL_TELEMETRY_KEY` = same value as `TELEMETRY_INGEST_SECRET`

## Deploy on Vercel

Create a **second** Vercel project with **Root Directory** = `apps/funnel-dashboard`.

Add the same environment variables as production (including `AUTH_URL` = your dashboard URL).

## Test ingest (curl)

```bash
curl -sS -X POST "$DASHBOARD_URL/api/telemetry" \
  -H "Authorization: Bearer $TELEMETRY_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"submission_id":"test-123","session_id":"sess-1","event_type":"prefill_applied","step":"prefill","response_summary":"ok","payload":{}}]}'
```
