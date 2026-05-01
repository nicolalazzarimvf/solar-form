import { BILLY_QUICK_MAP, normalizeBillyPresetKey } from './submissionFilterPresets';

export type SubmissionListFilters = {
  q?: string;
  step?: string;
  event_type?: string;
  date_from?: string;
  date_to?: string;
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
 */
export function resolveSubmissionListFilters(sp: SubmissionSearchParams): {
  activePreset: string;
  filters: SubmissionListFilters;
} {
  const activePreset = normalizeBillyPresetKey(sp.billy_preset);

  let resolvedStep = mergeStepFilter(sp);
  let resolvedEventType = (sp.event_type ?? '').trim();
  if (activePreset) {
    const slice = BILLY_QUICK_MAP[activePreset];
    if (slice.step !== undefined) resolvedStep = slice.step;
    if (slice.event_type !== undefined) resolvedEventType = slice.event_type;
  }

  return {
    activePreset,
    filters: {
      q: sp.q,
      step: resolvedStep,
      event_type: resolvedEventType,
      date_from: sp.date_from,
      date_to: sp.date_to,
    },
  };
}
