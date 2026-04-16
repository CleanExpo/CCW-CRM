/**
 * CCW Video Production Pipeline — On-Demand Generator (UNI-1672)
 *
 * Usage:
 *   node scripts/video-pipeline.js --type productdemo --session CCW-BOARD-20260329 --platforms youtube,linkedin
 *   node scripts/video-pipeline.js --type clientbenefits --industry trades --platforms youtube,instagram
 *   node scripts/video-pipeline.js --type spotlight --feature "Barcode Scanner" --platforms tiktok,instagram
 *   node scripts/video-pipeline.js --type behindthescenes --session CCW-BOARD-20260329 --platforms youtube
 */

import { parseArgs } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Video type definitions
// ---------------------------------------------------------------------------

const VIDEO_TYPES = {
  productdemo: { compositionId: 'ProductDemoVideo', needsScreenshots: true },
  clientbenefits: { compositionId: 'ClientBenefitsVideo', needsScreenshots: false },
  spotlight: { compositionId: 'FeatureSpotlightVideo', needsScreenshots: true },
  behindthescenes: { compositionId: 'BehindTheScenesVideo', needsScreenshots: false },
};

// ---------------------------------------------------------------------------
// Default props builders per video type
// ---------------------------------------------------------------------------

/**
 * Build default render props appropriate for the given video type and options.
 *
 * @param {string} type
 * @param {Object} options
 * @returns {Object}
 */
