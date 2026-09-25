import { describe, expect, it } from 'vitest';

import {
  OPTIX_STOCK_TOTALS_USAGE,
  describeOptixStockTotalsFailure,
  formatOptixStockTotals,
  loadOptixStockTotals,
  parseOptixStockTotalsCliArgs,
} from '../../../../scripts/lib/optix-stock-totals.mjs';

describe('parseOptixStockTotalsCliArgs', () => {
  it('requires --email', () => {
    expect(() => parseOptixStockTotalsCliArgs([])).toThrow(/--email/i);
  });

  it('accepts --email= and --confirm-remote', () => {
    const parsed = parseOptixStockTotalsCliArgs(['--email=Toby@CcW.example', '--confirm-remote']);
    expect(parsed.email).toBe('toby@ccw.example');
    expect(parsed.confirmRemote).toBe(true);
    expect(parsed.help).toBe(false);
  });

  it('rejects a flag in place of the address', () => {
    expect(() => parseOptixStockTotalsCliArgs(['--email', '--confirm-remote'])).toThrow(
      /--email requires an address/
    );
  });

  it('rejects a non-address', () => {
    expect(() => parseOptixStockTotalsCliArgs(['--email', 'toby'])).toThrow(/not a valid address/);
  });

  it('returns help without requiring email', () => {
    expect(parseOptixStockTotalsCliArgs(['--help'])).toMatchObject({ help: true });
  });
});

describe('loadOptixStockTotals', () => {
  it('loads qty, non-zero and per-branch for the account', async () => {
    const result = await loadOptixStockTotals({
      email: 'toby@ccw.example',
      findUserByEmail: async () => ({ id: 'user-1', email: 'tobyb@ccwarehouse.com.au' }),
      queryTotals: async () => ({ keys: 10480, qty: 90001, nonzero: 4100, negative: 3 }),
      queryPerBranch: async () => [
        { branch: 'CCW - QLD1, QLD', qty: 46000, nonzero: 2700 },
        { branch: 'CCW - VIC1, VIC', qty: 35000, nonzero: 1200 },
      ],
    });
    expect(result.keys).toBe(10480);
    expect(result.qty).toBe(90001);
    expect(result.nonzero).toBe(4100);
    expect(result.negative).toBe(3);
    const text = formatOptixStockTotals(result);
    expect(text).toMatch(/total SOH quantity: 90001/);
    expect(text).toMatch(/negative positions: 3/);
    expect(text).toMatch(/not stored on Optix stock rows/);
    expect(text).not.toMatch(/no stored stock walk/);
  });

  it('explains a missing account instead of a generic miss', async () => {
    await expect(
      loadOptixStockTotals({
        email: 'nobody@example.com',
        findUserByEmail: async () => null,
        queryTotals: async () => ({}),
        queryPerBranch: async () => [],
      })
    ).rejects.toThrow(/No Optix account for nobody@example.com/);
  });

  it('notes when the walk was never stored', () => {
    const text = formatOptixStockTotals({
      email: 'tobyb@ccwarehouse.com.au',
      keys: 0,
      qty: 0,
      nonzero: 0,
      negative: 0,
      perBranch: [],
    });
    expect(text).toMatch(/no stock rows/);
    expect(text).toMatch(/no stored stock walk/);
  });
});

describe('describeOptixStockTotalsFailure', () => {
  it('maps a refused local socket without leaking a URL', () => {
    const message = describeOptixStockTotalsFailure({ code: 'ECONNREFUSED' });
    expect(message).toMatch(/ECONNREFUSED/);
    expect(message).not.toMatch(/postgres:\/\//i);
  });

  it('keeps usage text stable', () => {
    expect(OPTIX_STOCK_TOTALS_USAGE).toMatch(/--confirm-remote/);
  });
});
