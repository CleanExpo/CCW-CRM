import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { warehouseApi } from '@/lib/api/warehouse';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => vi.clearAllMocks());

const mockPayload = {
  updatedAt: '2026-01-01T06:00:00Z',
  metrics: {
    inboundToday: 12,
    inboundDocked: 3,
    inboundScheduled: 9,
    picksDueToday: 47,
    rushPicks: 5,
    returnsOpen: 8,
    returnSlaRisk: 2,
    onTimeRate: 94.7,
  },
  receivingQueue: [
    {
      id: 'recv-1',
      supplier: 'Acme Tools',
      container: 'CNTR-001',
      eta: '2026-01-01T08:00:00Z',
      dock: 'Dock A',
      items: 150,
      status: 'scheduled',
      priority: 'high',
    },
  ],
  pickQueue: [
    {
      id: 'pick-1',
      customer: 'Bob Smith',
      zone: 'B3',
      lines: 4,
      promised: '2026-01-01T14:00:00Z',
      status: 'pending',
      priority: 'normal',
    },
  ],
  returnsQueue: [
    {
      id: 'ret-1',
      customer: 'Jane Doe',
      reason: 'Damaged',
      items: 2,
      sla: '2026-01-03T17:00:00Z',
      status: 'open',
    },
  ],
  aiGuidance: [
    { title: 'Prioritise rush picks', detail: '5 rush orders due before 12:00', impact: 'High' },
  ],
};

describe('warehouseApi.getOps', () => {
  it('calls GET /api/warehouse/ops', async () => {
    mockGet.mockResolvedValue(mockPayload);
    await warehouseApi.getOps();
    expect(mockGet).toHaveBeenCalledWith('/api/warehouse/ops');
  });

  it('returns the warehouse ops payload', async () => {
    mockGet.mockResolvedValue(mockPayload);
    const result = await warehouseApi.getOps();
    expect(result.updatedAt).toBe('2026-01-01T06:00:00Z');
    expect(result.metrics.inboundToday).toBe(12);
    expect(result.metrics.onTimeRate).toBe(94.7);
  });

  it('returns receivingQueue array', async () => {
    mockGet.mockResolvedValue(mockPayload);
    const result = await warehouseApi.getOps();
    expect(result.receivingQueue).toHaveLength(1);
    expect(result.receivingQueue[0].supplier).toBe('Acme Tools');
  });

  it('returns pickQueue array', async () => {
    mockGet.mockResolvedValue(mockPayload);
    const result = await warehouseApi.getOps();
    expect(result.pickQueue[0].customer).toBe('Bob Smith');
    expect(result.pickQueue[0].lines).toBe(4);
  });

  it('returns aiGuidance array', async () => {
    mockGet.mockResolvedValue(mockPayload);
    const result = await warehouseApi.getOps();
    expect(result.aiGuidance[0].title).toBe('Prioritise rush picks');
  });

  it('propagates errors from apiClient', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    await expect(warehouseApi.getOps()).rejects.toThrow('Network error');
  });
});
