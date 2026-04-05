import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing authApi
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  })),
}));

// Ensure Supabase Auth is disabled (no NEXT_PUBLIC_SUPABASE_URL)
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');

import { authApi } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

// Helper to create a mock Response for global fetch (used by authApi.login and logout)
function mockFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
  } as Response);
}

const mockUser = {
  id: 'user-1',
  email: 'admin@demo.com',
  full_name: 'Admin User',
  is_active: true,
  is_admin: true,
  created_at: '2026-01-01T00:00:00Z',
};

const mockLoginResponse = {
  access_token: 'jwt-token-123',
  token_type: 'bearer',
  user: mockUser,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Mock window storage
  const storage: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
  });
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  // Reset fetch mock
  vi.stubGlobal('fetch', vi.fn());
});

describe('authApi.login (FastAPI mode)', () => {
  it('calls POST /api/auth/login with credentials', async () => {
    vi.mocked(fetch).mockReturnValue(mockFetchResponse(mockLoginResponse));
    await authApi.login({ email: 'admin@demo.com', password: 'demo123' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'admin@demo.com', password: 'demo123' }),
      })
    );
  });

  it('stores token in localStorage when rememberMe is true', async () => {
    vi.mocked(fetch).mockReturnValue(mockFetchResponse(mockLoginResponse));
    await authApi.login({ email: 'admin@demo.com', password: 'demo123', rememberMe: true });
    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
  });

  it('stores token in sessionStorage when rememberMe is false', async () => {
    vi.mocked(fetch).mockReturnValue(mockFetchResponse(mockLoginResponse));
    await authApi.login({ email: 'admin@demo.com', password: 'demo123', rememberMe: false });
    expect(sessionStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
  });

  it('returns the login response', async () => {
    vi.mocked(fetch).mockReturnValue(mockFetchResponse(mockLoginResponse));
    const result = await authApi.login({ email: 'admin@demo.com', password: 'demo123' });
    expect(result.access_token).toBe('jwt-token-123');
    expect(result.user.email).toBe('admin@demo.com');
  });
});

describe('authApi.register (FastAPI mode)', () => {
  it('calls POST /api/auth/register', async () => {
    const registerResponse = { user: mockUser, message: 'User registered successfully' };
    mockPost.mockResolvedValue(registerResponse);
    await authApi.register({ email: 'new@test.com', password: 'pass123', full_name: 'New User' });
    expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
      email: 'new@test.com',
      password: 'pass123',
      full_name: 'New User',
    });
  });
});

describe('authApi.logout (FastAPI mode)', () => {
  it('clears tokens and calls POST /api/auth/logout', async () => {
    vi.mocked(fetch).mockReturnValue(mockFetchResponse(undefined));
    await authApi.logout();
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('authApi.getCurrentUser (FastAPI mode)', () => {
  it('calls GET /api/auth/me', async () => {
    mockGet.mockResolvedValue(mockUser);
    const result = await authApi.getCurrentUser();
    expect(mockGet).toHaveBeenCalledWith('/api/auth/me');
    expect(result?.email).toBe('admin@demo.com');
  });

  it('returns null on error', async () => {
    mockGet.mockRejectedValue(new Error('Unauthorized'));
    const result = await authApi.getCurrentUser();
    expect(result).toBeNull();
  });
});

describe('authApi.updateProfile (FastAPI mode)', () => {
  it('calls PATCH /api/auth/me with data', async () => {
    mockPatch.mockResolvedValue(mockUser);
    await authApi.updateProfile({ full_name: 'Updated Name' });
    expect(mockPatch).toHaveBeenCalledWith('/api/auth/me', { full_name: 'Updated Name' });
  });
});

describe('authApi.changePassword (FastAPI mode)', () => {
  it('calls POST /api/auth/change-password', async () => {
    mockPost.mockResolvedValue({ message: 'Password changed successfully' });
    await authApi.changePassword('old123', 'new456');
    expect(mockPost).toHaveBeenCalledWith('/api/auth/change-password', {
      current_password: 'old123',
      new_password: 'new456',
    });
  });
});

describe('authApi.requestPasswordReset (FastAPI mode)', () => {
  it('calls POST /api/auth/forgot-password', async () => {
    mockPost.mockResolvedValue({ message: 'Reset link sent' });
    await authApi.requestPasswordReset('user@test.com');
    expect(mockPost).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'user@test.com' });
  });
});

describe('authApi.resetPassword (FastAPI mode)', () => {
  it('calls POST /api/auth/reset-password', async () => {
    mockPost.mockResolvedValue({ message: 'Password reset' });
    await authApi.resetPassword('token-123', 'newpass');
    expect(mockPost).toHaveBeenCalledWith('/api/auth/reset-password', {
      token: 'token-123',
      new_password: 'newpass',
    });
  });
});
