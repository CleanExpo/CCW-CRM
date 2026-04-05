import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
}));

import {
  listAccounts,
  syncChartOfAccounts,
  listJournalEntries,
  createJournalEntry,
  postJournalEntry,
  listAccountMappings,
  upsertAccountMapping,
} from '@/lib/api/cin7-gl';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockPatch = vi.mocked(apiClient.patch);

beforeEach(() => vi.clearAllMocks());

describe('listAccounts', () => {
  it('calls GET /api/cin7/chart-of-accounts', async () => {
    mockGet.mockResolvedValue([]);
    await listAccounts();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/chart-of-accounts'));
  });
});

describe('syncChartOfAccounts', () => {
  it('calls POST /api/cin7/chart-of-accounts/sync', async () => {
    mockPost.mockResolvedValue({ synced: 10 });
    await syncChartOfAccounts();
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/chart-of-accounts/sync');
  });
});

describe('listJournalEntries', () => {
  it('calls GET /api/cin7/journal-entries', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await listJournalEntries();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/journal-entries'));
  });
});

describe('createJournalEntry', () => {
  it('calls POST /api/cin7/journal-entries', async () => {
    mockPost.mockResolvedValue({ id: 'je-1' });
    const data = { description: 'Test entry', lines: [] };
    await createJournalEntry(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/journal-entries', data);
  });
});

describe('postJournalEntry', () => {
  it('calls PATCH /api/cin7/journal-entries/:id/post', async () => {
    mockPatch.mockResolvedValue({ id: 'je-1', status: 'posted' });
    await postJournalEntry('je-1');
    expect(mockPatch).toHaveBeenCalledWith('/api/cin7/journal-entries/je-1/post');
  });
});

describe('listAccountMappings', () => {
  it('calls GET /api/cin7/account-mappings', async () => {
    mockGet.mockResolvedValue([]);
    await listAccountMappings();
    expect(mockGet).toHaveBeenCalledWith('/api/cin7/account-mappings');
  });
});

describe('upsertAccountMapping', () => {
  it('calls PUT /api/cin7/account-mappings', async () => {
    mockPut.mockResolvedValue({ id: 'map-1' });
    const data = { cin7_account_id: 'ca-1', local_account_code: 'ACC-001' };
    await upsertAccountMapping(data as never);
    expect(mockPut).toHaveBeenCalledWith('/api/cin7/account-mappings', data);
  });
});
