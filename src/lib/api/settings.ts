/**
 * Settings API client for account and company settings.
 */

import { apiClient } from './client';

export interface AccountProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
}

export interface UpdateAccountRequest {
  full_name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  trading_name: string | null;
  abn: string | null;
  acn: string | null;
}

export interface UpdateCompanyRequest {
  name: string;
  trading_name?: string | null;
  abn?: string | null;
  acn?: string | null;
}

export const settingsApi = {
  // Account profile (uses existing /api/auth/me endpoint)
  getAccount: (): Promise<AccountProfile> => apiClient.get<AccountProfile>('/api/auth/me'),

  updateAccount: (data: UpdateAccountRequest): Promise<AccountProfile> =>
    apiClient.patch<AccountProfile>('/api/auth/me', data),

  changePassword: (data: ChangePasswordRequest): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>('/api/auth/change-password', data),

  // Company settings (UNI-2111: org-authenticated via /api/settings/company)
  getCompany: (): Promise<CompanySettings> =>
    apiClient.get<CompanySettings>('/api/settings/company'),

  updateCompany: (data: UpdateCompanyRequest): Promise<CompanySettings> =>
    apiClient.put<CompanySettings>('/api/settings/company', data),
};
