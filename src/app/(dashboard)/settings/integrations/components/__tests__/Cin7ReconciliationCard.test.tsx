import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/cin7', () => ({
  getCin7Reconciliation: vi.fn(),
  getCin7ExceptionReport: vi.fn(),
  getCin7ExceptionReportExportUrl: vi.fn(() => '/api/cin7/exceptions/export'),
  listCin7ReconHistory: vi.fn().mockResolvedValue({ items: [] }),
  getCin7ReconSnapshot: vi.fn(),
  getCin7B1Residuals: vi.fn().mockResolvedValue({
    recon_run_id: null,
    checked_at: null,
    note: 'Closed residual',
    counts: {
      products: { missing: 0, extra: 0 },
      customers: { missing: 0, extra: 0 },
      suppliers: { missing: 0, extra: 0 },
      'tax-codes': { missing: 0, extra: 0 },
    },
    items: [],
  }),
  getCin7B1ResidualsExportUrl: vi.fn(() => '/api/cin7/residuals.csv'),
  getCin7StockStability: vi.fn().mockResolvedValue({
    stable: false,
    prune_enabled: false,
    required: 3,
    observed: 0,
    cin7_counts: [],
    reason: 'Need 3 consecutive complete acceptance runs',
    runs: [],
    last_prune_audit: null,
    revert_how: '',
  }),
  healCin7FieldMismatches: vi.fn(),
  revertCin7HealAudit: vi.fn(),
}));

import type { Cin7ReconciliationResponse } from '@/lib/api/cin7';
import {
  getCin7ReconSnapshot,
  getCin7Reconciliation,
  getCin7StockStability,
  listCin7ReconHistory,
} from '@/lib/api/cin7';
import { Cin7ReconciliationCard } from '../Cin7ReconciliationCard';

function buildSnapshot(extraWithoutId: number): Cin7ReconciliationResponse {
  return {
    source: 'omni',
    checked_at: new Date().toISOString(),
    notes: [],
    fetch_meta: { errors: [] },
    cin7: {
      products: { skus: 10, styles: 5 },
      customers: 3,
      internal_customers: 1,
      suppliers: 2,
      branches: 1,
    },
    optix: {
      products: { skus: 10, styles: 5 },
      customers: { cin7_linked: 3, extra_without_cin7_id: extraWithoutId },
      internal_customers: 1,
      suppliers: { cin7_linked: 2 },
      branches: { total: 1 },
    },
  } as unknown as Cin7ReconciliationResponse;
}

describe('Cin7ReconciliationCard extra_without_cin7_id remediation copy', () => {
  beforeEach(() => {
    vi.mocked(getCin7Reconciliation).mockReset();
    vi.mocked(getCin7ReconSnapshot).mockReset();
    vi.mocked(getCin7StockStability).mockResolvedValue({
      stable: false,
      prune_enabled: false,
      required: 3,
      observed: 0,
      cin7_counts: [],
      reason: 'Need 3 consecutive complete acceptance runs',
      runs: [],
      last_prune_audit: null,
      revert_how: '',
    });
    vi.mocked(listCin7ReconHistory).mockResolvedValue({
      owner_user_id: 'owner-1',
      note: '',
      items: [],
    });
  });

  it('does not instruct operators to run a full customer sync to link legacy rows', async () => {
    vi.mocked(getCin7Reconciliation).mockResolvedValue(buildSnapshot(4));

    render(<Cin7ReconciliationCard isConnected={true} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^refresh counts$/i }));

    await waitFor(() => {
      expect(screen.getByText(/legacy CRM records/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/does not merge or backfill IDs/i)).toBeInTheDocument();
    expect(screen.queryByText(/run a full customer sync to link them/i)).not.toBeInTheDocument();
  });

  it('opens a stored snapshot from history without re-running recon', async () => {
    vi.mocked(listCin7ReconHistory).mockResolvedValue({
      owner_user_id: 'owner-1',
      note: '',
      items: [
        {
          id: 'snap-1',
          mode: 'acceptance',
          status: 'complete',
          checked_at: '2026-08-13T08:20:52.000Z',
          immutable: true,
          missing_count: 1,
          extra_count: 0,
          field_mismatch_count: 0,
          products_cin7: 10,
          products_optix: 9,
          stock_cin7: 9805,
          stock_optix: 13749,
          stock_reported_total: 10542,
          stock_truncated: true,
        },
      ],
    });
    vi.mocked(getCin7ReconSnapshot).mockResolvedValue({
      ...buildSnapshot(0),
      recon_run_id: 'snap-1',
      mode: 'acceptance',
      notes: ['stored snapshot'],
    });

    render(<Cin7ReconciliationCard isConnected={true} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /acceptance · complete/i })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /acceptance · complete/i }));

    await waitFor(() => {
      expect(getCin7ReconSnapshot).toHaveBeenCalledWith('snap-1');
    });
    expect(getCin7Reconciliation).not.toHaveBeenCalled();
  });

  it('does not offer a prune button while stock is unstable', async () => {
    render(<Cin7ReconciliationCard isConnected={true} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Stock prune — locked until Cin7 count is stable/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /prune surplus stock/i })).not.toBeInTheDocument();
  });

  it('does not offer a prune button after the Cin7 stock count is stable', async () => {
    vi.mocked(getCin7StockStability).mockResolvedValue({
      stable: true,
      prune_enabled: true,
      required: 3,
      observed: 3,
      cin7_counts: [10283, 10283, 10283],
      reason: 'Cin7 stock row count held at 10283 across 3 consecutive complete acceptance runs.',
      runs: [],
      last_prune_audit: null,
      revert_how: '',
    });

    render(<Cin7ReconciliationCard isConnected={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Stock prune — Cin7 count is stable; prune is still a separate action/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Stock prune — locked until Cin7 count is stable/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /prune surplus stock/i })).not.toBeInTheDocument();
  });
});
