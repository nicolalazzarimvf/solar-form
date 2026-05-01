import { describe, expect, it } from 'vitest';
import {
  parseDateParam,
  resolveSubmissionListFilters,
  submissionFiltersFromSearchParams,
} from './resolveSubmissionFilters';

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
  it('with no preset passes q and dates only', () => {
    expect(
      resolveSubmissionListFilters({
        q: ' 102859 ',
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      })
    ).toEqual({
      activePreset: '',
      filters: {
        q: ' 102859 ',
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      },
    });
  });

  it('ignores invalid preset key', () => {
    expect(
      resolveSubmissionListFilters({ billy_preset: 'nope', q: 'x' })
    ).toEqual({
      activePreset: '',
      filters: { q: 'x' },
    });
  });

  it('preset defines latest-event booking outcome and keeps q/dates', () => {
    const { activePreset, filters } = resolveSubmissionListFilters({
      billy_preset: 'booking_succeeded',
      q: 'abc',
      date_from: '2026-01-01',
    });
    expect(activePreset).toBe('booking_succeeded');
    expect(filters).toEqual({
      q: 'abc',
      step: 'Confirmation: Booking succeeded',
      event_type: 'booking_result',
      any_event: undefined,
      date_from: '2026-01-01',
      date_to: undefined,
    });
  });

  it('preset with anyEventMatch uses any_event and clears step/event_type on latest', () => {
    const { filters } = resolveSubmissionListFilters({ billy_preset: 'thank_book_online' });
    expect(filters.step).toBe('');
    expect(filters.event_type).toBe('');
    expect(filters.any_event).toEqual({
      step: 'Thank-you: Book online',
      event_type: 'user_action',
    });
  });
});

describe('submissionFiltersFromSearchParams', () => {
  it('matches resolveSubmissionListFilters().filters', () => {
    const sp = { q: '1', billy_preset: 'et_page_view' };
    expect(submissionFiltersFromSearchParams(sp)).toEqual(
      resolveSubmissionListFilters(sp).filters
    );
  });
});
