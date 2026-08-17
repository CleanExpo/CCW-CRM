import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/cin7', () => ({
  getCin7ScheduledSyncStatus: vi.fn(),
  getCin7Reconciliation: vi.fn(),
  getCin7SyncLogs: vi.fn(),
  syncCin7EntityUntilComplete: vi.fn(),
}));

import { getCin7ScheduledSyncStatus, syncCin7EntityUntilComplete } from '@/lib/api/cin7';
import { Cin7ScheduledSyncRunner } from '../Cin7ScheduledSyncRunner';

describe('Cin7ScheduledSyncRunner', () => {
  beforeEach(() => {
    vi.mocked(getCin7ScheduledSyncStatus).mockReset();
    vi.mocked(syncCin7EntityUntilComplete).mockReset();
  });

  it('shows the next server run and never posts a Cin7 sync from the browser', async () => {
    vi.mocked(getCin7ScheduledSyncStatus).mockResolvedValue({
      source: 'server',
      schedule: { raw: '05:00,21:00', kind: 'twice-daily', time_zone: 'Australia/Sydney' },
      next_fire_at: '2026-08-17T11:00:00.000Z',
      countdown: '2h',
      running: false,
      current_entity: null,
      unattended_owner_is_this_account: true,
      armed: true,
      live_entities: [],
      last_run: null,
      note: 'Scheduled sync: 5:00 AM and 9:00 PM Australia/Sydney.',
    });

    render(
      <Cin7ScheduledSyncRunner
        isConnected
        onScheduledBusyChange={vi.fn()}
        onLogsMayHaveChanged={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Scheduled sync: 5:00 AM and 9:00 PM Australia\/Sydney/i)
      ).toBeInTheDocument();
    });
    expect(syncCin7EntityUntilComplete).not.toHaveBeenCalled();
    expect(screen.queryByText(/Keep this page open/i)).toBeNull();
    expect(screen.queryByText(/Server sync in progress/i)).toBeNull();
    expect(getCin7ScheduledSyncStatus).toHaveBeenCalledTimes(1);
  });
});
