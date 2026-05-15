#!/usr/bin/env node
/**
 * Scan allowed outward codes and call get-availability until N full postcodes
 * with at least one slot are found (or limits are hit).
 *
 *   export MVF_FUNCTIONS_BASE="https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1"
 *   export MVF_API_KEY="<x-api-key>"
 *   node scripts/find-postcodes-with-slots.mjs
 *   node scripts/find-postcodes-with-slots.mjs --n 10 --sleep 100
 *
 * Uses public/allowed-outward-codes.json: round-robin across UK outward *areas*
 * (B, M, SW, …) so probes hit different towns/regions before another cluster.
 * For each outward (e.g. B16) tries inward suffixes (e.g. 4DD) → B164DD.
 *
 * Options:
 *   --n N           Stop after N hits in different areas (default 3)
 *   --max-requests  Cap total HTTP calls (default 500)
 *   --sleep ms      Delay between requests (default 0)
 *   --inwards LIST  Comma-separated 3-char inwards (default: 1AA,1AE,2AD,4DD,1RH,1JX,3LP,2AG,1BA,1LS)
 *   --json          Print hits as JSON lines
 *   --codes PATH    Override path to allowed-outward-codes.json
 *   --allow-duplicate-areas  Allow multiple hits in the same postcode district (B, M, …)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const DEFAULT_BASE = 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1';
const DEFAULT_INWARDS = ['1AA', '1AE', '2AD', '4DD', '1RH', '1JX', '3LP', '2AG', '1BA', '1LS'];

function parseArgs(argv) {
  const flags = new Set();
  let n = 3;
  let maxRequests = 500;
  let sleepMs = 0;
  let codesPath = path.join(root, 'public', 'allowed-outward-codes.json');
  let inwards = [...DEFAULT_INWARDS];
  let distinctAreasOnly = true;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.add('json');
    else if (a === '--allow-duplicate-areas') distinctAreasOnly = false;
    else if (a === '--n' && argv[i + 1]) n = Math.max(1, parseInt(argv[++i], 10) || 3);
    else if (a === '--max-requests' && argv[i + 1]) maxRequests = Math.max(1, parseInt(argv[++i], 10) || 500);
    else if (a === '--sleep' && argv[i + 1]) sleepMs = Math.max(0, Number(argv[++i]) || 0);
    else if (a === '--codes' && argv[i + 1]) codesPath = path.resolve(argv[++i]);
    else if (a === '--inwards' && argv[i + 1]) {
      inwards = argv[++i]
        .split(',')
        .map((s) => s.trim().toUpperCase().replace(/\s/g, ''))
        .filter((s) => s.length === 3);
      if (!inwards.length) inwards = [...DEFAULT_INWARDS];
    } else if (a.startsWith('-')) {
      console.error('Unknown flag:', a);
      process.exit(1);
    }
  }
  return { flags, n, maxRequests, sleepMs, codesPath, inwards, distinctAreasOnly };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function outwardAreaKey(outward) {
  const s = String(outward).toUpperCase().trim();
  const m = s.match(/^([A-Z]{1,2})/);
  const g = m?.[1];
  if (!g) return '_';
  if (g.length === 2) return g;
  return g[0] ?? '_';
}

/** Round-robin across outward area letters (B, M, SW, …) for geographic spread. */
function orderOutwardsAcrossAreas(outwards) {
  if (outwards.length <= 1) return [...outwards];
  const buckets = new Map();
  for (const o of outwards) {
    const k = outwardAreaKey(o);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  }
  const keys = shuffle([...buckets.keys()]);
  const queues = new Map();
  for (const k of keys) {
    queues.set(k, shuffle([...(buckets.get(k) ?? [])]));
  }
  const result = [];
  for (;;) {
    let progressed = false;
    for (const k of keys) {
      const q = queues.get(k);
      if (q.length > 0) {
        result.push(q.shift());
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return result;
}

function countSlots(data) {
  const availability = data?.availability || data?.slots || [];
  let n = 0;
  for (const day of availability) {
    if (day && Array.isArray(day.slots)) n += day.slots.length;
  }
  return n;
}

async function fetchAvailability(base, postcode, apiKey) {
  const url = `${base.replace(/\/$/, '')}/get-availability?postcode=${encodeURIComponent(postcode)}`;
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  return { httpStatus: res.status, body };
}

const { flags, n, maxRequests, sleepMs, codesPath, inwards, distinctAreasOnly } = parseArgs(process.argv);
const base = (process.env.MVF_FUNCTIONS_BASE || DEFAULT_BASE).trim();
const apiKey = (process.env.MVF_API_KEY || '').trim();

let raw;
try {
  raw = JSON.parse(fs.readFileSync(codesPath, 'utf8'));
} catch (e) {
  console.error('Cannot read outward codes:', codesPath, e.message);
  process.exit(1);
}

const outwards = Array.isArray(raw.outward) ? raw.outward.map((o) => String(o).toUpperCase()) : [];
if (!outwards.length) {
  console.error('No outward[] in JSON:', codesPath);
  process.exit(1);
}

const order = orderOutwardsAcrossAreas(outwards);
const hits = [];
const usedAreas = new Set();
let requests = 0;

(async () => {
  outer: for (const outward of order) {
    for (const inward of inwards) {
      if (requests >= maxRequests) break outer;
      const postcode = `${outward}${inward}`.toUpperCase();
      requests++;
      const { httpStatus, body } = await fetchAvailability(base, postcode, apiKey);
      if (sleepMs) await new Promise((r) => setTimeout(r, sleepMs));

      if (httpStatus !== 200) continue;
      const slots = countSlots(body);
      if (slots > 0) {
        const area = outwardAreaKey(outward);
        if (distinctAreasOnly && usedAreas.has(area)) continue;
        if (distinctAreasOnly) usedAreas.add(area);
        hits.push({ postcode, slots, days: (body.availability || body.slots || []).length });
        if (hits.length >= n) break outer;
      }
    }
  }

  if (flags.has('json')) {
    for (const h of hits) console.log(JSON.stringify(h));
    console.log(JSON.stringify({ meta: { requests, found: hits.length, wanted: n } }));
    return;
  }

  console.log(`Base: ${base}`);
  console.log(`x-api-key: ${apiKey ? '(set)' : '(not set)'}`);
  console.log(`Codes: ${codesPath}`);
  console.log(`Requests: ${requests} (cap ${maxRequests})\n`);

  if (!hits.length) {
    console.log(`No postcodes with slots found (try raising --max-requests or different --inwards).`);
    process.exitCode = 1;
    return;
  }

  for (const h of hits) {
    console.log(`${h.postcode}\tslots=${h.slots}\tdays=${h.days}`);
  }
  console.log(`\nFound ${hits.length}/${n} with availability.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
