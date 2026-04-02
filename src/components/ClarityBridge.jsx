import { useEffect } from 'react';
import { useBooking } from '../contexts';

/**
 * Microsoft Clarity: anonymous "User ID" in the dashboard is cookie-based and can
 * fragment across iframe reloads or SPA quirks. We pass a stable custom session +
 * optional submission id so Recordings can be filtered to one journey.
 *
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api
 */
export function ClarityBridge() {
  const { bookingData } = useBooking();

  useEffect(() => {
    const sid = bookingData.sessionId ? String(bookingData.sessionId) : '';
    if (!sid || typeof window.clarity !== 'function') return;

    const sub = String(bookingData.submissionId ?? '').trim();
    const customUser = sub || sid;

    try {
      window.clarity('identify', customUser, sid, undefined, 'solar-form');
      window.clarity('set', 'solar_session_id', sid);
      if (sub) {
        window.clarity('set', 'submission_id', sub);
      }
    } catch {
      /* ignore */
    }
  }, [bookingData.sessionId, bookingData.submissionId]);

  return null;
}
