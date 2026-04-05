import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { getAutonomyMetrics, getAutonomyHealth, getAutonomyAnomalies } from '@/lib/api/autonomy';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAutonomyMetrics', () => {
  it('defaults window_hours to 24', async () => {
    mockGet.mockResolvedValue({ total_actions: 100 });
    await getAutonomyMetrics();
    expect(mockGet).toHaveBeenCalledWith('/api/autonomy/metrics?window_hours=24');
  });

  it('accepts custom window_hours', async () => {
    mockGet.mockResolvedValue({ total_actions: 50 });
    await getAutonomyMetrics(48);
    expect(mockGet).toHaveBeenCalledWith('/api/autonomy/metrics?window_hours=48');
  });
});

describe('getAutonomyHealth', () => {
  it('defaults window_hours to 1', async () => {
    mockGet.mockResolvedValue({ status: 'healthy' });
    await getAutonomyHealth();
    expect(mockGet).toHaveBeenCalledWith('/api/autonomy/health?window_hours=1');
  });
});

describe('getAutonomyAnomalies', () => {
  it('defaults window_hours to 24', async () => {
    mockGet.mockResolvedValue({
      anomalies: [],
      has_anomalies: false,
      anomaly_count: 0,
      window_hours: 24,
    });
    await getAutonomyAnomalies();
    expect(mockGet).toHaveBeenCalledWith('/api/autonomy/anomalies?window_hours=24');
  });

  it('accepts custom window_hours', async () => {
    mockGet.mockResolvedValue({ anomalies: [], has_anomalies: false });
    await getAutonomyAnomalies(72);
    expect(mockGet).toHaveBeenCalledWith('/api/autonomy/anomalies?window_hours=72');
  });
});
