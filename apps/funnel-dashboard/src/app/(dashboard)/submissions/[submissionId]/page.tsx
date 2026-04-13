import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPool } from '@/lib/db';
import { CollapsibleJson } from '@/components/CollapsibleJson';

export const dynamic = 'force-dynamic';

type EventRow = {
  id: string;
  submission_id: string;
  session_id: string;
  event_type: string;
  step: string;
  response_summary: string | null;
  payload: unknown;
  created_at: Date;
};

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId: rawId } = await params;
  const submissionId = decodeURIComponent(rawId);
  if (!submissionId) notFound();

  const pool = getPool();
  const { rows } = await pool.query<EventRow>(
    `SELECT id::text, submission_id, session_id, event_type, step, response_summary, payload, created_at
     FROM journey_events
     WHERE submission_id = $1
     ORDER BY created_at ASC, id ASC`,
    [submissionId]
  );

  if (rows.length === 0) {
    notFound();
  }

  return (
    <div>
      <p className="mb-4">
        <Link href="/" className="text-sm text-emerald-700 underline dark:text-emerald-400">
          ← All submissions
        </Link>
      </p>
      <h1 className="mb-2 font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {submissionId}
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {rows.length} event{rows.length === 1 ? '' : 's'} · session{' '}
        <span className="font-mono text-xs">{rows[0]?.session_id || '—'}</span>
      </p>

      <ol className="space-y-4">
        {rows.map((ev) => (
          <li
            key={ev.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                  {ev.event_type}
                </span>
                {ev.step ? (
                  <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{ev.step}</span>
                ) : null}
              </div>
              <time className="text-xs text-zinc-500" dateTime={ev.created_at?.toISOString?.()}>
                {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}
              </time>
            </div>
            {ev.response_summary ? (
              <p className="mb-3 text-sm text-zinc-800 dark:text-zinc-200">{ev.response_summary}</p>
            ) : null}
            <CollapsibleJson
              label="Payload"
              data={ev.payload}
              defaultOpen={ev.event_type === 'api_call'}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