function buildDefaultProps(type, options) {
  const base = {
    sessionId: options.sessionId,
    platforms: options.platforms || ['youtube'],
    generatedAt: new Date().toISOString(),
  };

  switch (type) {
    case 'productdemo':
      return {
        ...base,
        title: 'CCW Product Demo',
        subtitle: 'See the power of CCW in action',
        features: [
          'AI-powered inventory management',
          'Real-time order tracking',
          'Integrated POS system',
          'Multi-location stock control',
        ],
        cta: 'Book a free demo at carpetcleanerswarehouse.com.au',
        duration: 120,
        screenshots: [],
      };

    case 'clientbenefits':
      return {
        ...base,
        title: 'Why Trades Businesses Choose CCW',
        industry: options.industry || 'trades',
        benefits: [
          'Save 4+ hours per week on admin',
          'Never oversell stock again',
          'Get paid faster with integrated invoicing',
          'Know your numbers with real-time KPIs',
        ],
        testimonial: {
          quote: 'CCW transformed how we run our business.',
          author: 'CCW Customer',
          business: 'Trades Business',
        },
        cta: 'Start your free trial today',
        duration: 90,
      };

    case 'spotlight':
      return {
        ...base,
        featureName: options.feature || 'Feature Spotlight',
        title: `Feature Spotlight: ${options.feature || 'New Feature'}`,
        description: 'See how this feature saves you time and money.',
        steps: ['Open the feature', 'Configure your settings', 'Watch the magic happen'],
        screenshots: [],
        duration: 60,
      };

    case 'behindthescenes':
      return {
        ...base,
        title: 'Behind the Scenes at CCW',
        sessionReference: options.session || null,
        topics: ['What we built this sprint', 'Challenges we solved', 'What is coming next'],
        debriefData: options.debriefData || null,
        duration: 180,
      };

    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Main pipeline function
// ---------------------------------------------------------------------------

/**
 * Run the video production pipeline for a given type and options.
 *
 * @param {Object} options
 * @param {string} options.type         - Video type key from VIDEO_TYPES
 * @param {string} [options.session]    - Session ID (optional, auto-generated if omitted)
 * @param {string[]} [options.platforms] - Target platforms (e.g. ['youtube', 'linkedin'])
 * @param {string} [options.outputDir]  - Override output directory
 * @param {string} [options.industry]   - Industry for clientbenefits type
 * @param {string} [options.feature]    - Feature name for spotlight type
 * @param {boolean} [options.narrate]   - Generate ElevenLabs narration
 * @param {boolean} [options.noRender]  - Skip Remotion render step
 * @param {boolean} [options.upload]    - Upload to YouTube after render
 * @returns {Promise<void>}
 */
export async function runVideoPipeline(options) {
  // Step 1: Validate type
  if (!options.type || !VIDEO_TYPES[options.type]) {
    const valid = Object.keys(VIDEO_TYPES).join(', ');
    throw new Error(`[VideoPipeline] Invalid type "${options.type}". Valid types: ${valid}`);
  }

  const { compositionId } = VIDEO_TYPES[options.type];
  const type = options.type;

  // Step 2: Generate sessionId
  const sessionId =
    options.session ||
    'CCW-VIDEO-' +
      new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 14);

  options.sessionId = sessionId;

  console.log(`[VideoPipeline] Starting pipeline — type: ${type}, session: ${sessionId}`);
  console.log(`[VideoPipeline] Platforms: ${(options.platforms || ['youtube']).join(', ')}`);

  // Step 3: Create output directory
  const baseOutputDir = options.outputDir || './data/sessions';
  const sessionDir = path.join(baseOutputDir, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  console.log(`[VideoPipeline] Output directory: ${sessionDir}`);

  // Step 4: For behindthescenes with a session, try to load debrief.json
  if (type === 'behindthescenes' && options.session) {
    const debriefPath = path.join('data', 'sessions', options.session, 'debrief.json');
    try {
      const raw = await fs.readFile(debriefPath, 'utf-8');
      options.debriefData = JSON.parse(raw);
      console.log(`[VideoPipeline] Loaded debrief.json from ${debriefPath}`);
      console.log(`[VideoPipeline] Debrief topics: ${Object.keys(options.debriefData).join(', ')}`);
    } catch {
      console.log(
        `[VideoPipeline] No debrief.json found at ${debriefPath} — continuing without it`
      );
    }
  }

  // Step 5 & 6: Build and write render props
  const props = buildDefaultProps(type, options);
  const propsPath = path.join(sessionDir, `render-props-${type}.json`);
  await fs.writeFile(propsPath, JSON.stringify(props, null, 2));
  console.log(`[VideoPipeline] Props written to ${propsPath}`);

  // Step 7: Generate narration if requested
  if (options.narrate) {
    if (!process.env.ELEVENLABS_API_KEY) {
      console.log('[VideoPipeline] Narration requested but ELEVENLABS_API_KEY not set — skipping');
    } else {
      try {
        const { generateCEONarration } = await import('./elevenlabs.js');
        const placeholderScript = `This is the CCW ${type} video for session ${sessionId}. ${props.title || ''}`;
        const narrationPath = await generateCEONarration(placeholderScript, sessionId);
        if (narrationPath) {
          console.log(`[VideoPipeline] Narration saved to ${narrationPath}`);
        }
      } catch (err) {
        console.log(`[VideoPipeline] Narration failed (non-fatal): ${err.message}`);
      }
    }
  }

  // Step 8: Render via Remotion unless --no-render flag is set
  let outputPath = null;

  if (!options.noRender) {
    outputPath = path.join(sessionDir, `${type}.mp4`);
    // Escape backslashes on Windows for shell command
    const outputPathShell = outputPath.replace(/\\/g, '/');
    const propsPathShell = propsPath.replace(/\\/g, '/');
    const cmd = `npx remotion render video/remotion/src/index.ts ${compositionId} "${outputPathShell}" --props="${propsPathShell}"`;
    console.log(`[VideoPipeline] Rendering: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`[VideoPipeline] Render complete: ${outputPath}`);
  } else {
    console.log('[VideoPipeline] --no-render flag set — skipping Remotion render');
  }

  // Optional: Upload to YouTube after render
  if (options.upload && outputPath) {
    try {
      const { uploadToYouTube } = await import('./youtube_upload.js');
      const videoBrief = { ...props, title: props.title || `CCW ${type} Video` };
      const videoId = await uploadToYouTube(outputPath, videoBrief, sessionId);
      if (videoId) {
        console.log(`[VideoPipeline] YouTube upload complete: https://youtu.be/${videoId}`);
      }
    } catch (err) {
      console.log(`[VideoPipeline] YouTube upload failed (non-fatal): ${err.message}`);
    }
  }

  // Step 9: Completion summary
  console.log('');
  console.log('[VideoPipeline] ---- Pipeline Complete ----');
  console.log(`[VideoPipeline] Type:        ${type}`);
  console.log(`[VideoPipeline] Session:     ${sessionId}`);
  console.log(`[VideoPipeline] Output dir:  ${sessionDir}`);
  console.log(`[VideoPipeline] Props file:  ${propsPath}`);
  if (outputPath && !options.noRender) {
    console.log(`[VideoPipeline] Video file:  ${outputPath}`);
  }
  console.log('[VideoPipeline] ---------------------------');
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      type: { type: 'string' },
      session: { type: 'string' },
      platforms: { type: 'string' },
      industry: { type: 'string' },
      feature: { type: 'string' },
      'output-dir': { type: 'string' },
      narrate: { type: 'boolean', default: false },
      'no-render': { type: 'boolean', default: false },
      upload: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (!values.type) {
    console.log('[VideoPipeline] Usage: node scripts/video-pipeline.js --type <type> [options]');
    console.log('[VideoPipeline] Types: ' + Object.keys(VIDEO_TYPES).join(', '));
    process.exit(1);
  }

  const options = {
    type: values.type,
    session: values.session,
    platforms: values.platforms ? values.platforms.split(',').map((p) => p.trim()) : ['youtube'],
    industry: values.industry,
    feature: values.feature,
    outputDir: values['output-dir'],
    narrate: values.narrate,
    noRender: values['no-render'],
    upload: values.upload,
  };

  try {
    await runVideoPipeline(options);
  } catch (err) {
    console.log(`[VideoPipeline] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

// Run as CLI only when this file is the entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
