import { BILLY_QUICK_MAP, normalizeBillyPresetKey } from './submissionFilterPresets';

export type SubmissionListFilters = {
  q?: string;
  step?: string;
  event_type?: string;
  date_from?: string;
  date_to?: string;
  /** Match submissions with at least one event carrying this tag. */
  tag?: string;
  /** Match submissions that have at least one event matching (ILIKE), not only the latest row. */
  any_event?: { step?: string; event_type?: string };
  /** Exclude submissions that have at least one event matching (ILIKE) — compound "AND NOT". */
  not_any_event?: { step?: string; event_type?: string };
};

/** Allowed GET params for the submissions list (stray `step` / `event_type` in the URL are ignored). */
export type SubmissionSearchParams = {
  q?: string;
  date_from?: string;
  date_to?: string;
  recap_date_from?: string;
  recap_date_to?: string;
  billy_preset?: string;
  page?: string;
};

/** YYYY-MM-DD only; returns undefined if invalid or empty. */
export function parseDateParam(value: string | undefined): string | undefined {
  const v = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return v;
}

/**
 * Merges submission ID + date params with optional `billy_preset` quick filter.
 *
 * When a valid preset is selected it alone defines `step` / `event_type` / `any_event`.
 * With **None**, only `q` and dates apply (no manual step/event — avoids stale URL tightening).
 */
export function resolveSubmissionListFilters(sp: SubmissionSearchParams): {
  activePreset: string;
  filters: SubmissionListFilters;
} {
  const activePreset = normalizeBillyPresetKey(sp.billy_preset);

  if (activePreset) {
    const slice = BILLY_QUICK_MAP[activePreset];
    const useAny = Boolean(slice.anyEventMatch);
    return {
      activePreset,
      filters: {
        q: sp.q,
        step: useAny ? '' : slice.step !== undefined ? slice.step : '',
        event_type: useAny ? '' : slice.event_type !== undefined ? slice.event_type : '',
        ...(slice.tag ? { tag: slice.tag } : {}),
        any_event: useAny
          ? { step: slice.step ?? '', event_type: slice.event_type ?? '' }
          : undefined,
        not_any_event: slice.notAnyEvent
          ? { step: slice.notAnyEvent.step ?? '', event_type: slice.notAnyEvent.event_type ?? '' }
          : undefined,
        date_from: sp.date_from,
        date_to: sp.date_to,
      },
    };
  }

  return {
    activePreset: '',
    filters: {
      q: sp.q,
      date_from: sp.date_from,
      date_to: sp.date_to,
    },
  };
}

export function submissionFiltersFromSearchParams(sp: SubmissionSearchParams): SubmissionListFilters {
  return resolveSubmissionListFilters(sp).filters;
}
