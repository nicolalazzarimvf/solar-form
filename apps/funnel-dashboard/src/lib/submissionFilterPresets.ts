/**
 * Preset values for funnel dashboard filters — keep in sync with
 * solar-form src/telemetry/stepLabels.js and queueFunnelEvent event_type usage.
 */

export const EVENT_TYPE_OPTIONS = [
  'api_call',
  'booking_result',
  'eligibility',
  'page_view',
  'prefill_applied',
  'user_action',
] as const;

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPE_OPTIONS);

export function isPresetEventType(value: string | undefined): boolean {
  if (!value) return false;
  return EVENT_TYPE_SET.has(value);
}

const PAGE_STEPS = [
  'Page: Thank you — book online or callback?',
  'Page: Confirm address (postcode & property)',
  'Page: Roof solar assessment (map & segments)',
  'Page: Eligibility questions (4 checks)',
  'Page: Choose appointment slot',
  'Page: Booking confirmation / outcome',
  'Page: Loader / handover',
];

export const STEP_OPTION_GROUPS: { label: string; options: string[] }[] = [
  { label: 'Page views', options: PAGE_STEPS },
  {
    label: 'Prefill & thank-you',
    options: [
      'Chameleon: answers received (prefill / submission linked)',
      'Thank-you: Book online',
      'Thank-you: No thanks — callback offer',
    ],
  },
  {
    label: 'Address',
    options: [
      'Address: Find addresses (Ideal Postcodes API)',
      'Address: Property confirmed — continue to solar',
    ],
  },
  {
    label: 'Solar assessment',
    options: [
      'Solar: Google Building Insights (roof data loaded)',
      'Solar: Google Building Insights (error / no coverage)',
      'Solar: Did not meet roof/panel rules — exit',
      'Solar: Qualified — continue to eligibility',
      'Solar: Roof changed since imagery — journey ended',
    ],
  },
  {
    label: 'Eligibility',
    options: [
      'Eligibility: Passed — load appointment slots',
      'Eligibility: Disqualified — exit to confirmation',
    ],
  },
  {
    label: 'Slots',
    options: [
      'Slots: Supabase edge — get-availability (Project Solar)',
      'Slots: Time slot selected',
      'Slots: Appointment confirmed — go to booking',
    ],
  },
  {
    label: 'Confirmation',
    options: [
      'Confirmation: Supabase edge — book-appointment (Project Solar)',
      'Confirmation: Booking succeeded',
      'Confirmation: Booking failed (callback / retry)',
      'Confirmation: Skipped booking (disqualified earlier)',
      'Confirmation: Skipped booking (session expired)',
    ],
  },
];

export const ALL_PRESET_STEPS: string[] = STEP_OPTION_GROUPS.flatMap((g) => g.options);

const PRESET_STEP_SET = new Set(ALL_PRESET_STEPS);

export function isPresetStep(value: string | undefined): boolean {
  if (!value) return false;
  return PRESET_STEP_SET.has(value);
}

/** Maps GET param `billy_preset` → filters. `anyEventMatch`: row may be buried after a later page_view (navigation). */
export type BillyQuickSlice = Partial<{
  step: string;
  event_type: string;
  anyEventMatch: boolean;
  /** Exclude submissions that have ANY event matching this step/event_type (compound "AND NOT"). */
  notAnyEvent: { step?: string; event_type?: string };
}>;

