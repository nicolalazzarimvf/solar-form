import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { submissionFiltersFromSearchParams } from './resolveSubmissionFilters';
import {
  buildSubmissionListWhereClause,
  countMatchingSubmissions,
  fetchSubmissionList,
  mapSubmissionWhereForLatestSubquery,
} from './submissionListQuery';
import type { SubmissionListFilters } from './resolveSubmissionFilters';

const hasDbUrl = Boolean(process.env.DATABASE_URL?.trim());

/** Reference count for filters that use EXISTS (any-event match). */
async function countViaExistsAggregate(pool: Pool, filters: SubmissionListFilters): Promise<number> {
  const { whereClause, params } = buildSubmissionListWhereClause(filters);
  const sql = `
    SELECT COUNT(*)::bigint AS n
    FROM (
      SELECT submission_id, MAX(created_at) AS last_at
      FROM journey_events
      GROUP BY submission_id
    ) s
    ${whereClause}
  `;
  const { rows } = await pool.query<{ n: string }>(sql, params.length ? params : undefined);
  return Number(rows[0]?.n ?? 0);
}

async function countLatestViaDistinctOn(
  pool: Pool,
  filters: SubmissionListFilters
): Promise<number> {
  const { whereClause, params } = buildSubmissionListWhereClause(filters);
  const mappedWhere = mapSubmissionWhereForLatestSubquery(whereClause);
  const sql = `
    WITH latest AS (
      SELECT DISTINCT ON (submission_id)
        submission_id,
        step,
        event_type,
        created_at AS last_event_at
      FROM journey_events
      ORDER BY submission_id, created_at DESC, id DESC
    ),
    agg AS (
      SELECT submission_id, MAX(created_at) AS last_at
      FROM journey_events
      GROUP BY submission_id
    )
    SELECT COUNT(*)::bigint AS n
    FROM latest l
    INNER JOIN agg ON agg.submission_id = l.submission_id AND agg.last_at = l.last_event_at
    ${mappedWhere}
  `;
  const { rows } = await pool.query<{ n: string }>(sql, params.length ? params : undefined);
  return Number(rows[0]?.n ?? 0);
}

function sslForUrl(url: string): boolean | { rejectUnauthorized: boolean } {
  if (
    url.includes('amazonaws.com') ||
    url.includes('heroku') ||
    url.includes('neon.tech') ||
    /sslmode=require/i.test(url)
  ) {
    return { rejectUnauthorized: false };
  }
  return false;
}

describe.skipIf(!hasDbUrl)(
  'submission list query vs PostgreSQL (integration)',
  { timeout: 60_000 },
  () => {
    let pool: Pool;

    beforeAll(() => {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 15_000,
        ssl: sslForUrl(process.env.DATABASE_URL || ''),
      });
    });

    afterAll(async () => {
      await pool.end();
    });

    async function assertCountsMatch(filters: SubmissionListFilters) {
      const ae = filters.any_event;
      const useExistsRef =
        ae && ((ae.step ?? '').trim() || (ae.event_type ?? '').trim());
      const ref = useExistsRef
        ? countViaExistsAggregate(pool, filters)
        : countLatestViaDistinctOn(pool, filters);
      const [appCount, refCount] = await Promise.all([
        countMatchingSubmissions(pool, filters),
        ref,
      ]);
      expect(appCount, `app count ${appCount} vs reference ${refCount}`).toBe(refCount);
    }

    it('matches reference with no filters', async () => {
      await assertCountsMatch(submissionFiltersFromSearchParams({}));
    });

    it('matches reference for submission id contains', async () => {
      await assertCountsMatch(submissionFiltersFromSearchParams({ q: '0' }));
    });

    it('matches reference for booked filter (any-event: booking at any point)', async () => {
      const filters = submissionFiltersFromSearchParams({ billy_preset: 'booking_succeeded' });
      // booking_succeeded must resolve to an any-event filter (EXISTS branch).
      expect(filters.any_event?.step).toBe('Confirmation: Booking succeeded');
      await assertCountsMatch(filters);
    });

    it('matches reference for reached-but-not-booked (EXISTS slots AND NOT EXISTS booking)', async () => {
      const filters = submissionFiltersFromSearchParams({ billy_preset: 'reached_no_booking' });
      // Compound preset: positive any-event (slots) plus a not_any_event exclusion (booking).
      expect(filters.any_event?.step).toBe('Page: Choose appointment slot');
      expect(filters.not_any_event?.step).toBe('Confirmation: Booking succeeded');
      await assertCountsMatch(filters);
    });

    it('fetchSubmissionList length equals count when under LIMIT', async () => {
      const filters = submissionFiltersFromSearchParams({});
      const total = await countMatchingSubmissions(pool, filters);
      const rows = await fetchSubmissionList(pool, filters, { limit: 500 });
      expect(rows.length).toBe(Math.min(total, 500));
    });
  }
);
