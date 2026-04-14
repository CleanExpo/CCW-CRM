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

const FIRSTLOOK_SCRIPT = `CCW ERP. The complete operating system for Australian equipment suppliers. If you run a trade business — supplying cleaning equipment, power tools, safety gear, or machinery — this is the platform that runs your entire operation. Products. Customers. Orders. Invoicing. Warehouse. AI. Everything connected, in one system. No spreadsheets. No switching between tools. Built for the way your business actually works.

Sound familiar? You're tracking orders in Excel. Chasing suppliers by phone. Re-entering the same data across three different systems. At the end of the day, you still don't know what stock you have — or whether your jobs are profitable. You've built something real. But you're running it on tools that were never designed for what you do. There is a better way.

CCW ERP brings together everything your business runs on. Products and catalogue. Customers and CRM. Orders and fulfilment. Quotes. Point of sale. Invoicing with Xero sync. Warehouse and stock control. Suppliers. Purchase orders. Contact management. Reports and analytics. Workflow automation. An AI assistant that answers real questions about your business. And direct Shopify integration. Fourteen modules, all connected. When a quote is accepted, it flows to an order. The warehouse picks. The invoice generates and syncs to Xero — no re-entry, no delays.

Here's how it flows in practice. A customer accepts a quote — CCW converts it to an order automatically. The warehouse team is notified and picks the stock. The shipment goes out. The invoice generates and syncs to Xero that night. Every step tracked. Every team connected. No manual handoffs. No data entry between steps. From first contact to paid invoice — one system handles it all.

CCW ERP is built for equipment suppliers, trade businesses, and Australian SMEs who are serious about growth. Fourteen modules. Real-time sync. AI-powered insights. If you're ready to move beyond spreadsheets and want a system built for the way you work — this is it.

Getting started takes five days. Day one: connect your APIs. Day two: import your data. Day three: set up your team. Day four: test and validate. Day five: go live. Watch the next video and we'll walk through the connections step by step. Your system is ready.`;

const CONNECTIONS_SCRIPT = `Getting CCW ERP live takes two connections. Shopify — your online store. And Xero — your accounting. That's it. CCW manages all the infrastructure. You just connect the accounts that are yours.

Let's start with Shopify. In your Shopify Admin, go to Settings, then Apps and sales channels. Click Develop apps, then Create a new private app. Enable read and write access for Orders, Products, and Inventory. Copy your Admin API access token. Now in CCW, go to Settings, then Integrations, then Shopify. Paste your store URL and your access token. Click Save. Then click Import Orders to confirm your orders are coming through.

Connection one — done. That took about five minutes.

Now Xero. Go to developer dot xero dot com. Sign in, then click My Apps, then New App. Choose Web App. Add your redirect URI — your CCW domain followed by /api/auth/xero/callback. Copy your Client ID. Click Generate a Secret, copy it immediately — Xero only shows it once. In CCW, go to Settings, Integrations, Xero. Paste your Client ID and Client Secret. Click Connect Xero and complete the authorisation in the Xero window that opens.

Connection two — done. Under ten minutes total.

Now verify. Go to Settings, Integrations in CCW. Test Shopify by clicking Import Orders — confirm a test order appears. Check Xero shows as Connected. Then open your CCW dashboard — if it loads without errors, everything is flowing correctly.

That's it. You're live. From tonight, Shopify orders will sync automatically into CCW. Xero invoices will sync every evening at eight PM. Your dashboard updates in real time, and your AI assistant is ready. Open your CCW dashboard and start exploring.`;

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
    console.log(
      '[ElevenLabs] ELEVENLABS_API_KEY not set — skipping (set env var to generate audio)'
    );
    return null;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1';

  const wordCount = script.split(' ').length;
  const estimatedSeconds = Math.round((wordCount / 140) * 60);
  console.log(
    `[ElevenLabs] Voice ID: ${voiceId} | Script length: ${script.length} chars | ~${estimatedSeconds}s estimated`
  );

  try {
    const chunks = splitIntoChunks(script);
    console.log(`[ElevenLabs] Processing ${chunks.length} chunk(s)`);

    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(
        `[ElevenLabs] Rendering chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`
      );
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
