import { BILLY_QUICK_MAP, normalizeBillyPresetKey } from './submissionFilterPresets';

export type SubmissionListFilters = {
  q?: string;
  step?: string;
  event_type?: string;
  date_from?: string;
  date_to?: string;
  /** Match submissions that have at least one event matching (ILIKE), not only the latest row. */
  any_event?: { step?: string; event_type?: string };
};

export type SubmissionSearchParams = SubmissionListFilters & {
  step_custom?: string;
  billy_preset?: string;
};

export function mergeStepFilter(sp: { step?: string; step_custom?: string }): string {
  const custom = (sp.step_custom ?? '').trim();
  const selected = (sp.step ?? '').trim();
  return custom || selected;
}

/** YYYY-MM-DD only; returns undefined if invalid or empty. */
export function parseDateParam(value: string | undefined): string | undefined {
  const v = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return v;
}

/**
 * Merges manual query params with optional `billy_preset` quick filter
 * (same rules as the submissions list page).
 *
 * When a valid preset is selected it alone defines `step` / `event_type` (each optional
 * dimension defaults to empty = “any”). Manual dropdown values from the URL are ignored
 * so leftover params cannot tighten the query into an impossible combination.
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
        any_event: useAny
          ? { step: slice.step ?? '', event_type: slice.event_type ?? '' }
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
      step: mergeStepFilter(sp),
      event_type: (sp.event_type ?? '').trim(),
      any_event: undefined,
      date_from: sp.date_from,
      date_to: sp.date_to,
    },
  };
}
