import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/phase2', () => ({
  getPhase2Scope: vi.fn(async () => ({
    unsigned: false,
    phase1_missing: 0,
    price_lists_complete: false,
    preflight: [{ id: 'E1', check: 'stock control', result: 'pending' }],
    source_of_truth: [],
    out_of_scope: [],
  })),
  getPhase2EvidenceUrl: vi.fn(() => '/api/phase2/evidence?area=1'),
  getPhase2SameAnswer: vi.fn(),
  comparePhase2Area: vi.fn(async () => ({
    area: 1,
    title: 'Inventory quantities by warehouse',
    as_of: '2026-09-22T00:00:00.000Z',
    read_only: true,
    cin7_is_source_of_truth: true,
    clean: false,
    blocked: true,
    blocked_reason: 'Incomplete Cin7 stock pull cannot be treated as a clean result.',
    cin7_complete: false,
    company: { cin7: 10, optix: 9, difference: -1 },
    sku_count: { cin7: 2, optix: 2 },
    warehouse_count: { cin7: 12, optix: 12 },
    warehouses: [{ warehouse: 'Brisbane', cin7: 10, optix: 9, difference: -1 }],
    counts: { missing: 0, extra: 0, quantity_mismatch: 1, timing: 0, skipped: 0 },
    sample: [
      {
        classification: 'value_mismatch',
        sku: 'SKU-1',
        warehouse: 'Brisbane',
        cin7: 10,
        optix: 9,
        difference: -1,
      },
    ],
    notes: ['Compares Stock On Hand, not Available (open Shopify orders allocate Available only).'],
    source_of_truth: { cin7: 'cin7', optix: 'optix' },
  })),
}));

import { comparePhase2Area } from '@/lib/api/phase2';
import { Phase2Panel } from '../Phase2Panel';

describe('Phase2Panel', () => {
  it('shows the Area 1 section and compare action', async () => {
    const user = userEvent.setup();
    render(<Phase2Panel isConnected={true} />);
    expect(screen.getByText(/Phase 2 · Area 1/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compare on-hand quantities' }));
    expect(comparePhase2Area).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/SKU-1/)).toBeInTheDocument();
    expect(screen.getByText(/Incomplete Cin7 stock pull/)).toBeInTheDocument();
    expect(screen.getByText(/Stock On Hand, not Available/)).toBeInTheDocument();
  });
});
