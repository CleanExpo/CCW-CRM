import { createHash } from 'crypto';

export type CcwCallIntent =
  | 'lead_capture'
  | 'online_sale'
  | 'phone_order'
  | 'service_booking'
  | 'customer_support'
  | 'training'
  | 'newsletter'
  | 'supplier_event'
  | 'human_handoff'
  | 'general_enquiry';

export type CcwConversationInsightDraft = {
  insight_type: 'lead' | 'sales' | 'service' | 'training' | 'campaign' | 'risk' | 'learning';
  label: string;
  detail: string;
  evidence: Record<string, unknown>;
};

export type CcwFollowUpActionDraft = {
  action_type: 'email' | 'sms' | 'phone_task' | 'service_reminder' | 'newsletter' | 'event_invite';
  channel: 'email' | 'sms' | 'phone' | 'system';
  subject: string | null;
  body: string;
  payload: Record<string, unknown>;
};

export type CcwCallTriageDraft = {
  intent: CcwCallIntent;
  outcome: string;
  handoff_required: boolean;
  decision: 'self_serve' | 'draft_follow_up' | 'human_handoff';
  reason: string;
  confidence_score: number;
  insights: CcwConversationInsightDraft[];
  follow_up_actions: CcwFollowUpActionDraft[];
  learning_agent_code: string;
  learning_lesson: string;
};

const INTENT_RULES: Array<{
  intent: CcwCallIntent;
  agentCode: string;
  keywords: string[];
  insightType: CcwConversationInsightDraft['insight_type'];
}> = [
  {
    intent: 'phone_order',
    agentCode: 'orders-agent',
    keywords: ['order', 'buy over the phone', 'purchase', 'invoice me', 'quote'],
    insightType: 'sales',
  },
  {
    intent: 'online_sale',
    agentCode: 'online-sales-agent',
    keywords: ['website', 'shopify', 'online', 'checkout', 'cart'],
    insightType: 'sales',
  },
  {
    intent: 'service_booking',
    agentCode: 'service-booking-agent',
    keywords: ['service', 'repair', 'booking', 'machine', 'maintenance', 'interval'],
    insightType: 'service',
  },
  {
    intent: 'training',
    agentCode: 'carsi-training-agent',
    keywords: ['training', 'carsi', 'course', 'inhouse', 'online class'],
    insightType: 'training',
  },
  {
    intent: 'newsletter',
    agentCode: 'campaign-agent',
    keywords: ['newsletter', 'email campaign', 'updates', 'subscribe'],
    insightType: 'campaign',
  },
  {
    intent: 'supplier_event',
    agentCode: 'industry-events-agent',
    keywords: ['company day', 'trade show', 'supplier', 'award', 'showcase', 'guest speaker'],
    insightType: 'campaign',
  },
  {
    intent: 'lead_capture',
    agentCode: 'lead-capture-agent',
    keywords: ['interested', 'call me back', 'new customer', 'looking for', 'need help choosing'],
    insightType: 'lead',
  },
];

