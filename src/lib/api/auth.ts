/**
 * Authentication API
 *
 * Same-origin Next.js Route Handlers under `/api/auth/*` (Postgres + JWT).
 */

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface RegisterResponse {
  user: User;
  message: string;
  access_token?: string;
  token_type?: string;
}

async function readAuthError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({}));
  return (
    (err as { detail?: string }).detail ||
    (err as { error?: string }).error ||
    `Request failed (${res.status})`
  );
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { rememberMe = true } = credentials;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!res.ok) {
      throw new Error(await readAuthError(res));
    }

    const response: LoginResponse = await res.json();

    if (response.access_token && typeof window !== 'undefined') {
      if (rememberMe) {
        localStorage.setItem('auth_token', response.access_token);
        sessionStorage.removeItem('auth_token');
      } else {
        sessionStorage.setItem('auth_token', response.access_token);
        localStorage.removeItem('auth_token');
      }
    }

    return response;
  },

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      }),
    });

    if (!res.ok) {
      throw new Error(await readAuthError(res));
    }

    const response: RegisterResponse = await res.json();

    if (response.access_token && typeof window !== 'undefined') {
      localStorage.setItem('auth_token', response.access_token);
      sessionStorage.removeItem('auth_token');
    }

    return response;
  },

  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Ignore — client storage already cleared
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const body: { full_name?: string; email?: string } = {};
    if (data.full_name !== undefined) body.full_name = data.full_name;
    if (data.email !== undefined) body.email = data.email;

    if (Object.keys(body).length === 0) {
      throw new Error('No updatable fields provided (use full_name or email)');
    }

    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(await readAuthError(res));
    }

    return res.json();
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (!res.ok) {
      throw new Error(await readAuthError(res));
    }

    return res.json();
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      throw new Error(await readAuthError(res));
    }

    return res.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });

    if (!res.ok) {
      throw new Error(await readAuthError(res));
    }

    return res.json();
  },
};

/** Clear cookies/storage and hard-navigate to login so middleware picks up signed-out state. */
export async function logoutAndRedirectToLogin(): Promise<void> {
  await authApi.logout();
  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
}
