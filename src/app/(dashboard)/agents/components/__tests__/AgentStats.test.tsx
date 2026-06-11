/**
 * UNI-2116: AgentStats — verifies that API failures show an error state
 * (never silent mock fallback).
 *
 * Uses relative imports to work with the project's vitest config.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentStats } from '../AgentStats';

// Mock the agents API using relative path
vi.mock('../../../../../lib/api/agents', () => ({
  agentsApi: {
    getStats: vi.fn(),
    listAgents: vi.fn(),
    getRecentTasks: vi.fn(),
    getPerformanceTrends: vi.fn(),
    getInsights: vi.fn(),
  },
}));

// Mock demo-mode using relative path
vi.mock('../../../../../lib/demo-mode', () => ({
  isDemoMode: vi.fn(() => false),
}));

import { agentsApi } from '../../../../../lib/api/agents';
import { isDemoMode } from '../../../../../lib/demo-mode';

const mockGetStats = agentsApi.getStats as ReturnType<typeof vi.fn>;
const mockIsDemoMode = isDemoMode as ReturnType<typeof vi.fn>;

describe('AgentStats (UNI-2116)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it('shows error state when API fails — no mock data rendered', async () => {
    mockGetStats.mockRejectedValue(new Error('upstream timeout'));

    render(<AgentStats />);

    await waitFor(() => {
      expect(screen.getByText(/agent stats unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/upstream timeout/i)).toBeInTheDocument();
    });

    // Must NOT render stat card labels (would appear in mock data scenario)
    expect(screen.queryByText(/^Active Agents$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Success Rate$/i)).not.toBeInTheDocument();
  });

  it('renders live data when API succeeds', async () => {
    mockGetStats.mockResolvedValue({
      total_agents: 5,
      active_agents: 3,
      total_tasks: 120,
      successful_tasks: 110,
      failed_tasks: 10,
      success_rate: 0.917,
      avg_iterations: 1.2,
      avg_duration_seconds: 2.5,
    });

    render(<AgentStats />);

    await waitFor(() => {
      expect(screen.getByText(/Active Agents/i)).toBeInTheDocument();
    });

    // Error state must NOT appear
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });
});
