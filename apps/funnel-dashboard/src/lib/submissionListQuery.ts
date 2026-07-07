import type { Pool } from 'pg';
import { parseDateParam, type SubmissionListFilters } from './resolveSubmissionFilters';

export type SubmissionListRow = {
  submission_id: string;
  event_count: string;
  first_at: Date;
  last_at: Date;
  last_step: string;
  last_event_type: string;
  last_summary: string | null;
  tags: string[] | null;
};

/** Same shape as the dashboard list query (GROUP BY + LATERAL latest event). */
const SUBMISSION_LIST_BASE = `
  FROM (
    SELECT submission_id,
           COUNT(*)::int AS event_count,
           MIN(created_at) AS first_at,
           MAX(created_at) AS last_at
    FROM journey_events
    GROUP BY submission_id
  ) s
  JOIN LATERAL (
    SELECT step, event_type, response_summary
    FROM journey_events j
    WHERE j.submission_id = s.submission_id
    ORDER BY j.created_at DESC, j.id DESC
    LIMIT 1
  ) e ON true
`;

export function buildSubmissionListWhereClause(filters: SubmissionListFilters): {
  whereClause: string;
  params: string[];
} {
  const search = (filters.q ?? '').trim();
  const step = (filters.step ?? '').trim();
  const eventType = (filters.event_type ?? '').trim();
  const anyEv = filters.any_event;
  const anyStep = (anyEv?.step ?? '').trim();
  const anyEt = (anyEv?.event_type ?? '').trim();
  const useAnyEvent = Boolean(anyStep || anyEt);
  const notAnyEv = filters.not_any_event;
  const notStep = (notAnyEv?.step ?? '').trim();
  const notEt = (notAnyEv?.event_type ?? '').trim();
  const useNotAnyEvent = Boolean(notStep || notEt);
  const tag = (filters.tag ?? '').trim();
  const dateFrom = parseDateParam(filters.date_from);
  const dateTo = parseDateParam(filters.date_to);

  const conditions: string[] = [];
  const params: string[] = [];
  let i = 1;

  if (search) {
    conditions.push(`s.submission_id ILIKE $${i}`);
    params.push(`%${search}%`);
    i += 1;
  }
  if (useAnyEvent) {
    const existsParts = ['j.submission_id = s.submission_id'];
    if (anyStep) {
      existsParts.push(`j.step ILIKE $${i}`);
      params.push(`%${anyStep}%`);
      i += 1;
    }
    if (anyEt) {
      existsParts.push(`j.event_type ILIKE $${i}`);
      params.push(`%${anyEt}%`);
      i += 1;
    }
    conditions.push(`EXISTS (SELECT 1 FROM journey_events j WHERE ${existsParts.join(' AND ')})`);
  } else {
    if (step) {
      conditions.push(`e.step ILIKE $${i}`);
      params.push(`%${step}%`);
      i += 1;
    }
    if (eventType) {
      conditions.push(`e.event_type ILIKE $${i}`);
      params.push(`%${eventType}%`);
      i += 1;
    }
  }
  if (useNotAnyEvent) {
    const notParts = ['j.submission_id = s.submission_id'];
    if (notStep) {
      notParts.push(`j.step ILIKE $${i}`);
      params.push(`%${notStep}%`);
      i += 1;
    }
    if (notEt) {
      notParts.push(`j.event_type ILIKE $${i}`);
      params.push(`%${notEt}%`);
      i += 1;
    }
    conditions.push(`NOT EXISTS (SELECT 1 FROM journey_events j WHERE ${notParts.join(' AND ')})`);
  }
  if (tag) {
    conditions.push(
      `EXISTS (SELECT 1 FROM journey_events jt WHERE jt.submission_id = s.submission_id AND $${i} = ANY(jt.tags))`
    );
    params.push(tag);
    i += 1;
  }
  if (dateFrom) {
    conditions.push(`s.last_at >= $${i}::date`);
    params.push(dateFrom);
    i += 1;
  }
  if (dateTo) {
    conditions.push(`s.last_at < ($${i}::date + interval '1 day')`);
    params.push(dateTo);
    i += 1;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

/** Maps list-query WHERE aliases to the DISTINCT ON reference query used in integration tests. */
export function mapSubmissionWhereForLatestSubquery(whereClause: string): string {
  if (!whereClause) return '';
  return whereClause
    .replaceAll('s.submission_id', 'l.submission_id')
    .replaceAll('e.step', 'l.step')
    .replaceAll('e.event_type', 'l.event_type')
    .replaceAll('s.last_at', 'agg.last_at');
}

export async function fetchSubmissionList(
  pool: Pool,
  filters: SubmissionListFilters,
  options: { limit?: number; offset?: number } = {}
): Promise<SubmissionListRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const { whereClause, params } = buildSubmissionListWhereClause(filters);
  const sql = `
    SELECT s.submission_id,
           s.event_count::text,
           s.first_at,
           s.last_at,
           e.step AS last_step,
           e.event_type AS last_event_type,
           e.response_summary AS last_summary,
           (
             SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}'::text[])
             FROM journey_events jt, unnest(jt.tags) AS t
             WHERE jt.submission_id = s.submission_id
           ) AS tags
    ${SUBMISSION_LIST_BASE}
    ${whereClause}
    ORDER BY s.last_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const { rows } = await pool.query<SubmissionListRow>(sql, params.length ? params : undefined);
  return rows;
}

/** Count submissions whose latest event matches the filter (no LIMIT). */
export async function countMatchingSubmissions(
  pool: Pool,
  filters: SubmissionListFilters
): Promise<number> {
  const { whereClause, params } = buildSubmissionListWhereClause(filters);
  const sql = `
    SELECT COUNT(*)::bigint AS n
    ${SUBMISSION_LIST_BASE}
    ${whereClause}
  `;
  const { rows } = await pool.query<{ n: string }>(sql, params.length ? params : undefined);
  return Number(rows[0]?.n ?? 0);
}
