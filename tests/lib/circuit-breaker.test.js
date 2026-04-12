#!/usr/bin/env node
/**
 * tests/lib/circuit-breaker.test.js
 * UNI-1721 [C2] — Test Suite: Circuit Breaker
 */
'use strict';

const assert = require('assert');
const {
  CircuitBreaker,
  getBreaker,
  getAllStatus,
  STATES,
} = require('../../scripts/lib/circuit-breaker');

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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

// --- Initial state ---
test('starts in CLOSED state', () => {
  const cb = new CircuitBreaker('test-service');
  assert.strictEqual(cb.state, STATES.CLOSED);
  assert.strictEqual(cb.failureCount, 0);
});

// --- Successful execution ---
(async () => {
  await testAsync('execute: passes through on success', async () => {
    const cb = new CircuitBreaker('test-success');
    const result = await cb.execute(async () => 'ok');
    assert.strictEqual(result, 'ok');
    assert.strictEqual(cb.state, STATES.CLOSED);
    assert.strictEqual(cb.failureCount, 0);
  });

  // --- Trip to OPEN ---
  await testAsync('trips to OPEN after failureThreshold', async () => {
    const cb = new CircuitBreaker('test-trip', { failureThreshold: 3, resetTimeout: 1000 });
    const failFn = async () => {
      throw new Error('simulated failure');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(failFn);
      } catch (_) {}
    }

    assert.strictEqual(cb.state, STATES.OPEN, `Expected OPEN, got ${cb.state}`);
    assert.strictEqual(cb.failureCount, 3);
  });

  // --- OPEN state blocks ---
  await testAsync('OPEN state throws without calling fn', async () => {
    const cb = new CircuitBreaker('test-open', { failureThreshold: 1, resetTimeout: 9999999 });
    try {
      await cb.execute(async () => {
        throw new Error('fail');
      });
    } catch (_) {}

    let fnCalled = false;
    try {
      await cb.execute(async () => {
        fnCalled = true;
        return 'ok';
      });
      assert.fail('Should have thrown');
    } catch (e) {
      assert.ok(e.message.includes('OPEN'), 'Error should mention OPEN state');
      assert.strictEqual(fnCalled, false, 'Function should not have been called');
    }
  });

  // --- HALF_OPEN recovery ---
  await testAsync('transitions OPEN → HALF_OPEN → CLOSED on success', async () => {
    const cb = new CircuitBreaker('test-recover', { failureThreshold: 1, resetTimeout: 1 });
    try {
      await cb.execute(async () => {
        throw new Error('fail');
      });
    } catch (_) {}

    // Wait for resetTimeout
    await new Promise((r) => setTimeout(r, 10));

    // Next call should go through (HALF_OPEN)
    const result = await cb.execute(async () => 'recovered');
    assert.strictEqual(result, 'recovered');
    assert.strictEqual(cb.state, STATES.CLOSED);
  });

  // --- Error history cap ---
  await testAsync('error history capped at 10', async () => {
    const cb = new CircuitBreaker('test-cap', { failureThreshold: 100 });
    for (let i = 0; i < 15; i++) {
      try {
        await cb.execute(async () => {
          throw new Error(`err ${i}`);
        });
      } catch (_) {}
    }
    assert.ok(cb.errors.length <= 10, `Expected <= 10 errors, got ${cb.errors.length}`);
  });

  // --- reset() ---
  test('reset() restores CLOSED state', () => {
    const cb = new CircuitBreaker('test-reset', { failureThreshold: 1 });
    cb.state = STATES.OPEN;
    cb.failureCount = 5;
    cb.reset();
    assert.strictEqual(cb.state, STATES.CLOSED);
    assert.strictEqual(cb.failureCount, 0);
  });

  // --- getStatus() ---
  test('getStatus() returns correct shape', () => {
    const cb = new CircuitBreaker('test-status');
    const status = cb.getStatus();
    assert.ok('name' in status, 'should have name');
    assert.ok('state' in status, 'should have state');
    assert.ok('failureCount' in status, 'should have failureCount');
    assert.ok('recentErrors' in status, 'should have recentErrors');
  });

  // --- Global registry ---
  test('getBreaker returns singleton', () => {
    const b1 = getBreaker('my-service');
    const b2 = getBreaker('my-service');
    assert.strictEqual(b1, b2, 'same instance should be returned');
  });

  test('getAllStatus returns array', () => {
    const all = getAllStatus();
    assert.ok(Array.isArray(all), 'should return array');
    assert.ok(all.length > 0, 'should have pre-configured services');
  });

  console.log(`\n[CIRCUIT-BREAKER] ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
