import Link from 'next/link';
import { getPool } from '@/lib/db';
import { DeleteSubmissionButton } from '@/components/DeleteSubmissionButton';
import { FindSlotsCta } from '@/components/FindSlotsCta';
import { fetchLast7DaysRecap, RECAP_CLICK_PRESETS } from '@/lib/last7DaysRecap';
import { countMatchingSubmissions, fetchSubmissionList } from '@/lib/submissionListQuery';
import { BILLY_QUICK_GROUPS } from '@/lib/submissionFilterPresets';
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
  const recapDateFrom = typeof sp.recap_date_from === 'string' ? sp.recap_date_from : '';
  const recapDateTo = typeof sp.recap_date_to === 'string' ? sp.recap_date_to : '';
  const hasActiveFilters =
    activePreset !== '' ||
    Boolean((filters.q ?? '').trim()) ||
    Boolean((filters.date_from ?? '').trim()) ||
    Boolean((filters.date_to ?? '').trim()) ||
    Boolean((filters.tag ?? '').trim());

  const PAGE_SIZE = 50;
  const requestedPage = Math.max(1, Math.floor(Number(sp.page)) || 1);

  let rows: Awaited<ReturnType<typeof fetchSubmissionList>> = [];
  let recap: Awaited<ReturnType<typeof fetchLast7DaysRecap>> | null = null;
  let totalRows = 0;
  let currentPage = requestedPage;
  let dbError: string | null = null;
  try {
    const pool = getPool();
    totalRows = await countMatchingSubmissions(pool, filters);
    currentPage = Math.min(requestedPage, Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));
    rows = await fetchSubmissionList(pool, filters, {
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    });
    try {
      recap = await fetchLast7DaysRecap(pool, {
        dateFrom: recapDateFrom,
        dateTo: recapDateTo,
      });
    } catch {
      recap = null;
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Database error';
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalRows);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k !== 'page' && typeof v === 'string' && v.trim() !== '') params.set(k, v);
    }
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  const fmt = (n: number) => new Intl.NumberFormat().format(n);
  const fmtPct = (num: number, den: number) => {
    if (den <= 0) return '0%';
    return `${((num / den) * 100).toFixed(1)}%`;
  };
  const fmtDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };
  const SPECIAL_GROUP_TITLES = [
    'Booking page drop-off',
    'By last event type',
    'Experiment (CRO-693)',
  ];
  const renderGroupCard = (group: (typeof BILLY_QUICK_GROUPS)[number]) => (
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
  );

  return (
    <div>
      <FindSlotsCta />
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Submissions
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Latest activity by Chameleon <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">submissionId</code>
        . Events are recorded from the solar booking iframe after prefill. Quick picks either match the{' '}
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">latest event</strong> only (other booking
        outcomes, confirmation page, slots page, “by event type”) or{' '}
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">any earlier event</strong> for thank-you
        choices, hard exits, progress milestones, and “Booking succeeded” — see each box. Below that, filter by
        submission ID (partial match) and/or last activity date; open a row for the full event timeline.
      </p>

      <form method="get" className="mb-6 space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quick filters</h2>
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
                Use submission ID and date range only (below).
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BILLY_QUICK_GROUPS.filter((g) => !SPECIAL_GROUP_TITLES.includes(g.title)).map(
              renderGroupCard
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {BILLY_QUICK_GROUPS.filter((g) => SPECIAL_GROUP_TITLES.includes(g.title)).map(
              renderGroupCard
            )}
          </div>
          <div className="mt-3 flex w-full flex-col rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
                Last 7 days (recap)
              </h3>
              <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-400/90">
                Default is a rolling 7-day window from the database clock. You can optionally set a custom recap date
                range below.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-emerald-900/90 dark:text-emerald-300/90">
                  Recap date from
                  <input
                    name="recap_date_from"
                    type="date"
                    defaultValue={recapDateFrom}
                    className="rounded-md border border-emerald-200/70 bg-white px-2 py-1.5 text-xs font-normal text-zinc-900 dark:border-emerald-900/60 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-emerald-900/90 dark:text-emerald-300/90">
                  Recap date to
                  <input
                    name="recap_date_to"
                    type="date"
                    defaultValue={recapDateTo}
                    className="rounded-md border border-emerald-200/70 bg-white px-2 py-1.5 text-xs font-normal text-zinc-900 dark:border-emerald-900/60 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
              </div>
              <p className="mt-1 text-[11px] text-emerald-800/90 dark:text-emerald-400/90">
                Leave both empty to use the default last 7 days.
              </p>
              {recap ? (
                <>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 sm:gap-3">
                    <div className="rounded-md bg-white/80 px-2 py-1.5 dark:bg-zinc-950/50">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Total users
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmt(recap.totalUsers)}
                      </dd>
                    </div>
                    <Link
                      href={`/?billy_preset=${RECAP_CLICK_PRESETS.sawSolarForm}`}
                      className="group rounded-md border border-transparent bg-white/80 px-2 py-1.5 transition hover:border-emerald-300 hover:bg-white dark:bg-zinc-950/50 dark:hover:border-emerald-800"
                    >
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Saw the solar form
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 group-hover:text-emerald-800 dark:text-zinc-100 dark:group-hover:text-emerald-300">
                        {fmt(recap.sawSolarForm)}
                      </dd>
                    </Link>
                    <Link
                      href={`/?billy_preset=${RECAP_CLICK_PRESETS.startedForm}`}
                      className="group rounded-md border border-transparent bg-white/80 px-2 py-1.5 transition hover:border-emerald-300 hover:bg-white dark:bg-zinc-950/50 dark:hover:border-emerald-800"
                    >
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Started the form
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 group-hover:text-emerald-800 dark:text-zinc-100 dark:group-hover:text-emerald-300">
                        {fmt(recap.startedForm)}
                      </dd>
                    </Link>
                    <Link
                      href={`/?billy_preset=${RECAP_CLICK_PRESETS.bookingSucceeded}`}
                      className="group rounded-md border border-transparent bg-white/80 px-2 py-1.5 transition hover:border-emerald-300 hover:bg-white dark:bg-zinc-950/50 dark:hover:border-emerald-800"
                    >
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Booked
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 group-hover:text-emerald-800 dark:text-zinc-100 dark:group-hover:text-emerald-300">
                        {fmt(recap.booked)}
                      </dd>
                    </Link>
                  </dl>
                  <div className="mt-3 rounded-md bg-white/70 p-3 dark:bg-zinc-950/50">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/80 dark:text-emerald-300/80">
                      Funnel (share of total users)
                    </h4>
                    <div className="mt-2 space-y-1.5">
                      {[
                        { label: 'Total users', value: recap.totalUsers },
                        { label: 'Saw the form', value: recap.sawSolarForm },
                        { label: 'Started', value: recap.startedForm },
                        { label: 'Reached booking', value: recap.reachedBooking },
                        { label: 'Booked', value: recap.booked },
                      ].map((stage) => {
                        const pct = recap.totalUsers > 0 ? (stage.value / recap.totalUsers) * 100 : 0;
                        const width = stage.value > 0 ? Math.max(pct, 2) : 0;
                        return (
                          <div key={stage.label} className="flex items-center gap-2">
                            <span className="w-24 shrink-0 text-[11px] text-emerald-900/80 dark:text-emerald-300/80">
                              {stage.label}
                            </span>
                            <div className="relative h-5 flex-1 overflow-hidden rounded bg-emerald-100/70 dark:bg-emerald-950/50">
                              <div
                                className="h-full rounded bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-400"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                            <span className="w-20 shrink-0 text-right text-[11px] font-semibold tabular-nums text-emerald-900 dark:text-emerald-200">
                              {fmt(stage.value)}{' '}
                              <span className="font-normal text-emerald-700/70 dark:text-emerald-400/70">
                                {pct.toFixed(0)}%
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 sm:gap-3">
                    <div className="rounded-md bg-white/80 px-2 py-1.5 dark:bg-zinc-950/50">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Engagement rate (start/seen)
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmtPct(recap.startedForm, recap.sawSolarForm)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-white/80 px-2 py-1.5 dark:bg-zinc-950/50">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Booked rate (total)
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmtPct(recap.booked, recap.totalUsers)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-white/80 px-2 py-1.5 dark:bg-zinc-950/50">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Booked rate (seen)
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmtPct(recap.booked, recap.sawSolarForm)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-white/80 px-2 py-1.5 dark:bg-zinc-950/50">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Booked rate (started)
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmtPct(recap.booked, recap.startedForm)}
                      </dd>
                    </div>
                  </dl>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3 sm:gap-3">
                    <Link
                      href={`/?billy_preset=${RECAP_CLICK_PRESETS.reachedNoBooking}`}
                      className="group rounded-md border border-transparent bg-white/80 px-2 py-1.5 transition hover:border-emerald-300 hover:bg-white dark:bg-zinc-950/50 dark:hover:border-emerald-800"
                    >
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Reached booking, didn’t book
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 group-hover:text-emerald-800 dark:text-zinc-100 dark:group-hover:text-emerald-300">
                        {fmt(recap.reachedBookingNoBooking)}
                      </dd>
                    </Link>
                    <div className="rounded-md bg-white/80 px-2 py-1.5 dark:bg-zinc-950/50">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Avg time on form
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmtDuration(recap.avgSecondsOnForm)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-white/80 px-2 py-1.5 dark:bg-zinc-950/50">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Median time on form
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmtDuration(recap.medianSecondsOnForm)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-1 text-[11px] text-emerald-800/90 dark:text-emerald-400/90">
                    “Reached booking, didn’t book” = viewed the appointment-slot page but never recorded a successful
                    booking. Time on form spans the first to last recorded event per submission (including single-event
                    sessions), so treat it as a lower bound.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {dbError ? 'Connect the database to see recap stats.' : 'Recap unavailable.'}
                </p>
              )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
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
        </div>
      </form>

      {dbError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <strong>Database:</strong> {dbError}. Set <code className="rounded bg-red-100 px-1 dark:bg-red-900">DATABASE_URL</code> and run{' '}
          <code className="rounded bg-red-100 px-1 dark:bg-red-900">db/migrations/001_journey_events.sql</code> and{' '}
          <code className="rounded bg-red-100 px-1 dark:bg-red-900">db/migrations/002_journey_event_tags.sql</code>.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="p-3 font-medium">Submission ID</th>
              <th className="p-3 font-medium">Tags</th>
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
                <td colSpan={8} className="p-6 text-center text-zinc-500">
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
                  <td className="p-3">
                    {r.tags && r.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
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

      {!dbError && (
        <nav
          className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"
          aria-label="Submissions pagination"
        >
          <span className="text-zinc-600 dark:text-zinc-400">
            {totalRows === 0
              ? 'No results'
              : `Showing ${fmt(pageStart)}–${fmt(pageEnd)} of ${fmt(totalRows)}`}
          </span>
          <div className="flex items-center gap-1">
            {currentPage > 1 ? (
              <Link
                href={pageHref(currentPage - 1)}
                rel="prev"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                ← Prev
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-zinc-200 px-3 py-1.5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                ← Prev
              </span>
            )}
            <span className="px-2 text-zinc-600 tabular-nums dark:text-zinc-400">
              Page {fmt(currentPage)} of {fmt(totalPages)}
            </span>
            {currentPage < totalPages ? (
              <Link
                href={pageHref(currentPage + 1)}
                rel="next"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Next →
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-zinc-200 px-3 py-1.5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                Next →
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
