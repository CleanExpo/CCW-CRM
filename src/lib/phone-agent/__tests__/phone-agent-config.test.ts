import { describe, expect, it } from 'vitest';
import { getCcwPhoneAgentPilotStatus } from '../ccw-phone-agent-status';
import {
  buildCcwPhoneAgentConfigResponse,
  normaliseCcwPhoneAgentConfigInput,
  type CcwPhoneAgentStoredConfig,
} from '../phone-agent-config';

const defaults: CcwPhoneAgentStoredConfig = {
  approved_knowledge_only: true,
  recording_requested: false,
  outbound_requested: false,
  human_handoff_required_for: ['complaints'],
  notes: null,
};

describe('normaliseCcwPhoneAgentConfigInput', () => {
  it('keeps outbound and recording as requests, not effective approvals', () => {
    const result = normaliseCcwPhoneAgentConfigInput(
      {
        status: 'pilot_requested',
        recording_requested: true,
        outbound_requested: true,
        human_handoff_required_for: ['pricing exceptions', 'complaints', 'complaints'],
      },
      defaults
    );

    expect(result.status).toBe('pilot_requested');
    expect(result.config.recording_requested).toBe(true);
    expect(result.config.outbound_requested).toBe(true);
    expect(result.config.human_handoff_required_for).toEqual(['pricing exceptions', 'complaints']);
  });

  it('falls back to safe defaults for unknown status and empty handoff lists', () => {
    const result = normaliseCcwPhoneAgentConfigInput(
      { status: 'live_without_review', human_handoff_required_for: [] },
      defaults
    );

    expect(result.status).toBe('draft');
    expect(result.config.approved_knowledge_only).toBe(true);
    expect(result.config.human_handoff_required_for).toEqual(['complaints']);
  });
});

describe('buildCcwPhoneAgentConfigResponse', () => {
  it('never exposes requested outbound or recording as enabled safety settings', () => {
    const response = buildCcwPhoneAgentConfigResponse(
      'pilot_requested',
      {
        recording_requested: true,
        outbound_requested: true,
        approved_knowledge_only: true,
      },
      getCcwPhoneAgentPilotStatus({ NODE_ENV: 'test' })
    );

    expect(response.effective_safety.recording_requested).toBe(true);
    expect(response.effective_safety.outbound_requested).toBe(true);
    expect(response.effective_safety.call_recording_enabled).toBe(false);
    expect(response.effective_safety.outbound_ai_calling_enabled).toBe(false);
  });
});
