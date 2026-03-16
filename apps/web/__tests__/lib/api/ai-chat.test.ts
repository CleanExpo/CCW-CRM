import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  createNewConversation,
  sendMessage,
  getConversationHistory,
  deleteConversation,
} from '@/lib/api/ai-chat';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createNewConversation', () => {
  it('calls POST /api/ai/chat/new', async () => {
    mockPost.mockResolvedValue({ conversation_id: 'conv-1', created_at: '2026-01-01' });
    const result = await createNewConversation();
    expect(mockPost).toHaveBeenCalledWith('/api/ai/chat/new', {});
    expect(result.conversation_id).toBe('conv-1');
  });
});

describe('sendMessage', () => {
  it('calls POST /api/ai/chat/message', async () => {
    mockPost.mockResolvedValue({ conversation_id: 'conv-1', message: 'Response', tools_used: [] });
    await sendMessage({ conversation_id: 'conv-1', message: 'Hello' });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/chat/message', {
      conversation_id: 'conv-1',
      message: 'Hello',
    });
  });
});

describe('getConversationHistory', () => {
  it('calls GET with default limit 50', async () => {
    mockGet.mockResolvedValue({ conversation_id: 'conv-1', messages: [], total: 0 });
    await getConversationHistory('conv-1');
    expect(mockGet).toHaveBeenCalledWith('/api/ai/chat/history/conv-1?limit=50');
  });

  it('accepts custom limit', async () => {
    mockGet.mockResolvedValue({ conversation_id: 'conv-1', messages: [], total: 0 });
    await getConversationHistory('conv-1', 10);
    expect(mockGet).toHaveBeenCalledWith('/api/ai/chat/history/conv-1?limit=10');
  });
});

describe('deleteConversation', () => {
  it('calls DELETE /api/ai/chat/history/:id', async () => {
    mockDelete.mockResolvedValue({ message: 'Deleted', messages_deleted: '5' });
    await deleteConversation('conv-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/ai/chat/history/conv-1');
  });
});
