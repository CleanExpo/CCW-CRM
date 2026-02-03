/**
 * Billing API client for subscription management.
 *
 * Provides methods for:
 * - Getting current subscription
 * - Creating/updating subscriptions
 * - Managing payment methods
 * - Viewing invoices
 */

import { apiClient } from "./client";

export type SubscriptionTier = "starter" | "professional" | "enterprise" | "custom";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired";
export type BillingInterval = "monthly" | "annual";

export interface Subscription {
  id: string;
  organization_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  price_cents: number;
  price_display: string;
  max_locations: number;
  max_users: number;
  max_products: number;
  max_ai_quotes_per_month: number;
  has_multi_location: boolean;
  has_ai_features: boolean;
  has_api_access: boolean;
  has_white_label: boolean;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscribeRequest {
  tier: SubscriptionTier;
  billing_interval: BillingInterval;
  payment_method_id: string;
  trial_days?: number;
}

export interface UpdateSubscriptionRequest {
  tier?: SubscriptionTier;
  billing_interval?: BillingInterval;
}

export interface Invoice {
  id: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  invoice_pdf: string | null;
  created: string;
  period_start: string | null;
  period_end: string | null;
}

export const billingApi = {
  /**
   * Get current organization's subscription.
   */
  async getSubscription(): Promise<Subscription> {
    return apiClient.get<Subscription>("/api/billing");
  },

  /**
   * Subscribe to a plan (create new subscription).
   */
  async subscribe(data: SubscribeRequest): Promise<Subscription> {
    return apiClient.post<Subscription>("/api/billing/subscribe", data);
  },

  /**
   * Update subscription (change plan or billing interval).
   */
  async updateSubscription(data: UpdateSubscriptionRequest): Promise<Subscription> {
    return apiClient.put<Subscription>("/api/billing/subscription", data);
  },

  /**
   * Cancel subscription (at period end or immediately).
   */
  async cancelSubscription(immediately: boolean = false): Promise<Subscription> {
    return apiClient.delete<Subscription>(
      `/api/billing/subscription?immediately=${immediately}`
    );
  },

  /**
   * List invoices for the organization.
   */
  async listInvoices(limit: number = 10): Promise<Invoice[]> {
    return apiClient.get<Invoice[]>(`/api/billing/invoices?limit=${limit}`);
  },
};
