import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBooking, isLockedStatus } from '../contexts';

const CONFIRMATION_PATH = '/confirmation';

/**
 * JourneyLockGuard: Once the user reaches a terminal journey status
 * (disqualified, session timed out, or booking confirmed), they must stay on
 * /confirmation. This blocks the browser back button (and any stray navigation)
 * from re-entering the funnel to change answers and re-qualify / double-book.
 *
 * journeyStatus is persisted (sessionStorage + window.name) so the lock also
 * survives reloads and back/forward navigation.
 */
export function JourneyLockGuard() {
  const { bookingData } = useBooking();
  const location = useLocation();
  const navigate = useNavigate();

  const locked = isLockedStatus(bookingData.journeyStatus);

  // Redirect any non-confirmation route back to /confirmation while locked.
  useEffect(() => {
    if (locked && location.pathname !== CONFIRMATION_PATH) {
      navigate(CONFIRMATION_PATH, { replace: true });
    }
  }, [locked, location.pathname, navigate]);

  // Trap the browser Back button while locked on /confirmation.
  //
  // A bare replace() only re-asserts the route until the iframe's pre-existing
  // history entries (/, /address, /solar-assessment, ...) are exhausted — after
  // ~2-3 back presses Back escapes to the parent page and reloads Chameleon.
  //
  // To prevent that we keep a sentinel history entry primed and immediately
  // re-push it on every popstate, so the iframe's history never empties toward
  // the parent. Each Back lands on /confirmation, we push another sentinel, and
  // the user is trapped on the page no matter how many times they press Back.
  useEffect(() => {
    if (!locked || location.pathname !== CONFIRMATION_PATH) return undefined;

    // Preserve React Router's history state so its location stays consistent
    // (the URL never changes — every entry points at /confirmation).
    const pinHistory = () => {
      window.history.pushState(window.history.state, '', window.location.href);
    };

    // Prime one extra entry so the first Back press is absorbed here.
    pinHistory();

    const handlePopState = () => {
      pinHistory();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [locked, location.pathname, navigate]);

  return null;
}
