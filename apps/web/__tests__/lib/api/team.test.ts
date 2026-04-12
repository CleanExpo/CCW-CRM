import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { teamApi } from '@/lib/api/team';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

describe('teamApi.list', () => {
  it('calls GET /api/team', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await teamApi.list();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/team'));
  });
});

describe('teamApi.invite', () => {
  it('calls POST /api/team/invite', async () => {
    mockPost.mockResolvedValue({ id: 'user-1' });
    const data = { email: 'new@team.com', role: 'member' };
    await teamApi.invite(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/team/invite', data);
  });
});

describe('teamApi.updateRole', () => {
  it('calls PUT /api/team/:userId/role', async () => {
    mockPut.mockResolvedValue({ id: 'user-1', role: 'admin' });
    await teamApi.updateRole('user-1', { role: 'admin' } as never);
    expect(mockPut).toHaveBeenCalledWith('/api/team/user-1/role', { role: 'admin' });
  });
});

describe('teamApi.remove', () => {
  it('calls DELETE /api/team/:userId', async () => {
    mockDelete.mockResolvedValue(undefined);
    await teamApi.remove('user-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/team/user-1');
  });
});
