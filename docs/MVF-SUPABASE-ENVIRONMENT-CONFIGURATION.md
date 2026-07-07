# MVF Supabase Edge — environment configuration

Definitions below answer how **Base URL** and **API Key** are used across MVF Supabase Edge Functions, the solar-form iframe (Vercel), optional Deno proxies, and the Optimizely Custom JS Script.

**Do not commit real API keys to git.** Use placeholders here; store secrets in Vercel / Supabase / secure vaults only.

---

## Glossary (definitions)

### Base URL

The **root HTTPS URL** of the MVF Supabase **Edge Functions** gateway for an environment (Production or Staging). Every function is called by appending a path to this base, for example:

- `{Base URL}/appointments/{submissionId}`
- `{Base URL}/book-appointment`
- `{Base URL}/get-availability?postcode=...`

Production and Staging use **different** base URLs (different Supabase projects). A key from one environment **must not** be used against the other base URL.

### API Key (MVF `x-api-key`)

The **MVF-issued API key** is a shared secret used to **authenticate HTTP requests** to the Edge routes that require it. Clients send it as the header:

```http
x-api-key: <your MVF API key>
```

**Not the same as** the Supabase **anon** JWT sometimes sent as `Authorization: Bearer …` on other flows (for example parent-page slot checks). If you rotate one, confirm which header each caller uses.

### Where the API key is used (high level)

| Surface | Config name (typical) | How it is sent |
|---------|------------------------|----------------|
| Solar-form iframe (Vite / Vercel) | `VITE_PROJECT_SOLAR_MVF_API_KEY` | Browser `fetch` adds `x-api-key` to `book-appointment` / `get-availability` (inlined in client JS — treat as public; restrict abuse at API / infra level). |
| Optimizely Custom JS Script (parent page) | `appointmentsApiKey` in `CONFIG` | `fetch` to `/appointments/...` with `x-api-key`. |
| Optional Supabase Deno proxies (this repo) | Supabase secret `PROJECT_SOLAR_MVF_API_KEY` | Edge function reads `Deno.env.get('PROJECT_SOLAR_MVF_API_KEY')` and sets `x-api-key` on **server-side** `fetch` to the real MVF `book-appointment` / `get-availability` URLs. |

After rotation, **every** surface that calls the same environment must be updated **together** so headers stay valid.

### `submissionId` in appointment URLs

The path segment `{submissionId}` (e.g. Chameleon / lead submission id) identifies which appointment record the **appointments** API reads or updates. It is **not** the MVF API key.

### Full URL shape (appointments)

**Template:**

```text
{Base URL}/appointments/{submissionId}
```

**Production example** (only the path after the host changes; `submissionId` is a real id from your funnel):

```text
https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1/appointments/1028313458
```

**Related paths (same base + key):**

- `{Base URL}/appointments/{submissionId}` — GET or POST body as in examples below  
- `{Base URL}/appointments/{submissionId}/failed` — POST failure reason  

**Staging:** swap in the Staging **Base URL** from the table below; keep using the **Staging** API key (not Production’s).

### Curl `API_KEY` placeholder — not the same as `VITE_PROJECT_SOLAR_MVF_API_KEY`

In documentation, `API_KEY` in `-H "x-api-key: API_KEY"` means: **insert the real MVF secret string** issued for that environment (from Carolyn / your vault).

- **Do not** put the literal characters `VITE_PROJECT_SOLAR_MVF_API_KEY` in the header. That string is an **environment variable name** used only in the **solar-form** Vite/Vercel config; at build time Vercel substitutes the **value** into the app, and the browser sends that **value** as `x-api-key`.
- **Manual curl:** use the actual key value, e.g. `-H "x-api-key: $MVF_API_KEY"` after `export MVF_API_KEY='…'` in your shell (never commit the value).

---

## PRODUCTION

| Item | Value |
|------|--------|
| **Base URL** | `https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1` |
| **API Key** | Issued by MVF — **Ask Carolyn Symonds** (do not share in public channels). |

---

## STAGING

| Item | Value |
|------|--------|
| **Base URL** | `https://wppwuqfrvtvtnfgwxnbd.supabase.co/functions/v1` |
| **API Key** | Issued by MVF for the Staging project — **Ask Carolyn Symonds** (store in Vercel / vault only; rotate if exposed). |

---

## POST Appointment form

```bash
curl -X POST "https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1/appointments/my-submission-123" \
  -H "Content-Type: application/json" \
  -H "x-api-key: API_KEY" \
  -d '{
    "lead": {
      "first_name": "Jane",
      "last_name": "Smith",
      "postcode": "SW1A 1AA",
      "email": "jane@example.com",
      "phone_number": "+447700900000",
      "address": "10 Example Street, London"
    },
    "appointment_form": {
      "is_over_75": false,
      "roof_works_planned": false,
      "income_over_15k": true,
      "likely_to_pass_credit_check": true
    }
  }'
```

Replace `API_KEY` with the MVF key for the environment matching the host in the URL.

---

## GET Appointment form — request

```bash
curl "https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1/appointments/my-submission-123" \
  -H "x-api-key: API_KEY"
```

---

## GET Appointment form — response (example shape)

```json
{
  "submission_id": "1028313458",
  "status": "successful",
  "lead": {
    "email": "test@test.com",
    "address": "Memorial Hall, 1 Cornhill, Allestree, Derby, Derbyshire, DE22 2GG",
    "postcode": "DE222GG",
    "last_name": "test",
    "first_name": "test",
    "phone_number": "+447446947277"
  },
  "appointment_form": {
    "is_over_75": false,
    "booking_slot": "2026-03-18T11:00:00.000Z",
    "imagery_date": "2022-08-14",
    "carbon_offset": 6974,
    "imagery_quality": "high",
    "income_over_15k": true,
    "solar_roof_area": 113.4,
    "total_panel_count": 30,
    "roof_works_planned": false,
    "sun_exposure_hours": 243,
    "total_estimated_energy": 14559,
    "selected_segments_count": 2,
    "estimated_annual_savings": 1022,
    "likely_to_pass_credit_check": true
  },
  "booked_slot": "2026-03-18T11:00:00.000Z",
  "created_at": "2026-03-17T11:28:26.950979+00:00",
  "updated_at": "2026-03-17T11:29:05.906789+00:00"
}
```

---

## Failed — appointment form

```bash
curl -X POST "https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1/appointments/my-submission-123/failed" \
  -H "Content-Type: application/json" \
  -H "x-api-key: API_KEY" \
  -d '{"reason": "No slots available"}'
```

---

## Related internal docs

- [Secrets and key rotation](SECRETS-AND-KEY-ROTATION.md) — Vercel, telemetry, Optimizely script, Supabase proxy secret `PROJECT_SOLAR_MVF_API_KEY`.
