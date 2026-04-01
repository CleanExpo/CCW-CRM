/**
 * audit-logger.js — Structured CRON Logs & Governance Events
 * UNI-1728 [C10] — Audit Logger
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(process.cwd(), 'logs');
const GOVERNANCE_LOG = path.join(LOG_DIR, 'governance.jsonl');
const CRON_LOG = path.join(LOG_DIR, 'cron.jsonl');
const SECURITY_LOG = path.join(LOG_DIR, 'security.jsonl');

const RISK_LEVELS = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

// High-impact action keywords for blast radius scoring
const HIGH_IMPACT_KEYWORDS = ['deploy', 'migrate', 'delete', 'rls', 'publish', 'payment', 'schema', 'truncate', 'drop'];

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function createEntry(type, data) {
  return JSON.stringify({
    id: crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    type,
    sessionId: process.env.CCW_SESSION_ID || 'unknown',
    cronTrigger: process.env.CCW_CRON_TRIGGER || null,
    ...data,
  }) + '\n';
}

/**
 * Calculate blast radius score for an action.
 * @param {string} action
 * @returns {{ score: number, triggers: string[] }}
 */
function calculateBlastRadius(action = '') {
  const lower = action.toLowerCase();
  const triggers = HIGH_IMPACT_KEYWORDS.filter(k => lower.includes(k));
  return {
    score: Math.min(triggers.length * 25, 100),
    triggers,
  };
}

/**
 * Log a governance event (board decisions, agent actions, approvals).
 * HIGH/CRITICAL events are also written to security log.
 *
 * @param {{ actor: string, action: string, decision: string, reasoning: string, riskLevel?: string }} params
 * @returns {object} The logged entry
 */
function logGovernance({ actor, action, decision, reasoning, riskLevel = 'MEDIUM' }) {
  ensureLogDir();
  const blastRadius = calculateBlastRadius(action);
  const entry = createEntry('GOVERNANCE', {
    actor,
    action,
    decision,
    reasoning,
    riskLevel,
    riskScore: RISK_LEVELS[riskLevel] ?? 0,
    blastRadius,
  });
  fs.appendFileSync(GOVERNANCE_LOG, entry);

  // Duplicate HIGH/CRITICAL to security log
  if ((RISK_LEVELS[riskLevel] ?? 0) >= RISK_LEVELS.HIGH) {
    fs.appendFileSync(SECURITY_LOG, entry);
  }

  return JSON.parse(entry);
}

/**
 * Log a CRON execution event.
 *
 * @param {{ trigger: string, phase: string, status: string, duration: number, errors?: Array }} params
 * @returns {object} The logged entry
 */
function logCron({ trigger, phase, status, duration, errors = [] }) {
  ensureLogDir();
  const entry = createEntry('CRON', {
    trigger,
    phase,
    status,
    duration,
    errors: errors.map(e => (typeof e === 'string' ? { message: e } : e)),
    errorCount: errors.length,
  });
  fs.appendFileSync(CRON_LOG, entry);
  return JSON.parse(entry);
}

/**
 * Log a security event.
 *
 * @param {{ event: string, severity: string, details: any, remediation?: string }} params
 * @returns {object} The logged entry
 */
function logSecurity({ event, severity, details, remediation = null }) {
  ensureLogDir();
  const entry = createEntry('SECURITY', {
    event,
    severity,
    details,
    remediation,
  });
  fs.appendFileSync(SECURITY_LOG, entry);
  return JSON.parse(entry);
}

/**
 * Query a log file with optional filters.
 *
 * @param {string} logFile - Path to .jsonl log file
 * @param {{ since?: string, type?: string, riskLevel?: string, limit?: number }} options
 * @returns {Array}
 */
function queryLogs(logFile, { since, type, riskLevel, limit = 100 } = {}) {
  ensureLogDir();
  if (!fs.existsSync(logFile)) return [];

  let entries;
  try {
    entries = fs.readFileSync(logFile, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch (_) {
    return [];
  }

  if (since) {
    const sinceDate = new Date(since);
    entries = entries.filter(e => new Date(e.timestamp) >= sinceDate);
  }
  if (type) {
    entries = entries.filter(e => e.type === type);
  }
  if (riskLevel) {
    entries = entries.filter(e => e.riskLevel === riskLevel);
  }

  return entries.slice(-limit);
}

module.exports = {
  logGovernance,
  logCron,
  logSecurity,
  queryLogs,
  calculateBlastRadius,
  GOVERNANCE_LOG,
  CRON_LOG,
  SECURITY_LOG,
  LOG_DIR,
  RISK_LEVELS,
};
