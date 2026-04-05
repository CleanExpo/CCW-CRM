import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { slaApi } from '@/lib/api/sla';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('slaApi.getRules', () => {
  it('calls GET /api/sla/rules', async () => {
    mockGet.mockResolvedValue([]);
    await slaApi.getRules();
    expect(mockGet).toHaveBeenCalledWith('/api/sla/rules');
  });
});

describe('slaApi.getInstances', () => {
  it('calls GET /api/sla/instances with no params', async () => {
    mockGet.mockResolvedValue([]);
    await slaApi.getInstances();
    expect(mockGet).toHaveBeenCalledWith('/api/sla/instances');
  });

  it('appends entity_type filter', async () => {
    mockGet.mockResolvedValue([]);
    await slaApi.getInstances({ entity_type: 'order' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('entity_type=order'));
  });

  it('appends breached filter', async () => {
    mockGet.mockResolvedValue([]);
    await slaApi.getInstances({ breached: true });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('breached=true'));
  });
});

describe('slaApi.getEntitySLAs', () => {
  it('calls GET /api/sla/instances/:entityId', async () => {
    mockGet.mockResolvedValue([]);
    await slaApi.getEntitySLAs('entity-1');
    expect(mockGet).toHaveBeenCalledWith('/api/sla/instances/entity-1');
  });
});
