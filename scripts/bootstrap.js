/**
 * CCW Boardroom Autonomous CRON System — Bootstrap
 *
 * Run as the ABSOLUTE FIRST step of every CRON trigger.
 * Validates env vars and generates CLAUDE.md if missing.
 *
 * Usage:
 *   import { bootstrap } from './scripts/bootstrap.js';
 *   const sessionId = await bootstrap(); // ALWAYS first
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLAUDE_MD_PATH = path.join(ROOT, 'CLAUDE.md');
const TEMPLATE_PATH = path.join(__dirname, 'claude_md_template.md');

/**
 * Required env vars — missing any halts the session.
 * DEMO_MODE_SKIPPED vars are validated separately and trigger graceful skip.
 */
const REQUIRED_ENV_VARS = ['ANTHROPIC_API_KEY', 'PERPLEXITY_API_KEY', 'CRON_SECRET'];

const DEMO_MODE_SKIPPED_VARS = [
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'APIFY_API_TOKEN',
  'YOUTUBE_API_KEY',
  'YOUTUBE_OAUTH_CREDENTIALS',
  'YOUTUBE_CHANNEL_ID',
];

/**
 * Generate a session ID in format CCW-BOARD-YYYYMMDDHHMMSS
 */
function generateSessionId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('');
  const timePart = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('');
  return `CCW-BOARD-${datePart}${timePart}`;
}

/**
 * Bootstrap the CCW Boardroom system.
 * Validates env vars, ensures CLAUDE.md exists, returns session ID.
 *
 * @returns {Promise<string>} Session ID in format CCW-BOARD-YYYYMMDDHHMMSS
 * @throws {Error} If required env vars are missing
 */
export async function bootstrap() {
  console.log('[Bootstrap] CCW Boardroom Autonomous CRON System v3.0 — Starting...');

  // Step 1: CLAUDE.md check and auto-generate
  try {
    await fs.access(CLAUDE_MD_PATH);
    console.log('[Bootstrap] CLAUDE.md ✅');
  } catch {
    console.warn('[Bootstrap] CLAUDE.md missing — generating from template...');
    try {
      const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
      await fs.writeFile(CLAUDE_MD_PATH, template, 'utf8');
      console.log('[Bootstrap] CLAUDE.md generated ✅');
    } catch (templateErr) {
      console.error('[Bootstrap] ❌ Could not read claude_md_template.md:', templateErr.message);
      throw new Error('CLAUDE.md template missing. Cannot generate CLAUDE.md.');
    }
  }

  // Step 2: Required env var validation — HALT if any missing
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('[Bootstrap] ❌ Missing REQUIRED env vars:');
    missing.forEach((k) => console.error(`  - ${k}`));
    console.error('[Bootstrap] Add to .env (local) or Vercel Environment Variables (production).');
    console.error('[Bootstrap] HALTING — session cannot proceed without required vars.');
    process.exit(1);
  }
  console.log('[Bootstrap] Required env vars ✅');

  // Step 3: Demo mode detection — graceful skip for optional vars
  const skipped = DEMO_MODE_SKIPPED_VARS.filter((k) => !process.env[k]);
  if (skipped.length > 0) {
    console.warn('[Bootstrap] ⚠️  Demo mode — these vars absent, pipeline steps will be skipped:');
    skipped.forEach((k) => console.warn(`  - ${k}`));
  } else {
    console.log('[Bootstrap] Full pipeline mode — all optional vars present ✅');
  }

  // Step 4: Generate session ID
  const sessionId = generateSessionId();
  console.log(`[Bootstrap] Session: ${sessionId}`);
  console.log('[Bootstrap] Bootstrap complete ✅\n');

  return sessionId;
}

// Run directly if invoked as script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  bootstrap().catch((err) => {
    console.error('[Bootstrap] Fatal:', err.message);
    process.exit(1);
  });
}
