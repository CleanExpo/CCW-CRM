import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { workflowsApi } from '@/lib/api/workflows';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const mockTemplate = {
  id: 'tmpl-1',
  name: 'Order Created',
  description: null,
  trigger_event: 'order.created',
  trigger_conditions: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  actions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('workflowsApi.listTemplates', () => {
  it('calls /api/workflows/templates', async () => {
    mockGet.mockResolvedValue([mockTemplate]);
    const result = await workflowsApi.listTemplates();
    expect(mockGet).toHaveBeenCalledWith('/api/workflows/templates');
    expect(result).toHaveLength(1);
  });
});

describe('workflowsApi.getTemplate', () => {
  it('calls templates/:id endpoint', async () => {
    mockGet.mockResolvedValue(mockTemplate);
    await workflowsApi.getTemplate('tmpl-1');
    expect(mockGet).toHaveBeenCalledWith('/api/workflows/templates/tmpl-1');
  });
});

describe('workflowsApi.createTemplate', () => {
  it('posts new template to /api/workflows/templates', async () => {
    mockPost.mockResolvedValue(mockTemplate);
    const input = { name: 'Order Created', trigger_event: 'order.created' };
    await workflowsApi.createTemplate(input);
    expect(mockPost).toHaveBeenCalledWith('/api/workflows/templates', input);
  });
});

describe('workflowsApi.updateTemplate', () => {
  it('puts update to templates/:id endpoint', async () => {
    mockPut.mockResolvedValue({ ...mockTemplate, name: 'Updated Name' });
    await workflowsApi.updateTemplate('tmpl-1', { name: 'Updated Name' });
    expect(mockPut).toHaveBeenCalledWith('/api/workflows/templates/tmpl-1', { name: 'Updated Name' });
  });
});

describe('workflowsApi.deleteTemplate', () => {
  it('deletes template by id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await workflowsApi.deleteTemplate('tmpl-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/workflows/templates/tmpl-1');
  });
});

describe('workflowsApi.listInstances', () => {
  it('calls /api/workflows/instances with no params', async () => {
    mockGet.mockResolvedValue([]);
    await workflowsApi.listInstances();
    expect(mockGet).toHaveBeenCalledWith('/api/workflows/instances');
  });

  it('appends template_id filter', async () => {
    mockGet.mockResolvedValue([]);
    await workflowsApi.listInstances({ template_id: 'tmpl-1' });
    expect(mockGet).toHaveBeenCalledWith('/api/workflows/instances?template_id=tmpl-1');
  });

  it('appends status filter', async () => {
    mockGet.mockResolvedValue([]);
    await workflowsApi.listInstances({ status: 'completed' });
    expect(mockGet).toHaveBeenCalledWith('/api/workflows/instances?status=completed');
  });

  it('appends both filters', async () => {
    mockGet.mockResolvedValue([]);
    await workflowsApi.listInstances({ template_id: 'tmpl-1', status: 'running' });
    expect(mockGet).toHaveBeenCalledWith('/api/workflows/instances?template_id=tmpl-1&status=running');
  });
});
