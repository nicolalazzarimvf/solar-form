import type { Pool } from 'pg';
import { BILLY_QUICK_MAP } from './submissionFilterPresets';

/** GET `billy_preset` values for recap links — keep aligned with `BILLY_QUICK_MAP`. */
export const RECAP_CLICK_PRESETS = {
  sawSolarForm: 'page_thank_you',
  startedForm: 'thank_book_online',
  bookingSucceeded: 'booking_succeeded',
} as const;

function ilikeContains(value: string): string {
  return `%${value}%`;
}

export type Last7DaysRecap = {
  /** Distinct submissions with any telemetry in the rolling 7-day window. */
  totalUsers: number;
  /** Distinct submissions that saw the thank-you entry page in the same window. */
  sawSolarForm: number;
  /** Distinct submissions that clicked "Book online" in the same window. */
  startedForm: number;
  /** Distinct submissions that reached booking success in the same window. */
  booked: number;
};

export type RecapRangeInput = {
  dateFrom?: string;
  dateTo?: string;
};

function normalizeISODate(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function nextDayISO(dateISO: string): string {
  const dt = new Date(`${dateISO}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString();
}

const RECAP_SQL = `
  WITH windowed AS (
    SELECT submission_id, step, event_type
    FROM journey_events
    WHERE created_at >= COALESCE($7::timestamptz, NOW() - INTERVAL '7 days')
      AND created_at < COALESCE($8::timestamptz, NOW() + INTERVAL '1 day')
  )
  SELECT
    COUNT(DISTINCT submission_id)::bigint AS total_users,
    COUNT(DISTINCT submission_id) FILTER (
      WHERE step ILIKE $1 AND event_type ILIKE $2
    )::bigint AS saw_solar_form,
    COUNT(DISTINCT submission_id) FILTER (
      WHERE step ILIKE $3 AND event_type ILIKE $4
    )::bigint AS started_form,
    COUNT(DISTINCT submission_id) FILTER (
      WHERE step ILIKE $5 AND event_type ILIKE $6
    )::bigint AS booked
  FROM windowed
`;

/**
 * Rolling window on event timestamps since `NOW() - interval '7 days'`
 * (database session timezone). Counts are distinct submissions per funnel milestone.
 */
export async function fetchLast7DaysRecap(pool: Pool, range?: RecapRangeInput): Promise<Last7DaysRecap> {
  const seen = BILLY_QUICK_MAP.page_thank_you;
  const started = BILLY_QUICK_MAP.thank_book_online;
  const bs = BILLY_QUICK_MAP.booking_succeeded;
  const dateFrom = normalizeISODate(range?.dateFrom);
  const dateTo = normalizeISODate(range?.dateTo);

  const recapParams = [
    ilikeContains(seen.step!),
    ilikeContains(seen.event_type!),
    ilikeContains(started.step!),
    ilikeContains(started.event_type!),
    ilikeContains(bs.step!),
    ilikeContains(bs.event_type!),
    dateFrom ? `${dateFrom}T00:00:00Z` : null,
    dateTo ? nextDayISO(dateTo) : null,
  ];

  const recapRes = await pool.query<{
    total_users: string;
    saw_solar_form: string;
    started_form: string;
    booked: string;
  }>(RECAP_SQL, recapParams);
  const r = recapRes.rows[0];

  return {
    totalUsers: Number(r?.total_users ?? 0),
    sawSolarForm: Number(r?.saw_solar_form ?? 0),
    startedForm: Number(r?.started_form ?? 0),
    booked: Number(r?.booked ?? 0),
  };
}
