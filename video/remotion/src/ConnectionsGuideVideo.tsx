import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ConnectionsIntroScene } from './scenes/connections/ConnectionsIntroScene';
import { ConnectionStepScene } from './scenes/connections/ConnectionStepScene';
import { VerificationScene } from './scenes/connections/VerificationScene';
import { AllConnectedScene } from './scenes/connections/AllConnectedScene';

// 300s @ 30fps = 9000 frames
export const CONNECTIONS_TOTAL_FRAMES = 9000;

const cin7Steps = [
  'Log in to app.cin7.com',
  'Go to Settings → Integrations → API',
  'Click "Generate API Key"',
  'Copy your API Key + Company ID',
  'In CCW: Settings → Integrations → Cin7',
  'Paste both values → Save → Test Connection',
];
const cin7Env = ['CIN7_API_KEY=your_api_key_here', 'CIN7_COMPANY_ID=your_company_id', 'CIN7_MODE=live'];

const xeroSteps = [
  'Go to developer.xero.com → My Apps',
  'Click "New App" → Web App',
  'Add redirect URI: https://your-domain.vercel.app/api/auth/xero/callback',
  'Copy Client ID + Client Secret',
  'In CCW: Settings → Integrations → Xero',
  'Paste Client ID + Secret → Save',
];
const xeroEnv = ['XERO_CLIENT_ID=your_client_id', 'XERO_CLIENT_SECRET=your_client_secret', 'XERO_REDIRECT_URI=https://your-domain.vercel.app/api/auth/xero/callback'];

const supabaseSteps = [
  'Go to supabase.com → Your Project',
  'Click Settings (gear icon, left sidebar)',
  'Click "API" under Configuration',
  'Copy Project URL',
  'Copy anon/public key',
  'Copy service_role key (keep this secret!)',
];
const supabaseEnv = ['NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co', 'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...', 'SUPABASE_SERVICE_ROLE_KEY=eyJ...'];

const vercelSteps = [
  'Go to vercel.com → Your Project',
  'Click Settings → Environment Variables',
  'Add: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL',
  'Go to railway.app → Your Backend Service',
  'Click Variables tab',
  'Add: DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CIN7_API_KEY, XERO_CLIENT_SECRET, SECRET_KEY',
];
const vercelEnv = ['NEXT_PUBLIC_BACKEND_URL=https://[your-railway-service].railway.app', 'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co', 'SECRET_KEY=your_secret_key', 'DATABASE_URL=postgresql://...'];

export const ConnectionsGuideVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Intro: 0–600f (20s) */}
      <Sequence from={0} durationInFrames={600}>
        <ConnectionsIntroScene />
      </Sequence>

      {/* Cin7: 600–2100f (50s) */}
      <Sequence from={600} durationInFrames={1500}>
        <ConnectionStepScene stepNumber="01 / 05" serviceName="Cin7 Core" accentColor="#f59e0b" serviceIcon="📦" steps={cin7Steps} envVars={cin7Env} />
      </Sequence>

      {/* Xero: 2100–3600f (50s) */}
      <Sequence from={2100} durationInFrames={1500}>
        <ConnectionStepScene stepNumber="02 / 05" serviceName="Xero" accentColor="#10b981" serviceIcon="💼" steps={xeroSteps} envVars={xeroEnv} />
      </Sequence>

      {/* Supabase: 3600–5100f (50s) */}
      <Sequence from={3600} durationInFrames={1500}>
        <ConnectionStepScene stepNumber="03 / 05" serviceName="Supabase" accentColor="#3ecf8e" serviceIcon="🗄️" steps={supabaseSteps} envVars={supabaseEnv} warning="⚠️ Service Role Key has full database access. Never put in frontend code." />
      </Sequence>

      {/* Vercel + Railway: 5100–6900f (60s) */}
      <Sequence from={5100} durationInFrames={1800}>
        <ConnectionStepScene stepNumber="04 / 05" serviceName="Vercel + Railway" accentColor="#a855f7" serviceIcon="🚀" steps={vercelSteps} envVars={vercelEnv} />
      </Sequence>

      {/* Verification: 6900–8100f (40s) */}
      <Sequence from={6900} durationInFrames={1200}>
        <VerificationScene />
      </Sequence>

      {/* All Connected: 8100–9000f (30s) */}
      <Sequence from={8100} durationInFrames={900}>
        <AllConnectedScene />
      </Sequence>
    </AbsoluteFill>
  );
};
