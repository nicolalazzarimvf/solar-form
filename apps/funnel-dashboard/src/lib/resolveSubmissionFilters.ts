export type SubmissionListFilters = {
  q?: string;
  step?: string;
  event_type?: string;
  date_from?: string;
  date_to?: string;
  any_event?: { step?: string; event_type?: string };
};

/** Allowed GET params for the submissions list (legacy keys are ignored). */
export type SubmissionSearchParams = {
  q?: string;
  date_from?: string;
  date_to?: string;
};

/** YYYY-MM-DD only; returns undefined if invalid or empty. */
export function parseDateParam(value: string | undefined): string | undefined {
  const v = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return v;
}

/** Builds list filters from URL search params (submission ID + date range only). */
export function submissionFiltersFromSearchParams(sp: SubmissionSearchParams): SubmissionListFilters {
  return {
    q: sp.q,
    date_from: sp.date_from,
    date_to: sp.date_to,
  };
}
