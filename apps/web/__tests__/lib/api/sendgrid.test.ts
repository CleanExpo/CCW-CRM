import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import {
  getSendGridStatus,
  sendEmail,
  listConversations,
  getConversation,
  simulateInboundEmail,
} from '@/lib/api/sendgrid';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

describe('getSendGridStatus', () => {
  it('calls GET /api/integrations/sendgrid/status', async () => {
    mockGet.mockResolvedValue({ connected: true, mode: 'demo' });
    await getSendGridStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/sendgrid/status');
  });
});

describe('sendEmail', () => {
  it('calls POST /api/integrations/sendgrid/send', async () => {
    mockPost.mockResolvedValue({ message_id: 'msg-1' });
    const data = { to: 'test@example.com', subject: 'Test', body: 'Hello' };
    await sendEmail(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/sendgrid/send', data);
  });
});

describe('listConversations', () => {
  it('calls GET /api/integrations/sendgrid/conversations', async () => {
    mockGet.mockResolvedValue([]);
    await listConversations();
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/integrations/sendgrid/conversations')
    );
  });
});

describe('getConversation', () => {
  it('calls GET /api/integrations/sendgrid/conversations/:id', async () => {
    mockGet.mockResolvedValue({ id: 'conv-1', messages: [] });
    await getConversation('conv-1');
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/sendgrid/conversations/conv-1');
  });
});

describe('simulateInboundEmail', () => {
  it('calls POST /api/integrations/sendgrid/demo/simulate-inbound', async () => {
    mockPost.mockResolvedValue({ success: true });
    await simulateInboundEmail(1);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/integrations/sendgrid/demo/simulate-inbound?email_number=1'
    );
  });
});
