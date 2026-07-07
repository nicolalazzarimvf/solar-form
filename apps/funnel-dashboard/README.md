# Solar funnel dashboard

Next.js app (Vercel) with Google OAuth for `@mvfglobal.com` users, Heroku Postgres storage, and a public ingest API for the solar booking iframe.

## Setup

1. **Postgres** — Create a Heroku Postgres database and run the migration from the repo root:

   ```bash
   psql "$DATABASE_URL" -f ../../db/migrations/001_journey_events.sql
   psql "$DATABASE_URL" -f ../../db/migrations/002_journey_event_tags.sql
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
   - **Experimental solar-form (CRO-693):** `VITE_FUNNEL_TELEMETRY_TAGS=ADV` on the experimental Vercel project (ingest also auto-tags ADV when `Origin` is the experimental deploy URL).

## Deploy on Vercel (second project — do not change solar-form’s root)

The solar-form app must keep **Root Directory** empty (repo root). This dashboard needs its **own** Vercel project pointing at the subfolder.

1. [Vercel Dashboard](https://vercel.com) → **Add New…** → **Project**.
2. **Import** the same Git repository as solar-form (e.g. `nicolalazzarimvf/solar-form`).
3. Before deploying, open **Configure Project**:
   - **Root Directory** → **Edit** → select **`apps/funnel-dashboard`** (folder contains `package.json` with Next.js).
   - Framework preset should be **Next.js** (this repo includes [`vercel.json`](vercel.json) to pin install/build).
4. **Environment Variables** — add every key from [`.env.example`](.env.example) for **Production** (and **Preview** if you use previews). Set **`AUTH_URL`** to `https://<this-project>.vercel.app` after you know the URL (update Google OAuth redirect URI to match).
5. **Deploy**. Copy the production URL into Google Cloud OAuth redirect / solar-form `VITE_FUNNEL_TELEMETRY_URL`.

**CLI (optional):** from repo root, with a [token](https://vercel.com/account/tokens):  
`cd apps/funnel-dashboard && npx vercel link` then `npx vercel deploy --prod`

## Test ingest (curl)

```bash
curl -sS -X POST "$DASHBOARD_URL/api/telemetry" \
  -H "Authorization: Bearer $TELEMETRY_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"submission_id":"test-123","session_id":"sess-1","event_type":"prefill_applied","step":"prefill","response_summary":"ok","payload":{}}]}'
```
