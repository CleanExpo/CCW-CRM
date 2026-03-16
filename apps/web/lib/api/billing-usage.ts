/**
 * Billing usage API client for usage tracking and limits.
 */

import { apiClient } from "./client";

export interface UsageMetrics {
  locations: number;
  users: number;
  products: number;
  orders: number;
  quotes: number;
  ai_quotes: number;
}

export interface UsageLimits {
  within_limits: boolean;
  warnings: string[];
  exceeded: string[];
}

export const billingUsageApi = {
  /**
   * Get current usage metrics for the organization.
   */
  async getCurrentUsage(): Promise<UsageMetrics> {
    return apiClient.get<UsageMetrics>("/api/billing/usage");
  },

  /**
   * Check if organization is within usage limits.
   */
  async checkUsageLimits(): Promise<UsageLimits> {
    return apiClient.get<UsageLimits>("/api/billing/usage/limits");
  },

  /**
   * Report usage to Stripe (admin only).
   */
  async reportUsage(): Promise<{ organization_id: string; usage: UsageMetrics; reported_at: string }> {
    return apiClient.post("/api/billing/usage/report", {});
  },
};
