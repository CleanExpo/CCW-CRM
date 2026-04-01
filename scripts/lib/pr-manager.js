/**
 * pr-manager.js — GitHub PR Lifecycle & Merge Control
 * UNI-1739 [CR-2] — PR Manager Agent
 */

'use strict';

const { execFileSync } = require('child_process');

const PR_SIZE_THRESHOLDS = {
  AUTO_PROCEED: 200,
  WARN: 500,
  JUSTIFY: 1000,
  BLOCK: Infinity,
};

const MERGE_PRIORITY = ['security', 'bug', 'fix', 'feat', 'feature', 'refactor', 'docs'];

/**
 * Create a GitHub pull request.
 * @param {{ branch: string, title: string, body: string, base?: string, draft?: boolean }} opts
 * @returns {string} PR URL
 */
function createPR({ branch, title, body, base = 'develop', draft = false }) {
  const args = ['pr', 'create', '--base', base, '--head', branch, '--title', title, '--body', body];
  if (draft) args.push('--draft');
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

/**
 * Check if a PR meets all readiness gates.
 * @param {number} prNumber
 * @returns {{ ready: boolean, issues: string[] }}
 */
function checkPRReadiness(prNumber) {
  const issues = [];

  try {
    const raw = execFileSync('gh', ['pr', 'view', String(prNumber), '--json',
      'statusCheckRollup,mergeable,isDraft,additions,deletions,title'], { encoding: 'utf8' });
    const pr = JSON.parse(raw);

    if (pr.isDraft) issues.push('PR is still in draft state');
    if (pr.mergeable === 'CONFLICTING') issues.push('PR has merge conflicts');

    const totalLines = (pr.additions || 0) + (pr.deletions || 0);
    const sizeCheck = checkPRSize({ linesAdded: pr.additions, linesRemoved: pr.deletions });
    if (sizeCheck.status === 'BLOCK') issues.push(sizeCheck.reason);

    if (Array.isArray(pr.statusCheckRollup)) {
      const failed = pr.statusCheckRollup.filter(c => c.state === 'FAILURE' || c.conclusion === 'failure');
      if (failed.length > 0) {
        issues.push(`${failed.length} CI check(s) failing: ${failed.map(c => c.name || c.context).join(', ')}`);
      }
    }
  } catch (e) {
    issues.push(`Could not check PR ${prNumber}: ${e.message}`);
  }

  return { ready: issues.length === 0, issues };
}

/**
 * Check PR size against thresholds.
 * @param {{ linesAdded: number, linesRemoved: number }} diffAnalysis
 * @returns {{ status: 'OK'|'WARN'|'BLOCK', lines: number, reason?: string }}
 */
function checkPRSize({ linesAdded = 0, linesRemoved = 0 } = {}) {
  const totalLines = linesAdded + linesRemoved;

  if (totalLines > PR_SIZE_THRESHOLDS.JUSTIFY) {
    return {
      status: 'BLOCK',
      lines: totalLines,
      reason: `PR too large (${totalLines} lines changed). Must be split into smaller PRs (limit: ${PR_SIZE_THRESHOLDS.JUSTIFY} lines).`,
    };
  }
  if (totalLines > PR_SIZE_THRESHOLDS.WARN) {
    return {
      status: 'WARN',
      lines: totalLines,
      reason: `Large PR (${totalLines} lines). Consider splitting for easier review.`,
    };
  }
  return { status: 'OK', lines: totalLines };
}

/**
 * Assign reviewers to a PR based on diff content.
 * @param {number} prNumber
 * @param {{ files: string[] }} diffAnalysis
 * @returns {string[]} Reviewer names/teams assigned
 */
function assignReviewers(prNumber, diffAnalysis = {}) {
  const reviewers = new Set();

  for (const file of (diffAnalysis.files || [])) {
    if (/\.(sql|migration)/i.test(file)) {
      reviewers.add('ccw-database-reviewer');
      reviewers.add('ccw-security-reviewer');
    }
    if (/rls|auth|login|token|jwt|session/i.test(file)) {
      reviewers.add('ccw-security-reviewer');
    }
    if (/dockerfile|docker-compose|ci\.yml/i.test(file)) {
      reviewers.add('ccw-infra-reviewer');
    }
    if (/payment|billing|stripe/i.test(file)) {
      reviewers.add('ccw-security-reviewer');
    }
  }

  // Always assign orchestrator
  reviewers.add('ccw-orchestrator');

  const reviewerList = Array.from(reviewers);

  if (reviewerList.length > 0) {
    try {
      execFileSync('gh', ['pr', 'edit', String(prNumber),
        '--add-reviewer', reviewerList.join(',')], { encoding: 'utf8' });
    } catch (e) {
      console.warn(`[PR-MANAGER] Could not assign reviewers: ${e.message}`);
    }
  }

  return reviewerList;
}

/**
 * Squash-merge a PR.
 * @param {number} prNumber
 * @param {'squash'|'merge'|'rebase'} [strategy='squash']
 * @returns {string} Result
 */
function mergePR(prNumber, strategy = 'squash') {
  return execFileSync('gh', ['pr', 'merge', String(prNumber), `--${strategy}`, '--delete-branch'],
    { encoding: 'utf8' }).trim();
}

/**
 * Create a release PR from develop → main.
 * @param {string} version
 * @returns {string} PR URL
 */
function createReleasePR(version) {
  const { generateReleaseNotes, getChangesSinceLastRelease } = require('./release-manager');
  const changes = getChangesSinceLastRelease('main', 'develop');
  const notes = generateReleaseNotes(version, changes);
  return createPR({
    branch: 'develop',
    title: `Release ${version}`,
    body: notes + '\n\n---\n\n**CEO approval required** (@phillmcgurk)',
    base: 'main',
  });
}

module.exports = {
  createPR,
  checkPRReadiness,
  checkPRSize,
  assignReviewers,
  mergePR,
  createReleasePR,
  PR_SIZE_THRESHOLDS,
  MERGE_PRIORITY,
};
