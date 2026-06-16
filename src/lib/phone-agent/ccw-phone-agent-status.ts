export type CcwPhoneAgentFeatureFlags = {
  feasibility_addon_enabled: boolean;
  feasibility_dashboard_enabled: boolean;
  parcel_collection_scenarios_enabled: boolean;
  ai_phone_agent_enabled: boolean;
  ai_phone_agent_after_hours_enabled: boolean;
  ai_phone_agent_outbound_enabled: boolean;
  ai_phone_recording_enabled: boolean;
};

export type CcwPhoneAgentProviderConfig = {
  elevenlabs_api_key_configured: boolean;
  elevenlabs_agent_configured: boolean;
  twilio_account_configured: boolean;
  twilio_phone_number_configured: boolean;
  webhook_secret_configured: boolean;
  missing_env: string[];
};

export type CcwPhoneAgentPilotStatus = {
  ready_for_inbound_pilot: boolean;
  mode: 'disabled' | 'not_configured' | 'after_hours_overflow_pilot';
  feature_flags: CcwPhoneAgentFeatureFlags;
  provider_config: CcwPhoneAgentProviderConfig;
  safety_defaults: {
    outbound_ai_calling_enabled: boolean;
    call_recording_enabled: boolean;
    human_handoff_required_for: string[];
  };
};

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);

function envFlag(env: NodeJS.ProcessEnv, name: string, fallback = false): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return TRUE_VALUES.has(raw);
}

function hasEnv(env: NodeJS.ProcessEnv, name: string): boolean {
  return Boolean(env[name]?.trim());
}

export function getCcwPhoneAgentPilotStatus(
  env: NodeJS.ProcessEnv = process.env
): CcwPhoneAgentPilotStatus {
  const featureFlags: CcwPhoneAgentFeatureFlags = {
    feasibility_addon_enabled: envFlag(env, 'FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT'),
    feasibility_dashboard_enabled: envFlag(env, 'FEATURE_CCW_FEASIBILITY_DASHBOARD'),
    parcel_collection_scenarios_enabled: envFlag(env, 'FEATURE_CCW_PARCEL_COLLECTION_SCENARIOS'),
    ai_phone_agent_enabled: envFlag(env, 'FEATURE_CCW_AI_PHONE_AGENT'),
    ai_phone_agent_after_hours_enabled: envFlag(env, 'FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS'),
    ai_phone_agent_outbound_enabled: envFlag(env, 'FEATURE_CCW_AI_PHONE_AGENT_OUTBOUND'),
    ai_phone_recording_enabled: envFlag(env, 'FEATURE_CCW_AI_PHONE_RECORDING'),
  };

  const requiredEnv = [
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_AGENT_ID',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'PHONE_AGENT_WEBHOOK_SECRET',
  ];
  const missingEnv = requiredEnv.filter((name) => !hasEnv(env, name));

  const providerConfig: CcwPhoneAgentProviderConfig = {
    elevenlabs_api_key_configured: hasEnv(env, 'ELEVENLABS_API_KEY'),
    elevenlabs_agent_configured: hasEnv(env, 'ELEVENLABS_AGENT_ID'),
    twilio_account_configured: hasEnv(env, 'TWILIO_ACCOUNT_SID') && hasEnv(env, 'TWILIO_AUTH_TOKEN'),
    twilio_phone_number_configured: hasEnv(env, 'TWILIO_PHONE_NUMBER'),
    webhook_secret_configured: hasEnv(env, 'PHONE_AGENT_WEBHOOK_SECRET'),
    missing_env: missingEnv,
  };

  const readyForInboundPilot =
    featureFlags.feasibility_addon_enabled &&
    featureFlags.ai_phone_agent_enabled &&
    featureFlags.ai_phone_agent_after_hours_enabled &&
    missingEnv.length === 0;

  const anyFeatureEnabled =
    featureFlags.feasibility_addon_enabled ||
    featureFlags.ai_phone_agent_enabled ||
    featureFlags.ai_phone_agent_after_hours_enabled;

  return {
    ready_for_inbound_pilot: readyForInboundPilot,
    mode: readyForInboundPilot
      ? 'after_hours_overflow_pilot'
      : anyFeatureEnabled
        ? 'not_configured'
        : 'disabled',
    feature_flags: featureFlags,
    provider_config: providerConfig,
    safety_defaults: {
      outbound_ai_calling_enabled: featureFlags.ai_phone_agent_outbound_enabled,
      call_recording_enabled: featureFlags.ai_phone_recording_enabled,
      human_handoff_required_for: [
        'pricing exceptions',
        'complaints',
        'warranty disputes',
        'dangerous goods questions',
        'complex machine service or install questions',
      ],
    },
  };
}
