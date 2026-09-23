import { describe, expect, it } from 'vitest';
import { evaluatePhase2Gates, isPhase2SignOff, sealReport } from '../gates';

const open = {
  phase1Missing: 0,
  phase1ResidualSigned: false,
  stockCatalogComplete: true,
  priceListsComplete: true,
  previousAreaSigned: true,
  e2e3Ready: true,
  e5Cin7XeroAgree: true as boolean | null,
};

describe('evaluatePhase2Gates', () => {
  it('blocks Area 1 when Phase 1 still has missing master data', () => {
    const gate = evaluatePhase2Gates({ ...open, area: 1, phase1Missing: 3 });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/Phase 1/);
  });

  it('lets Area 1 run when the residual list is signed', () => {
    const gate = evaluatePhase2Gates({
      ...open,
      area: 1,
      phase1Missing: 3,
      phase1ResidualSigned: true,
    });
    expect(gate.allowed).toBe(true);
  });

  it('blocks Area 3 when price lists are incomplete', () => {
    const gate = evaluatePhase2Gates({ ...open, area: 3, priceListsComplete: false });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/Price lists/);
  });

  it('blocks Area 8 until E5 agrees', () => {
    const gate = evaluatePhase2Gates({ ...open, area: 8, e5Cin7XeroAgree: null });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/E5|bookkeeping|Area 8/);
  });

  it('never leaves a blocked report marked clean', () => {
    const sealed = sealReport(
      {
        area: 1,
        title: 'Inventory quantities by warehouse',
        as_of: '2026-09-22T00:00:00.000Z',
        read_only: true,
        cin7_is_source_of_truth: true,
        clean: true,
        blocked: false,
        blocked_reason: null,
        cin7_complete: true,
        company: { cin7: 1, optix: 1, difference: 0 },
        sku_count: { cin7: 1, optix: 1 },
        warehouse_count: { cin7: 1, optix: 1 },
        warehouses: [],
        counts: { missing: 0, extra: 0, quantity_mismatch: 0, timing: 0, skipped: 0 },
        sample: [],
        notes: [],
        source_of_truth: { cin7: 'cin7', optix: 'optix' },
      },
      { allowed: false, reason: 'Incomplete Cin7 stock pull cannot be treated as a clean result.' }
    );
    expect(sealed.clean).toBe(false);
    expect(sealed.blocked).toBe(true);
  });

  it('does not treat a blocked or incomplete run as a sign-off', () => {
    expect(isPhase2SignOff({ clean: true, blocked: false, cin7_complete: false })).toBe(false);
    expect(isPhase2SignOff({ clean: true, blocked: true, cin7_complete: true })).toBe(false);
    expect(isPhase2SignOff({ clean: true, blocked: false, cin7_complete: true })).toBe(true);
  });
});
