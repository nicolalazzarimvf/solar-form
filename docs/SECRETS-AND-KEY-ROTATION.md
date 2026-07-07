# Secrets and key rotation — solar-form & solar funnel dashboard

This document inventories **credentials and sensitive configuration** used by this repository, where they live, and what to update when rotating. Use it for security reviews, incident response, and onboarding.

**Scope:** Vite solar-form (iframe), **Optimizely Custom JS Script** (source in repo: `optimizely.js`, `optimizely-new.js`, `optimizely-cro-693.js`), optional Supabase Edge function proxies in `supabase/functions/`, and the **funnel dashboard** Next.js app under `apps/funnel-dashboard/`.

---

## 1. Two Vercel projects

| Vercel project | Root directory | Role |
|----------------|----------------|------|
| Solar form (iframe) | Repo root | Static SPA; env vars prefixed with `VITE_` are **exposed in the browser bundle** |
| Funnel dashboard | `apps/funnel-dashboard` | Next.js: server-only secrets + ingest API |

Keep environment variables in sync with this doc when rotating.

---

## 2. Solar form (Vite) — client-exposed variables

These are defined in [`.env.example`](/.env.example) and read from [`src/config/env.js`](/src/config/env.js), [`src/telemetry/funnelTelemetry.js`](/src/telemetry/funnelTelemetry.js), and pages that call external APIs.

| Variable | Purpose | Rotation / notes |
|----------|---------|------------------|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS, Solar Building Insights (`SolarAssessmentPage`) | The string is still **inlined in client JS** (Vite), but in production the key is **HTTP referrer–restricted in Google Cloud** to our allowed domains / iframe origins, so other sites cannot use it. After rotation: update credentials in Google Cloud (keep referrer restrictions), then **Vercel** (solar-form project) and local `.env`. |
| `VITE_IDEAL_POSTCODES_API_KEY` | Ideal Postcodes (address lookup) | Ideal Postcodes dashboard → regenerate API key. Update Vercel + `.env`. |
| `VITE_PROJECT_SOLAR_MVF_API_URL` | Base URL for Supabase Edge Functions (`get-availability`, `book-appointment`) | Not a secret; change if MVF/Supabase project URL changes. Must stay aligned with the Optimizely Custom JS Script `appointments` base (see §4). |
| `VITE_PROJECT_SOLAR_MVF_API_KEY` | `x-api-key` header to MVF Supabase functions from the iframe | **High sensitivity.** Issued/rotated with MVF Supabase project (see Carolyn Symonds note in `.env.example`). Update Vercel + `.env`. Also required server-side on Supabase if proxies use it (§6). |
| `VITE_FUNNEL_TELEMETRY_URL` | Full URL to funnel dashboard `POST /api/telemetry` | Not a secret. Update if dashboard hostname changes. |
| `VITE_FUNNEL_TELEMETRY_KEY` | Bearer token for telemetry ingest | Must **match** `TELEMETRY_INGEST_SECRET` on the dashboard (same random string). Generate new secret → set on **both** Vercel projects in one change window. |

**Legacy / optional entries in `.env.example`:** `VITE_PROJECT_SOLAR_API_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_SHEET_ID` — confirm whether production still uses them; if not, remove from env and docs to avoid confusion.

---

## 3. Funnel dashboard (Next.js / server)

Configured via [`apps/funnel-dashboard/.env.example`](/apps/funnel-dashboard/.env.example) and Vercel **funnel-dashboard** project.

