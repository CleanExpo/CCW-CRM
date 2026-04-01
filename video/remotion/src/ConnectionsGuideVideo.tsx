import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ConnectionsIntroScene } from './scenes/connections/ConnectionsIntroScene';
import { ConnectionStepScene } from './scenes/connections/ConnectionStepScene';
import { VerificationScene } from './scenes/connections/VerificationScene';
import { AllConnectedScene } from './scenes/connections/AllConnectedScene';

// 210s @ 30fps = 6300 frames
// Clients connect 2 things: Shopify (their store) + Xero (their accounting)
// Supabase, Vercel, Railway — all managed by CCW, invisible to clients
export const CONNECTIONS_TOTAL_FRAMES = 6300;

// Shopify — client's own store credentials
const shopifySteps = [
  'Go to your Shopify Admin → Settings → Apps and sales channels',
  'Click "Develop apps" → Create a new private app',
  'Enable read/write access for Orders, Products, Inventory',
  'Copy the Admin API access token',
  'In CCW: Settings → Integrations → Shopify',
  'Paste your store URL + token → Save → Import Orders to test',
];
const shopifyEnv = [
  'SHOPIFY_STORE_URL=yourstore.myshopify.com',
  'SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxx',
  'SHOPIFY_WEBHOOK_SECRET=your_webhook_secret',
];

// Xero — client's own accounting org
const xeroSteps = [
  'Go to developer.xero.com → My Apps',
  'Click "New App" → Web App',
  'Add redirect URI: https://ccw-crm-web.vercel.app/api/auth/xero/callback',
  'Copy Client ID + Client Secret',
  'In CCW: Settings → Integrations → Xero',
  'Paste Client ID + Secret → Connect Xero → Authorise',
];
const xeroEnv = [
  'XERO_CLIENT_ID=your_client_id',
  'XERO_CLIENT_SECRET=your_client_secret',
  'XERO_REDIRECT_URI=https://ccw-crm-web.vercel.app/api/auth/xero/callback',
];

export interface ConnectionsGuideVideoProps {
  narrationPath?: string;
}

export const ConnectionsGuideVideo: React.FC<ConnectionsGuideVideoProps> = ({ narrationPath }) => {
  return (
    <AbsoluteFill>
      {narrationPath && <Audio src={staticFile(narrationPath)} />}

      {/* Intro: 0–600f (20s) */}
      <Sequence from={0} durationInFrames={600}>
        <ConnectionsIntroScene />
      </Sequence>

      {/* Shopify: 600–2700f (70s) */}
      <Sequence from={600} durationInFrames={2100}>
        <ConnectionStepScene
          stepNumber="01 / 02"
          serviceName="Shopify"
          accentColor="#96bf48"
          serviceIcon="🛒"
          steps={shopifySteps}
          envVars={shopifyEnv}
          screenshotPath="images/integrations.png"
        />
      </Sequence>

      {/* Xero: 2700–4800f (70s) */}
      <Sequence from={2700} durationInFrames={2100}>
        <ConnectionStepScene
          stepNumber="02 / 02"
          serviceName="Xero"
          accentColor="#10b981"
          serviceIcon="💼"
          steps={xeroSteps}
          envVars={xeroEnv}
          screenshotPath="images/integrations.png"
        />
      </Sequence>

      {/* Verification: 4800–5700f (30s) */}
      <Sequence from={4800} durationInFrames={900}>
        <VerificationScene />
      </Sequence>

      {/* All Connected: 5700–6300f (20s) */}
      <Sequence from={5700} durationInFrames={600}>
        <AllConnectedScene />
      </Sequence>
    </AbsoluteFill>
  );
};
