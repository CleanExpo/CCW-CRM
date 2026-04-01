/**
 * CCW Intro Video Audio Generator
 * Generates ElevenLabs narration for FirstLookVideo + ConnectionsGuideVideo
 * Run: node scripts/generate-intro-audio.js [firstlook|connections|all]
 *
 * Output:
 *   video/remotion/public/audio/firstlook-narration.mp3
 *   video/remotion/public/audio/connections-narration.mp3
 *
 * Env vars:
 *   ELEVENLABS_API_KEY   — ElevenLabs API key (required)
 *   ELEVENLABS_VOICE_ID  — Voice ID (default: 21m00Tcm4TlvDq8ikWAM = Rachel)
 *   ELEVENLABS_MODEL_ID  — Model ID (default: eleven_monolingual_v1)
 */

import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(REPO_ROOT, 'video', 'remotion', 'public', 'audio');

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const CHUNK_SIZE_LIMIT = 2500;

// ── Narration Scripts ─────────────────────────────────────────────────────────

const FIRSTLOOK_SCRIPT = `Welcome to CCW ERP CRM — the complete operating system built specifically for Australian equipment suppliers. If you run a trade business, supply cleaning equipment or machinery, or manage a team on the road, this system was built for you.

Sound familiar? You're tracking orders in Excel. Chasing suppliers by phone. Re-entering the same data across three different systems. And at the end of the day, you still have no idea what stock you actually have. There is a better way — and you're about to see it.

CCW ERP brings together everything your business needs in one place. Products and catalogue management. Customers and CRM. Orders, fulfilment, and quoting. Point of sale. Invoicing and billing. Warehouse operations. Suppliers and purchase orders. Contact management. Reports and analytics. Workflow automation. An AI assistant. And deep integration with Shopify and Xero. Fourteen modules. No switching between systems. No double entry. No guesswork.

Your entire business flows in one direction. A customer accepts a quote — it becomes an order. The warehouse picks and packs. It ships. The invoice is generated automatically and syncs to Xero. Every step tracked. Every team in sync. From first contact to paid invoice, CCW handles it.

CCW ERP was built for equipment suppliers, trade businesses, and Australian SMEs who are serious about growth. If you're moving beyond spreadsheets and want a system that works the way your business works — this is it.

Getting started takes five days. Day one, connect your APIs. Day two, import your data. Day three, set up your team. Day four, test and validate. Day five, you go live. Ready to start? Watch the next video to connect your first integration.`;

const CONNECTIONS_SCRIPT = `To get CCW ERP fully operational, you need three connections. Shopify, Xero, and Supabase. Your Vercel environment is already pre-configured — no deployment setup required. Each connection takes between two and eight minutes. Follow along, pause at each step, and you'll be live in under twenty minutes.

Let's start with Shopify — your e-commerce channel. In your Shopify Admin, go to Settings, then Apps and sales channels. Click Develop apps, then Create a new private app. Enable read and write access for Orders, Products, and Inventory. Copy your Admin API access token. Now in CCW, go to Settings, then Integrations, then Shopify. Paste your token, enter your store URL, and click Save. Click Import Orders to verify the connection is working.

Next, Xero. Go to developer dot xero dot com. Sign in, then click My Apps, then New App. Choose Web App as the app type. Add your redirect URI — this will be your Vercel domain followed by /api/auth/xero/callback. Once the app is created, copy your Client ID. Click Generate a Secret to get your Client Secret — copy it now, as Xero will only show it once. In CCW, go to Settings, Integrations, Xero, and paste both values. Then click Connect Xero to complete the OAuth authorisation.

Finally, Supabase. The good news is your Supabase environment variables are already configured in Vercel — no manual action is required. To confirm everything is connected, log into supabase dot com, open your project, and go to Settings then API. Check that your Project URL and anon key match what's in your Vercel environment. If your CCW dashboard loaded without errors, Supabase is already working correctly.

Time to verify. In CCW Settings, test your Shopify connection by importing a test order. Click Connect Xero and complete the authorisation flow. Confirm your dashboard loads without errors — that confirms Supabase. And check that your products appear in the CCW Inventory module. If all three are green, you're live.

Congratulations — you're connected. From tonight, Shopify orders will sync automatically to CCW. Xero invoices will sync every night at eight PM. Your dashboard updates in real time. And your AI assistant is ready to answer questions about your business. Open your CCW dashboard and start exploring. If you need help, reach out at support at unite-group dot in. Welcome to CCW ERP.`;

