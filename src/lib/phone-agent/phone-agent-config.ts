import type { CcwPhoneAgentPilotStatus } from './ccw-phone-agent-status';

export type CcwPhoneAgentStoredConfig = {
  approved_knowledge_only: boolean;
  recording_requested: boolean;
  outbound_requested: boolean;
  human_handoff_required_for: string[];
  notes: string | null;
};

export type CcwPhoneAgentConfigInput = {
  status?: unknown;
  approvedKnowledgeOnly?: unknown;
  approved_knowledge_only?: unknown;
  recordingRequested?: unknown;
  recording_requested?: unknown;
  outboundRequested?: unknown;
  outbound_requested?: unknown;
  humanHandoffRequiredFor?: unknown;
  human_handoff_required_for?: unknown;
  notes?: unknown;
};

const CONFIG_STATUSES = new Set(['disabled', 'draft', 'pilot_requested', 'pilot_approved']);

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
    if (['false', '0', 'no', 'off'].includes(normalised)) return false;
  }
  return fallback;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 2000) : null;
}

function textList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length ? Array.from(new Set(cleaned)).slice(0, 20) : fallback;
}

export function normaliseCcwPhoneAgentConfigInput(
  input: CcwPhoneAgentConfigInput,
  defaults: CcwPhoneAgentStoredConfig
): { status: string; config: CcwPhoneAgentStoredConfig } {
  const requestedStatus = typeof input.status === 'string' ? input.status.trim() : '';
  const status = CONFIG_STATUSES.has(requestedStatus) ? requestedStatus : 'draft';
  const handoffInput = input.humanHandoffRequiredFor ?? input.human_handoff_required_for;

  return {
    status,
    config: {
      approved_knowledge_only: bool(
        input.approvedKnowledgeOnly ?? input.approved_knowledge_only,
        defaults.approved_knowledge_only
      ),
      recording_requested: bool(input.recordingRequested ?? input.recording_requested, defaults.recording_requested),
      outbound_requested: bool(input.outboundRequested ?? input.outbound_requested, defaults.outbound_requested),
      human_handoff_required_for: textList(handoffInput, defaults.human_handoff_required_for),
      notes: text(input.notes) ?? defaults.notes,
    },
  };
}

export function buildCcwPhoneAgentConfigResponse(
  storedStatus: string | null,
  storedConfig: Partial<CcwPhoneAgentStoredConfig> | null,
  pilotStatus: CcwPhoneAgentPilotStatus
) {
  const defaults: CcwPhoneAgentStoredConfig = {
    approved_knowledge_only: true,
    recording_requested: false,
    outbound_requested: false,
    human_handoff_required_for: pilotStatus.safety_defaults.human_handoff_required_for,
    notes: null,
  };

  const config: CcwPhoneAgentStoredConfig = {
    ...defaults,
    ...storedConfig,
    human_handoff_required_for: textList(
      storedConfig?.human_handoff_required_for,
      defaults.human_handoff_required_for
    ),
  };

  return {
    feature_slug: 'ccw_ai_phone_agent',
    status: storedStatus || 'draft',
    config,
    pilot_status: pilotStatus,
    effective_safety: {
      approved_knowledge_only: config.approved_knowledge_only,
      outbound_ai_calling_enabled: false,
      call_recording_enabled: false,
      recording_requested: config.recording_requested,
      outbound_requested: config.outbound_requested,
      human_handoff_required_for: config.human_handoff_required_for,
      approval_required_before: pilotStatus.safety_defaults.approval_required_before,
    },
  };
}
