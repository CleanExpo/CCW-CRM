import { describe, expect, it } from 'vitest';
import {
  defaultCcwSpecializedAgent,
  hashCcwCallerNumber,
  inferCcwCallTriage,
} from '../conversation-intelligence';

describe('inferCcwCallTriage', () => {
  it('drafts service follow-up from service booking language', () => {
    const result = inferCcwCallTriage(
      'Customer wants to book a machine service and asks about the maintenance interval.'
    );

    expect(result.intent).toBe('service_booking');
    expect(result.handoff_required).toBe(false);
    expect(result.decision).toBe('draft_follow_up');
    expect(result.follow_up_actions[0]).toMatchObject({
      action_type: 'service_reminder',
      channel: 'email',
    });
    expect(result.learning_agent_code).toBe('service-booking-agent');
  });

  it('forces human handoff for escalation language', () => {
    const result = inferCcwCallTriage('The caller is angry about a warranty dispute and wants Toby.');

    expect(result.intent).toBe('human_handoff');
    expect(result.handoff_required).toBe(true);
    expect(result.decision).toBe('human_handoff');
    expect(result.insights[0].insight_type).toBe('risk');
  });

  it('captures company day and industry event opportunities', () => {
    const result = inferCcwCallTriage('Supplier wants to speak at a CCW company day showcase.');

    expect(result.intent).toBe('supplier_event');
    expect(result.follow_up_actions[0].action_type).toBe('event_invite');
    expect(result.learning_agent_code).toBe('industry-events-agent');
  });
});

describe('hashCcwCallerNumber', () => {
  it('hashes caller numbers instead of returning raw phone data', () => {
    const hashed = hashCcwCallerNumber('+61 400 000 000');

    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain('400');
  });
});

describe('defaultCcwSpecializedAgent', () => {
  it('creates a human-gated specialised agent seed', () => {
    const agent = defaultCcwSpecializedAgent('lead-capture-agent');

    expect(agent.name).toBe('Lead Capture Agent');
    expect(agent.persona.guardrails).toContain('draft actions for human approval');
  });
});
