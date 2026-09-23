import { describe, expect, it } from 'vitest';
import { reportBalances, reportInvoices, reportValuation, reportXero } from '../ledgers';

describe('Phase 2 ledger reports', () => {
  it('blocks valuation when the Cin7 stock pull is incomplete', () => {
    const report = reportValuation({
      cin7ValueByWarehouse: [{ warehouse: 'BNE', value: 100 }],
      optixValueByWarehouse: [{ warehouse: 'BNE', value: 100 }],
      qtyWithoutCost: 0,
      cin7Complete: false,
      costingNote: 'test',
    });
    expect(report.blocked).toBe(true);
    expect(report.clean).toBe(false);
  });

  it('keeps Area 3 monthly control differences in the sample', () => {
    const report = reportInvoices({
      monthly: [{ month: '2025-07', cin7Count: 2, optixCount: 1, cin7Value: 200, optixValue: 100 }],
      cin7Complete: true,
      warrantyUnmarked: true,
    });
    expect(report.counts.quantity_mismatch).toBe(1);
    expect(report.sample[0]?.document).toBe('2025-07');
  });

  it('carries Part 1.5 populations on the invoice report', () => {
    const report = reportInvoices({
      monthly: [],
      cin7Complete: true,
      populations: { trade_in: 3, aberford_revaluation: 1 },
    });
    expect(report.populations?.trade_in).toBe(3);
    expect(report.populations?.aberford_revaluation).toBe(1);
  });

  it('excludes legacy customers as skipped_on_sync on Area 5', () => {
    const report = reportBalances({
      arCin7: 10,
      arOptix: 10,
      apCin7: 4,
      apOptix: 4,
      legacyExcluded: 3580,
      cin7Complete: true,
    });
    expect(report.clean).toBe(true);
    expect(report.counts.skipped).toBe(3580);
  });

  it('blocks Area 8 when E5 already disagrees', () => {
    const report = reportXero({
      inventoryCin7: 1,
      inventoryOptix: 1,
      inventoryXero: 1,
      cogsCin7: 1,
      cogsOptix: 1,
      cogsXero: 1,
      e5Agree: false,
    });
    expect(report.blocked).toBe(true);
    expect(report.blocked_reason).toMatch(/E5/);
  });
});
