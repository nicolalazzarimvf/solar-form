import Link from 'next/link';
import { getPool } from '@/lib/db';
import { DeleteSubmissionButton } from '@/components/DeleteSubmissionButton';
import { fetchSubmissionList } from '@/lib/submissionListQuery';
import {
  BILLY_QUICK_GROUPS,
  EVENT_TYPE_OPTIONS,
  isPresetEventType,
  isPresetStep,
  STEP_OPTION_GROUPS,
} from '@/lib/submissionFilterPresets';
import { resolveSubmissionListFilters, type SubmissionSearchParams } from '@/lib/resolveSubmissionFilters';

export const dynamic = 'force-dynamic';

export type { SubmissionListFilters } from '@/lib/resolveSubmissionFilters';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SubmissionSearchParams>;
}) {
  const sp = await searchParams;
  const { activePreset, filters } = resolveSubmissionListFilters(sp);
  const stepForSelect = isPresetStep(filters.step) ? filters.step : '';
  const stepCustomDefault =
    filters.step && !isPresetStep(filters.step) ? filters.step : '';
  const hasActiveFilters =
    activePreset !== '' ||
    Boolean((filters.q ?? '').trim()) ||
    Boolean((filters.step ?? '').trim()) ||
    Boolean((filters.event_type ?? '').trim()) ||
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
        . Events are recorded from the solar booking iframe after prefill. Quick picks filter by{' '}
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">last event</strong> per submission.
      </p>

      <form method="get" className="mb-6 space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Quick filters
          </h2>
          <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-600 dark:bg-zinc-950">
            <input
              type="radio"
              name="billy_preset"
              value=""
              defaultChecked={activePreset === ''}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">None</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Use the dropdowns and custom fields below.
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BILLY_QUICK_GROUPS.map((group) => (
              <div
                key={group.title}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                  {group.title}
                </h3>
                {group.description ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>
                ) : null}
                <div className="mt-3 space-y-2">
                  {group.options.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-0.5 text-sm hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="radio"
                        name="billy_preset"
                        value={opt.value}
                        defaultChecked={activePreset === opt.value}
                        className="mt-1"
                      />
                      <span className="text-zinc-800 dark:text-zinc-200">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <input
            name="q"
            type="search"
            placeholder="Submission ID…"
            defaultValue={filters.q ?? ''}
            className="min-w-[160px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
          <label className="flex min-w-[220px] max-w-full flex-[2] flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Last step
            <select
              name="step"
              defaultValue={stepForSelect}
              className="max-w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Any</option>
              {STEP_OPTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Custom step contains
            <input
              name="step_custom"
              type="search"
              placeholder="Overrides dropdown…"
              defaultValue={stepCustomDefault}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              autoComplete="off"
            />
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Last event type
            <select
              name="event_type"
              defaultValue={filters.event_type ?? ''}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Any</option>
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {filters.event_type && !isPresetEventType(filters.event_type) ? (
                <option value={filters.event_type}>{filters.event_type} (from URL)</option>
              ) : null}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
        </div>
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
                      No submissions match these filters. Quick picks use{' '}
                      <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                        last event only
                      </strong>{' '}
                      per submission (e.g. a later page view hides an older “booking succeeded”). Try{' '}
                      <Link href="/" className="underline">
                        Clear
                      </Link>{' '}
                      or check this deployment&apos;s{' '}
                      <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">DATABASE_URL</code>{' '}
                      matches the database where telemetry is written.
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
