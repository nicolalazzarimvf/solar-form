/**
 * Human-readable `step` values for the funnel dashboard timeline.
 * Technical route/API id is kept in each event `payload` where useful.
 */

const PAGE_LABELS = {
  '/': 'Page: Thank you — book online or callback?',
  '/address': 'Page: Confirm address (postcode & property)',
  '/solar-assessment': 'Page: Roof solar assessment (map & segments)',
  '/eligibility-questions': 'Page: Eligibility questions (4 checks)',
  '/slot-selection': 'Page: Choose appointment slot',
  '/confirmation': 'Page: Booking confirmation / outcome',
  '/loader': 'Page: Loader / handover',
};

export function pageViewStep(pathname) {
  if (!pathname) return 'Page: (unknown)';
  return PAGE_LABELS[pathname] || `Page: ${pathname}`;
}

export const STEPS = {
  PREFILL: 'Chameleon: answers received (prefill / submission linked)',

  BOOK_ONLINE: 'Thank-you: Book online',
  NO_THANKS: 'Thank-you: No thanks — callback offer',

  ADDRESS_IDEAL_LOOKUP: 'Address: Find addresses (Ideal Postcodes API)',
  ADDRESS_CONFIRMED: 'Address: Property confirmed — continue to solar',

  SOLAR_GOOGLE_OK: 'Solar: Google Building Insights (roof data loaded)',
  SOLAR_GOOGLE_ERR: 'Solar: Google Building Insights (error / no coverage)',
  SOLAR_DISQUALIFIED: 'Solar: Did not meet roof/panel rules — exit',
  SOLAR_PASSED: 'Solar: Qualified — continue to eligibility',
  SOLAR_ROOF_CHANGED_YES: 'Solar: Roof changed since imagery — journey ended',
  SOLAR_ROOF_CHANGED_AWAITING_TYPE: 'Solar: Roof changed — awaiting change type',
  SOLAR_ROOF_CHANGE_HOUSE_EXTENSION: 'Solar: Roof change — house extension (continue)',
  SOLAR_ROOF_CHANGE_ROOF_REPAIRS: 'Solar: Roof change — roof repairs (continue)',
  SOLAR_ROOF_CHANGE_LOFT_CONVERSION: 'Solar: Roof change — loft conversion (callback)',

  ELIGIBILITY_RESULT: (eligible) =>
    eligible
      ? 'Eligibility: Passed — load appointment slots'
      : 'Eligibility: Disqualified — exit to confirmation',

  SLOTS_API: 'Slots: Supabase edge — get-availability (Project Solar)',
  SLOT_SELECTED: 'Slots: Time slot selected',
  SLOT_CONFIRMED: 'Slots: Appointment confirmed — go to booking',

  BOOK_API: 'Confirmation: Supabase edge — book-appointment (Project Solar)',
  BOOKING_CONFIRMED: 'Confirmation: Booking succeeded',
  BOOKING_FAILED: 'Confirmation: Booking failed (callback / retry)',
  SKIP_DISQUALIFIED: 'Confirmation: Skipped booking (disqualified earlier)',
  SKIP_SESSION_EXPIRED: 'Confirmation: Skipped booking (session expired)',
};