| Variable | Purpose | Rotation / notes |
|----------|---------|------------------|
| `DATABASE_URL` | Heroku Postgres (pooler URL recommended on Vercel) | Heroku → Database → Credentials. Rotating DB password updates this string; **no app code change**. Redeploy / restart after change. |
| `DATABASE_POOL_MAX` | Optional pool size | Not a secret. |
| `TELEMETRY_INGEST_SECRET` | Validates `Authorization: Bearer …` on [`apps/funnel-dashboard/src/app/api/telemetry/route.ts`](/apps/funnel-dashboard/src/app/api/telemetry/route.ts) | Rotate with `openssl rand -base64 32` (or similar). Set on dashboard Vercel **and** `VITE_FUNNEL_TELEMETRY_KEY` on solar-form Vercel. |
| `ALLOWED_CORS_ORIGINS` | Comma-separated origins for telemetry `POST` CORS | Include production + experimental preview URLs (see `apps/funnel-dashboard/.env.example`). **Redeploy funnel-dashboard** after changes. |
| `AUTH_SECRET` | Auth.js session encryption | `openssl rand -base64 32`. Rotating **invalidates existing sessions** (users sign in again). |
| `AUTH_URL` | Canonical app URL for Auth.js | Set to production dashboard URL (see [README](/apps/funnel-dashboard/README.md)). |
| `AUTH_GOOGLE_ID` | Google OAuth Web client ID | [Google Cloud Console](https://console.cloud.google.com/) OAuth client. |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Rotate in Google Cloud → update Vercel. Restrict OAuth redirect URIs to dashboard `/api/auth/callback/google`. Sign-in is restricted to `@mvfglobal.com` in [`apps/funnel-dashboard/src/auth.ts`](/apps/funnel-dashboard/src/auth.ts). |

---

## 4. Optimizely Custom JS Script (public, hardcoded)

The script runs on the parent (Chameleon) page; keys live in its `CONFIG` object. Source is maintained in [`optimizely.js`](/optimizely.js), [`optimizely-new.js`](/optimizely-new.js), and [`optimizely-cro-693.js`](/optimizely-cro-693.js) before copy/paste or deploy into Optimizely.

| Config key (in `CONFIG`) | Purpose | Rotation / notes |
|--------------------------|---------|------------------|
| `getAvailabilityApiKey` | JWT-style **Supabase anon** key used as `Authorization: Bearer` for parent-page slot checks | **Rotating:** Supabase Dashboard → Project Settings → API → regenerate **anon** key, then update the **Optimizely Custom JS Script** in repo and any live Optimizely/Chameleon copy (and any `VITE_*` env that must match). Anyone loading the parent page can see this value in DevTools. |
| `appointmentsApiKey` | MVF `x-api-key` for `appointments` API from parent page | **Rotating:** issue new key in MVF/Supabase process, update the **Optimizely Custom JS Script** (both repo copies), then redeploy/republish the snippet in Optimizely. |
| `getAvailabilityApiUrl` / `appointmentsApiUrl` | Supabase function bases | Align with `VITE_PROJECT_SOLAR_MVF_API_URL` / MVF environment. |
| `appUrl` / `allowedOutwardCodesUrl` | Solar-form static asset URLs | Not secrets; update if Vercel hostname changes. |

**Operational note:** `window.__solarOptlyConfig` can override `CONFIG` at runtime without editing the repo — useful for staging without code change, but document who controls those overrides.

---

## 5. Supabase Edge functions (repo under `supabase/functions/`)

Proxies reference **Deno secrets** (set in Supabase project, not in this repo’s `.env`):

| Secret name (typical) | Used in | Notes |
|----------------------|---------|--------|
| `PROJECT_SOLAR_MVF_API_KEY` | `get-availability-proxy`, `book-appointment-proxy` | Must match MVF edge key expected upstream. Rotate in Supabase Dashboard → Edge Functions → Secrets and redeploy functions. |

If additional functions exist in the hosted Supabase project (outside this repo), inventory them in the MVF runbook.

---

## 6. Rotation checklist (minimal)

1. **MVF Supabase `x-api-key`:** Vercel solar-form `VITE_PROJECT_SOLAR_MVF_API_KEY`, Supabase Deno `PROJECT_SOLAR_MVF_API_KEY`, `appointmentsApiKey` in the **Optimizely Custom JS Script** (repo + live Optimizely), and any Chameleon-hosted copy of the snippet.
2. **Supabase anon (Bearer):** Supabase project settings, `getAvailabilityApiKey` in the **Optimizely Custom JS Script** (repo + live), and `.env.example` / Vite env if anything still uses anon client-side.
3. **Telemetry Bearer:** `TELEMETRY_INGEST_SECRET` (dashboard) + `VITE_FUNNEL_TELEMETRY_KEY` (solar-form) together.
4. **Google Maps / Solar key:** Google Cloud only + Vercel solar-form.
5. **Ideal Postcodes:** Vendor dashboard + Vercel solar-form.
6. **Dashboard staff login:** `AUTH_GOOGLE_SECRET` (+ ID if client recreated), `AUTH_SECRET` if session signing must rotate.
7. **Postgres:** Heroku credential rotation → `DATABASE_URL` on dashboard Vercel only.

---

## 7. Hygiene and compliance

- **Never commit real production secrets** to git. Prefer placeholders in [`.env.example`](/.env.example) and [`apps/funnel-dashboard/.env.example`](/apps/funnel-dashboard/.env.example); if a real key was ever committed, **rotate the key** and consider `git filter-repo` / support ticket for history scrub per org policy.
- **`VITE_*` variables are public** to anyone who loads the built site; treat them as browser-visible.
- **Vercel tokens** (CLI deploy, team API) are account-level — not in this repo; rotate via Vercel account if leaked.
- **Heroku account** access controls who can read `DATABASE_URL`.

---

## 8. Who to ask

- MVF Supabase function URLs and **MVF API keys:** internal owner (see notes in `.env.example` re: Carolyn Symonds / MVF). For **Base URL** vs **`x-api-key`** definitions and example curls, see [MVF Supabase environment configuration](MVF-SUPABASE-ENVIRONMENT-CONFIGURATION.md).
- **Google OAuth** client: team admin for the Google Cloud project tied to `@mvfglobal.com` login.

---

## 9. Vercel security bulletins (e.g. April 2026 incident)

Vercel published a [security bulletin for the April 2026 incident](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) involving unauthorized access to internal systems. Relevant points for this repo’s **two Vercel projects** (solar-form + funnel dashboard):

- **Environment variables not marked “Sensitive”** in the Vercel dashboard were at higher risk of being read if exposed; Vercel states they have **no evidence** that values marked **Sensitive** were accessed. Prefer marking secrets as **Sensitive** when creating or editing variables (Vercel now defaults new vars toward sensitive).
- **Treat non-Sensitive Vercel env values as potentially exposed** until you have confirmed otherwise with your org: rotate **API keys, tokens, `DATABASE_URL`, `TELEMETRY_INGEST_SECRET`, `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`,** etc. Deleting a Vercel project or account **does not** remove risk if secrets are still valid elsewhere — **rotate first**.
- **Hardening:** enable **MFA** on Vercel (and related Google accounts), review **activity logs** and recent **deployments** for anything suspicious, set **Deployment Protection** to at least Standard, and rotate **Deployment Protection tokens** if you use them.
- **Google Workspace:** the bulletin lists an **OAuth app IOC** for admins to check; see the bulletin’s “Indicators of compromise” section.

Re-read the official page for updates; the investigation may evolve.

---

## 10. Step-by-step: Vercel review + rotation (do in order)

Use this after the [April 2026 bulletin](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) or any time you want a controlled rotation. **Check one box per sub-step**; do not skip “inventory” before rotating.

### Step 1 — Account hardening (no secret changes yet)

1. Confirm **MFA** is on for your Vercel login (and for Google accounts that can access Vercel or deploy).
2. Open Vercel → **Activity** (account / team) and scan recent actions for anything unfamiliar.
3. Open **Deployments** on both projects (solar-form + funnel dashboard); confirm latest production deploys are expected.
4. Set **Deployment Protection** to at least **Standard** if policy allows; note whether you use **Protection Bypass** tokens.

### Step 2 — Inventory both Vercel projects

For **each** project (repo root = solar-form, `apps/funnel-dashboard` = funnel dashboard):

1. Settings → **Environment Variables**: export or screenshot the **list of names** (Production / Preview / Development as applicable).
2. For each secret, note whether it is marked **Sensitive** (Vercel UI). Plan to mark or re-create sensitive vars as Sensitive where supported.
3. Check your email / Slack for any **direct notice from Vercel** naming your team as affected; treat that as priority from your security lead.

### Step 3 — External systems (decide who rotates)

Some values are **owned outside Vercel**; rotating Vercel alone is not enough:

| Secret | Rotate in |
|--------|-----------|
| `DATABASE_URL` | Heroku (or host) DB credentials, then paste new URL into **funnel dashboard** Vercel |
| `AUTH_GOOGLE_SECRET` / `AUTH_GOOGLE_ID` | Google Cloud OAuth client |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Cloud API credentials + referrer restrictions |
| `VITE_IDEAL_POSTCODES_API_KEY` | Ideal Postcodes dashboard |
| `VITE_PROJECT_SOLAR_MVF_API_KEY` | MVF / Supabase process (see §8) |
| Optimizely `appointmentsApiKey` / `getAvailabilityApiKey` | MVF + Supabase anon key regen + **Optimizely Custom JS Script** in repo + live snippet |
| Supabase `PROJECT_SOLAR_MVF_API_KEY` | Supabase project → Edge Function secrets |

### Step 4 — Rotate in safe bundles (minimize downtime)

**Bundle A — Telemetry (must match same value on two projects)**  
1. Generate: `openssl rand -base64 32`  
2. Set **funnel dashboard** Vercel: `TELEMETRY_INGEST_SECRET` = new value (mark **Sensitive**).  
3. Set **solar-form** Vercel: `VITE_FUNNEL_TELEMETRY_KEY` = **same** value. Redeploy solar-form so the iframe picks up the new build.  
4. Smoke-test: complete one test journey and confirm events appear in the funnel dashboard DB (or ingest returns 200).

**Bundle B — Dashboard staff auth (expect re-login)**  
1. In Google Cloud: rotate **OAuth client secret** for the dashboard app → update `AUTH_GOOGLE_SECRET` on funnel dashboard Vercel (**Sensitive**).  
2. Optionally rotate `AUTH_SECRET` (`openssl rand -base64 32`) — **all** staff sessions end; update Vercel, redeploy.

**Bundle C — Database**  
1. Rotate DB password in Heroku (or provider) → update `DATABASE_URL` on funnel dashboard Vercel (**Sensitive**) → redeploy dashboard.

**Bundle D — Solar-form client keys (Vite)**  
1. Rotate Ideal Postcodes key → update `VITE_IDEAL_POSTCODES_API_KEY` on solar-form Vercel → redeploy.  
2. Rotate Google Maps key (or re-issue same key with new secret in Google) → update `VITE_GOOGLE_MAPS_API_KEY` → redeploy.  
3. **MVF `x-api-key`:** coordinate with MVF owner — update `VITE_PROJECT_SOLAR_MVF_API_KEY` on solar-form, Supabase Deno secret `PROJECT_SOLAR_MVF_API_KEY`, and **Optimizely Custom JS Script** `appointmentsApiKey` in repo + Optimizely, then redeploy/republish.

**Bundle E — Supabase anon (Bearer in Optimizely only)**  
1. Supabase Dashboard → regenerate **anon** key → update `getAvailabilityApiKey` in **Optimizely Custom JS Script** (repo + live) → publish snippet.

### Step 5 — Protection tokens and non-Vercel secrets

1. If you use **Deployment Protection** bypass tokens, **rotate** them in Vercel per bulletin advice.  
2. Rotate **Vercel personal/team tokens** (CLI, Git integrations) if your org policy says to.  
3. Remind: **Optimizely** and **Chameleon** copies of the Custom JS must match the repo after key changes.

### Step 6 — Verify

1. Solar-form: load iframe, postcode lookup, map/solar step, slot load, **test booking** in non-prod if available.  
2. Funnel dashboard: sign in with `@mvfglobal.com`, open a submission, confirm new events after telemetry rotation.  
3. Parent page: TY flow / iframe height / appointments still work after Optimizely script update.

### Step 7 — Record

1. Note date rotated, who did it, and ticket link in your team wiki or ticket.  
2. Attach variable **names** only (not values) for audit trail.

---

Last updated from repository layout and env examples; confirm production values against Vercel and Heroku dashboards before relying on this list in an audit sign-off.
