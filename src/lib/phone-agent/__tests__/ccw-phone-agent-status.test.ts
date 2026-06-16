import { describe, expect, it } from 'vitest';
import { getCcwPhoneAgentPilotStatus } from '../ccw-phone-agent-status';

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...overrides };
}

describe('getCcwPhoneAgentPilotStatus', () => {
  it('defaults to disabled with safe call recording and outbound settings', () => {
    const status = getCcwPhoneAgentPilotStatus(env());

    expect(status.mode).toBe('disabled');
    expect(status.ready_for_inbound_pilot).toBe(false);
    expect(status.safety_defaults.outbound_ai_calling_enabled).toBe(false);
    expect(status.safety_defaults.call_recording_enabled).toBe(false);
  });

  it('shows not_configured when features are enabled but provider secrets are missing', () => {
    const status = getCcwPhoneAgentPilotStatus(
      env({
        FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT: 'true',
        FEATURE_CCW_AI_PHONE_AGENT: 'true',
        FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS: 'true',
      })
    );

    expect(status.mode).toBe('not_configured');
    expect(status.ready_for_inbound_pilot).toBe(false);
    expect(status.provider_config.missing_env).toContain('ELEVENLABS_API_KEY');
    expect(status.provider_config.missing_env).toContain('TWILIO_PHONE_NUMBER');
    expect(status.provider_config.missing_env).toContain('PHONE_AGENT_OWNER_USER_ID');
  });

  it('is ready for inbound after-hours pilot when all required env values are present', () => {
    const status = getCcwPhoneAgentPilotStatus(
      env({
        FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT: 'true',
        FEATURE_CCW_AI_PHONE_AGENT: 'true',
        FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS: 'true',
        ELEVENLABS_API_KEY: 'configured',
        ELEVENLABS_AGENT_ID: 'agent-123',
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_PHONE_NUMBER: '+61200000000',
        PHONE_AGENT_WEBHOOK_SECRET: 'secret',
        PHONE_AGENT_OWNER_USER_ID: '11111111-1111-4111-8111-111111111111',
        PHONE_AGENT_PUBLIC_BASE_URL: 'https://ccw.example.com',
      })
    );

    expect(status.ready_for_inbound_pilot).toBe(true);
    expect(status.mode).toBe('after_hours_overflow_pilot');
    expect(status.provider_config.missing_env).toEqual([]);
    expect(status.safety_defaults.outbound_ai_calling_enabled).toBe(false);
    expect(status.safety_defaults.call_recording_enabled).toBe(false);
    expect(status.provider_config.webhook_urls.twilio_voice_url).toBe(
      'https://ccw.example.com/api/phone-agent/webhooks/twilio/voice'
    );
  });

  it('does not treat outbound and recording feature flags as automatic approval', () => {
    const status = getCcwPhoneAgentPilotStatus(
      env({
        FEATURE_CCW_AI_PHONE_AGENT_OUTBOUND: 'true',
        FEATURE_CCW_AI_PHONE_RECORDING: 'true',
      })
    );

    expect(status.feature_flags.ai_phone_agent_outbound_enabled).toBe(true);
    expect(status.feature_flags.ai_phone_recording_enabled).toBe(true);
    expect(status.safety_defaults.outbound_ai_calling_enabled).toBe(false);
    expect(status.safety_defaults.call_recording_enabled).toBe(false);
    expect(status.safety_defaults.approval_required_before).toContain('outbound AI calling');
    expect(status.safety_defaults.approval_required_before).toContain('call recording');
  });

  it('does not treat outbound and recording feature flags as automatic approval', () => {
    const status = getCcwPhoneAgentPilotStatus(
      env({
        FEATURE_CCW_AI_PHONE_AGENT_OUTBOUND: 'true',
        FEATURE_CCW_AI_PHONE_RECORDING: 'true',
      })
    );

    expect(status.feature_flags.ai_phone_agent_outbound_enabled).toBe(true);
    expect(status.feature_flags.ai_phone_recording_enabled).toBe(true);
    expect(status.safety_defaults.outbound_ai_calling_enabled).toBe(false);
    expect(status.safety_defaults.call_recording_enabled).toBe(false);
    expect(status.safety_defaults.approval_required_before).toContain('outbound AI calling');
    expect(status.safety_defaults.approval_required_before).toContain('call recording');
  });
});
