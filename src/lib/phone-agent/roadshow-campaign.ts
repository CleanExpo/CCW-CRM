export const CCW_ROADSHOW_CAMPAIGN_SLUG = 'carsi-ccw-roadshow-2026';
export const CCW_ROADSHOW_FEATURE_SLUG = 'carsi_ccw_roadshow_campaign';
export const CCW_ROADSHOW_BOOKING_URL = 'https://www.carsi.com.au/events/ccw-roadshow';
export const CCW_ROADSHOW_OWNER_EMAIL = 'toby.b@ccwarehouse.com.au';
export const CCW_ROADSHOW_DISTRIBUTION_EMAIL = 'annef@ccwarehouse.com.au';

export const ccwRoadshowComplianceFlagKeys = [
  'client_list_source_confirmed',
  'consent_basis_confirmed',
  'suppression_rules_confirmed',
  'unsubscribe_url_confirmed',
  'sender_footer_confirmed',
  'seat_capacity_confirmed',
  'final_approval_confirmed',
] as const;

export type CcwRoadshowComplianceFlagKey = (typeof ccwRoadshowComplianceFlagKeys)[number];

export type CcwRoadshowComplianceState = Record<CcwRoadshowComplianceFlagKey, boolean> & {
  updated_by: string | null;
  updated_at: string | null;
  notes: string | null;
};

export type CcwRoadshowEventSeed = {
  slug: 'melbourne' | 'sydney';
  city: string;
  name: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  description: string;
};

export type CcwRoadshowInternalDraft = {
  recipient_ref: string;
  subject: string;
  body: string;
};

export type CcwRoadshowReadinessInput = {
  saved_events: number;
  internal_test_drafts: number;
  trusted_sources: number;
} & Partial<Record<CcwRoadshowComplianceFlagKey, boolean>>;

export type CcwRoadshowReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
  blocker?: string;
};

export const ccwRoadshowEventSeeds: CcwRoadshowEventSeed[] = [
  {
    slug: 'melbourne',
    city: 'Melbourne',
    name: 'CARSI x CCW Business Growth Days - Melbourne',
    starts_at: '2026-07-22T08:30:00+10:00',
    ends_at: '2026-07-23T16:30:00+10:00',
    venue: 'Carpet Cleaners Warehouse Melbourne, Unit 1/5 Gatwick Road, Bayswater North VIC 3153',
    description:
      'Two practical business-growth days covering carpet cleaning, rug cleaning, stain removal, tile cleaning, equipment, chemicals, quoting confidence and service growth.',
  },
  {
    slug: 'sydney',
    city: 'Sydney',
    name: 'CARSI x CCW Business Growth Days - Sydney',
    starts_at: '2026-07-30T08:30:00+10:00',
    ends_at: '2026-07-31T16:30:00+10:00',
    venue: 'Carpet Cleaners Warehouse Sydney, 2/8 Tollis Place, Seven Hills NSW 2147',
    description:
      'Two practical business-growth days covering carpet cleaning, rug cleaning, stain removal, tile cleaning, equipment, chemicals, quoting confidence and service growth.',
  },
];

export const ccwRoadshowTrustedSources = [
  {
    label: 'CARSI roadshow booking page',
    url: CCW_ROADSHOW_BOOKING_URL,
    source_type: 'website',
  },
  {
    label: 'CARSI training platform',
    url: 'https://www.carsi.com.au',
    source_type: 'website',
  },
  {
    label: 'Carpet Cleaners Warehouse website',
    url: 'https://www.ccwarehouse.com.au',
    source_type: 'website',
  },
] as const;

export const ccwRoadshowInternalDrafts: CcwRoadshowInternalDraft[] = [
  {
    recipient_ref: CCW_ROADSHOW_OWNER_EMAIL,
    subject: 'Internal approval test - CARSI x CCW Roadshow campaign',
    body:
      'Draft only: Please review the CARSI x CCW Roadshow campaign before any CCW client-list send. Confirm consent basis, final segments, unsubscribe link, sender footer, seat capacity and approval to send.',
  },
  {
    recipient_ref: CCW_ROADSHOW_DISTRIBUTION_EMAIL,
    subject: 'Distribution test - CARSI x CCW Roadshow campaign',
    body:
      'Draft only: Please review the final CARSI x CCW Roadshow email proof for distribution readiness. No client-list send should happen until Toby approval and compliance checks are recorded.',
  },
];

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
    if (['false', '0', 'no', 'off'].includes(normalised)) return false;
  }
  return fallback;
}

function text(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 2000) : fallback;
}

