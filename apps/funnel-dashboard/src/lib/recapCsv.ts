import type { RecapSubmissionRow } from './recapExport';

export function escapeCsvCell(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_HEADERS = [
  'submission_id',
  'status',
  'first_at',
  'last_at',
  'last_step',
  'last_event_type',
  'tags',
  'milestone_saw_form',
  'milestone_started',
  'milestone_reached_booking',
  'milestone_booked',
] as const;

export function recapSubmissionsToCsv(submissions: RecapSubmissionRow[]): string {
  const lines = [CSV_HEADERS.join(',')];

  for (const row of submissions) {
    lines.push(
      [
        row.submission_id,
        row.status,
        row.first_at,
        row.last_at,
        row.last_step,
        row.last_event_type,
        row.tags.join('|'),
        row.milestones.saw_form,
        row.milestones.started,
        row.milestones.reached_booking,
        row.milestones.booked,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return `${lines.join('\n')}\n`;
}

export function recapCsvFilename(dateFrom: string, dateTo: string): string {
  return `solar-recap-${dateFrom}-to-${dateTo}.csv`;
}

export function buildRecapCsvHref(dateFrom?: string, dateTo?: string): string {
  const params = new URLSearchParams();
  if (dateFrom?.trim()) params.set('date_from', dateFrom.trim());
  if (dateTo?.trim()) params.set('date_to', dateTo.trim());
  const qs = params.toString();
  return qs ? `/api/recap/csv?${qs}` : '/api/recap/csv';
}
