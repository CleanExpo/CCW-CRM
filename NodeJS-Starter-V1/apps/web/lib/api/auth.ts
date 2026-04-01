/**
 * Authentication API
 *
 * Handles login, logout, registration, and user management.
 */

import { apiClient } from "./client";

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
}

/**
 * Authentication API methods
 */
export const authApi = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      "/api/auth/login",
      credentials
    );

    // Store token in cookie
    if (response.access_token) {
      document.cookie = `auth_token=${response.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    }

    return response;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>("/api/auth/register", data);
  },

  /**
   * Logout (clear auth token)
   */
  async logout(): Promise<void> {
    // Clear token cookie
    document.cookie = "auth_token=; path=/; max-age=0";

    // Optionally call backend logout endpoint if it exists
    try {
      await apiClient.post("/api/auth/logout");
    } catch {
      // Ignore errors - token is already cleared
    }
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      return await apiClient.get<User>("/api/auth/me");
    } catch (error) {
      // Not authenticated
      return null;
    }
  },

  /**
   * Update current user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.patch<User>("/api/auth/me", data);
  },

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return apiClient.post("/api/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiClient.post("/api/auth/forgot-password", { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return apiClient.post("/api/auth/reset-password", {
      token,
      new_password: newPassword,
    });
  },
};
