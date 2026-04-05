/**
 * Cin7 Webhook Subscriptions API Client
 *
 * Type-safe client for managing Cin7 webhook subscriptions.
 */

import { apiClient } from './client';

export interface Cin7WebhookSubscription {
  id: string;
  event_type: string;
  endpoint_url: string;
  is_active: boolean;
  secret_key?: string | null;
  last_triggered_at?: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookSubscriptionData {
  event_type: string;
  endpoint_url: string;
  secret_key?: string;
}

export interface UpdateWebhookSubscriptionData {
  is_active?: boolean;
  endpoint_url?: string;
  secret_key?: string;
}

export async function listWebhookSubscriptions(
  isActive?: boolean
): Promise<Cin7WebhookSubscription[]> {
  const params = isActive !== undefined ? `?is_active=${isActive}` : '';
  return apiClient.get<Cin7WebhookSubscription[]>(`/api/cin7/webhook-subscriptions${params}`);
}

export async function createWebhookSubscription(
  data: CreateWebhookSubscriptionData
): Promise<Cin7WebhookSubscription> {
  return apiClient.post<Cin7WebhookSubscription>('/api/cin7/webhook-subscriptions', data);
}

export async function updateWebhookSubscription(
  id: string,
  data: UpdateWebhookSubscriptionData
): Promise<Cin7WebhookSubscription> {
  return apiClient.patch<Cin7WebhookSubscription>(`/api/cin7/webhook-subscriptions/${id}`, data);
}

export async function deleteWebhookSubscription(
  id: string
): Promise<{ status: string; id: string }> {
  return apiClient.delete<{ status: string; id: string }>(`/api/cin7/webhook-subscriptions/${id}`);
}
