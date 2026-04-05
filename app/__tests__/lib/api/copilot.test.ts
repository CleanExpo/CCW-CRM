import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { copilotApi } from '@/lib/api/copilot';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('copilotApi.query', () => {
  it('calls POST /api/ai/copilot/query', async () => {
    mockPost.mockResolvedValue({
      answer: 'Test response',
      suggested_actions: [],
      sources: [],
      demo_mode: true,
      query_type: 'general_query',
    });
    await copilotApi.query({ query: 'What are today orders?' });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/copilot/query', {
      query: 'What are today orders?',
    });
  });

  it('passes all request fields', async () => {
    mockPost.mockResolvedValue({ answer: 'Order summary' });
    const request = {
      query: 'Summarize order ORD-001',
      query_type: 'summarise_order' as const,
      module_context: 'orders' as const,
      entity_id: 'order-1',
      conversation_history: [{ role: 'user' as const, content: 'hello' }],
    };
    await copilotApi.query(request);
    expect(mockPost).toHaveBeenCalledWith('/api/ai/copilot/query', request);
  });
});

describe('copilotApi.health', () => {
  it('calls GET /api/ai/copilot/health', async () => {
    mockGet.mockResolvedValue({ status: 'healthy', agent_id: 'copilot-1', capabilities: [] });
    const result = await copilotApi.health();
    expect(mockGet).toHaveBeenCalledWith('/api/ai/copilot/health');
    expect(result.status).toBe('healthy');
  });
});
