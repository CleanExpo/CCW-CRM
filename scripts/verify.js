#!/usr/bin/env node
/**
 * verify.js — 6-Phase Verification Loop
 * Quality gates before any publish/deploy action.
 * UNI-1723 [C4] — Verification Loops
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ------- Phase implementations -------

/**
 * Phase 1: JSON Schema Validation
 * Validates that sessionData has required fields.
 */
async function verifySchema(sessionData) {
  const phase = 'Phase 1: Schema Validation';
  const required = ['session_id', 'timestamp'];
  const missing = required.filter(k => !sessionData[k]);

  if (missing.length > 0) {
    return {
      phase,
      status: 'WARN',
      message: `Missing recommended fields: ${missing.join(', ')}`,
    };
  }
  return { phase, status: 'PASS', message: 'Schema valid' };
}

/**
 * Phase 2: Decision Consistency
 * Checks for obvious contradictions in decision list.
 */
async function verifyNoContradictions(decisions = []) {
  const phase = 'Phase 2: Decision Consistency';

  if (!Array.isArray(decisions)) {
    return { phase, status: 'WARN', message: 'decisions field is not an array' };
  }

  // Look for obvious contradictions (expand rules as needed)
  const contradictionPairs = [
    ['deploy', 'rollback'],
    ['enable', 'disable'],
    ['approve', 'reject'],
  ];

  for (const [a, b] of contradictionPairs) {
    const hasA = decisions.some(d => typeof d === 'string' && d.toLowerCase().includes(a));
    const hasB = decisions.some(d => typeof d === 'string' && d.toLowerCase().includes(b));
    if (hasA && hasB) {
      return {
        phase,
        status: 'FAIL',
        message: `Contradictory decisions detected: "${a}" and "${b}" both present`,
      };
    }
  }

  return { phase, status: 'PASS', message: `${decisions.length} decision(s) checked, no contradictions` };
}

/**
 * Phase 3: Security Scan
 * Looks for leaked secrets in session output.
 */
async function verifyNoSecrets(content = '') {
  const phase = 'Phase 3: Security Scan';

  const secretPatterns = [
    { pattern: /sk-[a-zA-Z0-9]{48}/, name: 'OpenAI key' },
    { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS key' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub token' },
    { pattern: /sk-ant-[a-zA-Z0-9\-_]{40,}/, name: 'Anthropic key' },
  ];

  const found = secretPatterns.filter(({ pattern }) => pattern.test(content));

  if (found.length > 0) {
    return {
      phase,
      status: 'FAIL',
      message: `Secrets detected: ${found.map(f => f.name).join(', ')} — CRITICAL`,
    };
  }

  return { phase, status: 'PASS', message: 'No secrets detected in session output' };
}

/**
 * Phase 4: Content Sanitisation Check
 * Verifies intel highlights don't contain injection vectors.
 */
async function verifyAllContentSanitised(intelHighlights = []) {
  const phase = 'Phase 4: Content Sanitisation';

  if (!Array.isArray(intelHighlights)) {
    return { phase, status: 'WARN', message: 'intel_highlights is not an array — skipping' };
  }

  // Check for zero-width chars and injection patterns
  const zeroWidthPattern = /[\u200B\u200C\u200D\u2060\uFEFF\u202A-\u202E]/;
  const injectionPattern = /ignore\s+(all\s+)?(previous|prior|above)/i;

  for (let i = 0; i < intelHighlights.length; i++) {
    const item = typeof intelHighlights[i] === 'string' ? intelHighlights[i] : JSON.stringify(intelHighlights[i]);
    if (zeroWidthPattern.test(item)) {
      return {
        phase,
        status: 'FAIL',
        message: `intel_highlights[${i}] contains zero-width Unicode — run sanitise.js first`,
      };
    }
    if (injectionPattern.test(item)) {
      return {
        phase,
        status: 'FAIL',
        message: `intel_highlights[${i}] contains prompt injection pattern`,
      };
    }
  }

  return { phase, status: 'PASS', message: `${intelHighlights.length} intel item(s) sanitisation check passed` };
}

