/**
 * session-manager.js — Session Persistence & Crash Recovery
 * UNI-1729 [C9] — Session Persistence & Crash Recovery
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_DIR = path.join(process.cwd(), '.session-state');
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STALE_THRESHOLD = 120000; // 2 minutes

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Write session state atomically (write to .tmp then rename).
 */
function writeState(session) {
  ensureStateDir();
  const statePath = path.join(STATE_DIR, `${session.id}.json`);
  const tmpPath = `${statePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(session, null, 2));
  fs.renameSync(tmpPath, statePath);
  return statePath;
}

/**
 * Load a session by ID.
 * @param {string} sessionId
 * @returns {object|null}
 */
function loadSession(sessionId) {
  const statePath = path.join(STATE_DIR, `${sessionId}.json`);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Create a new session.
 * @param {string} cronTrigger - e.g., 'boardroom-6am'
 * @returns {object} Session object
 */
function createSession(cronTrigger = 'manual') {
  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`,
    cronTrigger,
    startedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    phase: 'init',
    completedPhases: [],
    pendingPhases: [],
    checkpoints: [],
    status: 'running',
    recoveryStartedAt: null,
    resumeFrom: null,
    completedAt: null,
    failedAt: null,
    error: null,
    summary: null,
  };
  writeState(session);

  try {
    const { logCron } = require('./audit-logger');
    logCron({ trigger: cronTrigger, phase: 'init', status: 'started', duration: 0 });
  } catch (_) {}

  return session;
}

/**
 * Update session heartbeat (call every HEARTBEAT_INTERVAL ms).
 * @param {string} sessionId
 * @returns {object|null}
 */
function heartbeat(sessionId) {
  const session = loadSession(sessionId);
  if (!session) return null;
  session.lastHeartbeat = new Date().toISOString();
  writeState(session);
  return session;
}

/**
 * Record a completed phase checkpoint.
 * @param {string} sessionId
 * @param {string} phase
 * @param {object} data - Optional data to store with checkpoint
 * @returns {object|null}
 */
function checkpoint(sessionId, phase, data = {}) {
  const session = loadSession(sessionId);
  if (!session) return null;
  session.phase = phase;
  session.lastHeartbeat = new Date().toISOString();
  session.completedPhases.push({
    phase,
    completedAt: new Date().toISOString(),
    ...data,
  });
  session.checkpoints.push({
    phase,
    timestamp: new Date().toISOString(),
    data,
  });
  writeState(session);

  try {
    const { logCron } = require('./audit-logger');
    logCron({ trigger: session.cronTrigger, phase, status: 'checkpoint', duration: 0 });
  } catch (_) {}

  return session;
}

/**
 * Find sessions that have stopped heartbeating (likely crashed).
 * @returns {Array}
 */
function findStaleSessions() {
  ensureStateDir();
  const now = Date.now();
  try {
    return fs
      .readdirSync(STATE_DIR)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
        } catch (_) {
          return null;
        }
      })
      .filter(
        (s) =>
          s && s.status === 'running' && now - new Date(s.lastHeartbeat).getTime() > STALE_THRESHOLD
      );
  } catch (_) {
    return [];
  }
}

/**
 * Begin recovery of a crashed session.
 * @param {string} sessionId
 * @returns {object|null}
 */
function recoverSession(sessionId) {
  const session = loadSession(sessionId);
  if (!session) return null;

  const lastCheckpoint = session.checkpoints[session.checkpoints.length - 1];
  session.status = 'recovering';
  session.recoveryStartedAt = new Date().toISOString();
  session.resumeFrom = lastCheckpoint ? lastCheckpoint.phase : 'init';
  session.lastHeartbeat = new Date().toISOString();
  writeState(session);

  try {
    const { logCron } = require('./audit-logger');
    logCron({
      trigger: session.cronTrigger,
      phase: session.resumeFrom,
      status: 'recovering',
      duration: 0,
    });
  } catch (_) {}

  return session;
}

/**
 * Mark a session as successfully completed.
 * @param {string} sessionId
 * @param {object} summary
 * @returns {object|null}
 */
function completeSession(sessionId, summary = {}) {
  const session = loadSession(sessionId);
  if (!session) return null;
  session.status = 'completed';
  session.completedAt = new Date().toISOString();
  session.summary = summary;
  writeState(session);

  try {
    const { logCron } = require('./audit-logger');
    const duration = new Date(session.completedAt) - new Date(session.startedAt);
    logCron({ trigger: session.cronTrigger, phase: 'complete', status: 'success', duration });
  } catch (_) {}

  return session;
}

/**
 * Mark a session as failed.
 * @param {string} sessionId
 * @param {Error|string} error
 * @returns {object|null}
 */
function failSession(sessionId, error) {
  const session = loadSession(sessionId);
  if (!session) return null;
  session.status = 'failed';
  session.failedAt = new Date().toISOString();
  session.error = typeof error === 'string' ? error : (error && error.message) || String(error);
  writeState(session);

  try {
    const { logCron } = require('./audit-logger');
    logCron({
      trigger: session.cronTrigger,
      phase: session.phase,
      status: 'failed',
      duration: 0,
      errors: [session.error],
    });
  } catch (_) {}

  return session;
}

/**
 * List all sessions with optional status filter.
 * @param {string|null} statusFilter
 * @returns {Array}
 */
function listSessions(statusFilter = null) {
  ensureStateDir();
  try {
    return fs
      .readdirSync(STATE_DIR)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(STATE_DIR, f), 'utf8'));
        } catch (_) {
          return null;
        }
      })
      .filter((s) => s && (!statusFilter || s.status === statusFilter))
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  } catch (_) {
    return [];
  }
}

module.exports = {
  createSession,
  heartbeat,
  checkpoint,
  loadSession,
  findStaleSessions,
  recoverSession,
  completeSession,
  failSession,
  listSessions,
  STATE_DIR,
  HEARTBEAT_INTERVAL,
  STALE_THRESHOLD,
};
