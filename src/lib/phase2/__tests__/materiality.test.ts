import { describe, expect, it } from 'vitest';
import { approvedVarianceCapExceeded, dollarWithinTolerance, quantityWithinTolerance } from '../materiality';

describe('Phase 2 materiality', () => {
  it('requires exact quantity match', () => {
    expect(quantityWithinTolerance(10, 10)).toBe(true);
    expect(quantityWithinTolerance(10, 9)).toBe(false);
  });

  it('fails a +X / −X pair on the Schedule A gross test', () => {
    expect(
      dollarWithinTolerance({
        differences: [300, -300],
        tier: 'warehouse',
      })
    ).toBe(false);
  });

  it('uses Toby’s company-wide greater-of limits', () => {
    expect(
      dollarWithinTolerance({
        differences: [40],
        tier: 'company',
        base: 100_000,
      })
    ).toBe(true);
    expect(
      dollarWithinTolerance({
        differences: [80],
        tier: 'company',
        base: 100_000,
      })
    ).toBe(false);
  });

  it('requires AR/AP to tie exactly', () => {
    expect(
      dollarWithinTolerance({
        differences: [0.01],
        tier: 'ar_ap',
        netLimit: 10,
        grossLimit: 10,
      })
    ).toBe(false);
  });

  it('caps approved variances at ten items or $500', () => {
    const many = Array.from({ length: 11 }, () => ({
      classification: 'approved_variance' as const,
      cin7: 1,
      optix: 1,
      difference: 1,
    }));
    expect(approvedVarianceCapExceeded(many).exceeded).toBe(true);
    expect(
      approvedVarianceCapExceeded([
        { classification: 'approved_variance', cin7: 0, optix: 501, difference: 501 },
      ]).exceeded
    ).toBe(true);
  });
});
