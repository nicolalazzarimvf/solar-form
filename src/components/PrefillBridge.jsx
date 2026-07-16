import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBooking, isLockedStatus } from '../contexts';
import { queueFunnelEvent, STEPS } from '../telemetry';

/**
 * PrefillBridge: Receives Chameleon form answers from parent page via postMessage.
 * Used when solar-form runs inside an iframe injected by optimizely.js on the parent.
 * Sends solar-optly-prefill-request on mount; parent responds with solar-optly-prefill.
 */
export function PrefillBridge() {
  const { bookingData, resetForNewSubmission, setUserData, updateBookingData } = useBooking();
  const bookingRef = useRef(bookingData);
  bookingRef.current = bookingData;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appliedSubmissionRef = useRef('');

  const isOptlyIframe = searchParams.get('optly_iframe') === '1';

  useEffect(() => {
    if (!isOptlyIframe) return;

    const handleMessage = (event) => {
      const payload = event?.data;
      if (!payload || payload.type !== 'solar-optly-prefill') return;

      const answers = payload.answers || {};
      if (Object.keys(answers).length === 0) return;

      const titleCase = (s) => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '';

      const userData = {
        firstName: titleCase(answers.first_name || ''),
        lastName: titleCase(answers.last_name || ''),
        postcode: answers.primary_address_postalcode || '',
        phoneNumber: answers.phone_number || '',
        emailAddress: answers.email_address || '',
      };
      const rawSid = answers.submissionId ?? answers.submission_id;
      const submissionId =
        rawSid != null && rawSid !== '' ? String(rawSid).trim() : '';

      if (!submissionId) return;
      if (appliedSubmissionRef.current === submissionId) return;

      const current = bookingRef.current;
      const currentSid = String(current.submissionId ?? '').trim();
      const isNewSubmission = submissionId !== currentSid;
      const wasTerminal =
        isLockedStatus(current.journeyStatus) ||
        current.journeyStatus === 'callback_required';

      appliedSubmissionRef.current = submissionId;

      let sessionIdForTelemetry = current.sessionId;

      if (isNewSubmission) {
        const next = resetForNewSubmission({ submissionId, userData });
        sessionIdForTelemetry = next.sessionId;
        if (wasTerminal && window.location.pathname === '/confirmation') {
          navigate({ pathname: '/', search: window.location.search }, { replace: true });
        }
      } else {
        setUserData(userData);
        updateBookingData({ submissionId });
      }

      queueFunnelEvent({
        event_type: 'prefill_applied',
        step: STEPS.PREFILL,
        response_summary: isNewSubmission
          ? 'New Chameleon submission — booking state reset'
          : 'Iframe received Chameleon answers; submissionId set',
        submissionIdOverride: submissionId,
        sessionIdOverride: sessionIdForTelemetry,
        payload: {
          has_first_name: Boolean(answers.first_name),
          has_last_name: Boolean(answers.last_name),
          has_postcode: Boolean(answers.primary_address_postalcode),
          has_phone: Boolean(answers.phone_number),
          has_email: Boolean(answers.email_address),
          is_new_submission: isNewSubmission,
        },
      });
    };

    window.addEventListener('message', handleMessage);

    const requestPrefill = () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'solar-optly-prefill-request' }, '*');
      }
    };
    requestPrefill();
    const retry1 = setTimeout(requestPrefill, 300);
    const retry2 = setTimeout(requestPrefill, 800);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(retry1);
      clearTimeout(retry2);
    };
  }, [isOptlyIframe, navigate, resetForNewSubmission, setUserData, updateBookingData]);

  return null;
}
