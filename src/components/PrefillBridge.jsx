import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBooking } from '../contexts';
import { queueFunnelEvent } from '../telemetry';

/**
 * PrefillBridge: Receives Chameleon form answers from parent page via postMessage.
 * Used when solar-form runs inside an iframe injected by optimizely.js on the parent.
 * Sends solar-optly-prefill-request on mount; parent responds with solar-optly-prefill.
 */
export function PrefillBridge() {
  const { bookingData, setUserData, updateBookingData } = useBooking();
  const [searchParams] = useSearchParams();
  const appliedRef = useRef(false);

  const isOptlyIframe = searchParams.get('optly_iframe') === '1';

  useEffect(() => {
    if (!isOptlyIframe) return;

    const handleMessage = (event) => {
      const payload = event?.data;
      if (!payload || payload.type !== 'solar-optly-prefill') return;
      if (appliedRef.current) return;

      const answers = payload.answers || {};
      if (Object.keys(answers).length === 0) return;

      appliedRef.current = true;

      const titleCase = (s) => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '';

      const userData = {
        firstName: titleCase(answers.first_name || ''),
        lastName: titleCase(answers.last_name || ''),
        postcode: answers.primary_address_postalcode || '',
        phoneNumber: answers.phone_number || '',
        emailAddress: answers.email_address || '',
      };
      setUserData(userData);
      const submissionId = answers.submissionId || '';
      updateBookingData({
        submissionId,
      });
      if (submissionId) {
        queueFunnelEvent({
          event_type: 'prefill_applied',
          step: 'prefill',
          response_summary: 'Chameleon answers received',
          submissionIdOverride: submissionId,
          sessionIdOverride: bookingData.sessionId,
          payload: {
            has_first_name: Boolean(answers.first_name),
            has_last_name: Boolean(answers.last_name),
            has_postcode: Boolean(answers.primary_address_postalcode),
            has_phone: Boolean(answers.phone_number),
            has_email: Boolean(answers.email_address),
          },
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Request prefill from parent (retry a few times in case parent script loads after us)
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
  }, [isOptlyIframe, setUserData, updateBookingData]);

  return null;
}
