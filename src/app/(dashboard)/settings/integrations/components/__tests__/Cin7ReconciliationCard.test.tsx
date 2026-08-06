import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/api/cin7', () => ({
  getCin7Reconciliation: vi.fn(),
  getCin7ExceptionReport: vi.fn(),
  getCin7ExceptionReportExportUrl: vi.fn(() => '/api/cin7/exceptions/export'),
}));

import { getCin7Reconciliation } from '@/lib/api/cin7';
import type { Cin7ReconciliationResponse } from '@/lib/api/cin7';
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
});
