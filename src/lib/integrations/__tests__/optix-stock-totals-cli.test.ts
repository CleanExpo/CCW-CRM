import { describe, expect, it } from 'vitest';

import {
    formatOptixStockTotals,
    loadOptixStockTotals,
    parseOptixStockTotalsCliArgs,
} from '../../../../scripts/lib/optix-stock-totals.mjs';

describe('parseOptixStockTotalsCliArgs', () => {
  it('requires --email', () => {
    expect(() => parseOptixStockTotalsCliArgs([])).toThrow(/--email/i);
  });

  it('accepts --confirm-remote', () => {
    const parsed = parseOptixStockTotalsCliArgs([
      '--email',
      'Toby@CcW.example',
      '--confirm-remote',
    ]);
    expect(parsed.email).toBe('toby@ccw.example');
    expect(parsed.confirmRemote).toBe(true);
  });
});

describe('loadOptixStockTotals', () => {
  it('loads qty, non-zero and per-branch for the account', async () => {
    const result = await loadOptixStockTotals({
      email: 'toby@ccw.example',
      findUserByEmail: async () => ({ id: 'user-1', email: 'tobyb@ccwarehouse.com.au' }),
      queryTotals: async () => ({ keys: 10480, qty: 90001, nonzero: 4100 }),
      queryPerBranch: async () => [
        { branch: 'CCW - QLD1, QLD', qty: 46000, nonzero: 2700 },
        { branch: 'CCW - VIC1, VIC', qty: 35000, nonzero: 1200 },
      ],
    });
    expect(result.keys).toBe(10480);
    expect(result.qty).toBe(90001);
    expect(result.nonzero).toBe(4100);
    expect(formatOptixStockTotals(result)).toMatch(/total SOH quantity: 90001/);
    expect(formatOptixStockTotals(result)).toMatch(/not stored on Optix stock rows/);
  });
});
