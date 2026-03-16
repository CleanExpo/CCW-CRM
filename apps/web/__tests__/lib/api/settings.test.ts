import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

import { settingsApi } from '@/lib/api/settings';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockPatch = vi.mocked(apiClient.patch);

beforeEach(() => vi.clearAllMocks());

const mockAccount = {
  id: 'user-1',
  email: 'admin@demo.com',
  full_name: 'Admin User',
  is_admin: true,
};

const mockCompany = {
  id: 'org-1',
  name: 'CCW Equipment',
  slug: 'ccw-equipment',
  is_active: true,
};

// ─── settingsApi.getAccount ────────────────────────

describe('settingsApi.getAccount', () => {
  it('calls GET /api/auth/me', async () => {
    mockGet.mockResolvedValue(mockAccount);
    await settingsApi.getAccount();
    expect(mockGet).toHaveBeenCalledWith('/api/auth/me');
  });

  it('returns account profile', async () => {
    mockGet.mockResolvedValue(mockAccount);
    const result = await settingsApi.getAccount();
    expect(result.email).toBe('admin@demo.com');
    expect(result.is_admin).toBe(true);
  });
});

// ─── settingsApi.updateAccount ─────────────────────

describe('settingsApi.updateAccount', () => {
  it('calls PATCH /api/auth/me with update data', async () => {
    mockPatch.mockResolvedValue(mockAccount);
    const update = { full_name: 'Updated Name' };
    await settingsApi.updateAccount(update);
    expect(mockPatch).toHaveBeenCalledWith('/api/auth/me', update);
  });

  it('returns updated account profile', async () => {
    const updated = { ...mockAccount, full_name: 'Updated Name' };
    mockPatch.mockResolvedValue(updated);
    const result = await settingsApi.updateAccount({ full_name: 'Updated Name' });
    expect(result.full_name).toBe('Updated Name');
  });
});

// ─── settingsApi.changePassword ────────────────────

describe('settingsApi.changePassword', () => {
  it('calls POST /api/auth/change-password with passwords', async () => {
    mockPost.mockResolvedValue({ message: 'Password changed successfully' });
    const payload = { current_password: 'old123', new_password: 'new456' };
    await settingsApi.changePassword(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/auth/change-password', payload);
  });

  it('returns success message', async () => {
    mockPost.mockResolvedValue({ message: 'Password changed successfully' });
    const result = await settingsApi.changePassword({
      current_password: 'old',
      new_password: 'new',
    });
    expect(result.message).toBe('Password changed successfully');
  });
});

// ─── settingsApi.getCompany ────────────────────────

describe('settingsApi.getCompany', () => {
  it('calls GET /api/settings/company', async () => {
    mockGet.mockResolvedValue(mockCompany);
    await settingsApi.getCompany();
    expect(mockGet).toHaveBeenCalledWith('/api/settings/company');
  });

  it('returns company settings', async () => {
    mockGet.mockResolvedValue(mockCompany);
    const result = await settingsApi.getCompany();
    expect(result.name).toBe('CCW Equipment');
    expect(result.slug).toBe('ccw-equipment');
    expect(result.is_active).toBe(true);
  });
});

// ─── settingsApi.updateCompany ─────────────────────

describe('settingsApi.updateCompany', () => {
  it('calls PUT /api/settings/company with update data', async () => {
    mockPut.mockResolvedValue(mockCompany);
    const update = { name: 'CCW Equipment Pty Ltd' };
    await settingsApi.updateCompany(update);
    expect(mockPut).toHaveBeenCalledWith('/api/settings/company', update);
  });

  it('returns updated company settings', async () => {
    const updated = { ...mockCompany, name: 'CCW Equipment Pty Ltd' };
    mockPut.mockResolvedValue(updated);
    const result = await settingsApi.updateCompany({ name: 'CCW Equipment Pty Ltd' });
    expect(result.name).toBe('CCW Equipment Pty Ltd');
  });
});