// ── Audio Generation ──────────────────────────────────────────────────────────

/**
 * Split a long script into sentence-boundary chunks under CHUNK_SIZE_LIMIT chars.
 *
 * @param {string} script
 * @returns {string[]}
 */
function splitIntoChunks(script) {
  if (script.length <= CHUNK_SIZE_LIMIT) return [script];

  const sentences = script.split('. ');
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? current + '. ' + sentence : sentence;
    if (candidate.length > CHUNK_SIZE_LIMIT && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Call the ElevenLabs TTS API for a single text chunk.
 *
 * @param {string} text
 * @param {string} voiceId
 * @param {string} modelId
 * @param {string} apiKey
 * @returns {Promise<ArrayBuffer>}
 */
async function callElevenLabsAPI(text, voiceId, modelId, apiKey) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[ElevenLabs] API error ${response.status}: ${errorText}`);
  }

  return response.arrayBuffer();
}

/**
 * Generate narration MP3 from script text.
 *
 * For scripts longer than 2500 chars, splits on sentence boundaries and
 * concatenates the resulting audio buffers into a single MP3.
 *
 * @param {string} script - Narration script text
 * @param {string} outputPath - Absolute path for the output MP3
 * @param {string} label - Human-readable label for logging
 * @returns {Promise<string|null>} Absolute path to generated MP3, or null on failure
 */
async function generateAudio(script, outputPath, label) {
  console.log(`\n[ElevenLabs] Generating: ${label}`);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log('[ElevenLabs] ELEVENLABS_API_KEY not set — skipping (set env var to generate audio)');
    return null;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1';

  const wordCount = script.split(' ').length;
  const estimatedSeconds = Math.round(wordCount / 140 * 60);
  console.log(`[ElevenLabs] Voice ID: ${voiceId} | Script length: ${script.length} chars | ~${estimatedSeconds}s estimated`);

  try {
    const chunks = splitIntoChunks(script);
    console.log(`[ElevenLabs] Processing ${chunks.length} chunk(s)`);

    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[ElevenLabs] Rendering chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
      const audioBuffer = await callElevenLabsAPI(chunks[i], voiceId, modelId, apiKey);
      buffers.push(Buffer.from(audioBuffer));
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const combined = Buffer.concat(buffers);

    mkdirSync(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, combined);

    const fileSizeKb = Math.round(combined.byteLength / 1024);
    console.log(`[ElevenLabs] Saved: ${outputPath} (${fileSizeKb} KB)`);

    return outputPath;
  } catch (err) {
    console.log(`[ElevenLabs] Generation failed: ${err.message}`);
    return null;
  }
}

// ── Entry Point ───────────────────────────────────────────────────────────────

const target = process.argv[2] || 'all';

if (!['firstlook', 'connections', 'all'].includes(target)) {
  console.error(`Usage: node scripts/generate-intro-audio.js [firstlook|connections|all]`);
  process.exit(1);
}

if (target === 'firstlook' || target === 'all') {
  await generateAudio(
    FIRSTLOOK_SCRIPT,
    path.join(AUDIO_DIR, 'firstlook-narration.mp3'),
    'FirstLookVideo narration'
  );
}

if (target === 'connections' || target === 'all') {
  await generateAudio(
    CONNECTIONS_SCRIPT,
    path.join(AUDIO_DIR, 'connections-narration.mp3'),
    'ConnectionsGuideVideo narration'
  );
}

console.log('\n[ElevenLabs] Done. Now render the videos:');
console.log('   cd video/remotion && npm run render:firstlook');
console.log('   cd video/remotion && npm run render:connections\n');
