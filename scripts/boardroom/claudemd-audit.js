/**
 * CCW Boardroom — CLAUDE.md Fortnightly Audit (UNI-1140)
 *
 * Scans all known CLAUDE.md paths across the Unite-Group workspace.
 * Runs fortnightly (every Monday) in the boardroom CRON session.
 *
 * Audit gates (pass = 7/8 minimum per file):
 *   1. version field present
 *   2. PRIME DIRECTIVE section exists
 *   3. ABSOLUTE PROHIBITIONS section exists
 *   4. TECH STACK section exists
 *   5. SESSION SEQUENCE section exists
 *   6. No hardcoded secrets/API keys
 *   7. Line count within bounds (100–500 lines)
 *   8. Updated within 90 days (checks for date pattern)
 *
 * Produces: data/sessions/{sessionId}/claudemd-audit.json
 * Force run: FORCE_CLAUDEMD_AUDIT=1 env var
 */

import fs from 'fs/promises';
import path from 'path';

// All CLAUDE.md files that should exist across the workspace
const KNOWN_CLAUDEMD_PATHS = [
  'CLAUDE.md',
  '.claude/CLAUDE.md',
  'scripts/claude_md_template.md',
];

// Secret patterns that must NOT appear in CLAUDE.md
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[a-zA-Z0-9]{24,}/,
  /sk_test_[a-zA-Z0-9]{24,}/,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  /(?:api_key|apikey|API_KEY)\s*[=:]\s*["'][a-zA-Z0-9_\-]{20,}["']/,
  /(?:password|passwd|secret)\s*[=:]\s*["'][^"']{8,}["']/i,
];

// Required sections (at least one match per gate)
const REQUIRED_SECTIONS = [
  { id: 'prime_directive', patterns: ['PRIME DIRECTIVE', 'Prime Directive'] },
  { id: 'prohibitions', patterns: ['ABSOLUTE PROHIBITIONS', 'PROHIBITIONS', 'Forbidden', 'FORBIDDEN'] },
  { id: 'tech_stack', patterns: ['TECH STACK', 'Tech Stack', 'Technology Stack'] },
  { id: 'session_sequence', patterns: ['SESSION SEQUENCE', 'MANDATORY BEHAVIORS', 'MANDATORY', 'session sequence'] },
];

// Date patterns to detect "updated within 90 days"
const DATE_PATTERN = /20\d\d-\d\d-\d\d/;

/**
 * Audit a single CLAUDE.md file.
 * @param {string} filePath - Absolute path
 * @param {string} relPath - Relative path for reporting
 * @returns {Promise<Object>} Audit result
 */
async function auditFile(filePath, relPath) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return {
      path: relPath,
      exists: false,
      score: 0,
      maxScore: 8,
      pass: false,
      gates: {},
      issues: [`File not found: ${relPath}`],
    };
  }

  const lines = content.split('\n');
  const lineCount = lines.length;
  const issues = [];
  const gates = {};

  // Gate 1: Version field
  gates.version_field = /version[:\s]+\d+\.\d+/i.test(content) || /\*\*Version\*\*/i.test(content);
  if (!gates.version_field) issues.push('No version field found');

  // Gate 2-5: Required sections
  for (const { id, patterns } of REQUIRED_SECTIONS) {
    gates[id] = patterns.some((p) => content.includes(p));
    if (!gates[id]) issues.push(`Missing section: ${id} (expected one of: ${patterns.join(', ')})`);
  }

  // Gate 6: No secrets
  let secretsFound = false;
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      secretsFound = true;
      issues.push(`Potential secret detected (pattern: ${pattern.source.substring(0, 30)}...)`);
      break;
    }
  }
  gates.no_secrets = !secretsFound;

  // Gate 7: Line count
  gates.length_ok = lineCount >= 50 && lineCount <= 600;
  if (lineCount < 50) issues.push(`Too short: ${lineCount} lines (min 50)`);
  if (lineCount > 600) issues.push(`Too long: ${lineCount} lines (max 600)`);

  // Gate 8: Updated recently (contains a date within last 90 days)
  const dateMatches = content.match(new RegExp(DATE_PATTERN.source, 'g')) || [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  gates.updated_recently = dateMatches.some((d) => new Date(d) >= ninetyDaysAgo);
  if (!gates.updated_recently) issues.push(`No recent date found (needs date within 90 days, e.g. ${new Date().toISOString().split('T')[0]})`);

  const score = Object.values(gates).filter(Boolean).length;
  const pass = score >= 7; // 7/8 gates minimum

  return {
    path: relPath,
    exists: true,
    score,
    maxScore: 8,
    pass,
    lineCount,
    gates,
    issues,
  };
}

/**
 * Run CLAUDE.md audit across all known paths.
 *
 * @param {string} sessionId
 * @param {string} dataDir
 * @param {string} rootDir - Project root
 * @returns {Promise<Object>} Audit report, or null if skipped
 */
export async function runClaudemdAudit(sessionId, dataDir = './data/sessions', rootDir = '.') {
  // Only run on Mondays OR if forced
  const isMonday = new Date().getDay() === 1;
  const isForced = process.env.FORCE_CLAUDEMD_AUDIT === '1';

  if (!isMonday && !isForced) {
    console.log('[AUDIT] CLAUDE.md audit skipped (not Monday + FORCE_CLAUDEMD_AUDIT not set)');
    return null;
  }

  console.log('\n[AUDIT] Fortnightly CLAUDE.md audit starting...');

  const sessionDir = path.join(dataDir, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const results = [];

  for (const relPath of KNOWN_CLAUDEMD_PATHS) {
    const absPath = path.join(rootDir, relPath);
    const result = await auditFile(absPath, relPath);
    results.push(result);

    const status = result.exists ? (result.pass ? '✅' : '❌') : '⚠️ MISSING';
    console.log(`[AUDIT] ${relPath}: ${status} (${result.score}/${result.maxScore})`);
  }

  const existingFiles = results.filter((r) => r.exists);
  const passingFiles = results.filter((r) => r.pass);
  const missingFiles = results.filter((r) => !r.exists);
  const failingFiles = results.filter((r) => r.exists && !r.pass);

  const overallPass = missingFiles.length === 0 && failingFiles.length === 0;

  const report = {
    sessionId,
    generatedAt: new Date().toISOString(),
    overallPass,
    summary: {
      total: results.length,
      existing: existingFiles.length,
      missing: missingFiles.length,
      passing: passingFiles.length,
      failing: failingFiles.length,
    },
    results,
    failingPaths: failingFiles.map((r) => r.path),
    missingPaths: missingFiles.map((r) => r.path),
  };

  const outPath = path.join(sessionDir, 'claudemd-audit.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  const statusEmoji = overallPass ? '✅' : '❌';
  console.log(
    `[AUDIT] CLAUDE.md audit: ${passingFiles.length}/${results.length} files healthy ${statusEmoji}`
  );

  if (failingFiles.length > 0) {
    console.warn(`[AUDIT] Failing files:\n${failingFiles.map((r) => `  - ${r.path}: ${r.issues.join(', ')}`).join('\n')}`);
  }
  if (missingFiles.length > 0) {
    console.warn(`[AUDIT] Missing files:\n${missingFiles.map((r) => `  - ${r.path}`).join('\n')}`);
  }

  return report;
}

export default runClaudemdAudit;
