import type { Pool } from 'pg';
import { BILLY_QUICK_MAP } from './submissionFilterPresets';

function ilikeContains(value: string): string {
  return `%${value}%`;
}

export type SubmissionStatus =
  | 'booked'
  | 'booking_failed'
  | 'skipped_disqualified'
  | 'skipped_session_expired'
  | 'solar_disqualified'
  | 'eligibility_disqualified'
  | 'roof_changed'
  | 'roof_change_loft_conversion'
  | 'roof_change_other'
  | 'callback_requested'
  | 'reached_booking_no_book'
  | 'started_not_completed'
  | 'saw_form_not_started'
  | 'in_progress';

export type SubmissionMilestones = {
  saw_form: boolean;
  started: boolean;
  reached_booking: boolean;
  booked: boolean;
};

export type RecapSubmissionRow = {
  submission_id: string;
  status: SubmissionStatus;
  first_at: string;
  last_at: string;
  last_step: string;
  last_event_type: string;
  tags: string[];
  milestones: SubmissionMilestones;
};

export type RecapDailySummaryRow = {
  date: string;
  total_submissions: number;
  saw_form: number;
  started: number;
  reached_booking: number;
  booked: number;
  by_status: Partial<Record<SubmissionStatus, number>>;
};

export type RecapExport = {
  meta: {
    date_from: string;
    date_to: string;
    generated_at: string;
    submission_count: number;
  };
  daily_summary: RecapDailySummaryRow[];
  submissions: RecapSubmissionRow[];
};

export type RecapDateRange = {
  dateFrom: string;
  dateTo: string;
  windowFrom: string;
  windowToExclusive: string;
};

type RawSubmissionRow = {
  submission_id: string;
  saw: boolean;
  started: boolean;
  booked: boolean;
  reached_booking: boolean;
  booking_failed: boolean;
  skipped_disqualified: boolean;
  skipped_session_expired: boolean;
  solar_disqualified: boolean;
  eligibility_disqualified: boolean;
  roof_changed: boolean;
  roof_loft_conversion: boolean;
  roof_change_other: boolean;
  callback_requested: boolean;
  first_at: Date;
  last_at: Date;
  last_step: string;
  last_event_type: string;
  tags: string[] | null;
};

function normalizeISODate(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return v;
}

