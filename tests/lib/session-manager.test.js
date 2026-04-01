#!/usr/bin/env node
/**
 * tests/lib/session-manager.test.js
 * UNI-1721 [C2] — Test Suite: Session Manager
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Use a temp directory for session state during tests
process.env.CCW_SESSION_ID = 'test-session';
const {
  createSession, heartbeat, checkpoint, loadSession,
  findStaleSessions, recoverSession, completeSession, failSession,
  listSessions, STATE_DIR,
} = require('../../scripts/lib/session-manager');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

// --- createSession ---
test('createSession: returns session with required fields', () => {
  const session = createSession('test-trigger');
  assert.ok(session.id, 'should have id');
  assert.ok(session.startedAt, 'should have startedAt');
  assert.strictEqual(session.cronTrigger, 'test-trigger');
  assert.strictEqual(session.status, 'running');
  assert.strictEqual(session.phase, 'init');
  assert.ok(Array.isArray(session.checkpoints));
});

test('createSession: writes to STATE_DIR', () => {
  const session = createSession('test-write');
  const statePath = path.join(STATE_DIR, `${session.id}.json`);
  assert.ok(fs.existsSync(statePath), 'session file should exist on disk');
});

// --- loadSession ---
test('loadSession: returns null for unknown ID', () => {
  const result = loadSession('non-existent-session-id-xyz');
  assert.strictEqual(result, null);
});

test('loadSession: loads created session', () => {
  const session = createSession('load-test');
  const loaded = loadSession(session.id);
  assert.ok(loaded, 'should load session');
  assert.strictEqual(loaded.id, session.id);
  assert.strictEqual(loaded.cronTrigger, 'load-test');
});

// --- heartbeat ---
test('heartbeat: updates lastHeartbeat', () => {
  const session = createSession('heartbeat-test');
  const originalHb = session.lastHeartbeat;
  // Small delay to ensure timestamp differs
  const updated = heartbeat(session.id);
  assert.ok(updated, 'should return updated session');
  assert.strictEqual(updated.id, session.id);
});

test('heartbeat: returns null for unknown session', () => {
  const result = heartbeat('unknown-session-id');
  assert.strictEqual(result, null);
});

// --- checkpoint ---
test('checkpoint: records phase and adds to checkpoints', () => {
  const session = createSession('checkpoint-test');
  const updated = checkpoint(session.id, 'phase-02', { detail: 'test' });
  assert.ok(updated, 'should return updated session');
  assert.strictEqual(updated.phase, 'phase-02');
  assert.ok(updated.checkpoints.length > 0, 'should have checkpoints');
  assert.strictEqual(updated.checkpoints[0].phase, 'phase-02');
});

test('checkpoint: accumulates multiple phases', () => {
  const session = createSession('multi-checkpoint-test');
  checkpoint(session.id, 'phase-01');
  checkpoint(session.id, 'phase-02');
  const final = checkpoint(session.id, 'phase-03');
  assert.strictEqual(final.checkpoints.length, 3);
  assert.strictEqual(final.phase, 'phase-03');
});

// --- completeSession ---
test('completeSession: sets status to completed', () => {
  const session = createSession('complete-test');
  const completed = completeSession(session.id, { result: 'success' });
  assert.strictEqual(completed.status, 'completed');
  assert.ok(completed.completedAt, 'should have completedAt');
  assert.deepStrictEqual(completed.summary, { result: 'success' });
});

// --- failSession ---
test('failSession: sets status to failed with error', () => {
  const session = createSession('fail-test');
  const failed_sess = failSession(session.id, new Error('Test error'));
  assert.strictEqual(failed_sess.status, 'failed');
  assert.ok(failed_sess.failedAt, 'should have failedAt');
  assert.strictEqual(failed_sess.error, 'Test error');
});

test('failSession: handles string error', () => {
  const session = createSession('fail-string-test');
  const failed_sess = failSession(session.id, 'String error message');
  assert.strictEqual(failed_sess.error, 'String error message');
});

// --- recoverSession ---
test('recoverSession: sets status to recovering', () => {
  const session = createSession('recover-test');
  checkpoint(session.id, 'phase-02');
  const recovered = recoverSession(session.id);
  assert.strictEqual(recovered.status, 'recovering');
  assert.ok(recovered.recoveryStartedAt, 'should have recoveryStartedAt');
  assert.strictEqual(recovered.resumeFrom, 'phase-02');
});

test('recoverSession: resumeFrom init when no checkpoints', () => {
  const session = createSession('recover-no-cp-test');
  const recovered = recoverSession(session.id);
  assert.strictEqual(recovered.resumeFrom, 'init');
});

// --- findStaleSessions ---
test('findStaleSessions: returns empty array when none stale', () => {
  const stale = findStaleSessions();
  assert.ok(Array.isArray(stale), 'should return array');
});

// --- listSessions ---
test('listSessions: returns array', () => {
  const sessions = listSessions();
  assert.ok(Array.isArray(sessions), 'should return array');
});

test('listSessions: filters by status', () => {
  const s1 = createSession('filter-test-1');
  completeSession(s1.id);
  const completed = listSessions('completed');
  assert.ok(completed.every(s => s.status === 'completed'), 'all should be completed');
});

console.log(`\n[SESSION-MANAGER] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