/**
 * Phase 5: Video Pipeline Readiness (optional — only if video_brief present)
 */
async function verifyVideoReady(videoBrief = {}) {
  const phase = 'Phase 5: Video Pipeline Readiness';

  const required = ['title', 'script'];
  const missing = required.filter(k => !videoBrief[k]);

  if (missing.length > 0) {
    return {
      phase,
      status: 'FAIL',
      message: `Video brief missing required fields: ${missing.join(', ')}`,
    };
  }

  if (videoBrief.script && videoBrief.script.length < 50) {
    return { phase, status: 'WARN', message: 'Video script seems very short (<50 chars)' };
  }

  return { phase, status: 'PASS', message: 'Video brief validated' };
}

/**
 * Phase 6: Compliance Gate
 * Checks AU Privacy Act requirements.
 */
async function verifyComplianceChecklist(sessionData) {
  const phase = 'Phase 6: Compliance Gate';
  const warnings = [];

  // Check if any user data is being processed without consent marker
  if (sessionData.user_data_processed && !sessionData.consent_verified) {
    warnings.push('user_data_processed=true but consent_verified not set');
  }

  // Check if AI decision log is populated when decisions affect users
  if (sessionData.decisions_affecting_users && !sessionData.ai_decision_log_id) {
    warnings.push('decisions_affecting_users but no ai_decision_log_id');
  }

  if (warnings.length > 0) {
    return {
      phase,
      status: 'WARN',
      message: `Compliance warnings: ${warnings.join('; ')}`,
    };
  }

  return { phase, status: 'PASS', message: 'Compliance checklist passed' };
}

// ------- Main runner -------

/**
 * Run all 6 verification phases.
 *
 * @param {object} sessionData - The session data to verify
 * @returns {Promise<{ passed: boolean, results: Array, failures: Array }>}
 */
async function runVerificationLoop(sessionData = {}) {
  console.log('[VERIFY] Starting 6-phase verification loop...');
  const results = [];

  results.push(await verifySchema(sessionData));
  results.push(await verifyNoContradictions(sessionData.decisions));
  results.push(await verifyNoSecrets(JSON.stringify(sessionData)));
  results.push(await verifyAllContentSanitised(sessionData.intel_highlights));

  if (sessionData.video_brief) {
    results.push(await verifyVideoReady(sessionData.video_brief));
  }

  results.push(await verifyComplianceChecklist(sessionData));

  // Report results
  for (const result of results) {
    const icon = result.status === 'PASS' ? '[PASS]' : result.status === 'WARN' ? '[WARN]' : '[FAIL]';
    console.log(`${icon} ${result.phase}: ${result.message}`);
  }

  const failures = results.filter(r => r.status === 'FAIL');
  const warnings = results.filter(r => r.status === 'WARN');

  if (failures.length > 0) {
    console.error(`\n[VERIFY] BLOCKED: ${failures.length} CRITICAL gate(s) failed`);
    return { passed: false, results, failures };
  }

  if (warnings.length > 0) {
    console.warn(`\n[VERIFY] PASSED with ${warnings.length} warning(s)`);
  } else {
    console.log('\n[VERIFY] All gates passed');
  }

  return { passed: true, results, failures: [] };
}

module.exports = {
  runVerificationLoop,
  verifySchema,
  verifyNoContradictions,
  verifyNoSecrets,
  verifyAllContentSanitised,
  verifyVideoReady,
  verifyComplianceChecklist,
};

// CLI: node scripts/verify.js session.json
if (require.main === module) {
  const inputFile = process.argv[2];
  let sessionData = {};

  if (inputFile && fs.existsSync(inputFile)) {
    try {
      sessionData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    } catch (e) {
      console.error(`[VERIFY] Failed to parse ${inputFile}: ${e.message}`);
      process.exit(1);
    }
  }

  runVerificationLoop(sessionData).then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}
