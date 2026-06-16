import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceIdForUser: vi.fn(),
  getWorkspaceMemberUserIds: vi.fn(),
}));

import { getWorkspaceIdForUser, getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ccwWorkspaceRecordOwnerId,
  resolveCcwWorkspaceContext,
} from '@/lib/auth/ccw-workspace-context';

describe('ccw-workspace-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user has no workspace', async () => {
    vi.mocked(getWorkspaceIdForUser).mockResolvedValue(null);
    expect(await resolveCcwWorkspaceContext('user-1')).toBeNull();
  });

  it('returns workspace context with member ids', async () => {
    vi.mocked(getWorkspaceIdForUser).mockResolvedValue('ws-1');
    vi.mocked(getWorkspaceMemberUserIds).mockResolvedValue(['ws-1', 'user-2']);

    const ctx = await resolveCcwWorkspaceContext('user-2');
    expect(ctx).toEqual({
      workspaceId: 'ws-1',
      workspaceUserIds: ['ws-1', 'user-2'],
      actingUserId: 'user-2',
    });
    expect(ccwWorkspaceRecordOwnerId(ctx!)).toBe('ws-1');
  });
});
