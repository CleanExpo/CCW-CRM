/**
 * CCW Boardroom — Post-Session Retrospective (UNI-1695)
 *
 * Implements gstack /retro patterns as the final CRON step.
 * Runs AFTER the session is complete (after Linear logging).
 * Produces cycle_complete_{sessionId}.json that feeds into the NEXT session's context.
 *
 * Retrospective covers:
 *   - What was decided (from Witness decisions)
 *   - What worked well (from BUILD_STATUS and board outputs)
 *   - What to improve (from RED FLAGS and low-confidence items)
 *   - Next session priorities (top 3 actions)
 *   - Feedback loop: learnings that should feed into Session N+1
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const HAIKU = 'claude-haiku-4-5-20251001';

/**
 * Generate a structured retrospective using Claude Haiku.
 * Uses the debrief.json from the session to synthesise learnings.
 *
 * @param {Object} client - Anthropic client
 * @param {Object} debrief - Session debrief JSON
 * @param {Object} qaReport - QA check report (if available)
 * @param {Object} securityAudit - Security audit report (if available)
 * @returns {Promise<Object>} Structured retrospective
 */
async function generateRetroWithClaude(client, debrief, qaReport = null, securityAudit = null) {
  const sessionSummary = `
Session ID: ${debrief.sessionId}
Build Status: ${debrief.buildStatus || 'UNKNOWN'}
Moon Shot: ${debrief.moonShot || 'Not recorded'}

Key Decisions Made:
${(debrief.witness?.decisions || []).map((d, i) => `${i + 1}. ${d}`).join('\n') || 'None recorded'}

Red Flags:
${(debrief.witness?.red_flags || []).map((f) => `- ${f}`).join('\n') || 'None'}

SWOT Summary:
Strengths: ${(debrief.witness?.swot?.strengths || []).slice(0, 2).join('; ')}
Weaknesses: ${(debrief.witness?.swot?.weaknesses || []).slice(0, 2).join('; ')}
Opportunities: ${(debrief.witness?.swot?.opportunities || []).slice(0, 2).join('; ')}
Threats: ${(debrief.witness?.swot?.threats || []).slice(0, 2).join('; ')}

${qaReport ? `QA Status: ${qaReport.qaStatus} — ${qaReport.summary?.passed}/${qaReport.summary?.total} checks passed` : ''}
${securityAudit ? `Security Status: ${securityAudit.securityStatus} — ${securityAudit.summary?.critical} critical, ${securityAudit.summary?.high} high issues` : ''}
  `.trim();

  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 2048,
    system: `You are the CCW Boardroom Retrospective AI.
Produce a structured retrospective JSON from the session debrief.
Output ONLY valid JSON with this exact schema:
{
  "whatWentWell": ["string", "string", "string"],
  "whatToImprove": ["string", "string", "string"],
  "nextSessionPriorities": [
    {"priority": 1, "action": "string", "owner": "board member name or 'CEO'", "deadline": "next session | 7 days | 30 days"},
    {"priority": 2, "action": "string", "owner": "string", "deadline": "string"},
    {"priority": 3, "action": "string", "owner": "string", "deadline": "string"}
  ],
  "feedbackForNextSession": "string — key context to inject at Session N+1 start",
  "overallHealthScore": number (0-100),
  "retroSentiment": "POSITIVE | NEUTRAL | NEEDS_ATTENTION"
}`,
    messages: [
      {
        role: 'user',
        content: `Generate a retrospective for this boardroom session:\n\n${sessionSummary}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === 'text')?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Build retrospective without Claude (fallback for API failures).
 */
function buildFallbackRetro(debrief, qaReport, securityAudit) {
  const decisions = debrief.witness?.decisions || [];
  const redFlags = debrief.witness?.red_flags || [];

  return {
    whatWentWell: [
      `Session ${debrief.sessionId} completed successfully`,
      debrief.buildStatus === 'GREEN' ? 'Build status GREEN — system healthy' : `Build status: ${debrief.buildStatus}`,
      `${decisions.length} decisions logged by the Witness`,
    ],
    whatToImprove: redFlags.length > 0 ? redFlags.slice(0, 3) : ['No red flags detected this session'],
    nextSessionPriorities: decisions.slice(0, 3).map((d, i) => ({
      priority: i + 1,
      action: d,
      owner: 'CEO',
      deadline: 'next session',
    })),
    feedbackForNextSession: `Previous session (${debrief.sessionId}): BUILD_STATUS=${debrief.buildStatus}. Moon Shot: ${debrief.moonShot || 'not captured'}. ${decisions[0] ? `Top decision: ${decisions[0]}` : ''}`,
    overallHealthScore: debrief.buildStatus === 'GREEN' ? 85 : debrief.buildStatus === 'AMBER' ? 65 : 40,
    retroSentiment:
      debrief.buildStatus === 'GREEN' ? 'POSITIVE' : debrief.buildStatus === 'AMBER' ? 'NEUTRAL' : 'NEEDS_ATTENTION',
  };
}

/**
 * Run post-session retrospective.
 *
 * @param {string} sessionId
 * @param {string} dataDir
 * @returns {Promise<Object>} cycle_complete JSON (written to disk)
 */
export async function runRetro(sessionId, dataDir = './data/sessions') {
  console.log('\n[Retro] Final step — Post-session retrospective...');

  const sessionDir = path.join(dataDir, sessionId);

  // Load session artifacts
  let debrief = {};
  let qaReport = null;
  let securityAudit = null;

  try {
    debrief = JSON.parse(await fs.readFile(path.join(sessionDir, 'debrief.json'), 'utf-8'));
  } catch {
    debrief = { sessionId, buildStatus: 'UNKNOWN', witness: {}, moonShot: '' };
  }

  try {
    qaReport = JSON.parse(await fs.readFile(path.join(sessionDir, 'qa-report.json'), 'utf-8'));
  } catch {
    // QA report optional
  }

  try {
    securityAudit = JSON.parse(await fs.readFile(path.join(sessionDir, 'security-audit.json'), 'utf-8'));
  } catch {
    // Security audit optional
  }

  // Generate retrospective
  let retroData = null;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      retroData = await generateRetroWithClaude(client, debrief, qaReport, securityAudit);
    } catch (err) {
      console.warn(`[Retro] Claude retro generation failed: ${err.message} — using fallback`);
    }
  }

  if (!retroData) {
    retroData = buildFallbackRetro(debrief, qaReport, securityAudit);
  }

  // Build cycle_complete artifact
  const cycleComplete = {
    sessionId,
    completedAt: new Date().toISOString(),
    buildStatus: debrief.buildStatus || 'UNKNOWN',
    qaStatus: qaReport?.qaStatus || 'SKIPPED',
    securityStatus: securityAudit?.securityStatus || 'SKIPPED',
    youtubeVideoId: debrief.youtubeVideoId || null,
    moonShot: debrief.moonShot || null,
    decisions: debrief.witness?.decisions || [],
    redFlags: debrief.witness?.red_flags || [],
    retrospective: retroData,
    nextSessionContext: retroData?.feedbackForNextSession || '',
    nextSessionScheduled: true,
    artifacts: {
      debrief: `data/sessions/${sessionId}/debrief.json`,
      videoBrief: `data/sessions/${sessionId}/video-brief.json`,
      qaReport: qaReport ? `data/sessions/${sessionId}/qa-report.json` : null,
      securityAudit: securityAudit ? `data/sessions/${sessionId}/security-audit.json` : null,
      competitiveIntelligence: `data/sessions/${sessionId}/competitive-intelligence.json`,
    },
  };

  // Write cycle_complete.json (overwrites the basic one from orchestrator)
  const cycleCompletePath = path.join(sessionDir, 'cycle_complete.json');
  await fs.writeFile(cycleCompletePath, JSON.stringify(cycleComplete, null, 2));

  // Also write to root data dir as "latest" for next session to pick up
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'last_session.json'), JSON.stringify(cycleComplete, null, 2));

  console.log(`[Retro] Retrospective complete — ${retroData?.retroSentiment || 'UNKNOWN'} sentiment`);
  console.log(`[Retro] Health score: ${retroData?.overallHealthScore || 'N/A'}/100`);
  console.log(`[Retro] Cycle complete → ${cycleCompletePath} ✅`);

  return cycleComplete;
}

export default runRetro;