export function defaultCcwRoadshowComplianceState(): CcwRoadshowComplianceState {
  return {
    client_list_source_confirmed: false,
    consent_basis_confirmed: false,
    suppression_rules_confirmed: false,
    unsubscribe_url_confirmed: false,
    sender_footer_confirmed: false,
    seat_capacity_confirmed: false,
    final_approval_confirmed: false,
    updated_by: null,
    updated_at: null,
    notes: null,
  };
}

export function normaliseCcwRoadshowComplianceState(
  input: unknown,
  defaults: CcwRoadshowComplianceState = defaultCcwRoadshowComplianceState()
): CcwRoadshowComplianceState {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  return {
    client_list_source_confirmed: bool(source.client_list_source_confirmed, defaults.client_list_source_confirmed),
    consent_basis_confirmed: bool(source.consent_basis_confirmed, defaults.consent_basis_confirmed),
    suppression_rules_confirmed: bool(source.suppression_rules_confirmed, defaults.suppression_rules_confirmed),
    unsubscribe_url_confirmed: bool(source.unsubscribe_url_confirmed, defaults.unsubscribe_url_confirmed),
    sender_footer_confirmed: bool(source.sender_footer_confirmed, defaults.sender_footer_confirmed),
    seat_capacity_confirmed: bool(source.seat_capacity_confirmed, defaults.seat_capacity_confirmed),
    final_approval_confirmed: bool(source.final_approval_confirmed, defaults.final_approval_confirmed),
    updated_by: text(source.updated_by, defaults.updated_by),
    updated_at: text(source.updated_at, defaults.updated_at),
    notes: text(source.notes, defaults.notes),
  };
}

export function buildCcwRoadshowReadiness(input: CcwRoadshowReadinessInput) {
  const items: CcwRoadshowReadinessItem[] = [
    {
      key: 'events_seeded',
      label: 'Melbourne and Sydney campaign events saved',
      ready: input.saved_events >= ccwRoadshowEventSeeds.length,
      blocker: 'Seed the CARSI x CCW roadshow events into the CRM.',
    },
    {
      key: 'trusted_sources_seeded',
      label: 'CARSI, CCW and booking-page knowledge sources saved',
      ready: input.trusted_sources >= ccwRoadshowTrustedSources.length,
      blocker: 'Seed trusted knowledge sources so phone/follow-up agents can answer from approved pages.',
    },
    {
      key: 'internal_tests_drafted',
      label: 'Internal test drafts prepared for Toby and Anne',
      ready: input.internal_test_drafts >= ccwRoadshowInternalDrafts.length,
      blocker: 'Create internal test drafts before any customer-list campaign.',
    },
    {
      key: 'client_list_source',
      label: 'CCW client-list source and export date confirmed',
      ready: input.client_list_source_confirmed === true,
      blocker: 'Confirm the export source, owner and date before sending.',
    },
    {
      key: 'consent_basis',
      label: 'Marketing consent basis confirmed',
      ready: input.consent_basis_confirmed === true,
      blocker: 'Confirm Spam Act consent basis and remove contacts without valid consent.',
    },
    {
      key: 'suppression_rules',
      label: 'Unsubscribed, bounced, suppressed and no-marketing contacts excluded',
      ready: input.suppression_rules_confirmed === true,
      blocker: 'Run suppression before campaign approval.',
    },
    {
      key: 'unsubscribe_footer',
      label: 'Unsubscribe URL and sender business footer confirmed',
      ready: input.unsubscribe_url_confirmed === true && input.sender_footer_confirmed === true,
      blocker: 'Add unsubscribe link and business footer to every email.',
    },
    {
      key: 'seat_capacity',
      label: 'Seat capacity and limited-places claim confirmed',
      ready: input.seat_capacity_confirmed === true,
      blocker: 'Confirm the capacity for Melbourne and Sydney before using urgency claims.',
    },
    {
      key: 'final_approval',
      label: 'Toby final approval recorded before live send',
      ready: input.final_approval_confirmed === true,
      blocker: 'Record Toby approval before SendGrid, CRM or any other delivery tool sends to customers.',
    },
  ];

  const readyCount = items.filter((item) => item.ready).length;
  return {
    campaign_slug: CCW_ROADSHOW_CAMPAIGN_SLUG,
    booking_url: CCW_ROADSHOW_BOOKING_URL,
    owner_email: CCW_ROADSHOW_OWNER_EMAIL,
    distribution_email: CCW_ROADSHOW_DISTRIBUTION_EMAIL,
    ready_for_client_list_send: readyCount === items.length,
    ready_count: readyCount,
    total_count: items.length,
    items,
  };
}
