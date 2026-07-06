# CRO-693 — Optimizely experiment setup

**Target page:** `https://web.theecoexperts.com/5-reasons-to-install-solar-panels/`  
**Repo branch:** `experimental` (Vercel preview)  
**Ticket:** CRO-693 — loader cover + roof-change follow-up

---

## 1. Create experiment in Optimizely

1. Open **Optimizely Web Experimentation** (same project as existing solar-form experiments).
2. **New experiment** → name: `CRO-693 Solar loader cover + roof follow-up`.
3. **Page targeting:**
   - URL contains: `/5-reasons-to-install-solar-panels`
   - Or exact: `https://web.theecoexperts.com/5-reasons-to-install-solar-panels/`
4. **Activation:** Immediate (page load).

---

## 2. Variations — Custom JavaScript

Paste **one full script per variation** (entire file contents, no edits unless noted).

| Variation | File | Vercel iframe |
|-----------|------|---------------|
| **Control (Original)** | [`optimizely.js`](../optimizely.js) | `https://solar-form-eight.vercel.app` |
| **Variation 1 (CRO-693)** | [`optimizely-cro-693.js`](../optimizely-cro-693.js) | `https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app` |

**Never** run both scripts on the same page.

### Variation CONFIG (already set in `optimizely-cro-693.js`)

```javascript
appUrl: 'https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app/loader',
allowedOutwardCodesUrl: 'https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app/allowed-outward-codes.json',
postcodeOverlayBgUrl: 'https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app/tooltip-bkg.jpg',
postcodeTooltipEnabled: true,
debug: false,  // use ?debug=true on parent URL for QA
```

If Vercel preview hostname changes after a redeploy, update all three URLs in `optimizely-cro-693.js`, commit, push `experimental`, and re-paste into Optimizely.

---

## 3. Metrics / goals

Primary (recommended):

- Form submission completed — GTM `webform_submission_completed` or `thankYouPageReached`
- Thank-you page reached (iframe swap to solar-form)
- Online booking completed

Optional mid-funnel:

- Custom event when postcode loader cover is shown (if instrumented in Optimizely)

Mirror step names from the funnel dashboard (`apps/funnel-dashboard`) where possible.

---

## 4. Traffic and launch

| Phase | Traffic | Notes |
|-------|---------|-------|
| QA | Force variation via URL params (below) | Both control and variation |
| Soft launch | 10–20% | Monitor funnel dashboard |
| Full ramp | Per CRO/product agreement | Confirm loader copy with Luke Brown first |

---

## 5. QA URLs

Replace `<variation_id>` with Optimizely variation ID from the experiment UI.

**Force control:**

```
https://web.theecoexperts.com/5-reasons-to-install-solar-panels/?optly_qa=true&optimizely_x=<control_variation_id>&optimizely_force_tracking=true&eventLog=true&debug=true
```

**Force CRO-693 variation:**

```
https://web.theecoexperts.com/5-reasons-to-install-solar-panels/?optly_qa=true&optimizely_x=<treatment_variation_id>&optimizely_force_tracking=true&eventLog=true&debug=true
```

### QA checklist

**Control**

- [ ] Chameleon form loads inside `.chameleon-widget-wrapper`
- [ ] Form submit → TYP → iframe swaps to production `solar-form-eight.vercel.app/loader`
- [ ] No postcode loader cover

**Variation (console: `cro-693 | Variation 6`)**

- [ ] Postcode **Continue** click → branded loader cover (~5.5s min), not only address selection
- [ ] Cover hides on form advance or 12s safety timeout; no double-click Continue needed
- [ ] `#multistep-banner` hidden after **phone submit**, not only after typing phone
- [ ] Phone submit → TYP redirect → **no flash** of Chameleon supplier/TYP copy before solar-form loader
- [ ] Phone-submit overlay shows EE + PS collaboration strip (not spinner only)
- [ ] Eligible + slots → experimental `/loader` → booking modal (no premature reveal at ~2.5s)
- [ ] Duplicate phone (30d) / no slots / out-of-area → stays on Chameleon TYP, overlays removed
- [ ] Roof-change follow-up on imagery warning
- [ ] Debug panel visible with `debug=true`
- [ ] Safari + Chrome on advertorial → TYP redirect path

---

## 6. Winner rollout

1. Merge `experimental` → `main`.
2. `git push mvf main` → production Vercel deploy.
3. Port loader-cover `CONFIG` into [`optimizely.js`](../optimizely.js) with production URLs.
4. Update Optimizely control / end experiment and ship to 100%.

---

## 7. Variation 6 handoff fixes (2026-07-06)

**Script version:** `cro-693 | Variation 6` in [`optimizely-cro-693.js`](../optimizely-cro-693.js)

| Fix | Summary |
|-----|---------|
| Postcode Continue | Loader also triggers on `pageChanged` when `lastAnsweredQuestion` is postcode |
| Multistep banner | Hidden on phone submit via `hideMultistepBanner()` |
| TYP flash | Full-page + iframe overlays held until `solar-optly-loader-complete`; 7s fallback (not 2.5s) |
| Submit branding | EE + PS strip on phone-submit overlay |
| Pipeline | Duplicate qualification guards; reveal blocked while checks in flight |

Re-paste the full `optimizely-cro-693.js` into Optimizely Variation 1 after each deploy.

**Telemetry CORS (confirmation page):** If you see `Access-Control-Allow-Origin` errors from `solar-form-52ub.vercel.app/api/telemetry`, redeploy the funnel-dashboard app so built-in preview origins apply, or set `ALLOWED_CORS_ORIGINS` on that Vercel project to include `https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app`.

---

## 8. Pre-launch verification (2026-07-06)

Automated checks completed before Optimizely UI setup:

| Check | Result |
|-------|--------|
| Target page loads | OK — `https://web.theecoexperts.com/5-reasons-to-install-solar-panels/` |
| `.chameleon-widget-wrapper` present | OK — 1 wrapper, 1 iframe |
| Chameleon form | OK — form `14378` at `chameleon-eu.web.theecoexperts.com` |
| `window.optimizely` on page | OK — Optimizely snippet loaded |
| Experimental Vercel `/loader` | OK — HTTP 200 |
| Experimental assets (`tooltip-bkg.jpg`, `allowed-outward-codes.json`) | OK — HTTP 200 |
| Solar Optly script active | Not yet — expected until experiment is created and scripts pasted |

**Post-Optimizely QA required:** force each variation with `optly_qa` URLs (section 5) and complete the full form → TYP → booking path for control and CRO-693 variation.

---

## 9. Launch monitoring

After creating the experiment in Optimizely:

1. **Start at 10–20% traffic** on the target URL only.
2. **Monitor Optimizely** for sample ratio mismatch and primary goal lift.
3. **Monitor funnel dashboard** (`apps/funnel-dashboard` on Vercel) for:
   - Drop-off between postcode → email → TYP → booking steps
   - Compare control vs variation submission volumes once experiment is live
4. **Watch for regressions:** slot-check failures, iframe height issues (Safari), loader cover blocking form advance
5. **Ramp traffic** only after both variations pass manual QA and 24–48h of clean data at low traffic
6. **Before full ramp:** confirm loader-cover copy with Luke Brown
