#!/usr/bin/env node
/**
 * tests/lib/approval-gate.test.js
 * UNI-1721 [C2] — Test Suite: Approval Gate
 */
'use strict';

const assert = require('assert');
const {
  checkApproval, approveRequest, denyRequest, listPendingRequests,
  ALWAYS_REQUIRE, AUTO_APPROVE,
} = require('../../scripts/lib/approval-gate');

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

// --- AUTO_APPROVE operations ---
test('database:read is auto-approved', () => {
  const result = checkApproval('database:read');
  assert.strictEqual(result.approved, true, 'database:read should be auto-approved');
  assert.strictEqual(result.method, 'auto');
});

test('log:write is auto-approved', () => {
  const result = checkApproval('log:write');
  assert.strictEqual(result.approved, true);
});

test('report:generate is auto-approved', () => {
  const result = checkApproval('report:generate');
  assert.strictEqual(result.approved, true);
});

// --- ALWAYS_REQUIRE operations ---
test('database:migrate requires approval', () => {
  const result = checkApproval('database:migrate');
  assert.strictEqual(result.approved, false, 'database:migrate should require approval');
  assert.strictEqual(result.method, 'human_required');
  assert.ok(result.requestId, 'should have requestId');
});

test('video:publish requires approval', () => {
  const result = checkApproval('video:publish');
  assert.strictEqual(result.approved, false);
  assert.strictEqual(result.method, 'human_required');
});

test('deploy:production requires approval', () => {
  const result = checkApproval('deploy:production');
  assert.strictEqual(result.approved, false);
});

test('user:delete requires approval', () => {
  const result = checkApproval('user:delete');
  assert.strictEqual(result.approved, false);
});

test('payment:process requires approval', () => {
  const result = checkApproval('payment:process');
  assert.strictEqual(result.approved, false);
});

// --- CONDITIONAL rules ---
test('database:write with few rows is approved', () => {
  const result = checkApproval('database:write', { rowCount: 5 });
  assert.strictEqual(result.approved, true, 'small write should be conditionally approved');
  assert.strictEqual(result.method, 'conditional_passed');
});

test('database:write with many rows requires approval', () => {
  const result = checkApproval('database:write', { rowCount: 500 });
  assert.strictEqual(result.approved, false, 'large write should require approval');
  assert.strictEqual(result.method, 'conditional_failed');
});

test('email:send to few recipients is approved', () => {
  const result = checkApproval('email:send', { recipients: ['a@b.com', 'c@d.com'] });
  assert.strictEqual(result.approved, true);
});

test('email:send to many recipients requires approval', () => {
  const result = checkApproval('email:send', { recipients: new Array(15).fill('a@b.com') });
  assert.strictEqual(result.approved, false);
});

test('slack:send to allowed channel is approved', () => {
  const result = checkApproval('slack:send', { channel: '#ccw-board' });
  assert.strictEqual(result.approved, true);
});

test('slack:send to unknown channel requires approval', () => {
  const result = checkApproval('slack:send', { channel: '#external-channel' });
  assert.strictEqual(result.approved, false);
});

// --- Deny by default ---
test('unknown operation is denied by default', () => {
  const result = checkApproval('some:unknown:operation:xyz');
  assert.strictEqual(result.approved, false);
  assert.strictEqual(result.method, 'deny_by_default');
  assert.ok(result.requestId, 'should create a request');
});

// --- approveRequest / denyRequest ---
test('approveRequest updates request status', () => {
  const denied = checkApproval('user:delete');
  const requestId = denied.requestId;
  assert.ok(requestId, 'should have requestId');
  const approved = approveRequest(requestId, 'ceo-phill');
  assert.ok(approved, 'approveRequest should return updated request');
  assert.strictEqual(approved.status, 'approved');
  assert.strictEqual(approved.approvedBy, 'ceo-phill');
});

test('denyRequest updates request status', () => {
  const pending = checkApproval('database:migrate');
  const requestId = pending.requestId;
  const denied = denyRequest(requestId, 'system', 'Not safe at this time');
  assert.ok(denied, 'denyRequest should return updated request');
  assert.strictEqual(denied.status, 'denied');
  assert.strictEqual(denied.deniedBy, 'system');
});

test('approveRequest returns null for unknown ID', () => {
  const result = approveRequest('non-existent-request-id-xyz');
  assert.strictEqual(result, null);
});

// --- listPendingRequests ---
test('listPendingRequests returns array', () => {
  const pending = listPendingRequests();
  assert.ok(Array.isArray(pending), 'should return array');
});

// --- Set membership ---
test('ALWAYS_REQUIRE is a Set', () => {
  assert.ok(ALWAYS_REQUIRE instanceof Set, 'ALWAYS_REQUIRE should be a Set');
  assert.ok(ALWAYS_REQUIRE.has('database:migrate'));
  assert.ok(ALWAYS_REQUIRE.has('deploy:production'));
});

test('AUTO_APPROVE is a Set', () => {
  assert.ok(AUTO_APPROVE instanceof Set, 'AUTO_APPROVE should be a Set');
  assert.ok(AUTO_APPROVE.has('database:read'));
  assert.ok(AUTO_APPROVE.has('log:write'));
});

console.log(`\n[APPROVAL-GATE] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