const HANDOFF_KEYWORDS = [
  'complaint',
  'angry',
  'refund',
  'warranty',
  'legal',
  'insurance',
  'dangerous goods',
  'urgent',
  'human',
  'manager',
  'toby',
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function confidenceForMatches(matchCount: number, handoff: boolean) {
  const score = 0.52 + matchCount * 0.08 + (handoff ? 0.08 : 0);
  return Math.min(0.95, Math.round(score * 100) / 100);
}

export function hashCcwCallerNumber(value: string | null | undefined): string | null {
  const phone = value?.trim();
  if (!phone) return null;
  return createHash('sha256').update(phone).digest('hex');
}

export function inferCcwCallTriage(transcript: string, summary?: string | null): CcwCallTriageDraft {
  const text = `${summary ?? ''}\n${transcript}`.toLowerCase();
  const rule =
    INTENT_RULES.find((candidate) => includesAny(text, candidate.keywords)) ??
    ({
      intent: 'general_enquiry',
      agentCode: 'front-desk-agent',
      keywords: [],
      insightType: 'learning',
    } satisfies (typeof INTENT_RULES)[number]);

  const handoff = includesAny(text, HANDOFF_KEYWORDS);
  const matchedKeywords = rule.keywords.filter((keyword) => text.includes(keyword));
  const decision = handoff ? 'human_handoff' : matchedKeywords.length ? 'draft_follow_up' : 'self_serve';
  const confidence = confidenceForMatches(matchedKeywords.length, handoff);
  const outcome = handoff ? 'needs_human_review' : rule.intent === 'general_enquiry' ? 'answered_or_logged' : 'follow_up_drafted';
  const insightLabel = rule.intent === 'general_enquiry' ? 'General call learning' : `${rule.intent.replace(/_/g, ' ')} signal`;
  const evidence = {
    matched_keywords: matchedKeywords,
    decision,
  };
  const insights: CcwConversationInsightDraft[] = [
    {
      insight_type: handoff ? 'risk' : rule.insightType,
      label: insightLabel,
      detail: handoff
        ? 'Caller language matched a human-handoff condition and should be reviewed before any automated reply.'
        : `Conversation matched ${rule.intent.replace(/_/g, ' ')} intent and can be used to improve the relevant playbook.`,
      evidence,
    },
  ];

  return {
    intent: handoff ? 'human_handoff' : rule.intent,
    outcome,
    handoff_required: handoff,
    decision,
    reason: handoff
      ? 'The conversation includes a high-impact or escalation keyword.'
      : matchedKeywords.length
        ? 'The conversation contains enough intent signals to draft a follow-up.'
        : 'No specialised intent matched; keep the call as general learning.',
    confidence_score: confidence,
    insights,
    follow_up_actions: buildCcwFollowUpDrafts(rule.intent, handoff, evidence),
    learning_agent_code: handoff ? 'front-desk-agent' : rule.agentCode,
    learning_lesson:
      matchedKeywords.length > 0
        ? `Watch for ${matchedKeywords.join(', ')} as ${rule.intent.replace(/_/g, ' ')} signals.`
        : 'Review this conversation for new customer language that should improve the front-desk playbook.',
  };
}

function buildCcwFollowUpDrafts(
  intent: CcwCallIntent,
  handoff: boolean,
  evidence: Record<string, unknown>
): CcwFollowUpActionDraft[] {
  if (handoff) {
    return [
      {
        action_type: 'phone_task',
        channel: 'system',
        subject: 'Human review required',
        body: 'Review the call before replying or committing CCW to a customer outcome.',
        payload: { evidence },
      },
    ];
  }

  if (intent === 'service_booking') {
    return [
      {
        action_type: 'service_reminder',
        channel: 'email',
        subject: 'Service booking follow-up',
        body: 'Draft a service booking follow-up and ask for machine details, preferred time, and urgency.',
        payload: { evidence },
      },
    ];
  }

  if (intent === 'supplier_event') {
    return [
      {
        action_type: 'event_invite',
        channel: 'email',
        subject: 'CCW company day opportunity',
        body: 'Draft a company day or industry showcase follow-up for Toby to review.',
        payload: { evidence },
      },
    ];
  }

  if (intent === 'training') {
    return [
      {
        action_type: 'email',
        channel: 'email',
        subject: 'CARSI training follow-up',
        body: 'Draft a CARSI training reply with inhouse and online training options.',
        payload: { evidence },
      },
    ];
  }

  if (intent === 'newsletter') {
    return [
      {
        action_type: 'newsletter',
        channel: 'email',
        subject: 'Newsletter opt-in follow-up',
        body: 'Draft an opt-in follow-up before adding this contact to any campaign list.',
        payload: { evidence },
      },
    ];
  }

  if (intent === 'phone_order' || intent === 'online_sale' || intent === 'lead_capture') {
    return [
      {
        action_type: 'email',
        channel: 'email',
        subject: 'Sales follow-up',
        body: 'Draft a sales follow-up that routes the customer toward online checkout or a reviewed phone order.',
        payload: { evidence },
      },
    ];
  }

  return [];
}

export function defaultCcwSpecializedAgent(agentCode: string) {
  const name = agentCode
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    agent_code: agentCode,
    name,
    purpose:
      'Review CCW conversations, improve approved playbooks, and draft owner-reviewed actions without sending them automatically.',
    persona: {
      tone: 'helpful, commercially aware, concise',
      guardrails: ['use approved knowledge only', 'draft actions for human approval', 'handoff consequential decisions'],
    },
    playbook: {
      channels: ['phone', 'email', 'system'],
      learning_sources: ['phone_conversation', 'owner_review'],
    },
  };
}
