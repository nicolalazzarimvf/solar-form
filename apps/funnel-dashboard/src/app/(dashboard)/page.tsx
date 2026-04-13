import Link from 'next/link';
import { getPool } from '@/lib/db';
import { DeleteSubmissionButton } from '@/components/DeleteSubmissionButton';

export const dynamic = 'force-dynamic';

type Row = {
  submission_id: string;
  event_count: string;
  first_at: Date;
  last_at: Date;
  last_step: string;
  last_event_type: string;
  last_summary: string | null;
};

async function fetchSubmissions(q: string | undefined): Promise<Row[]> {
  const pool = getPool();
  const search = (q ?? '').trim();
  const params: string[] = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = 'WHERE submission_id ILIKE $1';
  }
  const sql = `
    SELECT s.submission_id,
           s.event_count::text,
           s.first_at,
           s.last_at,
           e.step AS last_step,
           e.event_type AS last_event_type,
           e.response_summary AS last_summary
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
      ORDER BY j.created_at DESC
      LIMIT 1
    ) e ON true
    ${where}
    ORDER BY s.last_at DESC
    LIMIT 200
  `;
  const { rows } = await pool.query<Row>(sql, params.length ? params : undefined);
  return rows;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let rows: Row[] = [];
  let dbError: string | null = null;
  try {
    rows = await fetchSubmissions(q);
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Database error';
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Submissions
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Latest activity by Chameleon <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">submissionId</code>
        . Events are recorded from the solar booking iframe after prefill.
      </p>

      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <input
          name="q"
          type="search"
          placeholder="Filter by submission ID…"
          defaultValue={q ?? ''}
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Search
        </button>
      </form>

      {dbError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <strong>Database:</strong> {dbError}. Set <code className="rounded bg-red-100 px-1 dark:bg-red-900">DATABASE_URL</code> and run{' '}
          <code className="rounded bg-red-100 px-1 dark:bg-red-900">db/migrations/001_journey_events.sql</code>.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="p-3 font-medium">Submission ID</th>
              <th className="p-3 font-medium">Events</th>
              <th className="p-3 font-medium">Last step</th>
              <th className="p-3 font-medium">Last type</th>
              <th className="p-3 font-medium">Last summary</th>
              <th className="p-3 font-medium">Last seen</th>
              <th className="p-3 w-24 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !dbError ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  No events yet. Send telemetry from the solar-form app.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.submission_id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="p-3 font-mono text-xs">
                    <Link
                      href={`/submissions/${encodeURIComponent(r.submission_id)}`}
                      className="text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400"
                    >
                      {r.submission_id}
                    </Link>
                  </td>
                  <td className="p-3">{r.event_count}</td>
                  <td className="p-3 font-mono text-xs">{r.last_step || '—'}</td>
                  <td className="p-3 text-xs">{r.last_event_type}</td>
                  <td className="max-w-[200px] truncate p-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.last_summary ?? '—'}
                  </td>
                  <td className="p-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.last_at ? new Date(r.last_at).toLocaleString() : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <DeleteSubmissionButton submissionId={r.submission_id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
