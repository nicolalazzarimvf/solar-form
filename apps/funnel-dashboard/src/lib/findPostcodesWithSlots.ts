import fs from 'fs';
import path from 'path';

export type SlotHit = { postcode: string; slots: number; days: number };

const DEFAULT_INWARDS = ['1AA', '1AE', '2AD', '4DD', '1RH', '1JX', '3LP', '2AG', '1BA', '1LS'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Outward district letters (e.g. B, SW, BA) — spreads probes across UK areas. */
export function outwardAreaKey(outward: string): string {
  const s = outward.toUpperCase().trim();
  const m = s.match(/^([A-Z]{1,2})/);
  const g = m?.[1];
  if (!g) return '_';
  if (g.length === 2) return g;
  return g[0] ?? '_';
}

/**
 * Round-robin outward codes across postcode area letters (B, M, S, …) so early
 * requests hit different UK regions instead of one cluster after a plain shuffle.
 */
export function orderOutwardsAcrossAreas(outwards: string[]): string[] {
  if (outwards.length <= 1) return [...outwards];

  const buckets = new Map<string, string[]>();
  for (const o of outwards) {
    const k = outwardAreaKey(o);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(o);
  }

  const keys = shuffle([...buckets.keys()]);
  const queues = new Map<string, string[]>();
  for (const k of keys) {
    queues.set(k, shuffle([...(buckets.get(k) ?? [])]));
  }

  const result: string[] = [];
  for (;;) {
    let progressed = false;
    for (const k of keys) {
      const q = queues.get(k)!;
      if (q.length > 0) {
        result.push(q.shift()!);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return result;
}

type AvailabilityBody = {
  availability?: { slots?: unknown[] }[];
  slots?: { slots?: unknown[] }[];
};

function countSlots(data: AvailabilityBody): number {
  const availability = data?.availability ?? data?.slots ?? [];
  let n = 0;
  for (const day of availability) {
    if (day && Array.isArray(day.slots)) n += day.slots.length;
  }
  return n;
}

export function loadOutwardCodesFromDisk(): string[] {
  const envPath = process.env.ALLOWED_OUTWARD_CODES_PATH?.trim();
  const candidates = [
    envPath,
    path.join(process.cwd(), 'public', 'allowed-outward-codes.json'),
    path.join(process.cwd(), '..', '..', 'public', 'allowed-outward-codes.json'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as { outward?: unknown[] };
      if (Array.isArray(raw.outward)) {
        return raw.outward.map((o) => String(o).toUpperCase());
      }
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Could not read allowed-outward-codes.json. Set ALLOWED_OUTWARD_CODES_PATH or run from monorepo with solar-form/public present.'
  );
}

async function fetchAvailability(
  base: string,
  postcode: string,
  apiKey: string
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const url = `${base.replace(/\/$/, '')}/get-availability?postcode=${encodeURIComponent(postcode)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }
  return { httpStatus: res.status, body };
}

export type FindSlotsParams = {
  baseUrl: string;
  apiKey: string;
  outwards: string[];
  targetN: number;
  maxRequests: number;
  sleepMs?: number;
  inwards?: string[];
  /** If true (default), only one hit per outward district (B, M, SW, …) so results are different towns/areas. */
  distinctAreasOnly?: boolean;
};

export async function findPostcodesWithSlots({
  baseUrl,
  apiKey,
  outwards,
  targetN,
  maxRequests,
  sleepMs = 0,
  inwards = DEFAULT_INWARDS,
  distinctAreasOnly = true,
}: FindSlotsParams): Promise<{ hits: SlotHit[]; requests: number }> {
  const order = orderOutwardsAcrossAreas(outwards);
  const hits: SlotHit[] = [];
  const usedAreas = new Set<string>();
  let requests = 0;

  outer: for (const outward of order) {
    for (const inward of inwards) {
      if (requests >= maxRequests) break outer;
      const postcode = `${outward}${inward}`.toUpperCase();
      requests++;
      const { httpStatus, body } = await fetchAvailability(baseUrl, postcode, apiKey);
      if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));

      if (httpStatus !== 200) continue;
      const slots = countSlots(body as AvailabilityBody);
      if (slots > 0) {
        const area = outwardAreaKey(outward);
        if (distinctAreasOnly && usedAreas.has(area)) continue;
        if (distinctAreasOnly) usedAreas.add(area);
        const availability =
          (body as AvailabilityBody).availability ?? (body as AvailabilityBody).slots ?? [];
        hits.push({ postcode, slots, days: availability.length });
        if (hits.length >= targetN) break outer;
      }
    }
  }

  return { hits, requests };
}
