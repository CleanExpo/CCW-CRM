import { describe, expect, it } from 'vitest';
import { formatLandedCostProbe } from '../e3-probe';

describe('E3 allocation probe', () => {
  it('asks for a UI export when Omni returns no feed', () => {
    const text = formatLandedCostProbe({
      anyExposed: false,
      rows: [{ path: '/v1/LandedCosts?page=1&rows=1', status: 404, exposed: false }],
    });
    expect(text).toMatch(/not on Omni/);
    expect(text).toMatch(/UI export/);
  });
});
