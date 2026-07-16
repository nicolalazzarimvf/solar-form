import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBooking, shouldHardLock } from '../contexts';

const CONFIRMATION_PATH = '/confirmation';
const CALLBACK_STATUS = 'callback_required';

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

  const status = bookingData.journeyStatus;

  // Hard lock only when terminal status belongs to this submission (not a stale prior test).
  const hardLocked = shouldHardLock(
    status,
    bookingData.submissionId,
    bookingData.lockedSubmissionId
  );

  // Pin the Back button on /confirmation for hard-locked states AND for
  // callback_required (e.g. "roof changed since imagery", "no solar data"
  // callbacks). We deliberately do NOT redirect callback_required from other
  // routes: the IndexPage "No thank you" flow shows its callback message inline
  // on '/'. But once a callback user has been sent to /confirmation, Back must
  // not take them back into the funnel to change their answer.
  const pinnedOnConfirmation =
    (hardLocked || status === CALLBACK_STATUS) &&
    location.pathname === CONFIRMATION_PATH;

  // Redirect any non-confirmation route back to /confirmation while hard-locked.
  useEffect(() => {
    if (hardLocked && location.pathname !== CONFIRMATION_PATH) {
      navigate(CONFIRMATION_PATH, { replace: true });
    }
  }, [hardLocked, location.pathname, navigate]);

  // Trap the browser Back button while pinned on /confirmation.
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
    if (!pinnedOnConfirmation) return undefined;

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
  }, [pinnedOnConfirmation]);

  return null;
}
