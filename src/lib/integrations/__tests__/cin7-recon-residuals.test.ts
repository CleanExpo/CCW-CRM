import { describe, expect, it } from 'vitest';
import {
  b1ResidualsToCsv,
  buildB1ResidualRecords,
  classifyB1AgainstAsOf,
  emptyB1Tally,
  explainB1Residual,
  tallyB1Residuals,
} from '../cin7-recon-residuals';

describe('explainB1Residual', () => {
  it('explains a missing product as in the Cin7 snapshot but not Optix', () => {
    const text = explainB1Residual({
      entityType: 'products',
      reason: 'missing_in_optix',
      cin7Id: 'SKU-1',
      label: 'Widget',
    });
    expect(text).toContain('Widget');
    expect(text).toContain('SKU-1');
    expect(text).toContain('no matching Optix product');
  });

  it('explains extra customers as possible unlinked legacy rows', () => {
    const text = explainB1Residual({
      entityType: 'customers',
      reason: 'extra_in_optix',
      cin7Id: 'legacy-1',
      label: 'Old Co',
    });
    expect(text).toContain('unlinked legacy');
    expect(text).toContain('Old Co');
  });

  it('gives a stored reason for each standing Phase 1 extra', () => {
    const oriental = explainB1Residual({
      entityType: 'customers',
      reason: 'extra_in_optix',
      cin7Id: '27148',
      label: 'The oriental rug cleaning company',
    });
    const shine = explainB1Residual({
      entityType: 'customers',
      reason: 'extra_in_optix',
      cin7Id: '27664',
      label: 'Shine Carpet and Pest Services',
    });
    const nutrienA = explainB1Residual({
      entityType: 'suppliers',
      reason: 'extra_in_optix',
      cin7Id: '27472',
      label: 'Nutrien Water (Total Eden)',
    });
    const nutrienB = explainB1Residual({
      entityType: 'suppliers',
      reason: 'extra_in_optix',
      cin7Id: '27457',
      label: 'Nutrien Water (Total Eden)',
    });
    const handPad = explainB1Residual({
      entityType: 'products',
      reason: 'extra_in_optix',
      cin7Id: 'MPPHaPd',
      label: 'Actichem System 7 Hand Pad 115 x 250mm (EACH Alt None PTO)',
    });

    expect(oriental).toMatch(/legacy/i);
    expect(oriental).toContain('27148');
    expect(shine).toMatch(/legacy/i);
    expect(shine).toContain('27664');
    expect(nutrienA).toMatch(/duplicate/i);
    expect(nutrienA).toContain('27472');
    expect(nutrienB).toMatch(/duplicate/i);
    expect(nutrienB).toContain('27457');
    expect(handPad).toMatch(/option|PTO|alternate/i);
    expect(handPad).toContain('MPPHaPd');
    expect(handPad).toMatch(/add-only|not deleted/i);
  });

  it('explains post-as-of missings as sync lag, not a closed defect', () => {
    const text = explainB1Residual({
      entityType: 'customers',
      reason: 'missing_in_optix',
      cin7Id: '35405',
      label: '35405',
      bucket: 'sync_lag',
    });
    expect(text).toMatch(/sync lag/i);
    expect(text).toMatch(/after the freeze as-of|after the as-of/i);
  });

  it('explains a missing tax code by code key', () => {
    const text = explainB1Residual({
      entityType: 'tax-codes',
      reason: 'missing_in_optix',
      cin7Id: 'GST',
      label: 'GST',
    });
    expect(text).toContain('tax-code');
    expect(text).toContain('GST');
  });
});

