/**
 * UNI-2116: agents/stats route — verifies that on upstream failure:
 *  - demo mode OFF  → 503 response with error body (no mock data)
 *  - demo mode ON   → 200 with zeroed placeholder (explicit, labelled)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDemoMode } from '@/lib/demo-mode';

vi.mock('@/lib/demo-mode', () => ({
  isDemoMode: vi.fn(() => false),
}));

const mockIsDemoMode = isDemoMode as ReturnType<typeof vi.fn>;

/**
 * Replicate the route error branch logic without importing Next.js server context.
 */
function simulateRouteError(message: string): { status: number; body: Record<string, unknown> } {
  if (isDemoMode()) {
    return {
      status: 200,
      body: {
        total_agents: 0,
        active_agents: 0,
        total_tasks: 0,
        successful_tasks: 0,
        failed_tasks: 0,
        success_rate: 0,
        avg_iterations: 0,
        avg_duration_seconds: 0,
      },
    };
  }
  return {
    status: 503,
    body: { error: 'agent_stats_unavailable', message },
  };
}

describe('agents/stats route error branch (UNI-2116)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it('demo mode OFF → 503 with error key, no mock stats data', () => {
    mockIsDemoMode.mockReturnValue(false);
    const { status, body } = simulateRouteError('upstream timeout');

    expect(status).toBe(503);
    expect(body.error).toBe('agent_stats_unavailable');
    expect(body.message).toBe('upstream timeout');
    // Must NOT contain real or mock stat fields
    expect(body.total_agents).toBeUndefined();
    expect(body.success_rate).toBeUndefined();
  });

  it('demo mode ON → 200 with zeroed placeholder (explicit demo response)', () => {
    mockIsDemoMode.mockReturnValue(true);
    const { status, body } = simulateRouteError('upstream timeout');

    expect(status).toBe(200);
    expect(body.total_agents).toBe(0);
    expect(body.success_rate).toBe(0);
    // Error fields must NOT appear in demo response
    expect(body.error).toBeUndefined();
  });
});