function nextDayISO(dateISO: string): string {
  const dt = new Date(`${dateISO}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString();
}

function utcTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

export type ParseRecapDateRangeResult =
  | { ok: true; range: RecapDateRange }
  | { ok: false; error: string };

/** Parse and validate date_from / date_to query params (YYYY-MM-DD, UTC). */
export function parseRecapDateRange(
  dateFromRaw?: string,
  dateToRaw?: string
): ParseRecapDateRangeResult {
  const dateFrom = normalizeISODate(dateFromRaw) ?? daysAgoISO(7);
  const dateTo = normalizeISODate(dateToRaw) ?? utcTodayISO();

  if (dateFromRaw !== undefined && dateFromRaw.trim() !== '' && !normalizeISODate(dateFromRaw)) {
    return { ok: false, error: 'Invalid date_from; use YYYY-MM-DD' };
  }
  if (dateToRaw !== undefined && dateToRaw.trim() !== '' && !normalizeISODate(dateToRaw)) {
    return { ok: false, error: 'Invalid date_to; use YYYY-MM-DD' };
  }
  if (dateFrom > dateTo) {
    return { ok: false, error: 'date_from must be on or before date_to' };
  }

  return {
    ok: true,
    range: {
      dateFrom,
      dateTo,
      windowFrom: `${dateFrom}T00:00:00Z`,
      windowToExclusive: nextDayISO(dateTo),
    },
  };
}

export type StatusFlags = {
  booked: boolean;
  booking_failed: boolean;
  skipped_disqualified: boolean;
  skipped_session_expired: boolean;
  solar_disqualified: boolean;
  eligibility_disqualified: boolean;
  roof_changed: boolean;
  roof_loft_conversion: boolean;
  roof_change_other: boolean;
  callback_requested: boolean;
  reached_booking: boolean;
  started: boolean;
  saw: boolean;
};

/** Terminal disposition priority — first match wins. */
export function deriveSubmissionStatus(flags: StatusFlags): SubmissionStatus {
  if (flags.booked) return 'booked';
  if (flags.booking_failed) return 'booking_failed';
  if (flags.skipped_disqualified) return 'skipped_disqualified';
  if (flags.skipped_session_expired) return 'skipped_session_expired';
  if (flags.solar_disqualified) return 'solar_disqualified';
  if (flags.eligibility_disqualified) return 'eligibility_disqualified';
  if (flags.roof_changed) return 'roof_changed';
  if (flags.roof_loft_conversion) return 'roof_change_loft_conversion';
  if (flags.roof_change_other) return 'roof_change_other';
  if (flags.callback_requested) return 'callback_requested';
  if (flags.reached_booking && !flags.booked) return 'reached_booking_no_book';
  if (flags.started) return 'started_not_completed';
  if (flags.saw) return 'saw_form_not_started';
  return 'in_progress';
}

function utcDateFromTimestamp(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDailySummary(submissions: RecapSubmissionRow[]): RecapDailySummaryRow[] {
  const byDate = new Map<string, RecapDailySummaryRow>();

  for (const sub of submissions) {
    const date = utcDateFromTimestamp(new Date(sub.first_at));
    let row = byDate.get(date);
    if (!row) {
      row = {
        date,
        total_submissions: 0,
        saw_form: 0,
        started: 0,
        reached_booking: 0,
        booked: 0,
        by_status: {},
      };
      byDate.set(date, row);
    }

    row.total_submissions += 1;
    if (sub.milestones.saw_form) row.saw_form += 1;
    if (sub.milestones.started) row.started += 1;
    if (sub.milestones.reached_booking) row.reached_booking += 1;
    if (sub.milestones.booked) row.booked += 1;
    row.by_status[sub.status] = (row.by_status[sub.status] ?? 0) + 1;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mapRow(row: RawSubmissionRow): RecapSubmissionRow {
  const flags: StatusFlags = {
    booked: row.booked,
    booking_failed: row.booking_failed,
    skipped_disqualified: row.skipped_disqualified,
    skipped_session_expired: row.skipped_session_expired,
    solar_disqualified: row.solar_disqualified,
    eligibility_disqualified: row.eligibility_disqualified,
    roof_changed: row.roof_changed,
    roof_loft_conversion: row.roof_loft_conversion,
    roof_change_other: row.roof_change_other,
    callback_requested: row.callback_requested,
    reached_booking: row.reached_booking,
    started: row.started,
    saw: row.saw,
  };

  return {
    submission_id: row.submission_id,
    status: deriveSubmissionStatus(flags),
    first_at: row.first_at.toISOString(),
    last_at: row.last_at.toISOString(),
    last_step: row.last_step ?? '',
    last_event_type: row.last_event_type ?? '',
    tags: row.tags ?? [],
    milestones: {
      saw_form: row.saw,
      started: row.started,
      reached_booking: row.reached_booking,
      booked: row.booked,
    },
  };
}

const RECAP_EXPORT_SQL = `
  WITH windowed AS (
    SELECT submission_id, step, event_type, created_at, tags, id
    FROM journey_events
    WHERE created_at >= $1::timestamptz
      AND created_at < $2::timestamptz
  ),
  per_sub AS (
    SELECT
      submission_id,
      bool_or(step ILIKE $3 AND event_type ILIKE $4) AS saw,
      bool_or(step ILIKE $5 AND event_type ILIKE $6) AS started,
      bool_or(step ILIKE $7 AND event_type ILIKE $8) AS booked,
      bool_or(step ILIKE $9 AND event_type ILIKE $10) AS reached_booking,
      bool_or(step ILIKE $11 AND event_type ILIKE $12) AS booking_failed,
      bool_or(step ILIKE $13 AND event_type ILIKE $14) AS skipped_disqualified,
      bool_or(step ILIKE $15 AND event_type ILIKE $16) AS skipped_session_expired,
      bool_or(step ILIKE $17 AND event_type ILIKE $18) AS solar_disqualified,
      bool_or(step ILIKE $19 AND event_type ILIKE $20) AS eligibility_disqualified,
      bool_or(step ILIKE $21 AND event_type ILIKE $22) AS roof_changed,
      bool_or(step ILIKE $23 AND event_type ILIKE $24) AS roof_loft_conversion,
      bool_or(step ILIKE $25 AND event_type ILIKE $26) AS roof_change_other,
      bool_or(step ILIKE $27 AND event_type ILIKE $28) AS callback_requested,
      MIN(created_at) AS first_at,
      MAX(created_at) AS last_at
    FROM windowed
    GROUP BY submission_id
  ),
  latest_in_window AS (
    SELECT DISTINCT ON (submission_id)
      submission_id,
      step AS last_step,
      event_type AS last_event_type
    FROM windowed
    ORDER BY submission_id, created_at DESC, id DESC
  )
  SELECT
    p.submission_id,
    p.saw,
    p.started,
    p.booked,
    p.reached_booking,
    p.booking_failed,
    p.skipped_disqualified,
    p.skipped_session_expired,
    p.solar_disqualified,
    p.eligibility_disqualified,
    p.roof_changed,
    p.roof_loft_conversion,
    p.roof_change_other,
    p.callback_requested,
    p.first_at,
    p.last_at,
    l.last_step,
    l.last_event_type,
    (
      SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}'::text[])
      FROM journey_events jt, unnest(jt.tags) AS t
      WHERE jt.submission_id = p.submission_id
    ) AS tags
  FROM per_sub p
  JOIN latest_in_window l ON l.submission_id = p.submission_id
  ORDER BY p.first_at DESC
`;

function recapSqlParams() {
  const presets = {
    saw: BILLY_QUICK_MAP.page_thank_you,
    started: BILLY_QUICK_MAP.thank_book_online,
    booked: BILLY_QUICK_MAP.booking_succeeded,
    reached: BILLY_QUICK_MAP.page_slots,
    bookingFailed: BILLY_QUICK_MAP.booking_failed,
    skipDisqualified: BILLY_QUICK_MAP.skip_disqualified,
    skipSession: BILLY_QUICK_MAP.skip_session_expired,
    solarDisqualified: BILLY_QUICK_MAP.solar_disqualified,
    eligibilityDisqualified: BILLY_QUICK_MAP.eligibility_disqualified,
    roofChanged: BILLY_QUICK_MAP.roof_changed,
    roofLoft: BILLY_QUICK_MAP.roof_loft_conversion,
    roofOther: BILLY_QUICK_MAP.roof_change_other,
    noThanks: BILLY_QUICK_MAP.thank_no_thanks,
  };

  return [
    presets.saw,
    presets.started,
    presets.booked,
    presets.reached,
    presets.bookingFailed,
    presets.skipDisqualified,
    presets.skipSession,
    presets.solarDisqualified,
    presets.eligibilityDisqualified,
    presets.roofChanged,
    presets.roofLoft,
    presets.roofOther,
    presets.noThanks,
  ].flatMap((p) => [ilikeContains(p.step ?? ''), ilikeContains(p.event_type ?? '')]);
}

export async function fetchRecapExport(pool: Pool, range: RecapDateRange): Promise<RecapExport> {
  const sqlParams = [
    range.windowFrom,
    range.windowToExclusive,
    ...recapSqlParams(),
  ];

  const { rows } = await pool.query<RawSubmissionRow>(RECAP_EXPORT_SQL, sqlParams);
  const submissions = rows.map(mapRow);
  const daily_summary = buildDailySummary(submissions);

  return {
    meta: {
      date_from: range.dateFrom,
      date_to: range.dateTo,
      generated_at: new Date().toISOString(),
      submission_count: submissions.length,
    },
    daily_summary,
    submissions,
  };
}
