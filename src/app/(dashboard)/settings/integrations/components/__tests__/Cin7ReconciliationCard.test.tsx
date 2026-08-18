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
    counts_identical: false,
    reason: 'D10 freeze has not been captured',
    live_reason: 'Need 3 consecutive complete acceptance runs to observe the live Cin7 catalog',
    freeze: null,
    runs: [],
    last_prune_audit: null,
    revert_how: '',
  }),
  captureCin7StockFreeze: vi.fn(),
  pruneCin7StockSurplus: vi.fn(),
  syncCin7EntityUntilComplete: vi.fn(),
  healCin7FieldMismatches: vi.fn(),
  revertCin7HealAudit: vi.fn(),
}));

import type { Cin7ReconciliationResponse } from '@/lib/api/cin7';
import {
  captureCin7StockFreeze,
  getCin7ReconSnapshot,
  getCin7Reconciliation,
  getCin7StockStability,
  listCin7ReconHistory,
  pruneCin7StockSurplus,
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
      counts_identical: false,
      reason: 'D10 freeze has not been captured',
      live_reason: 'Need 3 consecutive complete acceptance runs to observe the live Cin7 catalog',
      freeze: null,
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

  it('does not offer a prune button until a D10 freeze exists', async () => {
    render(<Cin7ReconciliationCard isConnected={true} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /capture freeze/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /prune extras/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync stock/i })).not.toBeInTheDocument();
  });

  it('offers prune extras when Optix has surplus against the freeze', async () => {
    vi.mocked(getCin7StockStability).mockResolvedValue({
      stable: true,
      prune_enabled: true,
      required: 3,
      observed: 3,
      cin7_counts: [10007, 9996, 9805],
      counts_identical: false,
      reason: '',
      live_reason: '',
      freeze: {
        procedure: 'D10',
        freeze_id: 'freeze-1',
        as_of: '2026-08-17T11:00:00.000Z',
        time_zone: 'Australia/Sydney',
        cin7_keys: 10007,
        keyset_sha256: 'abc123def4567890',
        truncated: false,
        complete: true,
        cin7_reported_total: 10007,
      },
      runs: [],
      last_prune_audit: null,
      revert_how: '',
    });
    vi.mocked(pruneCin7StockSurplus).mockResolvedValue({
      audit_run_id: null,
      cin7_keys: 10007,
      optix_before: 13749,
      deleted: 3742,
      missing_in_optix: 0,
      missing_keys: [],
      errors: [],
      dry_run: true,
      freeze_id: 'freeze-1',
    });

    render(<Cin7ReconciliationCard isConnected={true} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /prune extras/i })).toBeEnabled();
    });
    expect(screen.queryByRole('button', { name: /recapture freeze/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync stock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /undo prune/i })).not.toBeInTheDocument();
  });

  it('lists freeze keys missing in Optix without offering a live stock sync', async () => {
    vi.mocked(getCin7StockStability).mockResolvedValue({
      stable: true,
      prune_enabled: true,
      required: 3,
      observed: 0,
      cin7_counts: [],
      counts_identical: false,
      reason: '',
      live_reason: '',
      freeze: {
        procedure: 'D10',
        freeze_id: 'freeze-1',
        as_of: '2026-08-18T03:47:48.671Z',
        time_zone: 'Australia/Sydney',
        cin7_keys: 10403,
        keyset_sha256: '15ea42db5e7cabcd',
        truncated: false,
        complete: true,
        cin7_reported_total: 10403,
      },
      runs: [],
      last_prune_audit: {
        id: 'audit-1',
        status: 'applied',
        deleted_total: 12,
        reversible: true,
        created_at: '2026-08-18T03:00:00.000Z',
      },
      revert_how: '',
    });
    vi.mocked(pruneCin7StockSurplus).mockResolvedValue({
      audit_run_id: null,
      cin7_keys: 10403,
      optix_before: 10399,
      deleted: 0,
      missing_in_optix: 4,
      missing_keys: ['b1:SKU-A', 'b1:SKU-B', 'b2:SKU-C', 'b2:SKU-D'],
      errors: [],
      dry_run: true,
      freeze_id: 'freeze-1',
    });

    render(<Cin7ReconciliationCard isConnected={true} />);

    await waitFor(() => {
      expect(screen.getByText('b1:SKU-A')).toBeInTheDocument();
    });
    expect(screen.getByText('b2:SKU-D')).toBeInTheDocument();
    expect(screen.getByText(/missing in Optix/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync stock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /prune extras/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recapture freeze/i })).not.toBeInTheDocument();
  });

  it('opens an in-app confirm for D10 freeze instead of a browser dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<Cin7ReconciliationCard isConnected={true} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /capture freeze/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /capture freeze\?/i })).toBeInTheDocument();
    expect(captureCin7StockFreeze).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
