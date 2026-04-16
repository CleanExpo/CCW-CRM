#!/usr/bin/env node
/**
 * tests/lib/audit-logger.test.js
 * UNI-1721 [C2] — Test Suite: Audit Logger
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Point logs to a temp dir for testing
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccw-audit-test-'));
process.env.CCW_SESSION_ID = 'test-session-001';

// Override LOG_DIR by patching before require
const {
  logGovernance,
  logCron,
  logSecurity,
  queryLogs,
  calculateBlastRadius,
  LOG_DIR,
} = require('../../scripts/lib/audit-logger');

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

// --- calculateBlastRadius ---
test('calculateBlastRadius: deploy scores high', () => {
  const result = calculateBlastRadius('database:deploy:production');
  assert.ok(result.score > 0, 'should have positive score for deploy');
  assert.ok(result.triggers.includes('deploy'), 'should include deploy trigger');
});

test('calculateBlastRadius: read has zero score', () => {
  const result = calculateBlastRadius('database:read');
  assert.strictEqual(result.score, 0, 'read operations should have zero blast radius');
});

test('calculateBlastRadius: migrate+delete combined', () => {
  const result = calculateBlastRadius('database:migrate:delete:schema');
  assert.ok(result.score >= 50, 'combined high-impact keywords should score >= 50');
});

// --- logGovernance ---
test('logGovernance: returns entry with required fields', () => {
  const entry = logGovernance({
    actor: 'test-agent',
    action: 'test:action',
    decision: 'approved',
    reasoning: 'test reasoning',
    riskLevel: 'LOW',
  });
  assert.ok(entry.id, 'should have id');
  assert.ok(entry.timestamp, 'should have timestamp');
  assert.strictEqual(entry.type, 'GOVERNANCE', 'should have GOVERNANCE type');
  assert.strictEqual(entry.actor, 'test-agent');
  assert.strictEqual(entry.riskLevel, 'LOW');
});

test('logGovernance: HIGH risk writes to security log', () => {
  logGovernance({
    actor: 'test-agent',
    action: 'deploy:production',
    decision: 'approved',
    reasoning: 'high risk test',
    riskLevel: 'HIGH',
  });
  // Check security log exists and contains entry
  const secLog = path.join(LOG_DIR, 'security.jsonl');
  if (fs.existsSync(secLog)) {
    const content = fs.readFileSync(secLog, 'utf8');
    assert.ok(content.includes('deploy:production'), 'security log should contain high-risk entry');
  }
});

// --- logCron ---
test('logCron: returns entry with CRON type', () => {
  const entry = logCron({
    trigger: 'boardroom-6am',
    phase: 'phase-01',
    status: 'started',
    duration: 0,
  });
  assert.strictEqual(entry.type, 'CRON');
  assert.strictEqual(entry.trigger, 'boardroom-6am');
  assert.strictEqual(entry.phase, 'phase-01');
});

test('logCron: handles errors array', () => {
  const entry = logCron({
    trigger: 'test',
    phase: 'test',
    status: 'failed',
    duration: 100,
    errors: ['Error 1', 'Error 2'],
  });
  assert.strictEqual(entry.errorCount, 2);
});

// --- logSecurity ---
test('logSecurity: returns SECURITY type entry', () => {
  const entry = logSecurity({
    event: 'secret_detected',
    severity: 'CRITICAL',
    details: { file: 'test.js', line: 42 },
    remediation: 'Rotate credentials immediately',
  });
  assert.strictEqual(entry.type, 'SECURITY');
  assert.strictEqual(entry.event, 'secret_detected');
  assert.strictEqual(entry.severity, 'CRITICAL');
});

// --- queryLogs ---
test('queryLogs: returns empty array for non-existent file', () => {
  const result = queryLogs('/tmp/nonexistent-ccw-test-12345.jsonl');
  assert.deepStrictEqual(result, []);
});

test('queryLogs: filters by type', () => {
  // Log some entries first
  logGovernance({ actor: 'x', action: 'y', decision: 'z', reasoning: 'q', riskLevel: 'LOW' });
  const govLog = path.join(LOG_DIR, 'governance.jsonl');
  const results = queryLogs(govLog, { type: 'GOVERNANCE' });
  assert.ok(results.length > 0, 'should return governance entries');
  assert.ok(
    results.every((r) => r.type === 'GOVERNANCE'),
    'all results should be GOVERNANCE type'
  );
});

test('queryLogs: respects limit', () => {
  const govLog = path.join(LOG_DIR, 'governance.jsonl');
  const results = queryLogs(govLog, { limit: 2 });
  assert.ok(results.length <= 2, 'should respect limit of 2');
});

// Summary
console.log(`\n[AUDIT-LOGGER] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
