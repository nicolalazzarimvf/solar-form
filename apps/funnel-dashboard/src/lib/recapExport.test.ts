import { describe, expect, it } from 'vitest';
import { deriveSubmissionStatus, parseRecapDateRange } from './recapExport';
import type { StatusFlags } from './recapExport';

function flags(overrides: Partial<StatusFlags> = {}): StatusFlags {
  return {
    booked: false,
    booking_failed: false,
    skipped_disqualified: false,
    skipped_session_expired: false,
    solar_disqualified: false,
    eligibility_disqualified: false,
    roof_changed: false,
    roof_loft_conversion: false,
    roof_change_other: false,
    callback_requested: false,
    reached_booking: false,
    started: false,
    saw: false,
    ...overrides,
  };
}

describe('deriveSubmissionStatus', () => {
  it('prioritises booked over other signals', () => {
    expect(
      deriveSubmissionStatus(
        flags({ booked: true, booking_failed: true, callback_requested: true })
      )
    ).toBe('booked');
  });

  it('returns booking_failed when not booked', () => {
    expect(deriveSubmissionStatus(flags({ booking_failed: true, started: true }))).toBe(
      'booking_failed'
    );
  });

  it('returns skipped_disqualified before solar exits', () => {
    expect(
      deriveSubmissionStatus(
        flags({ skipped_disqualified: true, solar_disqualified: true })
      )
    ).toBe('skipped_disqualified');
  });

  it('returns skipped_session_expired', () => {
    expect(deriveSubmissionStatus(flags({ skipped_session_expired: true }))).toBe(
      'skipped_session_expired'
    );
  });

  it('returns solar_disqualified', () => {
    expect(deriveSubmissionStatus(flags({ solar_disqualified: true, started: true }))).toBe(
      'solar_disqualified'
    );
  });

  it('returns eligibility_disqualified', () => {
    expect(deriveSubmissionStatus(flags({ eligibility_disqualified: true }))).toBe(
      'eligibility_disqualified'
    );
  });

  it('returns roof_changed before loft/other roof exits', () => {
    expect(
      deriveSubmissionStatus(
        flags({ roof_changed: true, roof_loft_conversion: true })
      )
    ).toBe('roof_changed');
  });

  it('returns roof_change_loft_conversion', () => {
    expect(deriveSubmissionStatus(flags({ roof_loft_conversion: true }))).toBe(
      'roof_change_loft_conversion'
    );
  });

  it('returns roof_change_other', () => {
    expect(deriveSubmissionStatus(flags({ roof_change_other: true }))).toBe('roof_change_other');
  });

  it('returns callback_requested', () => {
    expect(deriveSubmissionStatus(flags({ callback_requested: true, started: true }))).toBe(
      'callback_requested'
    );
  });

  it('returns reached_booking_no_book when slots reached but not booked', () => {
    expect(
      deriveSubmissionStatus(flags({ reached_booking: true, started: true }))
    ).toBe('reached_booking_no_book');
  });

  it('returns started_not_completed', () => {
    expect(deriveSubmissionStatus(flags({ started: true, saw: true }))).toBe(
      'started_not_completed'
    );
  });

  it('returns saw_form_not_started', () => {
    expect(deriveSubmissionStatus(flags({ saw: true }))).toBe('saw_form_not_started');
  });

  it('returns in_progress when no milestones match', () => {
    expect(deriveSubmissionStatus(flags())).toBe('in_progress');
  });
});

describe('parseRecapDateRange', () => {
  it('defaults to a 7-day window ending today when params omitted', () => {
    const result = parseRecapDateRange();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.dateFrom <= result.range.dateTo).toBe(true);
    expect(result.range.windowFrom).toMatch(/T00:00:00(\.000)?Z$/);
  });

  it('accepts valid YYYY-MM-DD params', () => {
    const result = parseRecapDateRange('2026-07-01', '2026-07-07');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.dateFrom).toBe('2026-07-01');
    expect(result.range.dateTo).toBe('2026-07-07');
    expect(result.range.windowFrom).toBe('2026-07-01T00:00:00Z');
    expect(result.range.windowToExclusive).toBe('2026-07-08T00:00:00.000Z');
  });

  it('rejects invalid date_from', () => {
    const result = parseRecapDateRange('not-a-date', '2026-07-07');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('date_from');
  });

  it('rejects invalid date_to', () => {
    const result = parseRecapDateRange('2026-07-01', '07/07/2026');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('date_to');
  });

  it('rejects date_from after date_to', () => {
    const result = parseRecapDateRange('2026-07-10', '2026-07-01');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('date_from');
  });
});
