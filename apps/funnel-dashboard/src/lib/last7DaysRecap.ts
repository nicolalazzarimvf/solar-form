import type { Pool } from 'pg';

export type Last7DaysRecap = {
  /** Distinct submissions whose latest event falls in the rolling 7-day window. */
  submissionsLastActive: number;
  /** Distinct submissions whose first event falls in the window (new journeys). */
  submissionsNew: number;
  /** Total `journey_events` rows in the window. */
  eventsLogged: number;
};

/**
 * Rolling window: last activity / first activity / events since `NOW() - interval '7 days'`
 * (database session timezone).
 */
export async function fetchLast7DaysRecap(pool: Pool): Promise<Last7DaysRecap> {
  const sql = `
    WITH agg AS (
      SELECT submission_id,
             MIN(created_at) AS first_at,
             MAX(created_at) AS last_at
      FROM journey_events
      GROUP BY submission_id
    )
    SELECT
      (SELECT COUNT(*)::bigint FROM agg WHERE last_at >= NOW() - INTERVAL '7 days') AS submissions_last_active,
      (SELECT COUNT(*)::bigint FROM agg WHERE first_at >= NOW() - INTERVAL '7 days') AS submissions_new,
      (SELECT COUNT(*)::bigint FROM journey_events WHERE created_at >= NOW() - INTERVAL '7 days') AS events_logged
  `;
  const { rows } = await pool.query<{
    submissions_last_active: string;
    submissions_new: string;
    events_logged: string;
  }>(sql);
  const r = rows[0];
  return {
    submissionsLastActive: Number(r?.submissions_last_active ?? 0),
    submissionsNew: Number(r?.submissions_new ?? 0),
    eventsLogged: Number(r?.events_logged ?? 0),
  };
}
