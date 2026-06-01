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

  // Harden against rapid back presses: while locked and on /confirmation, pin a
  // history entry and re-assert it on popstate so the user can't escape the page.
  useEffect(() => {
    if (!locked || location.pathname !== CONFIRMATION_PATH) return undefined;

    const handlePopState = () => {
      navigate(CONFIRMATION_PATH, { replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [locked, location.pathname, navigate]);

  return null;
}
