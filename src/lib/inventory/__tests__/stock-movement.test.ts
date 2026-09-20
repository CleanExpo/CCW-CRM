import { describe, expect, it } from 'vitest';

import {
  csvCell,
  toReportingCsv,
  type ReportingExtract,
} from '@/lib/reporting/transaction-extract';
import { parseSaleBranch, sanitizeMovementRows } from '../stock-movement';

describe('sanitizeMovementRows', () => {
  it('drops zero qty and blank sku', () => {
    expect(
      sanitizeMovementRows([
        {
          ownerUserId: 'u',
          sku: '',
          branchName: 'brisbane',
          quantity: 1,
          movementType: 'adjustment',
          sourceType: 'x',
          sourceId: '1',
        },
        {
          ownerUserId: 'u',
          sku: 'A',
          branchName: 'brisbane',
          quantity: 0,
          movementType: 'adjustment',
          sourceType: 'x',
          sourceId: '1',
        },
        {
          ownerUserId: 'u',
          sku: 'A',
          branchName: 'brisbane',
          quantity: -2,
          movementType: 'sale',
          sourceType: 'invoice',
          sourceId: 'i1',
        },
      ])
    ).toHaveLength(1);
  });
});

describe('csvCell', () => {
  it('quotes commas and quotes', () => {
    expect(csvCell('QLD1, QLD')).toBe('"QLD1, QLD"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('parseSaleBranch', () => {
  it('normalises the three warehouse names', () => {
    expect(parseSaleBranch('Brisbane')).toBe('brisbane');
    expect(parseSaleBranch('')).toBeNull();
  });
});

describe('toReportingCsv', () => {
  it('emits invoice lines and stock movements without a database URL', () => {
    const extract: ReportingExtract = {
      generated_at: '2026-09-20T00:00:00.000Z',
      invoice_lines: [
        {
          kind: 'invoice_line',
          invoice_id: 'inv-1',
          invoice_number: 'INV-1',
          customer_id: 'c1',
          branch_name: 'brisbane',
          product_id: 'p1',
          sku: 'SKU-1',
          quantity: 2,
          unit_price: 10,
          line_total: 20,
          invoice_date: '2026-09-20',
        },
      ],
      stock_movements: [
        {
          kind: 'stock_movement',
          movement_id: 'm1',
          sku: 'SKU-1',
          branch_name: 'brisbane',
          quantity: -2,
          movement_type: 'transfer_out',
          source_type: 'stock_transfer',
          source_id: 't1',
          occurred_at: '2026-09-20T00:00:00.000Z',
        },
      ],
    };
    const csv = toReportingCsv(extract);
    expect(csv).toContain('invoice_line');
    expect(csv).toContain('stock_movement');
    expect(csv).toContain('brisbane');
  });
});
