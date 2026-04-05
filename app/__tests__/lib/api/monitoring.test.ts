import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  getAlerts,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  clearOldAlerts,
  getBusinessMetrics,
  getPerformanceStats,
  getAllEndpointStats,
  getSlowestEndpoints,
  getErrorEndpoints,
  getHealth,
  getMetrics,
  getPrometheusAlerts,
  getRangeData,
} from '@/lib/api/monitoring';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

const mockAlert = {
  id: 1,
  type: 'system',
  severity: 'warning' as const,
  title: 'High CPU',
  message: 'CPU usage at 90%',
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  acknowledged: false,
  resolved: false,
};

// ─── Alert Management ──────────────────────────────

describe('getAlerts', () => {
  it('calls GET /api/monitoring/alerts with no params', async () => {
    mockGet.mockResolvedValue({ alerts: [mockAlert], total: 1 });
    await getAlerts();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/alerts');
  });

  it('appends alert_type filter', async () => {
    mockGet.mockResolvedValue({ alerts: [], total: 0 });
    await getAlerts({ alert_type: 'system' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('alert_type=system'));
  });

  it('appends severity filter', async () => {
    mockGet.mockResolvedValue({ alerts: [], total: 0 });
    await getAlerts({ severity: 'critical' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('severity=critical'));
  });

  it('appends acknowledged=false filter', async () => {
    mockGet.mockResolvedValue({ alerts: [], total: 0 });
    await getAlerts({ acknowledged: false });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('acknowledged=false'));
  });

  it('returns alert list and total', async () => {
    mockGet.mockResolvedValue({ alerts: [mockAlert], total: 1 });
    const result = await getAlerts();
    expect(result.alerts[0].title).toBe('High CPU');
    expect(result.total).toBe(1);
  });
});

describe('createAlert', () => {
  it('calls POST /api/monitoring/alerts', async () => {
    mockPost.mockResolvedValue(mockAlert);
    const payload = {
      alert_type: 'system',
      severity: 'warning' as const,
      title: 'High CPU',
      message: 'CPU at 90%',
    };
    await createAlert(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/monitoring/alerts', payload);
  });
});

describe('acknowledgeAlert', () => {
  it('calls POST /api/monitoring/alerts/:id/acknowledge', async () => {
    mockPost.mockResolvedValue({ success: true });
    await acknowledgeAlert(1);
    expect(mockPost).toHaveBeenCalledWith('/api/monitoring/alerts/1/acknowledge', {});
  });
});

describe('resolveAlert', () => {
  it('calls POST /api/monitoring/alerts/:id/resolve', async () => {
    mockPost.mockResolvedValue({ success: true });
    await resolveAlert(1);
    expect(mockPost).toHaveBeenCalledWith('/api/monitoring/alerts/1/resolve', {});
  });
});

describe('clearOldAlerts', () => {
  it('calls DELETE with default 30 days', async () => {
    mockDelete.mockResolvedValue({ cleared_count: 5 });
    await clearOldAlerts();
    expect(mockDelete).toHaveBeenCalledWith('/api/monitoring/alerts/clear-old?days=30');
  });

  it('uses custom days parameter', async () => {
    mockDelete.mockResolvedValue({ cleared_count: 2 });
    await clearOldAlerts(7);
    expect(mockDelete).toHaveBeenCalledWith('/api/monitoring/alerts/clear-old?days=7');
  });
});

// ─── Business Metrics ─────────────────────────────

describe('getBusinessMetrics', () => {
  it('calls GET /api/monitoring/business/summary', async () => {
    mockGet.mockResolvedValue({});
    await getBusinessMetrics();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/business/summary');
  });
});

// ─── Performance Stats ─────────────────────────────

describe('getPerformanceStats', () => {
  it('calls GET /api/monitoring/performance', async () => {
    mockGet.mockResolvedValue({});
    await getPerformanceStats();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/performance');
  });
});

describe('getAllEndpointStats', () => {
  it('calls GET with default limit 100', async () => {
    mockGet.mockResolvedValue({ endpoints: [], total: 0 });
    await getAllEndpointStats();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/performance/endpoints?limit=100');
  });

  it('uses custom limit', async () => {
    mockGet.mockResolvedValue({ endpoints: [], total: 0 });
    await getAllEndpointStats(25);
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/performance/endpoints?limit=25');
  });
});

describe('getSlowestEndpoints', () => {
  it('calls GET with default limit 10', async () => {
    mockGet.mockResolvedValue({ endpoints: [], total: 0 });
    await getSlowestEndpoints();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/performance/slowest?limit=10');
  });
});

describe('getErrorEndpoints', () => {
  it('calls GET with default min_error_rate 1.0', async () => {
    mockGet.mockResolvedValue({ endpoints: [], total: 0 });
    await getErrorEndpoints();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/performance/errors?min_error_rate=1');
  });

  it('uses custom min_error_rate', async () => {
    mockGet.mockResolvedValue({ endpoints: [], total: 0 });
    await getErrorEndpoints(5.0);
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/performance/errors?min_error_rate=5');
  });
});

// ─── Infrastructure Health ─────────────────────────

describe('getHealth', () => {
  it('calls GET /api/monitoring/health', async () => {
    mockGet.mockResolvedValue({ services: [], prometheus: 'up' });
    await getHealth();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/health');
  });

  it('returns health status', async () => {
    const mockHealth = {
      services: [
        { job: 'backend', health: 'up' as const, lastScrape: '2026-01-01', lastError: '' },
      ],
      prometheus: 'up' as const,
    };
    mockGet.mockResolvedValue(mockHealth);
    const result = await getHealth();
    expect(result.prometheus).toBe('up');
    expect(result.services[0].job).toBe('backend');
  });
});

describe('getMetrics', () => {
  it('calls GET /api/monitoring/metrics', async () => {
    mockGet.mockResolvedValue({ metrics: {} });
    await getMetrics();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/metrics');
  });
});

describe('getPrometheusAlerts', () => {
  it('calls GET /api/monitoring/alerts', async () => {
    mockGet.mockResolvedValue({ alerts: [], summary: { total_rules: 0, firing: 0, pending: 0 } });
    await getPrometheusAlerts();
    expect(mockGet).toHaveBeenCalledWith('/api/monitoring/alerts');
  });

  it('returns alerts and summary', async () => {
    const mockPrometheus = {
      alerts: [
        {
          name: 'HighCPU',
          severity: 'warning',
          state: 'firing',
          summary: '',
          description: '',
          activeAt: '',
          value: '90',
        },
      ],
      summary: { total_rules: 10, firing: 1, pending: 0 },
    };
    mockGet.mockResolvedValue(mockPrometheus);
    const result = await getPrometheusAlerts();
    expect(result.summary.firing).toBe(1);
    expect(result.alerts[0].name).toBe('HighCPU');
  });
});

describe('getRangeData', () => {
  it('calls GET /api/monitoring/range with encoded params', async () => {
    mockGet.mockResolvedValue({ series: [] });
    await getRangeData({ query: 'cpu_usage', duration: '1h', step: '5m' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/monitoring/range?'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('query=cpu_usage'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('duration=1h'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('step=5m'));
  });

  it('returns series data', async () => {
    const mockSeries = {
      series: [{ values: [{ time: '2026-01-01T00:00:00Z', timestamp: 1735689600, value: 45.2 }] }],
    };
    mockGet.mockResolvedValue(mockSeries);
    const result = await getRangeData({ query: 'cpu', duration: '1h', step: '1m' });
    expect(result.series[0].values[0].value).toBe(45.2);
  });
});