describe('buildB1ResidualRecords', () => {
  it('keeps only products, customers, suppliers and tax-codes missing/extra', () => {
    const items = buildB1ResidualRecords([
      { entityType: 'products', reason: 'missing_in_optix', cin7Id: 'A', label: 'A' },
      { entityType: 'customers', reason: 'missing_in_optix', cin7Id: 'c1', label: 'C1' },
      { entityType: 'customers', reason: 'extra_in_optix', cin7Id: 'c2', label: 'C2' },
      { entityType: 'suppliers', reason: 'missing_in_optix', cin7Id: 's1', label: 'S1' },
      { entityType: 'suppliers', reason: 'extra_in_optix', cin7Id: 's2', label: 'S2' },
      { entityType: 'tax-codes', reason: 'missing_in_optix', cin7Id: 'GST', label: 'GST' },
      { entityType: 'stock-levels', reason: 'missing_in_optix', cin7Id: 'b:sku', label: 'sku' },
      { entityType: 'products', reason: 'field_mismatch', cin7Id: 'B', label: 'B' },
    ]);

    expect(items).toHaveLength(6);
    expect(items.every((row) => row.explanation.length > 0)).toBe(true);
    expect(items.some((row) => row.entity_type === ('stock-levels' as never))).toBe(false);

    const counts = tallyB1Residuals(items);
    expect(counts).toEqual({
      products: { missing: 1, extra: 0 },
      customers: { missing: 1, extra: 1 },
      suppliers: { missing: 1, extra: 1 },
      'tax-codes': { missing: 1, extra: 0 },
    });
  });

  it('starts from an empty tally', () => {
    expect(emptyB1Tally().products).toEqual({ missing: 0, extra: 0 });
  });

  it('exports CSV with an explanation column', () => {
    const csv = b1ResidualsToCsv([
      {
        entity_type: 'products',
        cin7_id: 'SKU,1',
        label: 'Name "x"',
        reason: 'missing_in_optix',
        explanation: 'In Cin7, not Optix',
        bucket: 'closed',
      },
    ]);
    expect(csv.startsWith('entity_type,cin7_id,label,reason,bucket,explanation')).toBe(true);
    expect(csv).toContain('""x""');
    expect(csv).toContain('SKU,1');
    expect(csv).toContain('closed');
  });
});

describe('classifyB1AgainstAsOf', () => {
  const extra = (
    entityType: 'products' | 'customers' | 'suppliers',
    cin7Id: string,
    label: string
  ) => ({ entityType, reason: 'extra_in_optix', cin7Id, label });
  const missing = (
    entityType: 'products' | 'customers' | 'suppliers',
    cin7Id: string,
    label: string
  ) => ({ entityType, reason: 'missing_in_optix', cin7Id, label });

  it('keeps latest extras in the closed residual, including a new option SKU', () => {
    const classified = classifyB1AgainstAsOf({
      latestRows: [
        extra('customers', '27148', 'The oriental rug cleaning company'),
        extra('products', 'MPPHaPd', 'Actichem System 7 Hand Pad'),
        missing('customers', '35405', '35405'),
      ],
      asOfRows: [extra('customers', '27148', 'The oriental rug cleaning company')],
      latestIsAsOf: false,
    });

    expect(classified.closed.map((row) => row.cin7_id).sort()).toEqual(['27148', 'MPPHaPd']);
    expect(classified.closed.every((row) => row.bucket === 'closed')).toBe(true);
    expect(classified.sync_lag).toHaveLength(1);
    expect(classified.sync_lag[0]?.cin7_id).toBe('35405');
    expect(classified.sync_lag[0]?.bucket).toBe('sync_lag');
  });

  it('treats missings that already existed at as-of as closed, not lag', () => {
    const classified = classifyB1AgainstAsOf({
      latestRows: [
        missing('customers', 'old-missing', 'Old'),
        missing('customers', '35405', 'New'),
      ],
      asOfRows: [missing('customers', 'old-missing', 'Old')],
      latestIsAsOf: false,
    });

    expect(classified.closed.map((row) => row.cin7_id)).toEqual(['old-missing']);
    expect(classified.sync_lag.map((row) => row.cin7_id)).toEqual(['35405']);
  });

  it('classifies every latest row as closed when the latest run is the as-of run', () => {
    const classified = classifyB1AgainstAsOf({
      latestRows: [
        extra('customers', '27148', 'Oriental'),
        missing('customers', '35405', '35405'),
      ],
      asOfRows: null,
      latestIsAsOf: true,
    });

    expect(classified.closed).toHaveLength(2);
    expect(classified.sync_lag).toHaveLength(0);
  });

  it('treats all missings as sync lag when there is no as-of snapshot to compare', () => {
    const classified = classifyB1AgainstAsOf({
      latestRows: [
        extra('suppliers', '27472', 'Nutrien'),
        missing('suppliers', '35406', '35406'),
      ],
      asOfRows: null,
      latestIsAsOf: false,
    });

    expect(classified.closed.map((row) => row.cin7_id)).toEqual(['27472']);
    expect(classified.sync_lag.map((row) => row.cin7_id)).toEqual(['35406']);
  });
});
