import { getIntegrationDiagnostics, type IntegrationDiagnostic } from '@/lib/integrations/diagnostics';

export type CcwConnectionState = 'connected' | 'ready' | 'mock' | 'blocked' | 'unknown';

export type CcwConnection = {
  id: string;
  label: string;
  state: CcwConnectionState;
  safeForMissionControl: boolean;
  detail: string;
  endpoint?: string;
  nextAction?: string;
};

export type CcwConnectionStatus = {
  source: 'ccw-erp:connection-status';
  generatedAt: string;
  project: {
    slug: 'ccw-erp';
    repo: 'CleanExpo/CCW-CRM';
    service: 'ccw-online-erp';
    environment: string;
  };
  summary: Record<CcwConnectionState, number> & { total: number };
  connections: CcwConnection[];
};

function envSet(name: string, env: NodeJS.ProcessEnv): boolean {
  return Boolean(env[name]?.trim());
}

/**
 * Map an existing IntegrationDiagnostic into the Mission Control connection
 * shape. Integrations cap at "ready" (live use stays gated), demo mode is
 * reported honestly as "mock", and any error-level check means "blocked".
 */
function diagnosticToConnection(diag: IntegrationDiagnostic): CcwConnection {
  const firstProblem = diag.checks.find((c) => c.level !== 'ok');
  let state: CcwConnectionState;
  if (diag.level === 'error') {
    state = 'blocked';
  } else if (diag.mode === 'demo') {
    state = 'mock';
  } else if (diag.liveReady) {
    state = 'ready';
  } else {
    state = 'unknown';
  }

  return {
    id: diag.key,
    label: diag.label,
    state,
    safeForMissionControl: true,
    detail:
      state === 'mock'
        ? `${diag.label} is in demo mode; no live provider calls are made.`
        : diag.checks[0]?.message ?? `${diag.label} diagnostic reported no checks.`,
    nextAction: firstProblem ? firstProblem.message : undefined,
  };
}

function connectionSummary(connections: CcwConnection[]): CcwConnectionStatus['summary'] {
  return {
    total: connections.length,
    connected: connections.filter((c) => c.state === 'connected').length,
    ready: connections.filter((c) => c.state === 'ready').length,
    mock: connections.filter((c) => c.state === 'mock').length,
    blocked: connections.filter((c) => c.state === 'blocked').length,
    unknown: connections.filter((c) => c.state === 'unknown').length,
  };
}

/**
 * Presence-only readiness manifest for Unite-Group Mission Control polling.
 * Reuses getIntegrationDiagnostics() for provider integrations and adds the
 * boot-critical infrastructure entries it does not cover. Never includes
 * secret values — env names and presence booleans only.
 */
export function buildCcwConnectionStatus(
  env: NodeJS.ProcessEnv = process.env,
  diagnostics: IntegrationDiagnostic[] = getIntegrationDiagnostics(),
  now = new Date().toISOString(),
): CcwConnectionStatus {
  const environment = env.VERCEL_ENV?.trim() || env.NODE_ENV?.trim() || 'development';

  const databaseReady = envSet('DATABASE_URL', env);
  const authReady = envSet('JWT_SECRET_KEY', env);
  const sentryReady = envSet('SENTRY_DSN', env) || envSet('NEXT_PUBLIC_SENTRY_DSN', env);
  const openAiReady = envSet('OPENAI_API_KEY', env);
  const cronReady = envSet('CRON_SECRET', env);

  const infra: CcwConnection[] = [
    {
      id: 'database',
      label: 'Primary database (Prisma/Postgres)',
      state: databaseReady ? 'connected' : 'blocked',
      safeForMissionControl: true,
      detail: databaseReady
        ? 'DATABASE_URL is configured; metadata only exposed.'
        : 'DATABASE_URL is not set — Prisma cannot connect.',
      nextAction: databaseReady ? undefined : 'Set DATABASE_URL in the deploy environment.',
    },
    {
      id: 'auth',
      label: 'Authentication (JWT)',
      state: authReady ? 'connected' : 'blocked',
      safeForMissionControl: true,
      detail: authReady
        ? 'JWT secret present.'
        : 'JWT_SECRET_KEY is not set — sign-in cannot issue tokens.',
      nextAction: authReady ? undefined : 'Set JWT_SECRET_KEY.',
    },
    {
      id: 'crons',
      label: 'Scheduled jobs (Vercel crons)',
      state: cronReady ? 'ready' : 'blocked',
      safeForMissionControl: true,
      detail: cronReady
        ? 'CRON_SECRET present; 16 schedules (incl. shadow-sync-cin7/xero) registered in vercel.json. Whether the Vercel project has them enabled must be confirmed in the dashboard.'
        : 'CRON_SECRET is not set — cron routes reject their scheduler.',
      nextAction: cronReady
        ? 'Confirm cron enablement in the Vercel project settings.'
        : 'Set CRON_SECRET in the deploy environment.',
    },
    {
      id: 'sentry',
      label: 'Error monitoring (Sentry)',
      state: sentryReady ? 'connected' : 'unknown',
      safeForMissionControl: true,
      detail: sentryReady
        ? 'Sentry DSN present.'
        : 'No Sentry DSN detected — errors are not being reported.',
      nextAction: sentryReady ? undefined : 'Set SENTRY_DSN (and NEXT_PUBLIC_SENTRY_DSN).',
    },
    {
      id: 'ai_openai',
      label: 'OpenAI (quote copilot)',
      state: openAiReady ? 'ready' : 'blocked',
      safeForMissionControl: true,
      detail: openAiReady
        ? 'OpenAI key present; copilot endpoints can run (billing applies on use).'
        : 'OPENAI_API_KEY is not set — /api/ai/copilot/* returns 503.',
      nextAction: openAiReady ? undefined : 'Set OPENAI_API_KEY.',
    },
  ];

  const connections: CcwConnection[] = [
    ...infra,
    ...diagnostics.map(diagnosticToConnection),
    {
      id: 'unite_group',
      label: 'Unite-Group Mission Control',
      state: 'ready',
      safeForMissionControl: true,
      detail:
        'This manifest is designed for Unite-Group to poll and show CCW-ERP readiness without secrets.',
      endpoint: '/api/v1/connections/status',
      nextAction: 'Add this endpoint to the Unite-Group project registry.',
    },
  ];

  return {
    source: 'ccw-erp:connection-status',
    generatedAt: now,
    project: {
      slug: 'ccw-erp',
      repo: 'CleanExpo/CCW-CRM',
      service: 'ccw-online-erp',
      environment,
    },
    summary: connectionSummary(connections),
    connections,
  };
}
