import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { generateQuote, generateEmail, generateSummary } from '@/lib/api/ai-generate';
import { apiClient } from '@/lib/api/client';

const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateQuote', () => {
  it('calls POST /api/ai/generate/quote', async () => {
    mockPost.mockResolvedValue({ quote_number: 'Q-2026-001', items: [], total: 0 });
    await generateQuote({ requirements: 'Need 5 truckmounts' });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/generate/quote', {
      requirements: 'Need 5 truckmounts',
    });
  });

  it('passes optional customer_id and user_id', async () => {
    mockPost.mockResolvedValue({ quote_number: 'Q-2026-002' });
    const request = { requirements: 'Test', customer_id: 'cust-1', user_id: 'user-1' };
    await generateQuote(request);
    expect(mockPost).toHaveBeenCalledWith('/api/ai/generate/quote', request);
  });
});

describe('generateEmail', () => {
  it('calls POST /api/ai/generate/email', async () => {
    mockPost.mockResolvedValue({ subject: 'Follow up', body: 'Hi...' });
    const request = {
      email_type: 'quote_follow_up' as const,
      context: { quote_id: 'q-1' },
    };
    await generateEmail(request);
    expect(mockPost).toHaveBeenCalledWith('/api/ai/generate/email', request);
  });
});

describe('generateSummary', () => {
  it('calls POST /api/ai/generate/summary with defaults', async () => {
    mockPost.mockResolvedValue({ content: 'Summary text' });
    await generateSummary('Summarize Q1 sales');
    expect(mockPost).toHaveBeenCalledWith('/api/ai/generate/summary', {
      requirements: 'Summarize Q1 sales',
      summary_type: 'general',
      user_id: undefined,
    });
  });

  it('passes custom summary_type and user_id', async () => {
    mockPost.mockResolvedValue({ content: 'Summary' });
    await generateSummary('Test', 'sales', 'user-1');
    expect(mockPost).toHaveBeenCalledWith('/api/ai/generate/summary', {
      requirements: 'Test',
      summary_type: 'sales',
      user_id: 'user-1',
    });
  });
});
