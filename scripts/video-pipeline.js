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
  // Props must exactly match the TypeScript interfaces defined in
  // video/remotion/src/types.ts — field names must be identical.

  switch (type) {
    case 'productdemo':
      // Matches ProductDemoVideoProps
      return {
        featureName: options.feature || 'CCW ERP Platform',
        tagline: 'Everything your trades business needs in one place',
        problemStatement:
          'Managing quotes, orders, inventory, and invoices across multiple tools costs your team hours every week.',
        screenshots: [],
        screenshotCaptions: [],
        results:
          '4+ hours saved per week. Zero missed orders. Real-time stock visibility.',
        ctaText: 'See CCW ERP in action — ccwonline.com.au',
      };

    case 'clientbenefits':
      // Matches ClientBenefitsVideoProps
      return {
        industry: options.industry || 'trades',
        painPoint:
          'Chasing quotes, invoices, and purchase orders across spreadsheets costs you 12+ hours every week.',
        solutionName: 'CCW ERP — Built for Trades',
        metrics: [
          { label: 'Quote Time Reduced', value: 85, unit: '%', direction: 'down' },
          { label: 'Admin Hours Saved', value: 12, unit: 'hrs/wk', direction: 'down' },
          { label: 'Revenue Visibility', value: 100, unit: '%', direction: 'up' },
        ],
        testimonialQuote: 'CCW ERP transformed how we run our business. We quote faster, stock smarter, and get paid sooner.',
        testimonialSource: 'Trades Business Owner, Brisbane',
        ctaText: 'Built for trades. Proven in the field.',
      };

    case 'spotlight':
      // Matches FeatureSpotlightVideoProps
      return {
        featureName: options.feature || 'AI Quote Generator',
        hookStatement: options.feature
          ? `${options.feature} — how it works in 60 seconds.`
          : 'Generate a professional quote in 30 seconds.',
        screenshot: undefined,
        screenshotCaption: undefined,
        keyBenefit: 'No more hours lost to manual quoting',
        ctaText: 'See it live — ccwonline.com.au',
      };

    case 'behindthescenes':
      // Matches BehindTheScenesVideoProps
      // If debrief was loaded, use real data; otherwise use illustrative defaults
      if (options.debriefData) {
        const d = options.debriefData;
        const members = Object.entries(d.boardOutputs || {}).slice(0, 4).map(([id, output]) => {
          const COLORS = {
            architect: '#3b82f6', revenue_guardian: '#22c55e',
            security_sentinel: '#ef4444', data_sovereign: '#06b6d4',
            agent_whisperer: '#8b5cf6', compliance_counsel: '#f59e0b',
            integration_maestro: '#06b6d4', video_director: '#ec4899',
            ux_visionary: '#a78bfa', fullstack_forge: '#3b82f6', moon_shooter: '#8b5cf6',
          };
          const sentences = String(output).split('. ').filter(s => s.length > 40 && s.length < 220);
          return {
            name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            title: 'Board Member',
            insight: (sentences[0] || String(output).slice(0, 200)) + '.',
            accentColor: COLORS[id] || '#3b82f6',
          };
        });
        return {
          sessionId: d.sessionId || options.sessionId,
          sessionDate: new Date(d.timestamp || Date.now()).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          openingQuestion: 'How do we build the best ERP system for Australian trades businesses?',
          boardMemberHighlights: members.length > 0 ? members : DEFAULT_BOARD_HIGHLIGHTS,
          conflictMoment: (d.witness?.red_flags || [])[0],
          decision: (d.witness?.decisions || ['Ship the next sprint feature set on schedule.'])[0],
          moonShot: d.moonShot || 'Fully autonomous business operations — zero manual admin — within 90 days.',
          outcome: (d.retrospective?.whatWentWell || ['All sprint targets hit on time.'])[0],
          impact: (d.retrospective?.nextSessionPriorities || [{ action: 'Continue building on this momentum.' }])[0].action,
        };
      }
      return {
        sessionId: options.sessionId,
        sessionDate: new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        openingQuestion: "How do we reduce CCW's admin overhead by 60% before Q3?",
        boardMemberHighlights: DEFAULT_BOARD_HIGHLIGHTS,
        conflictMoment: undefined,
        decision: 'Deploy automated Cin7-Xero nightly sync with anomaly alerts by end of sprint.',
        moonShot: 'Predictive reorder system that eliminates manual purchase orders within 90 days.',
        outcome: 'Nightly sync deployed, tested, and running — zero manual intervention required.',
        impact: 'Free up 8 hours per week across the CCW admin team for customer-facing work.',
      };

    default:
      return {};
  }
}

const DEFAULT_BOARD_HIGHLIGHTS = [
  {
    name: 'The Architect',
    title: 'Systems & Technical Strategy',
    insight: 'The bottleneck is manual data re-entry between Cin7 and Xero — automating this sync saves 8 hours per week.',
    accentColor: '#3b82f6',
  },
  {
    name: 'The Revenue Guardian',
    title: 'Commercial & Growth',
    insight: "Every hour saved on admin is an hour that goes to customer relationships — that's where the real revenue is.",
    accentColor: '#22c55e',
  },
  {
    name: 'The Moon Shooter',
    title: 'Vision & Innovation',
    insight: 'What if the system could predict reorder needs 3 weeks in advance using historical seasonal patterns?',
    accentColor: '#8b5cf6',
  },
];

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
    'CCW-VIDEO-' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

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
      console.log(`[VideoPipeline] No debrief.json found at ${debriefPath} — continuing without it`);
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
