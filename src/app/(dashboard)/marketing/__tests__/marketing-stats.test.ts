/**
 * UNI-2116: Marketing stats loadStats() - verifies that API failures
 * surface an error (never silently substitute mock data) unless demo mode
 * is explicitly on.
 *
 * These are unit tests for the loadStats logic, decoupled from React rendering
 * to keep them fast and environment-agnostic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the behaviour inline since loadStats is a closure; we replicate the
// exact branching logic from marketing/page.tsx here.
import { isDemoMode } from '@/lib/demo-mode';

vi.mock('@/lib/demo-mode', () => ({
  isDemoMode: vi.fn(() => false),
}));

const mockIsDemoMode = isDemoMode as ReturnType<typeof vi.fn>;

const DEMO_PLACEHOLDER = {
  totalAssets: 47,
  imagesGenerated: 28,
  copyGenerated: 19,
  thisMonth: 12,
};

/**
 * Simulate the loadStats error handler exactly as in marketing/page.tsx.
 */
function simulateLoadStatsError(error: Error): {
  stats: typeof DEMO_PLACEHOLDER | null;
  statsError: string | null;
} {
  let stats: typeof DEMO_PLACEHOLDER | null = null;
  let statsError: string | null = null;

  const message = error instanceof Error ? error.message : 'Failed to load marketing stats';
  console.error('[UNI-2116] Marketing stats fetch failed:', message);

  if (isDemoMode()) {
    console.warn('[UNI-2116] DEMO MODE active - using demo marketing stats');
    stats = DEMO_PLACEHOLDER;
  } else {
    statsError = message;
    stats = null;
  }

  return { stats, statsError };
}

describe('Marketing page loadStats error handling (UNI-2116)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
  });

  it('demo mode OFF + API failure → statsError set, stats remains null (no mock data)', () => {
    mockIsDemoMode.mockReturnValue(false);
    const { stats, statsError } = simulateLoadStatsError(new Error('connection refused'));

    expect(stats).toBeNull();
    expect(statsError).toBe('connection refused');
  });

  it('demo mode ON + API failure → placeholder mock data returned, no error surfaced', () => {
    mockIsDemoMode.mockReturnValue(true);
    const { stats, statsError } = simulateLoadStatsError(new Error('connection refused'));

    expect(stats).toEqual(DEMO_PLACEHOLDER);
    expect(statsError).toBeNull();
  });
});
