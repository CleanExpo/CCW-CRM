/**
 * review-pipeline.js — Automated PR Review Orchestration
 * UNI-1741 [CR-4] — Review Pipeline Script
 */

'use strict';

const { execFileSync } = require('child_process');

const REVIEWERS = {
  security:      { agent: 'review-security',      model: 'opus',   mandatory: false },
  database:      { agent: 'review-database',      model: 'sonnet', mandatory: false },
  codeQuality:   { agent: 'review-code-quality',  model: 'sonnet', mandatory: true  },
  testCoverage:  { agent: 'review-test-coverage', model: 'sonnet', mandatory: true  },
  infrastructure:{ agent: 'review-infrastructure',model: 'haiku',  mandatory: false },
  performance:   { agent: 'review-performance',   model: 'haiku',  mandatory: false },
};

// File pattern → reviewer routing rules
const ROUTING_RULES = [
  { pattern: /\.(sql|migration)$/i,           reviewers: ['database', 'security'] },
  { pattern: /rls|policy|auth|login|session|token|jwt/i, reviewers: ['security'] },
  { pattern: /payment|billing|stripe|invoice/i,reviewers: ['security'] },
  { pattern: /\.test\.|__tests__|spec\./i,    reviewers: ['testCoverage'] },
  { pattern: /dockerfile|docker-compose|\.github|ci\.yml/i, reviewers: ['infrastructure'] },
  { pattern: /\.env|\.secret|credential/i,   reviewers: ['security'] },
  { pattern: /query|select|insert|update|delete|supabase/i, reviewers: ['database', 'performance'] },
  { pattern: /\.(jsx?|tsx?)$/i,              reviewers: ['codeQuality'] },
];

/**
 * Analyse the git diff between HEAD and a base branch.
 * @param {string} [baseBranch='develop']
 * @returns {{ files: string[], fileCount: number, stat: string, linesAdded: number, linesRemoved: number }}
 */
function analyzeDiff(baseBranch = 'develop') {
  let filesRaw = '';
  let stat = '';

  try {
    filesRaw = execFileSync('git', ['diff', '--name-only', `${baseBranch}...HEAD`], {
      encoding: 'utf8',
    });
  } catch (_) {}

  try {
    stat = execFileSync('git', ['diff', '--stat', `${baseBranch}...HEAD`], {
      encoding: 'utf8',
    });
  } catch (_) {}

  const files = filesRaw.trim().split('\n').filter(Boolean);

  return {
    files,
    fileCount: files.length,
    stat,
    linesAdded: parseInt((stat.match(/(\d+) insertion/) || [0, 0])[1]),
    linesRemoved: parseInt((stat.match(/(\d+) deletion/) || [0, 0])[1]),
  };
}

/**
 * Route a diff analysis to the appropriate specialist reviewers.
 * @param {ReturnType<analyzeDiff>} diffAnalysis
 * @returns {Array<{ name: string, agent: string, model: string, mandatory: boolean }>}
 */
function routeReviewers(diffAnalysis) {
  // Code quality and test coverage are always mandatory
  const required = new Set(['codeQuality', 'testCoverage']);

  for (const file of diffAnalysis.files) {
    for (const rule of ROUTING_RULES) {
      if (rule.pattern.test(file)) {
        rule.reviewers.forEach(r => required.add(r));
      }
    }
  }

  return Array.from(required).map(name => ({
    name,
    ...REVIEWERS[name],
  }));
}

/**
 * Check PR size against limits.
 * @param {ReturnType<analyzeDiff>} diffAnalysis
 * @returns {{ status: 'OK'|'WARN'|'BLOCK', lines: number, reason?: string }}
 */
function checkPRSize(diffAnalysis) {
  const totalLines = diffAnalysis.linesAdded + diffAnalysis.linesRemoved;

  if (totalLines > 1000) {
    return {
      status: 'BLOCK',
      lines: totalLines,
      reason: `PR too large (${totalLines} lines changed). Must split into smaller PRs.`,
    };
  }
  if (totalLines > 500) {
    return {
      status: 'WARN',
      lines: totalLines,
      reason: `Large PR (${totalLines} lines). Consider splitting.`,
    };
  }
  return { status: 'OK', lines: totalLines };
}

/**
 * Aggregate findings from multiple reviewer reports, deduplicating overlapping findings.
 * @param {Array<{ reviewer: string, verdict: string, confidence: number, findings: object }>} reports
 * @returns {{ findings: object, verdicts: Array }}
 */
function aggregateReports(reports = []) {
  const findings = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  const verdicts = [];

  for (const report of reports) {
    verdicts.push({
      reviewer: report.reviewer,
      verdict: report.verdict || 'COMMENT',
      confidence: report.confidence || 0.5,
    });

    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (Array.isArray(report.findings && report.findings[severity])) {
        findings[severity].push(
          ...report.findings[severity].map(f => ({ ...f, source: report.reviewer }))
        );
      }
    }
  }

  // Deduplicate by file:line:description
  for (const severity of Object.keys(findings)) {
    const seen = new Set();
    findings[severity] = findings[severity].filter(f => {
      const key = `${f.file || ''}:${f.line || ''}:${f.description || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return { findings, verdicts };
}

/**
 * Make a SHIP/NEEDS_WORK/BLOCK decision based on aggregated findings.
 * @param {ReturnType<aggregateReports>} aggregated
 * @returns {'SHIP'|'NEEDS_WORK'|'BLOCK'}
 */
function makeDecision(aggregated) {
  if (aggregated.findings.CRITICAL.length > 0) return 'BLOCK';
  if (aggregated.findings.HIGH.length > 0) return 'NEEDS_WORK';
  if (aggregated.verdicts.some(v => v.verdict === 'REQUEST_CHANGES')) return 'NEEDS_WORK';
  return 'SHIP';
}

/**
 * Generate a structured review report.
 * @param {{ diffAnalysis: object, sizeCheck: object, assignedReviewers: Array, aggregated: object, decision: string }} opts
 * @returns {string}
 */
function generateReport({ diffAnalysis, sizeCheck, assignedReviewers, aggregated, decision }) {
  const divider = '═'.repeat(47);
  const lines = [
    divider,
    '  CODE REVIEW REPORT',
    `  Decision: ${decision}`,
    `  Date: ${new Date().toISOString()}`,
    divider,
    '',
    `BLAST RADIUS`,
    `  Files:    ${diffAnalysis.fileCount}`,
    `  Lines:    +${diffAnalysis.linesAdded} / -${diffAnalysis.linesRemoved}`,
    `  PR Size:  ${sizeCheck.status}${sizeCheck.reason ? ` — ${sizeCheck.reason}` : ''}`,
    '',
    `FINDINGS`,
    `  CRITICAL: ${aggregated.findings.CRITICAL.length}`,
    `  HIGH:     ${aggregated.findings.HIGH.length}`,
    `  MEDIUM:   ${aggregated.findings.MEDIUM.length}`,
    `  LOW:      ${aggregated.findings.LOW.length}`,
    '',
    `REVIEWERS`,
    ...aggregated.verdicts.map(v => `  ${v.reviewer}: ${v.verdict} (${Math.round((v.confidence || 0.5) * 100)}%)`),
    divider,
  ];

  return lines.join('\n');
}

module.exports = {
  analyzeDiff,
  routeReviewers,
  checkPRSize,
  aggregateReports,
  makeDecision,
  generateReport,
  REVIEWERS,
  ROUTING_RULES,
};
