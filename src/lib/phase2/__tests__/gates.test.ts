import { describe, expect, it } from 'vitest';
import { evaluatePhase2Gates } from '../gates';

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
    expect(gate.reason).toMatch(/E5/);
  });
});
