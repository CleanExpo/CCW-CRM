import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ConnectionsIntroScene } from './scenes/connections/ConnectionsIntroScene';
import { ConnectionStepScene } from './scenes/connections/ConnectionStepScene';
import { VerificationScene } from './scenes/connections/VerificationScene';
import { AllConnectedScene } from './scenes/connections/AllConnectedScene';

// 300s @ 30fps = 9000 frames
export const CONNECTIONS_TOTAL_FRAMES = 9000;

// CCW has built its own inventory platform — Shopify is the e-commerce sync integration
const shopifySteps = [
  'Go to your Shopify Admin → Settings → Apps and sales channels',
  'Click "Develop apps" → Create a new private app',
  'Enable read/write access for Orders, Products, Inventory',
  'Copy the Admin API access token',
  'In CCW: Settings → Integrations → Shopify',
  'Paste your token → Save → Import Orders to test',
];
const shopifyEnv = ['SHOPIFY_STORE_URL=yourstore.myshopify.com', 'SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxx', 'SHOPIFY_WEBHOOK_SECRET=your_webhook_secret'];

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

const deploySteps = [
  'Go to vercel.com → Your Project → Settings → Environment Variables',
  'Add: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL',
  'Go to railway.app → Your Backend Service → Variables tab',
  'Add: DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, XERO_CLIENT_SECRET, SECRET_KEY',
  'Trigger a redeploy on both Vercel and Railway',
  'Visit your Vercel URL — confirm the dashboard loads ✓',
];
const deployEnv = ['NEXT_PUBLIC_BACKEND_URL=https://[your-railway-service].railway.app', 'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co', 'SECRET_KEY=your_secret_key', 'DATABASE_URL=postgresql://...'];

export interface ConnectionsGuideVideoProps {
  narrationPath?: string;
}

export const ConnectionsGuideVideo: React.FC<ConnectionsGuideVideoProps> = ({ narrationPath }) => {
  return (
    <AbsoluteFill>
      {/* Background narration audio */}
      {narrationPath && <Audio src={staticFile(narrationPath)} />}

      {/* Intro: 0–600f (20s) */}
      <Sequence from={0} durationInFrames={600}>
        <ConnectionsIntroScene />
      </Sequence>

      {/* Shopify: 600–2100f (50s) */}
      <Sequence from={600} durationInFrames={1500}>
        <ConnectionStepScene
          stepNumber="01 / 04"
          serviceName="Shopify"
          accentColor="#96bf48"
          serviceIcon="🛒"
          steps={shopifySteps}
          envVars={shopifyEnv}
          screenshotPath="images/integrations.png"
        />
      </Sequence>

      {/* Xero: 2100–3600f (50s) */}
      <Sequence from={2100} durationInFrames={1500}>
        <ConnectionStepScene
          stepNumber="02 / 04"
          serviceName="Xero"
          accentColor="#10b981"
          serviceIcon="💼"
          steps={xeroSteps}
          envVars={xeroEnv}
          screenshotPath="images/integrations.png"
        />
      </Sequence>

      {/* Supabase: 3600–5100f (50s) */}
      <Sequence from={3600} durationInFrames={1500}>
        <ConnectionStepScene
          stepNumber="03 / 04"
          serviceName="Supabase"
          accentColor="#3ecf8e"
          serviceIcon="🗄️"
          steps={supabaseSteps}
          envVars={supabaseEnv}
          warning="⚠️ Service Role Key has full database access. Never put in frontend code."
        />
      </Sequence>

      {/* Vercel + Railway: 5100–6900f (60s) */}
      <Sequence from={5100} durationInFrames={1800}>
        <ConnectionStepScene
          stepNumber="04 / 04"
          serviceName="Vercel + Railway"
          accentColor="#a855f7"
          serviceIcon="🚀"
          steps={deploySteps}
          envVars={deployEnv}
          screenshotPath="images/dashboard.png"
        />
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
