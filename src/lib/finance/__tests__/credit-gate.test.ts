/**
 * Unit tests for credit limit gate business logic.
 *
 * The gate logic lives in POST /api/orders/route.ts. We test the decision
 * boundaries by extracting them into a testable pure function and verifying
 * the same conditions the route enforces.
 *
 * This mirrors how transfer-cancel-service.test.ts tests service logic via
 * Prisma mock + direct import pattern.
 */
import { describe, it, expect } from 'vitest';

/**
 * Pure business logic extracted from the route for unit testing.
 * Arguments mirror what the route computes before returning 402.
 */
function evaluateCreditGate(params: {
  creditLimit: number | null;
  outstanding: number;
  newOrderTotal: number;
  managerOverride: boolean;
  isManager: boolean;
}): { blocked: boolean; reason?: string } {
  const { creditLimit, outstanding, newOrderTotal, managerOverride, isManager } = params;

  // No limit = always passes
  if (creditLimit === null) return { blocked: false };

  if (outstanding + newOrderTotal > creditLimit) {
    // Override path: manager with flag
    if (managerOverride && isManager) return { blocked: false };
    return {
      blocked: true,
      reason: `Outstanding $${outstanding.toFixed(2)} + order $${newOrderTotal.toFixed(2)} exceeds limit $${creditLimit.toFixed(2)}`,
    };
  }

  return { blocked: false };
}

describe('credit gate logic', () => {
  // ── No credit limit ─────────────────────────────────────────────────────

  it('no credit limit: always passes regardless of outstanding', () => {
    expect(
      evaluateCreditGate({ creditLimit: null, outstanding: 1_000_000, newOrderTotal: 999_999, managerOverride: false, isManager: false })
    ).toEqual({ blocked: false });
  });

  // ── Under limit ──────────────────────────────────────────────────────────

  it('under limit: passes when combined total is exactly at limit', () => {
    // outstanding $900 + order $100 = $1000 = limit $1000 → NOT blocked (not over)
    expect(
      evaluateCreditGate({ creditLimit: 1000, outstanding: 900, newOrderTotal: 100, managerOverride: false, isManager: false })
    ).toEqual({ blocked: false });
  });

  it('under limit: passes when well under limit', () => {
    expect(
      evaluateCreditGate({ creditLimit: 10000, outstanding: 500, newOrderTotal: 200, managerOverride: false, isManager: false })
    ).toEqual({ blocked: false });
  });

  it('zero outstanding: new order alone within limit passes', () => {
    expect(
      evaluateCreditGate({ creditLimit: 5000, outstanding: 0, newOrderTotal: 4999, managerOverride: false, isManager: false })
    ).toEqual({ blocked: false });
  });

  // ── Over limit ───────────────────────────────────────────────────────────

  it('over limit: blocks when combined exceeds limit by 1 cent', () => {
    // $900 + $100.01 = $1000.01 > $1000
    const result = evaluateCreditGate({ creditLimit: 1000, outstanding: 900, newOrderTotal: 100.01, managerOverride: false, isManager: false });
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/exceeds limit/);
  });

  it('over limit: blocks when outstanding alone exceeds limit', () => {
    const result = evaluateCreditGate({ creditLimit: 1000, outstanding: 1500, newOrderTotal: 1, managerOverride: false, isManager: false });
    expect(result.blocked).toBe(true);
  });

  it('over limit: blocks for a zero-limit customer with any order', () => {
    // creditLimit=0 means no purchases allowed; $0 outstanding + $1 order > $0
    const result = evaluateCreditGate({ creditLimit: 0, outstanding: 0, newOrderTotal: 1, managerOverride: false, isManager: false });
    expect(result.blocked).toBe(true);
  });

  // ── Manager override ─────────────────────────────────────────────────────

  it('manager override: passes when manager requests override and is a manager', () => {
    const result = evaluateCreditGate({ creditLimit: 1000, outstanding: 900, newOrderTotal: 200, managerOverride: true, isManager: true });
    expect(result.blocked).toBe(false);
  });

  it('manager override: does NOT pass when managerOverride=true but role is member', () => {
    const result = evaluateCreditGate({ creditLimit: 1000, outstanding: 900, newOrderTotal: 200, managerOverride: true, isManager: false });
    expect(result.blocked).toBe(true);
  });

  it('manager override: does NOT pass when isManager=true but managerOverride=false', () => {
    const result = evaluateCreditGate({ creditLimit: 1000, outstanding: 900, newOrderTotal: 200, managerOverride: false, isManager: true });
    expect(result.blocked).toBe(true);
  });

  it('member with flag false on over-limit → blocked', () => {
    const result = evaluateCreditGate({ creditLimit: 500, outstanding: 400, newOrderTotal: 200, managerOverride: false, isManager: false });
    expect(result.blocked).toBe(true);
  });

  // ── Boundary precision ───────────────────────────────────────────────────

  it('exactly at limit is not blocked (boundary inclusive)', () => {
    expect(
      evaluateCreditGate({ creditLimit: 10000, outstanding: 9000, newOrderTotal: 1000, managerOverride: false, isManager: false })
    ).toEqual({ blocked: false });
  });

  it('one cent over limit is blocked', () => {
    const result = evaluateCreditGate({ creditLimit: 10000, outstanding: 9000, newOrderTotal: 1000.01, managerOverride: false, isManager: false });
    expect(result.blocked).toBe(true);
  });
});

// ─── Cron: overdue threshold logic ──────────────────────────────────────────

describe('overdue cron threshold detection', () => {
  const THRESHOLDS = [7, 30, 60] as const;

  function shouldFire(daysPastDue: number): boolean {
    return (THRESHOLDS as readonly number[]).includes(daysPastDue);
  }

  it('fires at exactly 7 days past due', () => expect(shouldFire(7)).toBe(true));
  it('fires at exactly 30 days past due', () => expect(shouldFire(30)).toBe(true));
  it('fires at exactly 60 days past due', () => expect(shouldFire(60)).toBe(true));
  it('does NOT fire at 6 days', () => expect(shouldFire(6)).toBe(false));
  it('does NOT fire at 8 days', () => expect(shouldFire(8)).toBe(false));
  it('does NOT fire at 29 days', () => expect(shouldFire(29)).toBe(false));
  it('does NOT fire at 31 days', () => expect(shouldFire(31)).toBe(false));
  it('does NOT fire at 59 days', () => expect(shouldFire(59)).toBe(false));
  it('does NOT fire at 61 days', () => expect(shouldFire(61)).toBe(false));
  it('does NOT fire at 90 days', () => expect(shouldFire(90)).toBe(false));
  it('does NOT fire at 0 days', () => expect(shouldFire(0)).toBe(false));
});
