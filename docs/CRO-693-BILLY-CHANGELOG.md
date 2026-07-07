# CRO-693 — Billy requests × implementation

**From:** Billy Amps (Slack, 12:43)  
**Experiment:** CRO-693 · Optimizely **Variation 14** (`cro-693 | Variation 14` in console)  
**QA page:** `https://web.theecoexperts.com/5-reasons-to-install-solar-panels/?debug=true`  
**Funnel dashboard:** https://funnel-dashboard-silk.vercel.app  

---

## Request 1 — Loader (between postcode & next step)

> Remove Project Solar reference and say something along the lines of *book an appointment via The Eco Experts in partnership with top rated solar providers*.

| | |
|---|---|
| **Status** | Done |
| **Where** | Parent-page loader cover (after postcode answered, before next Chameleon step) |
| **Project Solar** | Removed from this cover (`postcodeTooltipShowProjectSolar: false`; no PS logo, no “in collaboration with” line) |
| **Eco Experts** | EE logo only on photo background (`loader-bkg.png`) |
| **Title** | Looking for appointments in your area |
| **Body** | Book an appointment via The Eco Experts in partnership with top rated solar providers. |
| **Code** | `optimizely-cro-693.js` → `postcodeTooltipTitle`, `postcodeTooltipBody` |

**Note:** The separate **phone-submit** overlay (after phone number) is intentionally plain white + spinner only — no PS branding there either. The photo branded loader lives on solar-form `/loader` after qualification.

**Billy dashboard filter:** — (no dedicated filter for postcode cover yet). Use **ADV — experimental only** to scope CRO-693 traffic.

---

## Request 2 — When at booking stage

> Remove awards icons top right  
> Remove Eco Experts logo top left  
> Remove the Title  
> Add the following — centered on page:  
> **ECO EXPERTS IN PARTNERSHIP WITH**  
> **{PROJECT SOLAR LOGO}**  
> **Book Your Free Home Assessment**

| | |
|---|---|
| **Status** | Done |
| **Where** | Parent page while user is in the solar-form booking journey (qualified path) |
| **Removed** | Awards icons (top right), EE logo (top left), existing page title / “Explore your solar options” |
| **Added (centered)** | Line: `ECO EXPERTS IN PARTNERSHIP WITH` → white Project Solar logo → H1: `Book Your Free Home Assessment` |
| **PS logo** | White on dark background (`filter: brightness(0) invert(1)`) |
| **Code** | `optimizely-cro-693.js` → `applyBookingStageChrome()`, `ensureBookingStageHeader()`, `hideBookingStageLegacyChrome()` |

**Billy dashboard filter:** — (visual chrome only). Combine **ADV — experimental only** with **Booking succeeded** or **Slot confirmed** for users who reached booking.

---

## Request 3 — Roof assessment conditional question

> Add **"Other"** answer option and exclude from booking.

| | |
|---|---|
| **Status** | Done |
| **Where** | Solar assessment → user says roof changed since imagery → follow-up options |
| **New option** | **Other** (alongside House extension, Roof repairs, Loft conversion) |
| **Booking** | **Excluded** — same as loft conversion: callback screen, no slot booking |
| **Appointment API** | `POST …/failed` with reason `roof_change_other` |
| **Code** | `src/utils/roofChangeFlow.js`, `SolarAssessmentPage.jsx`, `optimizely-cro-693.js` (booking-result mapping) |

### Roof options (full flow)

| Answer | Can book online? | User sees |
|--------|------------------|-----------|
| House extension | Yes | Continue → eligibility → slots |
| Roof repairs | Yes | Continue → eligibility → slots |
| Loft conversion | No | “We'll give you a call” |
| **Other** | **No** | “We'll give you a call” |

**Billy dashboard filters:**

| Outcome | Quick filter |
|---------|--------------|
| Selected **Other** | **Solar — roof change: other (callback)** |
| Selected loft conversion | **Solar — roof change: loft conversion (callback)** |
| Said yes, picking type | **Awaiting roof change type** |
| Continued (extension / repairs) | **House extension — continue online** / **Roof repairs — continue online** |
| All CRO-693 journeys | **ADV — experimental only** |

**Telemetry step names:** `Solar: Roof change — other (callback)` · filter under **Hard exits**.

---

## Request 4 — Database & funnel dashboard

| Change | Status | Detail |
|--------|--------|--------|
| **`tags` column on `journey_events`** | Done (migration run) | `db/migrations/002_journey_event_tags.sql` — adds `tags TEXT[]` default `{}`; **does not delete existing rows** (11,503 events preserved) |
| **`ADV` tag on experimental events** | Done | Client: `VITE_FUNNEL_TELEMETRY_TAGS=ADV` on experimental Vercel. Server: auto-tags when Origin is experimental deploy URL |
| **Roof quick filters in dashboard** | Done | Loft conversion, Other, awaiting type, extension, repairs — see Request 3 table |
| **ADV experiment filter** | Done | Quick filter: **ADV — experimental only** |
| **Tags visible in UI** | Done | Amber **ADV** badge on submission list + event timeline |

**Migration (already applied):**

```bash
psql "$DATABASE_URL" -f db/migrations/002_journey_event_tags.sql
```

**Verify:**

```sql
SELECT COUNT(*) FROM journey_events;                    -- unchanged total
SELECT COUNT(*) FROM journey_events WHERE tags = '{}';  -- pre-migration rows
```

---

## QA checklist (sign-off)

Console: `cro-693 | Variation 14`

- [ ] **Req 1** — After postcode: EE-only loader, new partnership copy, no PS on cover  
- [ ] **Req 2** — At booking: awards + EE logo + old title gone; centered partnership block + white PS logo + “Book Your Free Home Assessment”  
- [ ] **Req 3** — Roof → Other → callback (no booking); loft conversion still callbacks too  
- [ ] **Req 4** — Dashboard events show **ADV** tag; **Other** filter returns submissions  

---

## Deploy / files

| Piece | Location |
|-------|----------|
| Optimizely (re-paste) | `optimizely-cro-693.js` |
| Roof “Other” | `src/utils/roofChangeFlow.js`, `SolarAssessmentPage.jsx` |
| Loader background | `public/loader-bkg.png`, `LoaderTransitionPage.jsx` |
| Dashboard filters + ADV | `apps/funnel-dashboard/src/lib/submissionFilterPresets.ts` |
| DB migration | `db/migrations/002_journey_event_tags.sql` |
