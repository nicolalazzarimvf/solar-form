'use client';

import { useState } from 'react';

type SlotHit = { postcode: string; slots: number; days: number };

type ApiOk = {
  ok: true;
  hits: SlotHit[];
  requests: number;
  wanted: number;
  message?: string;
};

type ApiErr = { error: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Chrome often surfaces Wi‑Fi/VPN/sleep drops as TypeError "Failed to fetch". */
function isRetriableNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return (
    e.name === 'TypeError' ||
    e.name === 'AbortError' ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    (m.includes('fetch') && m.includes('aborted')) ||
    m.includes('load failed') ||
    m.includes('network changed')
  );
}

function friendlyFetchError(e: unknown): string {
  if (isRetriableNetworkError(e)) {
    return 'Connection interrupted (Wi‑Fi, VPN, or device sleep often causes this). Try again.';
  }
  return e instanceof Error ? e.message : 'Request failed';
}

export function FindSlotsCta() {
  const [pending, setPending] = useState(false);
  const [hits, setHits] = useState<SlotHit[] | null>(null);
  const [requests, setRequests] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function fetchSlots(): Promise<ApiOk> {
    const res = await fetch('/api/find-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ n: 3, maxRequests: 600, distinctAreasOnly: true }),
    });
    const data = (await res.json().catch(() => ({}))) as ApiOk | ApiErr;
    if (!res.ok) {
      throw new Error('error' in data ? data.error : res.statusText);
    }
    return data as ApiOk;
  }

  function applyOk(ok: ApiOk) {
    setHits(ok.hits);
    setRequests(ok.requests);
    setNote(ok.message ?? null);
  }

  async function run() {
    setPending(true);
    setError(null);
    setNote(null);
    setHits(null);
    setRequests(null);
    try {
      applyOk(await fetchSlots());
    } catch (e) {
      if (isRetriableNetworkError(e)) {
        await sleep(900);
        try {
          applyOk(await fetchSlots());
        } catch (e2) {
          setError(friendlyFetchError(e2));
        }
      } else {
        setError(friendlyFetchError(e));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-sky-200/90 bg-sky-50/70 p-4 dark:border-sky-900/60 dark:bg-sky-950/25">
      <h2 className="text-sm font-semibold text-sky-950 dark:text-sky-100">
        Find available slots for testing
      </h2>
      <button
        type="button"
        onClick={() => void run()}
        disabled={pending}
        className="mt-3 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
      >
        {pending ? 'Scanning…' : 'Find 3 postcodes'}
      </button>
      {error && (
        <div className="mt-3 space-y-2" role="alert">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void run()}
            disabled={pending}
            className="text-sm font-medium text-sky-800 underline hover:text-sky-950 disabled:opacity-50 dark:text-sky-300 dark:hover:text-sky-100"
          >
            Retry
          </button>
        </div>
      )}
      {note && !error && (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200/90">{note}</p>
      )}
      {hits && hits.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-sky-900/80 dark:text-sky-400">
            {requests != null ? `${requests} requests · ` : null}
            {hits.length} area{hits.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 grid gap-1 font-mono text-xs text-sky-950 dark:text-sky-100 sm:grid-cols-2">
            {hits.map((h) => (
              <li key={h.postcode} className="rounded-md bg-white/80 px-2 py-1 dark:bg-zinc-950/60">
                {h.postcode}{' '}
                <span className="text-sky-700 dark:text-sky-400">
                  ({h.slots} slots, {h.days} days)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hits && hits.length === 0 && !error && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No slots in this run.</p>
      )}
    </div>
  );
}
