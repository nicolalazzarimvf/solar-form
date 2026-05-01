import Link from 'next/link';
import { getPool } from '@/lib/db';
import { DeleteSubmissionButton } from '@/components/DeleteSubmissionButton';
import { fetchSubmissionList } from '@/lib/submissionListQuery';
import {
  submissionFiltersFromSearchParams,
  type SubmissionSearchParams,
} from '@/lib/resolveSubmissionFilters';

export const dynamic = 'force-dynamic';

export type { SubmissionListFilters } from '@/lib/resolveSubmissionFilters';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SubmissionSearchParams>;
}) {
  const sp = await searchParams;
  const filters = submissionFiltersFromSearchParams(sp);
  const hasActiveFilters =
    Boolean((filters.q ?? '').trim()) ||
    Boolean((filters.date_from ?? '').trim()) ||
    Boolean((filters.date_to ?? '').trim());

  let rows: Awaited<ReturnType<typeof fetchSubmissionList>> = [];
  let dbError: string | null = null;
  try {
    rows = await fetchSubmissionList(getPool(), filters);
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
        . Events are recorded from the solar booking iframe after prefill. Filter by ID (partial match) and/or last
        activity date; open a row for the full event timeline.
      </p>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <input
          name="q"
          type="search"
          placeholder="Submission ID…"
          defaultValue={filters.q ?? ''}
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Last activity from
          <input
            name="date_from"
            type="date"
            defaultValue={filters.date_from ?? ''}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Last activity to
          <input
            name="date_to"
            type="date"
            defaultValue={filters.date_to ?? ''}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Apply filters
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
        >
          Clear
        </Link>
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
                  {hasActiveFilters ? (
                    <>
                      No submissions match these filters. Try{' '}
                      <Link href="/" className="underline">
                        Clear
                      </Link>{' '}
                      or widen the date range. Confirm{' '}
                      <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">DATABASE_URL</code> points at
                      the database where telemetry is written.
                    </>
                  ) : (
                    <>No events yet. Send telemetry from the solar-form app.</>
                  )}
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
