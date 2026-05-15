#!/usr/bin/env node
/**
 * Probe MVF Supabase Edge `get-availability` for one or more UK postcodes.
 *
 * Calls the Edge HTTP API (same contract as SlotSelectionPage.jsx), not SQL.
 *
 *   export MVF_FUNCTIONS_BASE="https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1"
 *   export MVF_API_KEY="<same as VITE_PROJECT_SOLAR_MVF_API_KEY / x-api-key>"
 *   node scripts/check-postcode-slots.mjs B164DD M11AE BS284JX
 *
 *   npm run check-slots -- B164DD M11AE
 *
 * Options:
 *   --json     One JSON object per line
 *   --sleep ms Delay between requests (default 0)
 */

const DEFAULT_BASE = 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1';

function parseArgs(argv) {
  const flags = new Set();
  const pos = [];
  let sleepMs = 0;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.add('json');
    else if (a === '--sleep' && argv[i + 1]) {
      sleepMs = Math.max(0, Number(argv[++i]) || 0);
    } else if (a.startsWith('-')) {
      console.error('Unknown flag:', a);
      process.exit(1);
    } else pos.push(a);
  }
  return { flags, postcodes: pos, sleepMs };
}

function normalizePc(pc) {
  return String(pc || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function countSlots(data) {
  const availability = data?.availability || data?.slots || [];
  let n = 0;
  for (const day of availability) {
    if (day && Array.isArray(day.slots)) n += day.slots.length;
  }
  return { slotCount: n, dayCount: availability.length };
}

async function fetchAvailability(base, postcode, apiKey) {
  const url = `${base.replace(/\/$/, '')}/get-availability?postcode=${encodeURIComponent(postcode)}`;
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const t0 = Date.now();
  const res = await fetch(url, { method: 'GET', headers });
  const ms = Date.now() - t0;
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { _parseError: true, raw: text.slice(0, 500) };
  }
  return { postcode, httpStatus: res.status, ms, body };
}

function main() {
  const { flags, postcodes: rawList, sleepMs } = parseArgs(process.argv);
  const base = (process.env.MVF_FUNCTIONS_BASE || DEFAULT_BASE).trim();
  const apiKey = (process.env.MVF_API_KEY || '').trim();

  const postcodes = (rawList.length ? rawList : ['B164DD', 'M11AE', 'BS284JX', 'LE17RH']).map(normalizePc);

  if (!postcodes.length) {
    console.error('Pass at least one postcode, e.g. node scripts/check-postcode-slots.mjs B164DD');
    process.exit(1);
  }

  (async () => {
    const rows = [];
    for (const pc of postcodes) {
      rows.push(await fetchAvailability(base, pc, apiKey));
      if (sleepMs) await new Promise((r) => setTimeout(r, sleepMs));
    }

    if (flags.has('json')) {
      for (const r of rows) {
        const ok = r.httpStatus === 200 && !r.body?._parseError;
        const { slotCount, dayCount } = ok ? countSlots(r.body) : { slotCount: 0, dayCount: 0 };
        console.log(
          JSON.stringify({
            postcode: r.postcode,
            httpStatus: r.httpStatus,
            ms: r.ms,
            slotCount,
            dayCount,
            message: r.body?.message || r.body?.error,
          })
        );
      }
      return;
    }

    console.log(`Base: ${base}`);
    console.log(`x-api-key: ${apiKey ? '(set)' : '(not set — may 401/403 depending on MVF config)'}\n`);

    for (const r of rows) {
      const ok = r.httpStatus === 200 && !r.body?._parseError;
      const { slotCount, dayCount } = ok ? countSlots(r.body) : { slotCount: 0, dayCount: 0 };
      const extra =
        r.httpStatus !== 200
          ? ` body=${JSON.stringify(r.body).slice(0, 200)}`
          : ` slots=${slotCount} days=${dayCount}`;
      console.log(`${r.postcode}\tHTTP ${r.httpStatus}\t${r.ms}ms${extra}`);
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
