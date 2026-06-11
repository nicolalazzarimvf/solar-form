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

  it('booking_succeeded matches a booking at any point (any_event) and keeps q/dates', () => {
    const { activePreset, filters } = resolveSubmissionListFilters({
      billy_preset: 'booking_succeeded',
      q: 'abc',
      date_from: '2026-01-01',
    });
    expect(activePreset).toBe('booking_succeeded');
    expect(filters).toEqual({
      q: 'abc',
      step: '',
      event_type: '',
      any_event: {
        step: 'Confirmation: Booking succeeded',
        event_type: 'booking_result',
      },
      date_from: '2026-01-01',
      date_to: undefined,
    });
  });

  it('latest-event booking outcome (booking_failed) keeps step/event_type, no any_event', () => {
    const { activePreset, filters } = resolveSubmissionListFilters({
      billy_preset: 'booking_failed',
      q: 'abc',
    });
    expect(activePreset).toBe('booking_failed');
    expect(filters).toEqual({
      q: 'abc',
      step: 'Confirmation: Booking failed (callback / retry)',
      event_type: 'booking_result',
      any_event: undefined,
      date_from: undefined,
      date_to: undefined,
    });
  });

  it('reached_no_booking combines an any_event match with a not_any_event exclusion', () => {
    const { activePreset, filters } = resolveSubmissionListFilters({
      billy_preset: 'reached_no_booking',
    });
    expect(activePreset).toBe('reached_no_booking');
    expect(filters.step).toBe('');
    expect(filters.event_type).toBe('');
    expect(filters.any_event).toEqual({
      step: 'Page: Choose appointment slot',
      event_type: 'page_view',
    });
    expect(filters.not_any_event).toEqual({
      step: 'Confirmation: Booking succeeded',
      event_type: 'booking_result',
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
