import type { Pool } from 'pg';
import { BILLY_QUICK_MAP } from './submissionFilterPresets';

/** GET `billy_preset` values for recap links — keep aligned with `BILLY_QUICK_MAP`. */
export const RECAP_CLICK_PRESETS = {
  bookingSucceeded: 'booking_succeeded',
  bookingFailed: 'booking_failed',
  eligibilityPassed: 'eligibility_passed',
} as const;

function ilikeContains(value: string): string {
  return `%${value}%`;
}

export type Last7DaysRecap = {
  /** Distinct submissions whose first event falls in the window (new journeys). */
  submissionsNew: number;
  /** Total `journey_events` rows in the window. */
  eventsLogged: number;
  /**
   * Among submissions with last activity in the window: latest event matches the
   * booking succeeded preset (same as quick filter).
   */
  bookingSucceeded: number;
  /**
   * Same universe; latest event matches booking failed preset.
   */
  bookingFailed: number;
  /**
   * Same universe; at least one event matches eligibility-passed preset (`any_event` semantics).
   */
  eligibilityPassed: number;
};

const SUMMARY_SQL = `
  WITH agg AS (
    SELECT submission_id, MIN(created_at) AS first_at
    FROM journey_events
    GROUP BY submission_id
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM agg WHERE first_at >= NOW() - INTERVAL '7 days') AS submissions_new,
    (SELECT COUNT(*)::bigint FROM journey_events WHERE created_at >= NOW() - INTERVAL '7 days') AS events_logged
`;

const OUTCOMES_SQL = `
  WITH recent AS (
    SELECT s.submission_id,
           s.last_at,
           e.step AS last_step,
           e.event_type AS last_event_type
    FROM (
      SELECT submission_id, MAX(created_at) AS last_at
      FROM journey_events
      GROUP BY submission_id
    ) s
    JOIN LATERAL (
      SELECT step, event_type
      FROM journey_events j
      WHERE j.submission_id = s.submission_id
      ORDER BY j.created_at DESC, j.id DESC
      LIMIT 1
    ) e ON true
    WHERE s.last_at >= NOW() - INTERVAL '7 days'
  )
  SELECT
    COUNT(*) FILTER (
      WHERE last_step ILIKE $1 AND last_event_type ILIKE $2
    )::bigint AS booking_succeeded,
    COUNT(*) FILTER (
      WHERE last_step ILIKE $3 AND last_event_type ILIKE $4
    )::bigint AS booking_failed,
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1
        FROM journey_events j
        WHERE j.submission_id = recent.submission_id
          AND j.step ILIKE $5
          AND j.event_type ILIKE $6
      )
    )::bigint AS eligibility_passed
  FROM recent
`;

/**
 * Rolling window: last activity / first activity / events since `NOW() - interval '7 days'`
 * (database session timezone). Outcome counts use the same last-activity window and match
 * `buildSubmissionListWhereClause` behaviour for the three presets.
 */
export async function fetchLast7DaysRecap(pool: Pool): Promise<Last7DaysRecap> {
  const bs = BILLY_QUICK_MAP.booking_succeeded;
  const bf = BILLY_QUICK_MAP.booking_failed;
  const ep = BILLY_QUICK_MAP.eligibility_passed;

  const outcomeParams = [
    ilikeContains(bs.step!),
    ilikeContains(bs.event_type!),
    ilikeContains(bf.step!),
    ilikeContains(bf.event_type!),
    ilikeContains(ep.step!),
    ilikeContains(ep.event_type!),
  ];

  const [summaryRes, outcomesRes] = await Promise.all([
    pool.query<{
      submissions_new: string;
      events_logged: string;
    }>(SUMMARY_SQL),
    pool.query<{
      booking_succeeded: string;
      booking_failed: string;
      eligibility_passed: string;
    }>(OUTCOMES_SQL, outcomeParams),
  ]);

  const s = summaryRes.rows[0];
  const o = outcomesRes.rows[0];

  return {
    submissionsNew: Number(s?.submissions_new ?? 0),
    eventsLogged: Number(s?.events_logged ?? 0),
    bookingSucceeded: Number(o?.booking_succeeded ?? 0),
    bookingFailed: Number(o?.booking_failed ?? 0),
    eligibilityPassed: Number(o?.eligibility_passed ?? 0),
  };
}
