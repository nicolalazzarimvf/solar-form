import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking, useInactivity } from '../contexts';
import { config } from '../config/env';
import { queueFunnelEvent, redactTelemetryObject } from '../telemetry';
import styles from './ConfirmationPage.module.css';

const USE_MOCK_DATA = false;

// Generate a mock booking reference
const generateMockReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `PS-UAT-${timestamp}`;
};

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const { bookingData, confirmBooking, updateBookingData, setBookingSlot } = useBooking();
  const { isSessionExpired: inactivityExpired } = useInactivity();
  const [loading, setLoading] = useState(true);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingReference, setBookingReference] = useState('');

  const pendingSuccessRef = useRef(null);

  const isDisqualified = bookingData.journeyStatus?.startsWith('disqualified') || false;
  const isSessionExpired = inactivityExpired || bookingData.journeyStatus === 'session_expired';
  const isCallbackRequired = bookingData.journeyStatus === 'callback_required';

  useEffect(() => {
    if (bookingConfirmed && pendingSuccessRef.current != null && window.parent !== window) {
      window.parent.postMessage({
        type: 'solar-optly-booking-result',
        success: true,
        bookingReference: pendingSuccessRef.current,
        bookingSlot: bookingData.selectedSlot?.startTime || '',
      }, '*');
      pendingSuccessRef.current = null;
    }
  }, [bookingConfirmed]);

  useEffect(() => {
    if (bookingData.selectedSlot && !isDisqualified && !isSessionExpired && !isCallbackRequired) {
      submitBooking();
    } else {
      setLoading(false);
      if (isDisqualified || isSessionExpired) {
        queueFunnelEvent({
          event_type: 'booking_result',
          step: '/confirmation',
          response_summary: isDisqualified ? 'skipped_disqualified' : 'skipped_session_expired',
          payload: { journeyStatus: bookingData.journeyStatus },
        });
      }
      if (window.parent !== window && (isDisqualified || isSessionExpired)) {
        window.parent.postMessage({
          type: 'solar-optly-booking-result',
          success: false,
          error: isDisqualified ? 'disqualified' : 'session_expired',
        }, '*');
      }
    }
  }, []);

  const submitBooking = async () => {
    try {
      setLoading(true);

      if (USE_MOCK_DATA) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockRef = generateMockReference();
        setBookingReference(mockRef);
        setBookingConfirmed(true);
        confirmBooking(mockRef);
        setLoading(false);
        return;
      }

      // Book appointment via Project Solar API (POST book-appointment)
      // Normalize phone to E.164 UK format (+44...) for API validation.
      // Project Solar expects customer.mobile - UK mobile (07xxx) preferred; landlines may fail validation.
      const rawPhone = (bookingData.phoneNumber || '').trim();
      const digits = rawPhone.replace(/\D/g, '');
      let mobile = '';
      if (digits.length >= 10) {
        if (digits.startsWith('44') && digits.length >= 12) {
          mobile = '+' + digits;
        } else if (digits.startsWith('0') && digits.length === 11) {
          mobile = '+44' + digits.slice(1);
        } else if (digits.length === 10 || digits.length === 11) {
          mobile = '+44' + (digits.startsWith('0') ? digits.slice(1) : digits);
        }
      }

      const bookAppointmentPayload = {
        firstname: (bookingData.firstName || '').trim(),
        lastname: (bookingData.lastName || '').trim(),
        postcode: (bookingData.postcode || '').trim().replace(/\s/g, '').toUpperCase(),
        email: (bookingData.emailAddress || '').trim(),
        booking_date: bookingData.selectedSlot?.startTime || '',
        addressLine: (bookingData.fullAddress || '').trim(),
        mobile,
        provider_lead_id: String(bookingData.submissionId || bookingData.sessionId || ''),
      };

      const bookHeaders = {
        'Content-Type': 'application/json',
        ...(config.projectSolarMvfApiKey && { 'x-api-key': config.projectSolarMvfApiKey }),
      };

      console.log('[DEBUG] Booking appointment:', bookAppointmentPayload);

      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const bookingResponse = await fetch(`${config.projectSolarMvfApiUrl}/book-appointment`, {
        method: 'POST',
        headers: bookHeaders,
        body: JSON.stringify(bookAppointmentPayload),
      });
      const duration_ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null;

      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json().catch(() => ({}));
        console.error('[ERROR] Appointment booking failed:', errorData);
        if (errorData.details) console.error('[ERROR] Validation details:', errorData.details);
        const details = errorData.details || errorData.errors || [];
        const detailMsg = Array.isArray(details) ? details.map(d => (typeof d === 'object' ? JSON.stringify(d) : d)).join('; ') : JSON.stringify(details);
        queueFunnelEvent({
          event_type: 'api_call',
          step: 'book_appointment',
          response_summary: `HTTP ${bookingResponse.status} in ${duration_ms ?? '?'}ms`,
          payload: redactTelemetryObject({
            request: {
              postcode: bookAppointmentPayload.postcode,
              booking_date: bookAppointmentPayload.booking_date,
            },
            response: { error: errorData.error || errorData.reason, details: detailMsg.slice(0, 2000) },
            duration_ms,
          }),
        });
        throw new Error(
          (errorData.error || errorData.reason || 'Failed to book appointment') +
          (detailMsg ? `: ${detailMsg}` : '')
        );
      }

      const bookingResult = await bookingResponse.json();
      console.log('[DEBUG] Appointment booking success:', bookingResult);

      queueFunnelEvent({
        event_type: 'api_call',
        step: 'book_appointment',
        response_summary: `OK in ${duration_ms ?? '?'}ms`,
        payload: redactTelemetryObject({
          request: {
            postcode: bookAppointmentPayload.postcode,
            booking_date: bookAppointmentPayload.booking_date,
          },
          response: {
            booking_reference:
              bookingResult.booking_reference || bookingResult.bookingReference || bookingResult.id,
          },
          duration_ms,
        }),
      });

      let generatedRef = bookingResult.booking_reference || bookingResult.bookingReference || bookingResult.id || '';
      if (!generatedRef) {
        const year = new Date().getFullYear();
        const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        generatedRef = `PS-${year}-${random}`;
      }

      // Show booking confirmation (Project Solar booking succeeded)
      setBookingReference(generatedRef);
      setBookingConfirmed(true);
      confirmBooking(generatedRef);
      pendingSuccessRef.current = generatedRef;

      queueFunnelEvent({
        event_type: 'booking_result',
        step: '/confirmation',
        response_summary: 'booking_confirmed',
        payload: { bookingReference: generatedRef },
      });
    } catch (err) {
      console.error('Booking submission failed:', err);
      const errMsg = String(err?.message || '');
      const isSlotUnavailable = /time slot not available|410|slot.*unavailable/i.test(errMsg);
      const isPhoneValidation = /validation\.phone|customer\.mobile/i.test(errMsg);

      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'solar-optly-booking-result',
          success: false,
          error: errMsg,
        }, '*');
      }

      queueFunnelEvent({
        event_type: 'booking_result',
        step: '/confirmation',
        response_summary: 'booking_failed',
        payload: {
          error: errMsg.slice(0, 2000),
          slotUnavailable: isSlotUnavailable,
          phoneValidation: isPhoneValidation,
        },
      });

      if (isSlotUnavailable) {
        updateBookingData({ lastError: 'slot_unavailable' });
      } else {
        updateBookingData({
          journeyStatus: 'callback_required',
          ...(isPhoneValidation && { lastError: 'phone_validation' }),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const [calMenuOpen, setCalMenuOpen] = useState(false);
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const calRef = useRef(null);
  const emailRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calMenuOpen && calRef.current && !calRef.current.contains(e.target)) {
        setCalMenuOpen(false);
      }
      if (emailMenuOpen && emailRef.current && !emailRef.current.contains(e.target)) {
        setEmailMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calMenuOpen, emailMenuOpen]);

  const buildCalendarData = useCallback(() => {
    if (!bookingData.selectedSlot) return null;

    const start = new Date(bookingData.selectedSlot.startTime);
    const end = new Date(bookingData.selectedSlot.endTime);
    const location = bookingData.fullAddress || '';
    const title = 'Project Solar Home Appointment';
    const description = `Solar assessment appointment with Project Solar.\nBooking Reference: ${bookingReference}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';

    const pad = (v) => String(v).padStart(2, '0');
    const fmtGoogle = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const fmtOutlook = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const fmtICS = (d) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const escICS = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

    const googleUrl =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${encodeURIComponent(fmtGoogle(start) + '/' + fmtGoogle(end))}` +
      `&details=${encodeURIComponent(description)}` +
      `&location=${encodeURIComponent(location)}` +
      `&ctz=${encodeURIComponent(tz)}`;

    const outlookUrl =
      `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose` +
      `&subject=${encodeURIComponent(title)}` +
      `&body=${encodeURIComponent(description)}` +
      `&location=${encodeURIComponent(location)}` +
      `&startdt=${encodeURIComponent(fmtOutlook(start))}` +
      `&enddt=${encodeURIComponent(fmtOutlook(end))}`;

    const icsContent =
      `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Project Solar//Booking//EN\nCALSCALE:GREGORIAN\nBEGIN:VEVENT\n` +
      `UID:${bookingReference}@projectsolar.com\n` +
      `DTSTAMP:${fmtGoogle(new Date())}\n` +
      `DTSTART:${fmtICS(start)}\nDTEND:${fmtICS(end)}\n` +
      `SUMMARY:${escICS(title)}\nDESCRIPTION:${escICS(description)}\nLOCATION:${escICS(location)}\n` +
      `END:VEVENT\nEND:VCALENDAR`;

    return { googleUrl, outlookUrl, icsContent };
  }, [bookingData.selectedSlot, bookingData.fullAddress, bookingReference]);

  const openGoogleCalendar = () => {
    const data = buildCalendarData();
    if (data) window.open(data.googleUrl, '_blank', 'noopener,noreferrer');
  };

  const openOutlookCalendar = () => {
    const data = buildCalendarData();
    if (data) window.open(data.outlookUrl, '_blank', 'noopener,noreferrer');
    setCalMenuOpen(false);
  };

  const openAppleCalendar = () => {
    const data = buildCalendarData();
    if (!data) return;
    const dataUri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(data.icsContent);
    window.open(dataUri, '_blank');
    setCalMenuOpen(false);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <h2 className={styles.loadingTitle}>Confirming your booking</h2>
          <p className={styles.loadingText}>Please wait...</p>
        </div>
      </div>
    );
  }

  // Booking confirmed successfully
  if (bookingConfirmed) {
    return (
      <div className={styles.container}>
        {USE_MOCK_DATA && (
          <div className={styles.uatBanner}>
            UAT Mode: Mock booking confirmation
          </div>
        )}

        <div className={styles.icon}>
          <img
            src="https://images-ulpn.ecs.prd9.eu-west-1.mvfglobal.net/wp-content/uploads/2026/03/calendar_check_100dp_0F5132_FILL0_wght400_GRAD0_opsz48.svg"
            alt=""
            className={styles.checkIcon}
          />
        </div>

        <h1 className={styles.title}>Booking confirmed!</h1>

        <p className={styles.message}>
          Your solar assessment appointment has been booked successfully.
        </p>

        <div className={styles.bookingDetails}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Reference</span>
            <span className={styles.detailValue}>{bookingReference}</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Date</span>
            <span className={styles.detailValue}>
              {formatDate(bookingData.selectedSlot?.startTime)}
            </span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Time</span>
            <span className={styles.detailValue}>
              {formatTime(bookingData.selectedSlot?.startTime)} - {formatTime(bookingData.selectedSlot?.endTime)}
            </span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Address</span>
            <span className={styles.detailValue}>{bookingData.fullAddress}</span>
          </div>
        </div>

        <div className={styles.calendarWrapper} ref={calRef}>
          <div className={styles.calendarSplitButton}>
            <button type="button" className={`${styles.calBtn} ${styles.calBtnMain}`} onClick={openGoogleCalendar}>
              <span className={styles.calBtnIcon}>📅</span>
              Add to Calendar
            </button>
            <button
              type="button"
              className={`${styles.calBtn} ${styles.calBtnToggle}`}
              onClick={() => setCalMenuOpen(prev => !prev)}
              aria-label="More calendar options"
            >
              ▾
            </button>
          </div>

          {calMenuOpen && (
            <div className={styles.calendarMenu}>
              <div className={styles.calMenuLabel}>More options</div>
              <a
                href={buildCalendarData()?.googleUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.calMenuItem}
                onClick={() => setCalMenuOpen(false)}
              >
                <span className={styles.calMenuIcon}>📅</span>
                Google Calendar
              </a>
              <button type="button" className={styles.calMenuItem} onClick={openOutlookCalendar}>
                <span className={styles.calMenuIcon}>📆</span>
                Outlook
              </button>
              <button type="button" className={styles.calMenuItem} onClick={openAppleCalendar}>
                <span className={styles.calMenuIcon}>
                  <svg width="16" height="16" viewBox="0 0 814 1000" fill="currentColor">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57.8-155.5-127.4c-58.5-81.5-105.5-208.5-105.5-329 0-193.5 125.7-296.1 249.2-296.1 65.7 0 120.6 43.1 162 43.1 39.5 0 101-45.8 175.8-45.8 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 103.8-30.4 135.5-71.3z"/>
                  </svg>
                </span>
                Apple Calendar
              </button>
            </div>
          )}
        </div>

        <div className={styles.emailNote}>
          <p className={styles.note}>
            A confirmation email has been sent to {bookingData.emailAddress || 'your email address'}
          </p>
          <div className={styles.openEmailWrapper} ref={emailRef}>
            <button
              type="button"
              className={styles.openEmailLink}
              onClick={() => setEmailMenuOpen(prev => !prev)}
            >
              Open email ›
            </button>
            {emailMenuOpen && (
              <div className={styles.emailMenu}>
                <div className={styles.calMenuLabel}>Select your email provider</div>
                <a
                  href="https://mail.google.com/mail/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.calMenuItem}
                  onClick={() => setEmailMenuOpen(false)}
                >
                  <span className={styles.calMenuIcon}>
                    <svg width="16" height="12" viewBox="0 0 24 18" fill="none">
                      <path d="M1.636 18h4.364V8.77L0 5.727V16.09c0 1.052.862 1.909 1.636 1.909z" fill="#4285f4"/>
                      <path d="M18 18h4.364c.792 0 1.636-.857 1.636-1.91V5.726L18 8.773z" fill="#34a853"/>
                      <path d="M18 1.91v6.862l6-4.636V2.863c0-2.353-2.7-3.698-4.582-2.29z" fill="#fbbc04"/>
                      <path d="M6 8.77V1.91l6 4.636 6-4.636v6.862L12 13.41z" fill="#ea4335"/>
                      <path d="M0 2.864v2.863l6 4.636V1.909L4.582.573C2.7-.834 0 .51 0 2.864z" fill="#c5221f"/>
                    </svg>
                  </span>
                  Gmail
                </a>
                <a
                  href="https://outlook.live.com/mail/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.calMenuItem}
                  onClick={() => setEmailMenuOpen(false)}
                >
                  <span className={styles.calMenuIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M24 7.387v10.478c0 .914-.737 1.65-1.644 1.65h-8.553V6.865l.95.656 8.81-4.593c.255.32.437.735.437 1.179v3.28z" fill="#0072c6"/>
                      <path d="M14.753 6.865L13.803 6.21V19.515h-8.16C4.737 19.515 4 18.78 4 17.865V4.387c0-.914.737-1.65 1.644-1.65h8.16v4.128z" fill="#0072c6"/>
                      <path d="M0 3v18l13 3V0L0 3zm7.5 12.75c-2.485 0-4.5-2.462-4.5-5.5s2.015-5.5 4.5-5.5 4.5 2.462 4.5 5.5-2.015 5.5-4.5 5.5z" fill="#0072c6"/>
                      <ellipse cx="7.5" cy="10.25" rx="2.7" ry="3.5" fill="#fff"/>
                    </svg>
                  </span>
                  Outlook
                </a>
                <a
                  href="https://mail.yahoo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.calMenuItem}
                  onClick={() => setEmailMenuOpen(false)}
                >
                  <span className={styles.calMenuIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#6001d2">
                      <path d="M0 5l7.2 9.6V22h3.6v-7.4L18 5h-3.6l-5.4 7.2L3.6 5H0zm18 0l3 4h3l-3-4h-3zm3 6a2 2 0 100 4 2 2 0 000-4z"/>
                    </svg>
                  </span>
                  Yahoo Mail
                </a>
                <a
                  href={`mailto:${bookingData.emailAddress || ''}`}
                  className={styles.calMenuItem}
                  onClick={() => setEmailMenuOpen(false)}
                >
                  <span className={styles.calMenuIcon}>✉️</span>
                  Default mail app
                </a>
              </div>
            )}
          </div>
        </div>

        <div className={styles.appointmentInfo}>
          <h2 className={styles.appointmentTitle}>What happens at your appointment?</h2>
          <p className={styles.appointmentIntro}>
            A Project Solar expert will visit your home at your chosen time to carry out your solar assessment. During the visit, they'll:
          </p>
          <div className={styles.appointmentCards}>
            <div className={styles.appointmentCard}>
              <div className={styles.appointmentCardIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#03624C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <p className={styles.appointmentCardText}>Review your energy usage and current electricity bill</p>
            </div>
            <div className={styles.appointmentCard}>
              <div className={styles.appointmentCardIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#03624C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <p className={styles.appointmentCardText}>Check your roof and how many panels your home could support</p>
            </div>
            <div className={styles.appointmentCard}>
              <div className={styles.appointmentCardIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#03624C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </div>
              <p className={styles.appointmentCardText}>Show how much energy your system could generate</p>
            </div>
            <div className={styles.appointmentCard}>
              <div className={styles.appointmentCardIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#03624C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M7 7h8M7 12h10M7 17h6"/>
                </svg>
              </div>
              <p className={styles.appointmentCardText}>Estimate how much you could save over time</p>
            </div>
          </div>
          <p className={styles.appointmentFooter}>
            You'll have the chance to ask any questions along the way, so you can decide what's right for your home — with no pressure.
          </p>
        </div>
      </div>
    );
  }

  // Session expired (takes priority over other error states)
  if (isSessionExpired) {
    return (
      <div className={styles.container}>
        <div className={styles.icon}>
          <svg viewBox="0 0 64 64" className={styles.warningIcon}>
            <circle cx="32" cy="32" r="30" fill="#ffc107" />
            <text x="32" y="42" textAnchor="middle" fontSize="32" fill="#000">!</text>
          </svg>
        </div>

        <h1 className={styles.title}>Session expired</h1>

        <p className={styles.message}>
          Your session has timed out due to inactivity. Don't worry - one of our team will call you to arrange an appointment.
        </p>

        <p className={styles.note}>
          We'll call you on {bookingData.phoneNumber || 'your registered number'} within 24 hours.
        </p>
      </div>
    );
  }

  // Slot no longer available (410) - let user pick another
  if (bookingData.lastError === 'slot_unavailable') {
    const handlePickAnotherSlot = () => {
      setBookingSlot(null);
      updateBookingData({ lastError: null });
      navigate('/slot-selection');
    };
    return (
      <div className={styles.container}>
        <div className={styles.icon}>
          <svg viewBox="0 0 64 64" className={styles.warningIcon}>
            <circle cx="32" cy="32" r="30" fill="#ffc107" />
            <text x="32" y="42" textAnchor="middle" fontSize="32" fill="#000">!</text>
          </svg>
        </div>

        <h1 className={styles.title}>This slot is no longer available</h1>

        <p className={styles.message}>
          Someone else may have taken this appointment. Please choose another time.
        </p>

        <button
          type="button"
          className={styles.calendarButton}
          onClick={handlePickAnotherSlot}
        >
          Choose another slot
        </button>
      </div>
    );
  }

  // Callback required (disqualified or user chose callback)
  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <svg viewBox="0 0 64 64" className={styles.phoneIcon}>
          <circle cx="32" cy="32" r="30" fill="#55bfe5" />
          <g transform="translate(32, 32) scale(1.4) translate(-12, -12)">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z"
              fill="#ffffff"
            />
          </g>
        </svg>
      </div>

      <h1 className={styles.title}>We'll give you a call</h1>

      <p className={styles.message}>
        {bookingData.lastError === 'phone_validation'
          ? "We need a mobile number to complete your booking online. One of our team will call you on the number below to arrange your appointment."
          : isDisqualified
            ? "Based on your answers, we'd like to discuss your options with you directly. One of our solar experts will call you soon."
            : "Thank you for your interest. One of our team will call you to discuss your solar options and arrange an appointment."}
      </p>

      <div className={styles.callbackInfo}>
        <p>We'll call you on:</p>
        <p className={styles.phoneNumber}>{bookingData.phoneNumber || 'your registered number'}</p>
        <p className={styles.callbackNote}>Usually within 24 hours</p>
        {bookingData.lastError === 'phone_validation' && (
          <p className={styles.callbackNote}>Or call us on 0800 112 3110 to complete your booking now.</p>
        )}
      </div>
    </div>
  );
}
