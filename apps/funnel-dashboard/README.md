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

## Recap export API (`GET /api/recap`)

Read-only JSON export for reporting dashboards (e.g. Google Apps Script). Returns per-submission funnel statuses and daily aggregates for a date range.

### Authentication

Set `RECAP_API_TOKEN` on Vercel (mark **Sensitive**). Generate with `openssl rand -base64 32`. Share the value securely with consumers — store in Apps Script **Script Properties**, never in source code.

Send either:

- `Authorization: Bearer <RECAP_API_TOKEN>`
- `x-api-key: <RECAP_API_TOKEN>`

Unauthenticated or invalid requests return **401**. Missing server config returns **500**.

### Query parameters

| Param | Required | Format | Description |
|-------|----------|--------|-------------|
| `date_from` | No | `YYYY-MM-DD` | Start of range (UTC midnight). Default: 7 days ago. |
| `date_to` | No | `YYYY-MM-DD` | End of range (inclusive). Default: today (UTC). |

A submission is included if **any** telemetry event falls in `[date_from 00:00 UTC, date_to 23:59:59 UTC]`.

### Example (curl)

```bash
curl -sS "https://solar-form-52ub.vercel.app/api/recap?date_from=2026-07-08&date_to=2026-07-14" \
  -H "Authorization: Bearer $RECAP_API_TOKEN"
```

### Example (Google Apps Script)

```javascript
function fetchSolarRecap(dateFrom, dateTo) {
  var token = PropertiesService.getScriptProperties().getProperty('RECAP_API_TOKEN');
  var url = 'https://solar-form-52ub.vercel.app/api/recap'
    + '?date_from=' + encodeURIComponent(dateFrom)
    + '&date_to=' + encodeURIComponent(dateTo);
  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Recap API ' + response.getResponseCode() + ': ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}
```

### Response schema

Top-level object:

| Field | Type | Meaning |
|-------|------|---------|
| `meta.date_from` | string | Resolved start date (`YYYY-MM-DD`) |
| `meta.date_to` | string | Resolved end date (`YYYY-MM-DD`) |
| `meta.generated_at` | string | ISO timestamp when the response was built |
| `meta.submission_count` | number | Number of submissions in `submissions` |
| `daily_summary` | array | Funnel counts grouped by UTC date of each submission's first event in range |
| `submissions` | array | One row per Chameleon `submission_id` |

Each `daily_summary[]` row:

| Field | Meaning |
|-------|---------|
| `date` | UTC date (`YYYY-MM-DD`) |
| `total_submissions` | Submissions whose first in-range event falls on this date |
| `saw_form` | Saw the thank-you page (any event in their window) |
| `started` | Clicked "Book online" |
| `reached_booking` | Reached appointment slot selection |
| `booked` | Booking succeeded |
| `by_status` | Count per `status` value (see below) |

Each `submissions[]` row:

| Field | Meaning |
|-------|---------|
| `submission_id` | Chameleon submission ID (join key) |
| `status` | Derived terminal disposition (priority order below) |
| `first_at` | ISO timestamp of first event in range |
| `last_at` | ISO timestamp of last event in range |
| `last_step` | Human-readable step label of latest in-range event |
| `last_event_type` | Event type of latest in-range event |
| `tags` | Distinct experiment tags across the full journey (e.g. `ADV`) |
| `milestones.saw_form` | Thank-you page viewed in range |
| `milestones.started` | "Book online" clicked in range |
| `milestones.reached_booking` | Slot selection page reached in range |
| `milestones.booked` | Booking succeeded in range |

`status` values (first matching rule wins):

| Value | Meaning |
|-------|---------|
| `booked` | Appointment booked successfully |
| `booking_failed` | Booking API failed (callback / retry) |
| `skipped_disqualified` | Confirmation skipped — disqualified earlier |
| `skipped_session_expired` | Confirmation skipped — session expired |
| `solar_disqualified` | Roof/panel rules not met |
| `eligibility_disqualified` | Failed eligibility questions |
| `roof_changed` | Roof changed since imagery (legacy exit) |
| `roof_change_loft_conversion` | Loft conversion — callback |
| `roof_change_other` | Other roof change — callback |
| `callback_requested` | "No thanks" on thank-you (phone callback) |
| `reached_booking_no_book` | Reached slot page but never booked |
| `started_not_completed` | Started online journey, no terminal outcome |
| `saw_form_not_started` | Saw thank-you only |
| `in_progress` | Has events but none of the above |
