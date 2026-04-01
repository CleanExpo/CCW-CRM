import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ConnectionsIntroScene } from './scenes/connections/ConnectionsIntroScene';
import { ConnectionStepScene } from './scenes/connections/ConnectionStepScene';
import { VerificationScene } from './scenes/connections/VerificationScene';
import { AllConnectedScene } from './scenes/connections/AllConnectedScene';

// 260s @ 30fps = 7800 frames (Vercel env vars are pre-configured — 3 user steps only)
export const CONNECTIONS_TOTAL_FRAMES = 7800;

// Shopify — user's own store, requires their API token
const shopifySteps = [
  'Go to your Shopify Admin → Settings → Apps and sales channels',
  'Click "Develop apps" → Create a new private app',
  'Enable read/write access for Orders, Products, Inventory',
  'Copy the Admin API access token',
  'In CCW: Settings → Integrations → Shopify',
  'Paste your token → Save → Import Orders to test',
];
const shopifyEnv = ['SHOPIFY_STORE_URL=yourstore.myshopify.com', 'SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxx', 'SHOPIFY_WEBHOOK_SECRET=your_webhook_secret'];

// Xero — user's own accounting org
const xeroSteps = [
  'Go to developer.xero.com → My Apps',
  'Click "New App" → Web App',
  'Add redirect URI: https://your-domain.vercel.app/api/auth/xero/callback',
  'Copy Client ID + Client Secret',
  'In CCW: Settings → Integrations → Xero',
  'Paste Client ID + Secret → Connect Xero → Authorise',
];
const xeroEnv = ['XERO_CLIENT_ID=your_client_id', 'XERO_CLIENT_SECRET=your_client_secret', 'XERO_REDIRECT_URI=https://your-domain.vercel.app/api/auth/xero/callback'];

// Supabase — already in Vercel, just confirm keys are present
const supabaseSteps = [
  'These keys are already configured in your Vercel environment',
  'Go to supabase.com → Your Project → Settings → API',
  'Confirm Project URL matches NEXT_PUBLIC_SUPABASE_URL in Vercel',
  'Confirm anon key matches NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel',
  'No action needed — Vercel reads these automatically on every deploy',
  'Dashboard loading without errors = Supabase is connected ✓',
];
const supabaseEnv = ['NEXT_PUBLIC_SUPABASE_URL=✅ already in Vercel', 'NEXT_PUBLIC_SUPABASE_ANON_KEY=✅ already in Vercel', 'SUPABASE_SERVICE_ROLE_KEY=✅ already in Vercel'];

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

      {/* Shopify: 600–2400f (60s) */}
      <Sequence from={600} durationInFrames={1800}>
        <ConnectionStepScene
          stepNumber="01 / 03"
          serviceName="Shopify"
          accentColor="#96bf48"
          serviceIcon="🛒"
          steps={shopifySteps}
          envVars={shopifyEnv}
          screenshotPath="images/integrations.png"
        />
      </Sequence>

      {/* Xero: 2400–4200f (60s) */}
      <Sequence from={2400} durationInFrames={1800}>
        <ConnectionStepScene
          stepNumber="02 / 03"
          serviceName="Xero"
          accentColor="#10b981"
          serviceIcon="💼"
          steps={xeroSteps}
          envVars={xeroEnv}
          screenshotPath="images/integrations.png"
        />
      </Sequence>

      {/* Supabase: 4200–5700f (50s) */}
      <Sequence from={4200} durationInFrames={1500}>
        <ConnectionStepScene
          stepNumber="03 / 03"
          serviceName="Supabase"
          accentColor="#3ecf8e"
          serviceIcon="🗄️"
          steps={supabaseSteps}
          envVars={supabaseEnv}
          warning="✅ Already configured in Vercel — no manual action required."
          screenshotPath="images/dashboard.png"
        />
      </Sequence>

      {/* Verification: 5700–6900f (40s) */}
      <Sequence from={5700} durationInFrames={1200}>
        <VerificationScene />
      </Sequence>

      {/* All Connected: 6900–7800f (30s) */}
      <Sequence from={6900} durationInFrames={900}>
        <AllConnectedScene />
      </Sequence>
    </AbsoluteFill>
  );
};
