import { describe, expect, it } from 'vitest';
import { shouldHardLock, isLockedStatus } from '../../contexts/BookingContext';

describe('shouldHardLock', () => {
  it('locks when terminal status matches current submission', () => {
    expect(
      shouldHardLock('session_expired', '1029203686', '1029203686')
    ).toBe(true);
    expect(
      shouldHardLock('disqualified_solar', 'abc', 'abc')
    ).toBe(true);
  });

  it('does not lock when submissionId differs from lockedSubmissionId', () => {
    expect(
      shouldHardLock('session_expired', '1029203687', '1029203686')
    ).toBe(false);
  });

  it('does not lock legacy stale state without lockedSubmissionId', () => {
    expect(shouldHardLock('session_expired', '1029203686', '')).toBe(false);
    expect(shouldHardLock('session_expired', '1029203686', undefined)).toBe(false);
  });

  it('does not lock non-terminal statuses', () => {
    expect(shouldHardLock('started', '1029203686', '1029203686')).toBe(false);
    expect(isLockedStatus('callback_required')).toBe(false);
  });
});
