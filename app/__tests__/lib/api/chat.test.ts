import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  createConversation,
  sendMessage,
  getConversationHistory,
  deleteConversation,
  formatMessage,
  isValidConversationId,
} from '@/lib/api/chat';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createConversation', () => {
  it('posts to /api/ai/chat/new', async () => {
    mockPost.mockResolvedValue({ conversation_id: 'conv-1', created_at: '2026-01-01T00:00:00Z' });
    const result = await createConversation();
    expect(mockPost).toHaveBeenCalledWith('/api/ai/chat/new');
    expect(result.conversation_id).toBe('conv-1');
  });
});

describe('sendMessage', () => {
  it('posts to /api/ai/chat/message with request body', async () => {
    mockPost.mockResolvedValue({
      conversation_id: 'conv-1',
      message: 'Hello back',
      tools_used: [],
      error: null,
    });
    await sendMessage({ conversation_id: 'conv-1', message: 'Hello', user_id: null });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/chat/message', {
      conversation_id: 'conv-1',
      message: 'Hello',
      user_id: null,
    });
  });
});

describe('getConversationHistory', () => {
  it('fetches history with default limit of 50', async () => {
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
  it('deletes conversation history', async () => {
    mockDelete.mockResolvedValue({ message: 'deleted', messages_deleted: '5' });
    await deleteConversation('conv-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/ai/chat/history/conv-1');
  });
});

describe('formatMessage', () => {
  it('formats user message role as "You"', () => {
    const result = formatMessage({
      role: 'user',
      content: 'Hi',
      created_at: '2026-01-01T12:00:00Z',
    });
    expect(result.role).toBe('You');
    expect(result.content).toBe('Hi');
  });

  it('formats assistant message role as "Assistant"', () => {
    const result = formatMessage({
      role: 'assistant',
      content: 'Hello',
      created_at: '2026-01-01T12:00:00Z',
    });
    expect(result.role).toBe('Assistant');
  });
});

describe('isValidConversationId', () => {
  it('returns true for a valid UUID', () => {
    expect(isValidConversationId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns false for invalid strings', () => {
    expect(isValidConversationId('not-a-uuid')).toBe(false);
    expect(isValidConversationId('')).toBe(false);
    expect(isValidConversationId('conv-1')).toBe(false);
  });
});
