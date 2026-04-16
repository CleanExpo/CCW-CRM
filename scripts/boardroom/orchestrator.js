/**
 * CCW Boardroom — Session Orchestrator (UNI-1671)
 *
 * Coordinates the full 22-step autonomous boardroom session:
 * bootstrap → preflight → scout swarm → competitive intelligence →
 * board deliberation → security audit → witness → debrief JSON →
 * ElevenLabs → Remotion → YouTube → Linear → QA check → retro
 *
 * Model assignments:
 *   Orchestrator + Moon Shooter: claude-opus-4-6   (adaptive, effort: max)
 *   Board Members 2–11:          claude-sonnet-4-6  (adaptive, effort: high)
 *   Scout Swarm + Witness:       claude-haiku-4-5-20251001 (speed, no thinking)
 *
 * New CRON steps (UNI-1691/1693/1694/1695):
 *   Step 03b: Competitive intelligence via browse-competitive.js
 *   Step 10:  Security audit via security-audit.js (weekly comprehensive)
 *   Step 18a: QA check via qa-check.js
 *   Step 18b: Retrospective via retro.js (produces cycle_complete.json)
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { bootstrap } from '../bootstrap.js';
import { preFlightCheck } from '../preflight.js';
import { runScoutSwarm } from '../perplexity.js';
import { generateCEONarration } from '../elevenlabs.js';
import { runCompetitiveIntelligence } from './browse-competitive.js';
import { runSecurityAudit } from './security-audit.js';
import { runQACheck } from './qa-check.js';
import { runRetro } from './retro.js';
import { runClaudemdAudit } from './claudemd-audit.js';
import { uploadToYouTube } from '../youtube_upload.js';

const DATA_DIR = process.env.VIDEO_OUTPUT_DIR || './data/sessions';

// ─── Model constants ────────────────────────────────────────────────────────
const OPUS = 'claude-opus-4-6';
const SONNET = 'claude-sonnet-4-6';
const HAIKU = 'claude-haiku-4-5-20251001';

// ─── Board member definitions ───────────────────────────────────────────────
const BOARD_MEMBERS = [
  {
    id: 'architect',
    name: 'The Architect',
    model: OPUS,
    effort: 'max',
    superpowers: [
      'brainstorming',
      'writing-plans',
      'subagent-driven-development',
      'requesting-code-review',
    ],
    system: `You are The Architect — 20+ years at AWS, Google Cloud, Meta, Netflix.
You open every boardroom session with a BUILD_STATUS (GREEN/AMBER/RED) based on current system state.
You have final say on system design decisions. Be direct, technical, decisive.
Always start your response with: BUILD_STATUS: [GREEN|AMBER|RED] — [one-line reason]

Available Superpowers: brainstorming, writing-plans, subagent-driven-development, requesting-code-review
When planning new system capabilities, invoke writing-plans. For complex parallelisable work, invoke subagent-driven-development.`,
  },
  {
    id: 'product_oracle',
    name: 'The Product Oracle',
    model: SONNET,
    effort: 'high',
    superpowers: ['brainstorming'],
    system: `You are The Product Oracle — 20+ years at Apple, Google, Stripe, Figma, Atlassian.
Translate CEO vision into concrete product decisions. Challenge feature creep ruthlessly.
Speak in user outcomes, not features.

Available Superpowers: brainstorming
When evaluating new product directions, invoke brainstorming to surface unconventional alternatives.`,
  },
  {
    id: 'revenue_guardian',
    name: 'The Revenue Guardian',
    model: SONNET,
    effort: 'high',
    system: `You are The Revenue Guardian — 20+ years at Shopify, HubSpot, Salesforce, Xero.
Every decision passes revenue impact analysis first. Speak in dollars and percentages.
If it doesn't grow, protect, or accelerate revenue — challenge it.`,
  },
  {
    id: 'security_sentinel',
    name: 'The Security Sentinel',
    model: SONNET,
    effort: 'high',
    superpowers: [
      'systematic-debugging',
      'test-driven-development',
      'verification-before-completion',
    ],
    system: `You are The Security Sentinel — 20+ years CISO at ANZ Bank, Australian Defence, CBA.
Security review every session. Block insecure patterns immediately.
Reference AU/NZ data sovereignty requirements and OWASP standards.

Available Superpowers: systematic-debugging, test-driven-development, verification-before-completion
Use systematic-debugging for any reported security incident. Use verification-before-completion before approving any auth or data change.`,
  },
  {
    id: 'data_sovereign',
    name: 'The Data Sovereign',
    model: SONNET,
    effort: 'high',
    superpowers: ['verification-before-completion'],
    system: `You are The Data Sovereign — 20+ years at Netflix, Uber, Meta, Palantir.
You own all intelligence. Synthesise the Perplexity scout data into exactly 3 critical findings.
Always cite your sources and date-stamp your insights.

Available Superpowers: verification-before-completion
Before declaring any insight final, apply verification-before-completion to confirm source integrity.`,
  },
  {
    id: 'agent_whisperer',
    name: 'The Agent Whisperer',
    model: SONNET,
    effort: 'high',
    superpowers: [
      'dispatching-parallel-agents',
      'subagent-driven-development',
      'using-git-worktrees',
    ],
    system: `You are The Agent Whisperer — 20+ years at OpenAI, DeepMind, Anthropic, Google Brain.
You own the AI architecture. Enforce Anthropic best practices and multi-agent patterns.
Flag any use of deprecated APIs (e.g. budget_tokens) immediately.

Available Superpowers: dispatching-parallel-agents, subagent-driven-development, using-git-worktrees
For any multi-agent work, invoke dispatching-parallel-agents. Use using-git-worktrees to isolate experimental AI feature branches.`,
  },
  {
    id: 'compliance_counsel',
    name: 'The Compliance Counsel',
    model: SONNET,
    effort: 'high',
    superpowers: ['verification-before-completion'],
    system: `You are The Compliance Counsel — 20+ years technology law AU/NZ/UK/US.
AU Privacy Act, ACCC, IP law. Prevent liability before it manifests.
Flag any proposed action that creates legal exposure.

Available Superpowers: verification-before-completion
Before approving any user-facing feature or data handling change, invoke verification-before-completion to confirm compliance.`,
  },
  {
    id: 'integration_maestro',
    name: 'The Integration Maestro',
    model: SONNET,
    effort: 'high',
    superpowers: ['systematic-debugging'],
    system: `You are The Integration Maestro — 20+ years at Twilio, Stripe, MuleSoft, Zapier.
You own: Cin7, Xero, ElevenLabs, YouTube, Remotion, Apify integrations.
Design for failure modes — every integration must have a graceful fallback.

Available Superpowers: systematic-debugging
When any integration is failing or degraded, invoke systematic-debugging to isolate root cause before proposing fixes.`,
  },
  {
    id: 'video_director',
    name: 'The Video Director',
    model: SONNET,
    effort: 'high',
    system: `You are The Video Director — 20+ years at Netflix, YouTube, BBC, Vice.
You produce the VIDEO_BRIEF JSON for this session's YouTube video.
Output MUST be a valid JSON object with fields:
  title, description, tags[], duration_iso, youtube.chapters[{timestamp, title}],
  script (CEO narration, ~1200 words for 8-min video), scenes[]
Write the CEO narration script in first-person, warm but authoritative Australian voice.`,
  },
  {
    id: 'ux_visionary',
    name: 'The UX Visionary',
    model: SONNET,
    effort: 'high',
    system: `You are The UX Visionary — 20+ years at Apple, Google, Adobe, Canva.
You champion the tradesperson user. Apply the "30-second dirty gloves" test to every decision:
"Can a tradie use this in 30 seconds with dirty gloves?" If not, simplify.`,
  },
  {
    id: 'fullstack_forge',
    name: 'The Full-Stack Forge',
    model: SONNET,
    effort: 'high',
    superpowers: ['writing-plans', 'executing-plans', 'finishing-a-development-branch'],
    system: `You are The Full-Stack Forge — 20+ years at Microsoft, GitHub, Vercel, Next.js core.
Engineering quality guardian. No untested code, no tech debt, no shortcuts.
Every build decision must consider scalability, maintainability, and the developer experience.

Available Superpowers: writing-plans, executing-plans, finishing-a-development-branch
Before any implementation: writing-plans. During implementation: executing-plans. Pre-merge: finishing-a-development-branch.`,
  },
  {
    id: 'moon_shooter',
    name: 'The Moon Shooter',
    model: OPUS,
    effort: 'max',
    superpowers: ['brainstorming'],
    system: `You are The Moon Shooter — 20+ years at SpaceX, OpenAI, Y Combinator, DeepMind, DARPA.
You ALWAYS speak LAST. You deliver the single audacious Moon Shot idea.
One idea only. Ambitious but achievable within 90 days. Back it with a specific first step.

Available Superpowers: brainstorming
Before committing to your Moon Shot, invoke brainstorming to stress-test alternatives and ensure the chosen idea is the most audacious AND most achievable.`,
  },
];

// ─── Witness ─────────────────────────────────────────────────────────────────
const WITNESS = {
  id: 'witness',
  name: 'The Witness',
  model: HAIKU,
  superpowers: ['verification-before-completion'],
  system: `You are The Witness — quality control for the CCW Boardroom.
Detect contradictions between board members. Produce:
1. SWOT analysis (3 points each: Strengths, Weaknesses, Opportunities, Threats)
2. Decision Log (numbered list of key decisions made this session)
3. RED FLAGS: any unresolved contradictions or risks

Output valid JSON with fields: swot{strengths[], weaknesses[], opportunities[], threats[]}, decisions[], red_flags[]

Available Superpowers: verification-before-completion
Apply verification-before-completion before finalising the decision log — confirm every decision is supported by at least one board member's deliberation.`,
};

// ─── Orchestrator helpers ─────────────────────────────────────────────────────

/**
 * Call a single board member via Anthropic API.
 * Opus gets adaptive thinking with effort:max, Sonnet with effort:high, Haiku plain.
 */