export const BILLY_QUICK_MAP: Record<string, BillyQuickSlice> = {
  page_thank_you: {
    step: 'Page: Thank you — book online or callback?',
    event_type: 'page_view',
  },
  thank_book_online: {
    step: 'Thank-you: Book online',
    event_type: 'user_action',
    anyEventMatch: true,
  },
  thank_no_thanks: {
    step: 'Thank-you: No thanks — callback offer',
    event_type: 'user_action',
    anyEventMatch: true,
  },
  booking_succeeded: {
    step: 'Confirmation: Booking succeeded',
    event_type: 'booking_result',
    // Match if a booking succeeded at ANY point — users often navigate on
    // afterwards, which adds a newer page_view and buries the booking row.
    anyEventMatch: true,
  },
  booking_failed: {
    step: 'Confirmation: Booking failed (callback / retry)',
    event_type: 'booking_result',
  },
  skip_disqualified: {
    step: 'Confirmation: Skipped booking (disqualified earlier)',
    event_type: 'booking_result',
  },
  skip_session_expired: {
    step: 'Confirmation: Skipped booking (session expired)',
    event_type: 'booking_result',
  },
  solar_disqualified: {
    step: 'Solar: Did not meet roof/panel rules — exit',
    event_type: 'user_action',
    anyEventMatch: true,
  },
  eligibility_disqualified: {
    step: 'Eligibility: Disqualified — exit to confirmation',
    event_type: 'eligibility',
    anyEventMatch: true,
  },
  roof_changed: {
    step: 'Solar: Roof changed since imagery — journey ended',
    event_type: 'user_action',
    anyEventMatch: true,
  },
  eligibility_passed: {
    step: 'Eligibility: Passed — load appointment slots',
    event_type: 'eligibility',
    anyEventMatch: true,
  },
  slot_confirmed: {
    step: 'Slots: Appointment confirmed — go to booking',
    event_type: 'user_action',
    anyEventMatch: true,
  },
  page_slots: {
    step: 'Page: Choose appointment slot',
    event_type: 'page_view',
  },
  reached_no_booking: {
    // Reached the appointment-slot page at any point...
    step: 'Page: Choose appointment slot',
    event_type: 'page_view',
    anyEventMatch: true,
    // ...but never recorded a successful booking.
    notAnyEvent: { step: 'Confirmation: Booking succeeded', event_type: 'booking_result' },
  },
  page_confirmation: {
    step: 'Page: Booking confirmation / outcome',
    event_type: 'page_view',
  },
  et_booking_result: { event_type: 'booking_result' },
  et_user_action: { event_type: 'user_action' },
  et_page_view: { event_type: 'page_view' },
};

export type BillyQuickGroup = {
  title: string;
  description?: string;
  options: { value: string; label: string }[];
};

/** Visual grouping only — every `value` must exist in `BILLY_QUICK_MAP`. */
export const BILLY_QUICK_GROUPS: BillyQuickGroup[] = [
  {
    title: 'Choice on the thank-you screen',
    description:
      'Matches if this choice was recorded at any point (the next page usually adds a newer page_view).',
    options: [
      { value: 'thank_book_online', label: 'Book online' },
      { value: 'thank_no_thanks', label: 'No thanks — callback' },
    ],
  },
  {
    title: 'Booking outcome',
    description:
      '"Booking succeeded" matches if a booking was recorded at any point. The other outcomes match the latest recorded event.',
    options: [
      { value: 'booking_succeeded', label: 'Booking succeeded' },
      { value: 'booking_failed', label: 'Booking failed (callback / retry)' },
      { value: 'skip_disqualified', label: 'Skipped — disqualified earlier' },
      { value: 'skip_session_expired', label: 'Skipped — session expired' },
    ],
  },
  {
    title: 'Confirmation page',
    description:
      'Last event is a page view on /confirmation. Matches “reached confirmation”. To find completed bookings use “Booking succeeded” (matches at any point).',
    options: [{ value: 'page_confirmation', label: 'Reached confirmation page' }],
  },
  {
    title: 'Hard exits',
    description:
      'Matches if this exit was recorded at any point. Users are sent to /confirmation next, so the latest event is often a page_view, not the exit row.',
    options: [
      { value: 'solar_disqualified', label: 'Solar — roof/panel rules not met' },
      { value: 'eligibility_disqualified', label: 'Eligibility — disqualified' },
      { value: 'roof_changed', label: 'Solar — roof changed since imagery' },
    ],
  },
  {
    title: 'Progress signals',
    description:
      'Matches if this milestone occurred at any point (navigation usually adds a newer page_view afterward).',
    options: [
      { value: 'eligibility_passed', label: 'Eligibility passed' },
      { value: 'slot_confirmed', label: 'Slot confirmed — go to booking' },
    ],
  },
  {
    title: 'Stopped on page (last event)',
    description: 'Latest event is a page view on this step.',
    options: [{ value: 'page_slots', label: 'Choose appointment slot' }],
  },
  {
    title: 'Booking page drop-off',
    description:
      'Reached the appointment-slot page at any point but never recorded a successful booking.',
    options: [{ value: 'reached_no_booking', label: 'Reached booking, didn’t book' }],
  },
  {
    title: 'By last event type',
    description: 'Any last step with this event type.',
    options: [
      { value: 'et_booking_result', label: 'booking_result' },
      { value: 'et_user_action', label: 'user_action' },
      { value: 'et_page_view', label: 'page_view' },
    ],
  },
];

export function normalizeBillyPresetKey(raw: string | undefined): string {
  const key = (raw ?? '').trim();
  if (!key || !BILLY_QUICK_MAP[key]) return '';
  return key;
}
