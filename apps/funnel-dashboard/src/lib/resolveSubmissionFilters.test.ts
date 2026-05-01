import { describe, expect, it } from 'vitest';
import {
  parseDateParam,
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

describe('submissionFiltersFromSearchParams', () => {
  it('passes q and dates', () => {
    expect(
      submissionFiltersFromSearchParams({
        q: ' 102859 ',
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      })
    ).toEqual({
      q: ' 102859 ',
      date_from: '2026-04-01',
      date_to: '2026-04-30',
    });
  });

  it('allows empty object', () => {
    expect(submissionFiltersFromSearchParams({})).toEqual({
      q: undefined,
      date_from: undefined,
      date_to: undefined,
    });
  });
});
