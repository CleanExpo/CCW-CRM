import { describe, expect, it } from 'vitest';
import { evidenceCsv } from '../evidence';
import type { Phase2AreaReport } from '../types';

describe('evidenceCsv', () => {
  it('exports the sample list for client review', () => {
    const report = {
      area: 1,
      as_of: '2026-09-22T00:00:00.000Z',
      sample: [
        {
          classification: 'value_mismatch',
          sku: 'A',
          warehouse: 'Brisbane',
          cin7: 10,
          optix: 8,
          difference: -2,
          note: 'SOH',
        },
      ],
    } as Phase2AreaReport;
    const csv = evidenceCsv(report);
    expect(csv.split('\n')[0]).toContain('classification');
    expect(csv).toContain('A,Brisbane');
    expect(csv).toContain('value_mismatch');
  });
});
