/**
 * release-manager.js — develop → main Release Pipeline Automation
 * UNI-1745 [PROD-3] — Release Automation
 */

'use strict';

const { execFileSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Generate a version string in format vYYYY.MM.DD.{sequence}
 * @returns {string} e.g., 'v2026.03.31.1'
 */
function generateVersion() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '.');

  let tags = [];
  try {
    const raw = execFileSync('git', ['tag', '-l', `v${date}.*`], { encoding: 'utf8' }).trim();
    tags = raw.split('\n').filter(Boolean);
  } catch (_) {}

  const seq = tags.length + 1;
  return `v${date}.${seq}`;
}

/**
 * Get commit history since the last release tag on main.
 * @param {string} [baseBranch='main'] - Branch containing last release
 * @param {string} [headBranch='develop'] - Branch to release from
 * @returns {{ features: string[], fixes: string[], security: string[], other: string[], total: number, lastTag: string }}
 */
function getChangesSinceLastRelease(baseBranch = 'main', headBranch = 'develop') {
  let lastTag = '';
  try {
    lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0', baseBranch], {
      encoding: 'utf8',
    }).trim();
  } catch (_) {
    // No tags yet — use initial commit
    try {
      lastTag = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
    } catch (_) {
      lastTag = '';
    }
  }

  let rawLog = '';
  try {
    rawLog = execFileSync(
      'git',
      ['log', lastTag ? `${lastTag}..${headBranch}` : headBranch, '--pretty=format:%h %s'],
      { encoding: 'utf8' }
    );
  } catch (_) {}

  const commits = rawLog.trim().split('\n').filter(Boolean);

  const features = commits.filter((c) => c.match(/\bfeat[\s(]/i));
  const fixes = commits.filter((c) => c.match(/\bfix[\s(]/i));
  const security = commits.filter(
    (c) => c.match(/\bsecur/i) || c.match(/\brls\b/i) || c.match(/\bcve\b/i)
  );
  const other = commits.filter(
    (c) => !features.includes(c) && !fixes.includes(c) && !security.includes(c)
  );

  return { features, fixes, security, other, total: commits.length, lastTag };
}

/**
 * Generate formatted release notes.
 * @param {string} version
 * @param {ReturnType<getChangesSinceLastRelease>} changes
 * @returns {string}
 */
function generateReleaseNotes(version, changes) {
  const lines = [
    `# Release ${version}`,
    '',
    `**Date**: ${new Date().toISOString()}`,
    `**Commits**: ${changes.total}`,
    `**Since**: ${changes.lastTag || 'initial commit'}`,
    '',
  ];

  if (changes.security.length) {
    lines.push('## Security', ...changes.security.map((c) => `- ${c}`), '');
  }
  if (changes.features.length) {
    lines.push('## Features', ...changes.features.map((c) => `- ${c}`), '');
  }
  if (changes.fixes.length) {
    lines.push('## Bug Fixes', ...changes.fixes.map((c) => `- ${c}`), '');
  }
  if (changes.other.length) {
    lines.push('## Other Changes', ...changes.other.map((c) => `- ${c}`), '');
  }

  return lines.join('\n');
}

/**
 * Create a GitHub PR for the release (develop → main).
 * @param {string} version
 * @param {string} notes
 * @returns {string} PR URL
 */
function createReleasePR(version, notes) {
  const body = [
    notes,
    '',
    '---',
    '',
    '**Approval required from**: CEO (@phillmcgurk)',
    '',
    '### Release Checklist',
    '- [ ] All CI checks passing',
    '- [ ] No CRITICAL/HIGH findings from code review',
    '- [ ] Coverage >= 80%',
    '- [ ] RLS policies verified',
    '- [ ] CEO approval received',
  ].join('\n');

  const result = execFileSync(
    'gh',
    [
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      'develop',
      '--title',
      `Release ${version}`,
      '--body',
      body,
    ],
    { encoding: 'utf8' }
  );

  try {
    const { logGovernance } = require('./audit-logger');
    logGovernance({
      actor: 'release-manager',
      action: 'release:pr-created',
      decision: `PR created for ${version}`,
      reasoning: `Automated release PR from develop to main`,
      riskLevel: 'HIGH',
    });
  } catch (_) {}

  return result.trim();
}

/**
 * Create an annotated git tag and push it.
 * @param {string} version
 */
function tagRelease(version) {
  execFileSync('git', ['tag', '-a', version, '-m', `Release ${version}`]);
  execFileSync('git', ['push', 'origin', version]);

  try {
    const { logGovernance } = require('./audit-logger');
    logGovernance({
      actor: 'release-manager',
      action: 'release:tagged',
      decision: `Tagged ${version}`,
      reasoning: `Production release tag created`,
      riskLevel: 'HIGH',
    });
  } catch (_) {}
}

/**
 * Post release notification to Slack #ccw-releases channel.
 * Requires SLACK_WEBHOOK_URL env var.
 * @param {string} version
 * @param {string} notes
 */
async function notifySlack(version, notes) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[RELEASE-MANAGER] SLACK_WEBHOOK_URL not set — skipping Slack notification');
    return;
  }

  const message = {
    channel: '#ccw-releases',
    text: `*Release ${version} deployed to production*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Release ${version}* has been merged to main and deployed.\n\n${notes.slice(0, 500)}...`,
        },
      },
    ],
  };

  const https = require('https');
  const url = new URL(webhookUrl);
  const body = JSON.stringify(message);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        resolve(res.statusCode);
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  generateVersion,
  getChangesSinceLastRelease,
  generateReleaseNotes,
  createReleasePR,
  tagRelease,
  notifySlack,
};
