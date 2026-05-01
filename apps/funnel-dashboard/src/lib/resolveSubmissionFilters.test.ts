import { describe, expect, it } from 'vitest';
import { BILLY_QUICK_GROUPS, BILLY_QUICK_MAP } from './submissionFilterPresets';
import {
  mergeStepFilter,
  parseDateParam,
  resolveSubmissionListFilters,
} from './resolveSubmissionFilters';

describe('mergeStepFilter', () => {
  it('prefers step_custom over dropdown step', () => {
    expect(
      mergeStepFilter({
        step: 'Thank-you: Book online',
        step_custom: 'Confirmation:',
      })
    ).toBe('Confirmation:');
  });

  it('uses step when custom empty', () => {
    expect(
      mergeStepFilter({
        step: 'Page: Loader / handover',
        step_custom: '   ',
      })
    ).toBe('Page: Loader / handover');
  });

  it('returns empty when both empty', () => {
    expect(mergeStepFilter({})).toBe('');
  });
});

describe('parseDateParam', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(parseDateParam('2026-05-01')).toBe('2026-05-01');
  });

  it('rejects dates that are not strict YYYY-MM-DD', () => {
    expect(parseDateParam('2026-5-01')).toBeUndefined();
    expect(parseDateParam('26-05-01')).toBeUndefined();
  });

  it('rejects wrong format', () => {
    expect(parseDateParam('01/05/2026')).toBeUndefined();
    expect(parseDateParam('')).toBeUndefined();
  });
});

describe('resolveSubmissionListFilters', () => {
  it('uses manual step and event_type when no preset', () => {
    const { activePreset, filters } = resolveSubmissionListFilters({
      step: 'Thank-you: Book online',
      event_type: 'user_action',
    });
    expect(activePreset).toBe('');
    expect(filters.step).toBe('Thank-you: Book online');
    expect(filters.event_type).toBe('user_action');
  });

  it('applies thank_book_online preset', () => {
    const { activePreset, filters } = resolveSubmissionListFilters({
      billy_preset: 'thank_book_online',
      step: 'Page: Confirm address (postcode & property)',
      event_type: 'page_view',
    });
    expect(activePreset).toBe('thank_book_online');
    expect(filters.step).toBe('Thank-you: Book online');
    expect(filters.event_type).toBe('user_action');
  });

  it('applies et_page_view without overriding step when map has no step', () => {
    const { filters } = resolveSubmissionListFilters({
      billy_preset: 'et_page_view',
      step: 'Page: Choose appointment slot',
      step_custom: '',
      event_type: 'user_action',
    });
    expect(filters.event_type).toBe('page_view');
    expect(filters.step).toBe('Page: Choose appointment slot');
  });

  it('ignores unknown billy_preset', () => {
    const { activePreset, filters } = resolveSubmissionListFilters({
      billy_preset: 'not_a_real_key',
      step: '',
      event_type: 'prefill_applied',
    });
    expect(activePreset).toBe('');
    expect(filters.event_type).toBe('prefill_applied');
  });

  it('passes through q and dates unchanged', () => {
    const { filters } = resolveSubmissionListFilters({
      q: 'abc-123',
      date_from: '2026-01-10',
      date_to: '2026-01-20',
      billy_preset: '',
    });
    expect(filters.q).toBe('abc-123');
    expect(filters.date_from).toBe('2026-01-10');
    expect(filters.date_to).toBe('2026-01-20');
  });
});

describe('BILLY_QUICK_GROUPS ↔ BILLY_QUICK_MAP', () => {
  it('every quick-filter radio value has a map entry', () => {
    for (const group of BILLY_QUICK_GROUPS) {
      for (const opt of group.options) {
        expect(BILLY_QUICK_MAP[opt.value], `missing preset: ${opt.value}`).toBeDefined();
      }
    }
  });
});
