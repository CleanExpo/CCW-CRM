/**
 * Notifications API Client
 *
 * In-app notification endpoints: list, unread count, mark read.
 */

import { apiClient } from './client';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationsApi = {
  /**
   * List notifications for a user (newest first, max 50)
   * GET /api/notifications?user_id=...
   */
  list: (userId: string): Promise<Notification[]> =>
    apiClient.get<Notification[]>(`/api/notifications?user_id=${userId}`),

  /**
   * Get unread notification count for a user
   * GET /api/notifications/unread-count?user_id=...
   */
  unreadCount: (userId: string): Promise<UnreadCountResponse> =>
    apiClient.get<UnreadCountResponse>(`/api/notifications/unread-count?user_id=${userId}`),

  /**
   * Mark a single notification as read
   * POST /api/notifications/{id}/read
   */
  markRead: (notificationId: string): Promise<Notification> =>
    apiClient.post<Notification>(`/api/notifications/${notificationId}/read`, {}),

  /**
   * Mark all notifications as read for a user
   * POST /api/notifications/read-all?user_id=...
   */
  markAllRead: (userId: string): Promise<{ status: string; user_id: string }> =>
    apiClient.post<{ status: string; user_id: string }>(
      `/api/notifications/read-all?user_id=${userId}`,
      {}
    ),
};
