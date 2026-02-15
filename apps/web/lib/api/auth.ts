/**
 * Authentication API
 *
 * Uses Supabase Auth for production, falls back to FastAPI backend for local dev.
 */

import { getSupabase } from "@/lib/supabase/client";
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
}

/**
 * Check if we should use Supabase Auth (production) or FastAPI (local dev)
 */
function useSupabaseAuth(): boolean {
  // Use Supabase Auth when NEXT_PUBLIC_SUPABASE_URL is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return supabaseUrl.length > 0 && supabaseUrl.includes("supabase.co");
}

/**
 * Authentication API methods
 */
export const authApi = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { rememberMe = true } = credentials;

    if (useSupabaseAuth()) {
      // Supabase Auth
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      const token = data.session?.access_token || "";

      // Store token based on "Keep me signed in" preference
      if (token && typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("auth_token", token);
          sessionStorage.removeItem("auth_token");
        } else {
          sessionStorage.setItem("auth_token", token);
          localStorage.removeItem("auth_token");
        }
      }

      return {
        access_token: token,
        token_type: "bearer",
        user: {
          id: data.user?.id || "",
          email: data.user?.email || "",
          full_name: data.user?.user_metadata?.full_name || data.user?.email?.split("@")[0] || "",
          is_active: true,
          is_admin: data.user?.user_metadata?.is_admin ?? true,
          created_at: data.user?.created_at || new Date().toISOString(),
        },
      };
    }

    // FastAPI backend (local development)
    const { rememberMe: _, ...loginData } = credentials;
    const response = await apiClient.post<LoginResponse>(
      "/api/auth/login",
      loginData
    );

    if (response.access_token && typeof window !== "undefined") {
      if (rememberMe) {
        localStorage.setItem("auth_token", response.access_token);
        sessionStorage.removeItem("auth_token");
      } else {
        sessionStorage.setItem("auth_token", response.access_token);
        localStorage.removeItem("auth_token");
      }
    }

    return response;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    if (useSupabaseAuth()) {
      const { data: authData, error } = await getSupabase().auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name },
        },
      });

      if (error) throw new Error(error.message);

      return {
        user: {
          id: authData.user?.id || "",
          email: authData.user?.email || "",
          full_name: data.full_name,
          is_active: true,
          is_admin: false,
          created_at: authData.user?.created_at || new Date().toISOString(),
        },
        message: "User registered successfully",
      };
    }

    return apiClient.post<RegisterResponse>("/api/auth/register", data);
  },

  /**
   * Logout (clear auth token)
   */
  async logout(): Promise<void> {
    // Clear token from both storage locations
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
    }

    if (useSupabaseAuth()) {
      await getSupabase().auth.signOut();
    } else {
      try {
        await apiClient.post("/api/auth/logout");
      } catch {
        // Ignore errors - token is already cleared
      }
    }
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    if (useSupabaseAuth()) {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return null;

      return {
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
        is_active: true,
        is_admin: user.user_metadata?.is_admin ?? true,
        created_at: user.created_at,
      };
    }

    try {
      return await apiClient.get<User>("/api/auth/me");
    } catch {
      return null;
    }
  },

  /**
   * Update current user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    if (useSupabaseAuth()) {
      const { data: authData, error } = await getSupabase().auth.updateUser({
        data: { full_name: data.full_name },
      });

      if (error) throw new Error(error.message);

      return {
        id: authData.user?.id || "",
        email: authData.user?.email || "",
        full_name: authData.user?.user_metadata?.full_name,
        is_active: true,
        is_admin: authData.user?.user_metadata?.is_admin ?? true,
        created_at: authData.user?.created_at || new Date().toISOString(),
      };
    }

    return apiClient.patch<User>("/api/auth/me", data);
  },

  /**
   * Change password
   */
  async changePassword(
    _currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    if (useSupabaseAuth()) {
      const { error } = await getSupabase().auth.updateUser({
        password: newPassword,
      });

      if (error) throw new Error(error.message);
      return { message: "Password changed successfully" };
    }

    return apiClient.post("/api/auth/change-password", {
      current_password: _currentPassword,
      new_password: newPassword,
    });
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    if (useSupabaseAuth()) {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email);
      if (error) throw new Error(error.message);
      return { message: "If an account exists with that email, a password reset link has been sent." };
    }

    return apiClient.post("/api/auth/forgot-password", { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword(
    _token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    if (useSupabaseAuth()) {
      const { error } = await getSupabase().auth.updateUser({
        password: newPassword,
      });

      if (error) throw new Error(error.message);
      return { message: "Password has been reset successfully" };
    }

    return apiClient.post("/api/auth/reset-password", {
      token: _token,
      new_password: newPassword,
    });
  },
};
