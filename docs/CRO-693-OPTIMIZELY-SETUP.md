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

**Variation**

- [ ] Postcode answered → branded loader cover (~5.5s min)
- [ ] Cover hides on form advance or 12s timeout
- [ ] TYP loads experimental Vercel preview hostname
- [ ] Roof-change follow-up on imagery warning
- [ ] Debug panel visible with `debug=true`

---

## 6. Winner rollout

1. Merge `experimental` → `main`.
2. `git push mvf main` → production Vercel deploy.
3. Port loader-cover `CONFIG` into [`optimizely.js`](../optimizely.js) with production URLs.
4. Update Optimizely control / end experiment and ship to 100%.
