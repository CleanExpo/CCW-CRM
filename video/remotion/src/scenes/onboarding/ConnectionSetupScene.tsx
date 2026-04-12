/**
 * Onboarding Scene 4 — Connection Setup (Step-by-Step)
 * Covers: env vars, Supabase, Cin7, Xero, Vercel/Railway
 * Duration: ~90 seconds (2700 frames @ 30fps)
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Sequence } from 'remotion';

interface Step {
  number: string;
  service: string;
  color: string;
  icon: React.ReactNode;
  title: string;
  envVars: { key: string; value: string }[];
  instructions: string[];
}

/* ── Styled icon components (replace all emoji usage) ── */

/** Branded letter-circle: a colored circle with a bold white letter inside */
const LetterCircle: React.FC<{ letter: string; bg: string }> = ({ letter, bg }) => (
  <div
    style={{
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 22,
      fontWeight: 900,
      color: '#ffffff',
      fontFamily: 'Inter, sans-serif',
      flexShrink: 0,
    }}
  >
    {letter}
  </div>
);

/** Geometric database icon: stacked rounded rectangles */
const DatabaseIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <ellipse cx="22" cy="12" rx="14" ry="6" fill={color} opacity={0.9} />
    <path
      d="M8 12v8c0 3.3 6.3 6 14 6s14-2.7 14-6v-8"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
    />
    <path
      d="M8 20v8c0 3.3 6.3 6 14 6s14-2.7 14-6v-8"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
    />
    <ellipse cx="22" cy="20" rx="14" ry="6" fill={color} opacity={0.25} />
  </svg>
);

/** Geometric box icon: an open-top 3D box shape */
const BoxIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect
      x="8"
      y="14"
      width="28"
      height="22"
      rx="3"
      fill={color}
      opacity={0.15}
      stroke={color}
      strokeWidth="2.5"
    />
    <path d="M8 20h28" stroke={color} strokeWidth="2.5" />
    <path d="M18 14v6" stroke={color} strokeWidth="2.5" />
    <path d="M26 14v6" stroke={color} strokeWidth="2.5" />
    <rect
      x="14"
      y="8"
      width="16"
      height="6"
      rx="2"
      fill={color}
      opacity={0.5}
      stroke={color}
      strokeWidth="2"
    />
  </svg>
);

/** Geometric ledger icon: a stylised open book / ledger */
const LedgerIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect
      x="6"
      y="8"
      width="32"
      height="28"
      rx="3"
      fill={color}
      opacity={0.12}
      stroke={color}
      strokeWidth="2.5"
    />
    <line x1="22" y1="8" x2="22" y2="36" stroke={color} strokeWidth="2" />
    <line x1="12" y1="16" x2="19" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="22" x2="19" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="28" x2="19" y2="28" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="25" y1="16" x2="32" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="25" y1="22" x2="32" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="25" y1="28" x2="32" y2="28" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Geometric deploy / arrow-up icon: an upward arrow inside a rounded square */
const DeployIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect
      x="6"
      y="6"
      width="32"
      height="32"
      rx="8"
      fill={color}
      opacity={0.12}
      stroke={color}
      strokeWidth="2.5"
    />
    <path d="M22 32V14" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <path
      d="M15 21l7-7 7 7"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const STEPS: Step[] = [
  {
    number: '01',
    service: 'Supabase',
    color: '#3ecf8e',
    icon: <DatabaseIcon color="#3ecf8e" />,
    title: 'Connect Your Database',
    envVars: [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', value: 'https://xxxx.supabase.co' },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: 'eyJhbGci...' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', value: 'eyJhbGci...' },
    ],
    instructions: [
      'Go to supabase.com and create a new project',
      'Copy Project URL from Settings → API',
      'Copy anon key and service_role key',
      'Add all three to both frontend and backend .env files',
    ],
  },
  {
    number: '02',
    service: 'Cin7',
    color: '#f59e0b',
    icon: <BoxIcon color="#f59e0b" />,
    title: 'Connect Inventory System',
    envVars: [
      { key: 'CIN7_API_URL', value: 'https://inventory.dearsystems.com/ExternalApi/v2' },
      { key: 'CIN7_API_KEY', value: 'your-cin7-api-key' },
      { key: 'CIN7_MODE', value: 'live' },
    ],
    instructions: [
      'Log into Cin7 Core → Settings → API Settings',
      'Copy your API Key (or create a new one)',
      'Set CIN7_MODE to "demo" for testing, "live" for production',
      'First sync will import all products + customers automatically',
    ],
  },
  {
    number: '03',
    service: 'Xero',
    color: '#10b981',
    icon: <LedgerIcon color="#10b981" />,
    title: 'Connect Accounting',
    envVars: [
      { key: 'XERO_CLIENT_ID', value: 'your-xero-client-id' },
      { key: 'XERO_CLIENT_SECRET', value: 'your-xero-client-secret' },
      { key: 'XERO_REDIRECT_URI', value: 'https://your-backend.railway.app/api/xero/callback' },
    ],
    instructions: [
      'Go to developer.xero.com → My Apps → New App',
      'Set Redirect URI to your Railway backend /api/xero/callback',
      'Copy Client ID and Client Secret',
      'Navigate to CCW Settings → Integrations → Xero → Connect',
    ],
  },
  {
    number: '04',
    service: 'Vercel + Railway',
    color: '#a855f7',
    icon: <DeployIcon color="#a855f7" />,
    title: 'Deploy to Production',
    envVars: [
      { key: 'NEXT_PUBLIC_BACKEND_URL', value: 'https://your-backend.railway.app' },
      { key: 'SECRET_KEY', value: 'generate-a-secure-random-string' },
      { key: 'DATABASE_URL', value: 'postgresql://...(from Supabase)' },
    ],
    instructions: [
      'Railway: New Project → Deploy from GitHub → select CCW-CRM/apps/backend',
      'Add all backend env vars to Railway dashboard',
      'Vercel: New Project → Import CCW-CRM → set root to apps/web',
      'Add NEXT_PUBLIC_BACKEND_URL pointing to your Railway URL',
    ],
  },
];

const StepCard: React.FC<{ step: Step; visible: boolean }> = ({ step, visible }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: 'clamp' });
  const slideX = interpolate(frame, [0, fps * 0.4], [-40, 0], { extrapolateRight: 'clamp' });

  const instrOpacity = (i: number) =>
    interpolate(frame, [fps * (0.5 + i * 0.25), fps * (0.8 + i * 0.25)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  if (!visible) return null;

  return (
    <AbsoluteFill
      style={{
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'Inter, sans-serif',
        opacity,
      }}
    >
      {/* Left: Step info */}
      <div
        style={{
          width: 480,
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          transform: `translateX(${slideX}px)`,
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: `${step.color}22`,
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          {step.number}
        </div>
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>{step.icon}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: step.color, marginBottom: 8 }}>
          {step.service}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.2,
            marginBottom: 24,
          }}
        >
          {step.title}
        </div>

        {/* Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {step.instructions.map((inst, i) => (
            <div
              key={i}
              style={{
                opacity: instrOpacity(i),
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: step.color,
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 16, color: '#cbd5e1', lineHeight: 1.5 }}>{inst}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Env vars */}
      <div
        style={{
          flex: 1,
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: '#475569',
            letterSpacing: 4,
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          Environment Variables
        </div>
        <div
          style={{
            background: '#020617',
            borderRadius: 12,
            padding: '32px',
            border: `1px solid ${step.color}44`,
          }}
        >
          {step.envVars.map((env, i) => (
            <div
              key={env.key}
              style={{
                opacity: instrOpacity(i),
                marginBottom: i < step.envVars.length - 1 ? 20 : 0,
              }}
            >
              <div
                style={{ fontSize: 13, color: '#60a5fa', fontFamily: 'monospace', marginBottom: 4 }}
              >
                {env.key}=
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '8px 14px',
                  borderRadius: 6,
                  borderLeft: `3px solid ${step.color}`,
                }}
              >
                {env.value}
              </div>
            </div>
          ))}
        </div>

        {/* Progress indicator */}
        <div style={{ marginTop: 48, display: 'flex', gap: 8 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.number}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background: s.number === step.number ? step.color : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
          Step {step.number} of {STEPS.length}
        </div>
      </div>

      {/* Bottom accent */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
        }}
      />
    </AbsoluteFill>
  );
};

export const ConnectionSetupScene: React.FC = () => {
  const { fps } = useVideoConfig();
  const STEP_DURATION = fps * 20; // 20 seconds per step

  return (
    <AbsoluteFill>
      {STEPS.map((step, i) => (
        <Sequence key={step.number} from={i * STEP_DURATION} durationInFrames={STEP_DURATION}>
          <StepCard step={step} visible />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