async function callBoardMember(client, member, messages) {
  const params = {
    model: member.model,
    max_tokens: member.model === HAIKU ? 4096 : 16000,
    system: member.system,
    messages,
  };

  if (member.model === OPUS) {
    params.thinking = { type: 'adaptive' };
    params.output_config = { effort: member.effort || 'max' };
  } else if (member.model === SONNET) {
    params.thinking = { type: 'adaptive' };
    params.output_config = { effort: member.effort || 'high' };
  }

  const response = await client.messages.create(params);
  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.text || '';
}

/**
 * Parse VIDEO_BRIEF JSON from the Video Director's output.
 * Extracts first JSON object found in the text.
 */
function parseVideoBrief(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('[Orchestrator] Video Director did not produce valid JSON');
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`[Orchestrator] VIDEO_BRIEF JSON parse failed: ${e.message}`);
  }
}

/**
 * Parse Witness JSON output.
 */
function parseWitnessOutput(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { swot: {}, decisions: [], red_flags: [] };
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { raw: text };
  }
}

/**
 * Log session to Linear (UNI-1665).
 * Posts a comment to the Linear issue if LINEAR_API_KEY is configured.
 */
async function logSessionToLinear(sessionId, debrief) {
  if (!process.env.LINEAR_API_KEY || !process.env.LINEAR_BOARDROOM_ISSUE_ID) {
    console.log('[Linear] Skipping — LINEAR_API_KEY or LINEAR_BOARDROOM_ISSUE_ID not set');
    return;
  }

  const commentBody = `## Boardroom Session: ${sessionId}

**Date:** ${new Date().toISOString()}
**Build Status:** ${debrief.buildStatus || 'UNKNOWN'}
**Moon Shot:** ${debrief.moonShot || 'Not recorded'}

### Key Decisions
${(debrief.witness?.decisions || []).map((d, i) => `${i + 1}. ${d}`).join('\n')}

### Red Flags
${(debrief.witness?.red_flags || []).map((f) => `⚠️ ${f}`).join('\n') || 'None'}

### Next Action
${debrief.nextAction || 'See full session JSON'}

[Full session data: \`data/sessions/${sessionId}/debrief.json\`]`;

  try {
    await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: process.env.LINEAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `mutation CreateComment($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) {
            success
          }
        }`,
        variables: {
          issueId: process.env.LINEAR_BOARDROOM_ISSUE_ID,
          body: commentBody,
        },
      }),
    });
    console.log('[Linear] Session logged to UNI-1665 ✅');
  } catch (err) {
    console.warn(`[Linear] Logging failed: ${err.message}`);
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Run a full autonomous boardroom session (18 steps).
 *
 * @returns {Promise<Object>} Session debrief JSON
 */
export async function runBoardroomSession() {
  // ── Step 00: Read CLAUDE.md (done by caller via bootstrap) ──
  // ── Step 01: Bootstrap — validate env vars, generate sessionId ──
  const sessionId = await bootstrap();
  console.log(`\n🏛️  [Boardroom] Session ${sessionId} starting...`);

  // ── Step 02: Pre-flight endpoint checks ──
  await preFlightCheck(sessionId);

  // ── Step 03: Scout Swarm — 5 parallel Perplexity queries ──
  console.log('\n[Boardroom] Step 03 — Scout Swarm dispatching...');
  const scoutResults = await runScoutSwarm();

  // ── Step 03b: Competitive Intelligence — browser scrape (UNI-1691) ──
  console.log('\n[Boardroom] Step 03b — Competitive Intelligence (gstack /browse)...');
  let competitiveIntelligence = null;
  try {
    competitiveIntelligence = await runCompetitiveIntelligence(sessionId, DATA_DIR);
  } catch (err) {
    console.warn(`[Boardroom] Competitive intelligence skipped: ${err.message}`);
  }

  // ── Steps 04–05: Data Sovereign synthesises intelligence ──
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sessionDir = path.join(DATA_DIR, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const intelligenceSummary = scoutResults
    .map(
      (r, i) =>
        `Query ${i + 1}: ${r.query}\n${JSON.stringify(r.result?.choices?.[0]?.message?.content || r.result, null, 2)}`
    )
    .join('\n\n---\n\n');

  console.log('\n[Boardroom] Step 05 — Data Sovereign synthesising intelligence...');
  const dataSovereign = BOARD_MEMBERS.find((m) => m.id === 'data_sovereign');
  const sovereignOutput = await callBoardMember(client, dataSovereign, [
    {
      role: 'user',
      content: `Today is ${new Date().toLocaleDateString('en-AU')}. Here is this week's intelligence from the Scout Swarm:\n\n${intelligenceSummary}\n\nSynthesize exactly 3 critical findings for the boardroom.`,
    },
  ]);

  // ── Step 06: Orchestrator opens boardroom ──
  console.log('\n[Boardroom] Step 06 — Orchestrator opening boardroom...');
  // Build competitive intelligence addendum for boardroom context
  const competitiveAddendum = competitiveIntelligence
    ? `
COMPETITIVE INTELLIGENCE (Live Scrape — ${new Date().toLocaleDateString('en-AU')}):
CCW Site Status: ${competitiveIntelligence.ccwSiteStatus}
CCW Site Title: ${competitiveIntelligence.ccwTitle || 'N/A'}
Price Range (scraped): ${competitiveIntelligence.priceRange ? `$${competitiveIntelligence.priceRange.min}–$${competitiveIntelligence.priceRange.max} (${competitiveIntelligence.priceRange.count} products)` : 'N/A'}
Competitor Presence: ${
        (competitiveIntelligence.competitorResults || [])
          .map((r) => r.text)
          .slice(0, 3)
          .join('; ') || 'None scraped'
      }
Industry News: ${(competitiveIntelligence.industryNews || []).slice(0, 3).join(' | ') || 'None scraped'}
`
    : '';

  const boardroomContext = `CCW Boardroom — Autonomous Session ${sessionId}
Date: ${new Date().toLocaleDateString('en-AU')}

INTELLIGENCE BRIEF (Data Sovereign):
${sovereignOutput}
${competitiveAddendum}
The boardroom is now in session. CEO Phill McGurk presiding.`;

  const conversationHistory = [];

  // ── Steps 07–10: Board deliberation ──
  console.log('\n[Boardroom] Steps 07–10 — Board deliberation...');

  const deliberationOrder = [
    'architect', // 07: Opens with BUILD_STATUS
    'product_oracle', // 08: Board members 2–11 deliberate
    'revenue_guardian',
    'security_sentinel',
    'agent_whisperer',
    'compliance_counsel',
    'integration_maestro',
    'ux_visionary',
    'fullstack_forge',
    'video_director', // 09: Produces VIDEO_BRIEF JSON
    'moon_shooter', // 10: ALWAYS SPEAKS LAST
  ];

  const boardOutputs = {};

  for (const memberId of deliberationOrder) {
    const member = BOARD_MEMBERS.find((m) => m.id === memberId);
    console.log(`[Boardroom] Calling ${member.name}...`);

    const messages = [
      {
        role: 'user',
        content:
          conversationHistory.length === 0
            ? boardroomContext
            : `${boardroomContext}\n\n${conversationHistory.map((c) => `${c.speaker}:\n${c.output}`).join('\n\n---\n\n')}\n\nYour turn, ${member.name}.`,
      },
    ];

    const output = await callBoardMember(client, member, messages);
    boardOutputs[memberId] = output;
    conversationHistory.push({ speaker: member.name, output });

    console.log(`[Boardroom] ${member.name} ✅`);
  }

  // ── Step 09: Extract VIDEO_BRIEF from Video Director ──
  console.log('\n[Boardroom] Step 09 — Extracting VIDEO_BRIEF JSON...');
  let videoBrief;
  try {
    videoBrief = parseVideoBrief(boardOutputs.video_director);
    await fs.writeFile(
      path.join(sessionDir, 'video-brief.json'),
      JSON.stringify(videoBrief, null, 2)
    );
    console.log('[Boardroom] VIDEO_BRIEF saved ✅');
  } catch (err) {
    console.warn(`[Boardroom] ${err.message} — using fallback brief`);
    videoBrief = {
      title: `CCW Boardroom Session ${sessionId}`,
      description: 'AI-powered boardroom deliberation for CCW — trades automation platform.',
      tags: ['CCW', 'AI', 'trades', 'automation', 'Australia'],
      duration_iso: 'PT8M',
      script: boardOutputs.video_director || 'Script unavailable.',
      youtube: { chapters: [] },
    };
  }

  // ── Step 10: Security Audit — gstack /cso (UNI-1693) ──
  console.log('\n[Boardroom] Step 10 — Security Audit (gstack /cso)...');
  let securityAudit = null;
  try {
    const rootDir = path.join(DATA_DIR, '../..');
    securityAudit = await runSecurityAudit(sessionId, DATA_DIR, rootDir, {
      mode: new Date().getDay() === 1 ? 'weekly' : 'daily', // Monday = weekly
    });
  } catch (err) {
    console.warn(`[Boardroom] Security audit skipped: ${err.message}`);
  }

  // ── Step 11: The Witness — SWOT + Decision Log ──
  console.log('\n[Boardroom] Step 11 — The Witness reviewing session...');
  const witnessOutput = await callBoardMember(client, WITNESS, [
    {
      role: 'user',
      content: `Review this boardroom session and produce your SWOT + Decision Log:\n\n${conversationHistory.map((c) => `${c.speaker}:\n${c.output}`).join('\n\n---\n\n')}`,
    },
  ]);
  const witnessData = parseWitnessOutput(witnessOutput);

  // Extract BUILD_STATUS from Architect
  const buildStatusMatch = boardOutputs.architect?.match(/BUILD_STATUS:\s*(GREEN|AMBER|RED)/i);
  const buildStatus = buildStatusMatch?.[1] || 'AMBER';

  // ── Step 12: CEO Debrief JSON ──
  console.log('\n[Boardroom] Step 12 — Generating CEO Debrief JSON...');
  const debrief = {
    sessionId,
    timestamp: new Date().toISOString(),
    buildStatus,
    boardOutputs,
    videoBrief,
    witness: witnessData,
    moonShot: boardOutputs.moon_shooter?.split('\n').slice(0, 3).join(' ') || '',
    nextAction: witnessData.decisions?.[0] || 'Review full session output',
    scoutCount: scoutResults.length,
    intelligence: sovereignOutput,
  };

  const debriefPath = path.join(sessionDir, 'debrief.json');
  await fs.writeFile(debriefPath, JSON.stringify(debrief, null, 2));
  console.log(`[Boardroom] CEO Debrief JSON saved to ${debriefPath} ✅`);

  // ── Step 13: ElevenLabs — CEO narration MP3 ──
  let narrationPath = null;
  if (videoBrief.script) {
    try {
      narrationPath = await generateCEONarration(videoBrief.script, sessionId);
    } catch (err) {
      console.warn(`[Boardroom] ElevenLabs skipped: ${err.message}`);
    }
  }

  // ── Step 14: Remotion — MP4 render ──
  let videoPath = null;
  if (narrationPath) {
    try {
      videoPath = await renderVideo(sessionId, videoBrief, narrationPath);
    } catch (err) {
      console.warn(`[Boardroom] Remotion render skipped: ${err.message}`);
    }
  } else {
    console.log('[Boardroom] Step 14 skipped — no narration (demo mode)');
  }

  // ── Step 15: YouTube upload ──
  let youtubeVideoId = null;
  if (videoPath) {
    try {
      youtubeVideoId = await uploadToYouTube(videoPath, videoBrief, sessionId);
      debrief.youtubeVideoId = youtubeVideoId;
      await fs.writeFile(debriefPath, JSON.stringify(debrief, null, 2));
    } catch (err) {
      console.warn(`[Boardroom] YouTube upload skipped: ${err.message}`);
    }
  } else {
    console.log('[Boardroom] Step 15 skipped — no video (demo mode)');
  }

  // ── Step 16: Social media — placeholder for future ──
  console.log('[Boardroom] Step 16 — Social media posting: pending implementation');

  // ── Step 17: Linear — log session ──
  await logSessionToLinear(sessionId, debrief);

  // ── Step 18a: QA Check — gstack /qa (UNI-1694) ──
  console.log('\n[Boardroom] Step 18a — QA check (gstack /qa)...');
  let qaReport = null;
  try {
    qaReport = await runQACheck(sessionId, DATA_DIR);
    debrief.qaStatus = qaReport.qaStatus;
    debrief.qaPassRate = qaReport.summary?.passRate;
    await fs.writeFile(debriefPath, JSON.stringify(debrief, null, 2));
  } catch (err) {
    console.warn(`[Boardroom] QA check skipped: ${err.message}`);
  }

  // ── Step 18b+: CLAUDE.md Audit — fortnightly (UNI-1140) ──
  if (new Date().getDay() === 1) {
    // Monday only
    console.log('\n[Boardroom] Step 18b+ — Fortnightly CLAUDE.md audit...');
    try {
      const rootDir = path.join(DATA_DIR, '../..');
      await runClaudemdAudit(sessionId, DATA_DIR, rootDir);
    } catch (err) {
      console.warn(`[Boardroom] CLAUDE.md audit skipped: ${err.message}`);
    }
  }

  // ── Step 18c: Retrospective — gstack /retro (UNI-1695) ──
  console.log('\n[Boardroom] Step 18c — Post-session retrospective (gstack /retro)...');
  let cycleComplete;
  try {
    cycleComplete = await runRetro(sessionId, DATA_DIR);
  } catch (err) {
    console.warn(`[Boardroom] Retro skipped: ${err.message}`);
    // Fallback cycle_complete
    cycleComplete = {
      sessionId,
      completedAt: new Date().toISOString(),
      buildStatus,
      youtubeVideoId,
      nextSessionScheduled: true,
    };
    await fs.writeFile(
      path.join(sessionDir, 'cycle_complete.json'),
      JSON.stringify(cycleComplete, null, 2)
    );
  }

  console.log(`\n✅ [Boardroom] Session ${sessionId} complete — BUILD_STATUS: ${buildStatus}`);
  if (qaReport) {
    console.log(
      `🧪 [Boardroom] QA: ${qaReport.qaStatus} — ${qaReport.summary?.passRate}% pass rate`
    );
  }
  if (securityAudit) {
    console.log(`🔒 [Boardroom] Security: ${securityAudit.securityStatus}`);
  }
  if (youtubeVideoId) {
    console.log(`📺 [Boardroom] YouTube: https://youtu.be/${youtubeVideoId}`);
  }
  if (cycleComplete?.retrospective?.retroSentiment) {
    console.log(`💭 [Boardroom] Retro sentiment: ${cycleComplete.retrospective.retroSentiment}`);
  }

  return debrief;
}

// ─── Remotion render helper ───────────────────────────────────────────────────

/**
 * Render boardroom video via Remotion CLI.
 * Expects /video/remotion/ to be scaffolded (UNI-1666).
 *
 * @param {string} sessionId
 * @param {Object} videoBrief
 * @param {string} narrationPath - Path to ElevenLabs MP3
 * @returns {Promise<string>} Path to rendered MP4
 */
async function renderVideo(sessionId, videoBrief, narrationPath) {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const outputPath = path.join(DATA_DIR, sessionId, 'boardroom.mp4');
  const propsPath = path.join(DATA_DIR, sessionId, 'render-props.json');

  await fs.writeFile(propsPath, JSON.stringify({ sessionId, videoBrief, narrationPath }, null, 2));

  console.log(`[Remotion] Rendering ${outputPath}...`);

  await execFileAsync('npx', [
    'remotion',
    'render',
    'video/remotion/src/index.ts',
    'BoardroomVideo',
    outputPath,
    `--props=${propsPath}`,
  ]);

  console.log(`[Remotion] Render complete: ${outputPath} ✅`);
  return outputPath;
}
