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
