/**
 * approval-gate.js — Approval Boundaries for Critical Operations
 * Deny-by-default: unknown operations require human approval.
 * UNI-1731 [C11] — Approval Boundaries
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APPROVALS_DIR = path.join(process.cwd(), '.approvals');

// Operations that ALWAYS require human approval (destructive / irreversible)
const ALWAYS_REQUIRE = new Set([
  'database:migrate',
  'database:delete',
  'supabase:rls:modify',
  'payment:process',
  'video:publish',
  'api:external:write',
  'user:delete',
  'deploy:production',
  'secret:rotate',
  'schema:drop',
  'table:truncate',
]);

// Operations that are auto-approved (safe reads / non-destructive)
const AUTO_APPROVE = new Set([
  'database:read',
  'api:internal:read',
  'log:write',
  'cache:invalidate',
  'report:generate',
  'api:external:read',
  'file:read',
  'health:check',
]);

// Conditional rules with threshold checks
const CONDITIONAL_RULES = [
  {
    operation: 'database:write',
    check: (params) => {
      if (params && params.rowCount && params.rowCount > 100) {
        return { approved: false, reason: `Exceeds maxRows limit (${params.rowCount} > 100)` };
      }
      return { approved: true };
    },
  },
  {
    operation: 'api:external:read',
    check: (params) => {
      if (params && params.callsPerMinute && params.callsPerMinute > 60) {
        return { approved: false, reason: `Exceeds rate limit (${params.callsPerMinute} > 60/min)` };
      }
      return { approved: true };
    },
  },
  {
    operation: 'email:send',
    check: (params) => {
      if (params && params.recipients && params.recipients.length > 10) {
        return { approved: false, reason: `Exceeds maxRecipients (${params.recipients.length} > 10)` };
      }
      return { approved: true };
    },
  },
  {
    operation: 'slack:send',
    check: (params) => {
      const ALLOWED_CHANNELS = ['#ccw-board', '#ccw-releases', '#ccw-security', '#ccw-alerts', '#general'];
      if (params && params.channel && !ALLOWED_CHANNELS.includes(params.channel)) {
        return { approved: false, reason: `Channel "${params.channel}" not in whitelist` };
      }
      return { approved: true };
    },
  },
];

function ensureApprovalsDir() {
  if (!fs.existsSync(APPROVALS_DIR)) {
    fs.mkdirSync(APPROVALS_DIR, { recursive: true });
  }
}

/**
 * Check if an operation is approved.
 * @param {string} operation - e.g., 'database:migrate'
 * @param {object} params - Operation parameters for conditional checks
 * @returns {{ approved: boolean, method: string, requestId?: string, reason?: string }}
 */
function checkApproval(operation, params = {}) {
  // Auto-approved operations
  if (AUTO_APPROVE.has(operation)) {
    return { approved: true, method: 'auto', operation };
  }

  // Always require approval
  if (ALWAYS_REQUIRE.has(operation)) {
    const request = createApprovalRequest(operation, params);
    return {
      approved: false,
      method: 'human_required',
      requestId: request.id,
      operation,
      reason: `Operation "${operation}" always requires human approval`,
      requestFile: request.filePath,
    };
  }

  // Check conditional rules
  for (const rule of CONDITIONAL_RULES) {
    if (rule.operation === operation) {
      const result = rule.check(params);
      if (!result.approved) {
        const request = createApprovalRequest(operation, params, result.reason);
        return {
          approved: false,
          method: 'conditional_failed',
          requestId: request.id,
          operation,
          reason: result.reason,
          requestFile: request.filePath,
        };
      }
      return { approved: true, method: 'conditional_passed', operation };
    }
  }

  // Deny by default for unknown operations
  const request = createApprovalRequest(operation, params, 'Unknown operation — deny by default');
  return {
    approved: false,
    method: 'deny_by_default',
    requestId: request.id,
    operation,
    reason: `Unknown operation "${operation}" — requires approval (deny-by-default policy)`,
    requestFile: request.filePath,
  };
}

/**
 * Create an approval request file.
 */
function createApprovalRequest(operation, params, reason = '') {
  ensureApprovalsDir();
  const id = crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`;
  const request = {
    id,
    operation,
    params,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
    requestedBy: process.env.CCW_SESSION_ID || 'autonomous-agent',
    approvedBy: null,
    approvedAt: null,
  };
  const filePath = path.join(APPROVALS_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(request, null, 2));

  try {
    const { logGovernance } = require('./audit-logger');
    logGovernance({
      actor: 'approval-gate',
      action: `approval_requested:${operation}`,
      decision: 'pending',
      reasoning: reason,
      riskLevel: ALWAYS_REQUIRE.has(operation) ? 'HIGH' : 'MEDIUM',
    });
  } catch (_) {}

  return { id, filePath };
}

/**
 * Approve a pending request.
 * @param {string} requestId
 * @param {string} approver - Name/ID of the human approver
 * @returns {object|null}
 */
function approveRequest(requestId, approver = 'human') {
  const filePath = path.join(APPROVALS_DIR, `${requestId}.json`);
  if (!fs.existsSync(filePath)) return null;

  const request = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  request.status = 'approved';
  request.approvedBy = approver;
  request.approvedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(request, null, 2));

  try {
    const { logGovernance } = require('./audit-logger');
    logGovernance({
      actor: approver,
      action: `approved:${request.operation}`,
      decision: 'approved',
      reasoning: `Manually approved by ${approver}`,
      riskLevel: 'HIGH',
    });
  } catch (_) {}

  return request;
}

/**
 * Deny a pending request.
 * @param {string} requestId
 * @param {string} denier
 * @param {string} reason
 * @returns {object|null}
 */
function denyRequest(requestId, denier = 'human', reason = '') {
  const filePath = path.join(APPROVALS_DIR, `${requestId}.json`);
  if (!fs.existsSync(filePath)) return null;

  const request = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  request.status = 'denied';
  request.deniedBy = denier;
  request.deniedAt = new Date().toISOString();
  request.denialReason = reason;
  fs.writeFileSync(filePath, JSON.stringify(request, null, 2));

  return request;
}

/**
 * List all pending approval requests.
 */
function listPendingRequests() {
  ensureApprovalsDir();
  return fs.readdirSync(APPROVALS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(APPROVALS_DIR, f), 'utf8')))
    .filter(r => r.status === 'pending');
}

module.exports = {
  checkApproval,
  approveRequest,
  denyRequest,
  listPendingRequests,
  ALWAYS_REQUIRE,
  AUTO_APPROVE,
  CONDITIONAL_RULES,
  APPROVALS_DIR,
};
