import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  appendAvailabilityWindowParams,
  formatDdMmYyyy,
  getAvailabilityQueryParams,
} from '../../utils/availabilityWindow';

// July 2026 is BST (UTC+1): London wall clock = UTC + 1h
function bstLondon(year, month, day, hour, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 1, minute, 0));
}

describe('formatDdMmYyyy', () => {
  it('zero-pads day and month', () => {
    expect(formatDdMmYyyy(2026, 7, 8)).toBe('08-07-2026');
    expect(formatDdMmYyyy(2026, 12, 22)).toBe('22-12-2026');
  });
});

describe('addCalendarDays', () => {
  it('crosses month boundaries', () => {
    expect(addCalendarDays(2026, 7, 31, 1)).toEqual({ year: 2026, month: 8, day: 1 });
  });
});

describe('getAvailabilityQueryParams', () => {
  it('before 18:00 UK starts tomorrow', () => {
    const now = bstLondon(2026, 7, 21, 17, 59);
    const params = getAvailabilityQueryParams(now);
    expect(params.start_date).toBe('22-07-2026');
    expect(params.number_of_days).toBe(5);
  });

  it('at 18:00 UK starts day after tomorrow', () => {
    const now = bstLondon(2026, 7, 21, 18, 0);
    const params = getAvailabilityQueryParams(now);
    expect(params.start_date).toBe('23-07-2026');
    expect(params.number_of_days).toBe(5);
  });

  it('after 18:00 UK starts day after tomorrow', () => {
    const now = bstLondon(2026, 7, 21, 22, 30);
    expect(getAvailabilityQueryParams(now).start_date).toBe('23-07-2026');
  });

  it('uses GMT in winter (UTC+0)', () => {
    // Jan 2026 is GMT: London = UTC
    const before = new Date(Date.UTC(2026, 0, 15, 17, 59, 0));
    expect(getAvailabilityQueryParams(before).start_date).toBe('16-01-2026');
    const after = new Date(Date.UTC(2026, 0, 15, 18, 0, 0));
    expect(getAvailabilityQueryParams(after).start_date).toBe('17-01-2026');
  });
});

describe('appendAvailabilityWindowParams', () => {
  it('appends to URL that already has query string', () => {
    const now = bstLondon(2026, 7, 21, 10, 0);
    const url = appendAvailabilityWindowParams(
      'https://example.com/get-availability?postcode=RG29FU',
      now
    );
    expect(url).toContain('postcode=RG29FU');
    expect(url).toContain('start_date=22-07-2026');
    expect(url).toContain('number_of_days=5');
  });
});
