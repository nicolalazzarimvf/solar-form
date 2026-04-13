import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBooking } from '../contexts';
import { config } from '../config/env';
import { queueFunnelEvent, redactTelemetryObject, STEPS } from '../telemetry';
import styles from './SlotSelectionPage.module.css';

const USE_MOCK_DATA = false;

// Generate mock slots for the next 5 days
// Time slots: 10am, 2pm, 6pm (90-minute appointments)
const generateMockSlots = () => {
  const slots = [];
  const now = new Date();
  let daysAdded = 0;
  let dayOffset = 1;

  // Get 5 weekdays (skipping weekends)
  while (daysAdded < 5) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) {
      dayOffset++;
      continue;
    }

    // Three slots per day: 10am, 2pm, 6pm (90-minute duration)
    [10, 14, 18].forEach(hour => {
      const startTime = new Date(date);
      startTime.setHours(hour, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 90); // 90-minute appointment

      slots.push({
        id: `slot-${dayOffset}-${hour}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
    });

    daysAdded++;
    dayOffset++;
  }

  return slots;
};

export default function SlotSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingData, setBookingSlot, updateBookingData } = useBooking();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [contactOverrides, setContactOverrides] = useState({ lastName: '', email: '', phone: '' });

  const missingLastName = !(bookingData.lastName || contactOverrides.lastName).trim();
  const missingEmail = !(bookingData.emailAddress || contactOverrides.email).trim();
  const missingPhone = !(bookingData.phoneNumber || contactOverrides.phone).trim();
  const hasMissingContact = missingLastName || missingEmail || missingPhone;

  useEffect(() => {
    fetchAvailableSlots();
  }, []);

  const fetchAvailableSlots = async () => {
    try {
      setLoading(true);
      setError('');

      if (USE_MOCK_DATA) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSlots(generateMockSlots());
        setLoading(false);
        return;
      }

      const postcode = (bookingData.postcode || '').trim().replace(/\s/g, '');
      const url = `${config.projectSolarMvfApiUrl}/get-availability?postcode=${encodeURIComponent(postcode)}`;
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const response = await fetch(url, { method: 'GET' });
      const duration_ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null;

      if (!response.ok) {
        queueFunnelEvent({
          event_type: 'api_call',
          step: STEPS.SLOTS_API,
          response_summary: `Project Solar get-availability failed — HTTP ${response.status}`,
          payload: redactTelemetryObject({
            api: 'get_availability',
            route: '/slot-selection',
            request: { postcode },
            duration_ms,
          }),
        });
        throw new Error('Failed to fetch available slots');
      }

      const data = await response.json();

      // Transform get-availability response: { availability: [{ date: "DD-MM-YYYY", slots: ["10:00", "14:00"] }] }
      // to { id, startTime, endTime }
      const APPOINTMENT_DURATION_MINS = 90;
      const normalizedSlots = [];
      const availability = data.availability || data.slots || [];
      let slotIndex = 0;

      availability.forEach((daySlot) => {
        const dateStr = daySlot.date || ''; // DD-MM-YYYY
        const times = daySlot.slots || [];
        const [d, m, y] = dateStr.split('-').map(Number);
        if (!d || !m || !y) return;
        const year = y >= 100 ? y : 2000 + y;

        times.forEach((timeStr) => {
          const [hour, min] = (timeStr || '10:00').split(':').map(Number);
          const start = new Date(Date.UTC(year, m - 1, d, hour || 10, min || 0, 0, 0));
          const end = new Date(start);
          end.setUTCMinutes(end.getUTCMinutes() + APPOINTMENT_DURATION_MINS);
          normalizedSlots.push({
            id: `slot-${slotIndex++}`,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          });
        });
      });

      setSlots(normalizedSlots);

      queueFunnelEvent({
        event_type: 'api_call',
        step: STEPS.SLOTS_API,
        response_summary: `Loaded ${normalizedSlots.length} slot(s) for postcode in ${duration_ms ?? '?'}ms`,
        payload: redactTelemetryObject({
          api: 'get_availability',
          route: '/slot-selection',
          request: { postcode },
          response: { slotCount: normalizedSlots.length },
          duration_ms,
        }),
      });
    } catch (err) {
      queueFunnelEvent({
        event_type: 'api_call',
        step: STEPS.SLOTS_API,
        response_summary: `get-availability error: ${err?.message || err}`,
        payload: {
          api: 'get_availability',
          route: '/slot-selection',
          error: String(err?.message || err),
        },
      });
      setError('Unable to load available slots. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupSlotsByDate = (slots) => {
    return slots.reduce((groups, slot) => {
      const date = new Date(slot.startTime).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(slot);
      return groups;
    }, {});
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    queueFunnelEvent({
      event_type: 'user_action',
      step: STEPS.SLOT_SELECTED,
      response_summary: slot?.startTime
        ? `Selected slot starting ${slot.startTime}`
        : 'Selected a slot',
      payload: { route: '/slot-selection', slotStart: slot?.startTime || null },
    });
  };

  const resolvedLastName = (bookingData.lastName || contactOverrides.lastName || '').trim();
  const resolvedEmail = (bookingData.emailAddress || contactOverrides.email || '').trim();
  const resolvedPhone = (bookingData.phoneNumber || contactOverrides.phone || '').trim();
  const canConfirm = selectedSlot && resolvedLastName && resolvedEmail && resolvedPhone;

  const handleConfirm = () => {
    if (!selectedSlot || !canConfirm) return;

    setBookingSlot(selectedSlot);

    updateBookingData({
      lastName: resolvedLastName,
      emailAddress: resolvedEmail,
      phoneNumber: resolvedPhone,
      currentPage: '/confirmation',
      lastAction: 'slot_confirmed',
      lastActionPage: '/slot-selection',
      journeyStatus: 'slot_confirmed',
    });

    queueFunnelEvent({
      event_type: 'user_action',
      step: STEPS.SLOT_CONFIRMED,
      response_summary: 'User confirmed slot & contact details — booking request next',
      payload: {
        route: '/slot-selection',
        slotStart: selectedSlot?.startTime || null,
        hasLastName: Boolean(resolvedLastName),
        hasEmail: Boolean(resolvedEmail),
        hasPhone: Boolean(resolvedPhone),
      },
    });

    navigate({ pathname: '/confirmation', search: location.search });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <h2 className={styles.loadingTitle}>Finding available appointments</h2>
          <p className={styles.loadingText}>
            Checking availability in your area...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2 className={styles.errorTitle}>Unable to load appointments</h2>
          <p className={styles.errorText}>{error}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={fetchAvailableSlots}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const groupedSlots = groupSlotsByDate(slots);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Choose your appointment</h1>

      <p className={styles.description}>
        Please choose a time when you and any other household decision-makers are available for a solar assessment appointment
      </p>

      <div className={styles.accordion}>
        <button
          type="button"
          className={styles.accordionHeader}
          onClick={() => setAccordionOpen(prev => !prev)}
          aria-expanded={accordionOpen}
          aria-controls="appointment-accordion-content"
        >
          <span className={styles.accordionTitle}>What happens at an appointment?</span>
          <span className={`${styles.accordionIcon} ${accordionOpen ? styles.accordionIconOpen : ''}`}>
            &#9660;
          </span>
        </button>
        <div
          id="appointment-accordion-content"
          className={`${styles.accordionContent} ${accordionOpen ? styles.accordionContentOpen : ''}`}
        >
          <p className={styles.accordionBody}>
            Project Solar Panels experts will visit your home for a free home assessment - usually taking up to 1 hour 30 minutes. They'll leave you with a full breakdown of your next steps to going solar with Project Solar.
          </p>
        </div>
      </div>

      {USE_MOCK_DATA && (
        <div className={styles.uatBanner}>
          UAT Mode: Using mock appointment slots
        </div>
      )}

      {slots.length === 0 ? (
        <div className={styles.noSlots}>
          <p>No appointments available at the moment. Please try again later or contact us.</p>
        </div>
      ) : (
        <div className={styles.slotsContainer}>
          {Object.entries(groupedSlots).map(([date, dateSlots]) => (
            <div key={date} className={styles.dateGroup}>
              <h3 className={styles.dateHeader}>{formatDate(dateSlots[0].startTime)}</h3>

              <div className={styles.slotsList}>
                {dateSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className={`${styles.slotCard} ${selectedSlot?.id === slot.id ? styles.selected : ''}`}
                    onClick={() => handleSlotSelect(slot)}
                  >
                    <span className={styles.slotTime}>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </span>
                    {selectedSlot?.id === slot.id && (
                      <span className={styles.checkmark}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSlot && (
        <div className={styles.selectedSummary}>
          <span className={styles.summaryLabel}>Booking summary</span>
          <div className={styles.summaryRow}>
            <span className={styles.summaryField}>Name</span>
            <span className={styles.summaryValue}>
              {[(bookingData.firstName || '').trim(), resolvedLastName].filter(Boolean).join(' ') || '—'}
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryField}>Appointment</span>
            <span className={styles.summaryValue}>
              {formatDate(selectedSlot.startTime)} at {formatTime(selectedSlot.startTime)}
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryField}>Address</span>
            <span className={styles.summaryValue}>
              {bookingData.fullAddress || '—'}
            </span>
          </div>
        </div>
      )}

      {selectedSlot && hasMissingContact && (
        <div className={styles.contactForm}>
          <span className={styles.summaryLabel}>Contact details</span>
          <p className={styles.contactFormHint}>Please provide your contact details to complete the booking.</p>
          {missingLastName && (
            <div className={styles.contactField}>
              <label htmlFor="slot-lastname">Last name *</label>
              <input
                id="slot-lastname"
                type="text"
                value={contactOverrides.lastName}
                onChange={(e) => setContactOverrides(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Your last name"
                autoComplete="family-name"
              />
            </div>
          )}
          {missingEmail && (
            <div className={styles.contactField}>
              <label htmlFor="slot-email">Email *</label>
              <input
                id="slot-email"
                type="email"
                value={contactOverrides.email}
                onChange={(e) => setContactOverrides(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
          )}
          {missingPhone && (
            <div className={styles.contactField}>
              <label htmlFor="slot-phone">Mobile number *</label>
              <input
                id="slot-phone"
                type="tel"
                value={contactOverrides.phone}
                onChange={(e) => setContactOverrides(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="07XXX XXXXXX"
                autoComplete="tel"
              />
              <span className={styles.contactFieldHint}>Please enter a UK mobile number (07xxx)</span>
            </div>
          )}
        </div>
      )}

      <p className={styles.consentStatement}>
        Your privacy is important to us.{' '}
        <a href="https://www2.mvfglobal.com/pp/b649e" target="_blank" rel="noopener noreferrer" className={styles.privacyInlineLink}>
          Privacy Policy
        </a>
        . By submitting this booking, you consent to MVF, trading as The Eco Experts, sharing your details with Project Solar to arrange and discuss your solar appointment. Project Solar may contact you by telephone (including automated calls), SMS, email, post or OTT messaging services such as WhatsApp for this purpose. You can withdraw your consent at any time.
      </p>

      <button
        type="button"
        className={styles.confirmButton}
        onClick={handleConfirm}
        disabled={!canConfirm}
      >
        Confirm appointment
      </button>
    </div>
  );
}
