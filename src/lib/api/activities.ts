/**
 * Activities API Client
 *
 * Provides methods for interacting with the CRM activities endpoints.
 * Activities track customer interactions (calls, emails, meetings, notes, tasks).
 */

import { apiClient } from "./client";
import type {
  Activity,
  ActivityWithRelations,
  CreateActivityRequest,
  UpdateActivityRequest,
  PaginatedActivities,
  ActivityStats,
  ActivityType,
} from "@/types/activities";

/**
 * Parameters for listing activities
 */
export interface ActivityListParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 50, max: 100) */
  page_size?: number;
  /** Filter by activity type */
  activity_type?: ActivityType;
  /** Filter by customer ID */
  customer_id?: string;
  /** Filter by contact ID */
  contact_id?: string;
  /** Filter by order ID */
  order_id?: string;
  /** Filter by quote ID */
  quote_id?: string;
  /** Include completed tasks in results (default: true) */
  include_completed?: boolean;
}

/**
 * Activities API methods
 */
export const activitiesApi = {
  /**
   * List activities with pagination and filters
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated list of activities with related entity names
   *
   * @example
   * ```ts
   * // Get all activities
   * const activities = await activitiesApi.list();
   *
   * // Get only calls for a specific customer
   * const calls = await activitiesApi.list({
   *   activity_type: ActivityType.CALL,
   *   customer_id: 'customer-123'
   * });
   *
   * // Get pending tasks only
   * const tasks = await activitiesApi.list({
   *   activity_type: ActivityType.TASK,
   *   include_completed: false
   * });
   * ```
   */
  async list(params: ActivityListParams = {}): Promise<PaginatedActivities> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.activity_type) queryParams.append("activity_type", params.activity_type);
    if (params.customer_id) queryParams.append("customer_id", params.customer_id);
    if (params.contact_id) queryParams.append("contact_id", params.contact_id);
    if (params.order_id) queryParams.append("order_id", params.order_id);
    if (params.quote_id) queryParams.append("quote_id", params.quote_id);
    if (params.include_completed !== undefined) {
      queryParams.append("include_completed", params.include_completed.toString());
    }

    const url = `/api/activities${queryParams.toString() ? `?${queryParams}` : ""}`;
    return apiClient.get<PaginatedActivities>(url);
  },

  /**
   * Get a single activity by ID
   *
   * @param id - Activity UUID
   * @returns Activity with related entity names (customer_name, contact_name, etc.)
   *
   * @example
   * ```ts
   * const activity = await activitiesApi.get('activity-uuid');
   * console.log(activity.customer_name); // "Acme Corp"
   * ```
   */
  async get(id: string): Promise<ActivityWithRelations> {
    return apiClient.get<ActivityWithRelations>(`/api/activities/${id}`);
  },

  /**
   * Create a new activity
   *
   * @param data - Activity creation data
   * @returns Created activity
   *
   * @example
   * ```ts
   * // Log a phone call
   * const call = await activitiesApi.create({
   *   activity_type: ActivityType.CALL,
   *   subject: "Discussed pricing",
   *   description: "Customer interested in bulk pricing",
   *   customer_id: 'customer-123',
   *   contact_id: 'contact-456'
   * });
   *
   * // Create a task with due date
   * const task = await activitiesApi.create({
   *   activity_type: ActivityType.TASK,
   *   subject: "Send quote",
   *   due_date: new Date('2026-02-15').toISOString(),
   *   customer_id: 'customer-123'
   * });
   * ```
   */
  async create(data: CreateActivityRequest): Promise<Activity> {
    return apiClient.post<Activity>("/api/activities", data);
  },

  /**
   * Update an existing activity
   *
   * @param id - Activity UUID
   * @param data - Partial activity update data
   * @returns Updated activity
   *
   * @example
   * ```ts
   * // Update subject
   * await activitiesApi.update('activity-uuid', {
   *   subject: "Updated subject"
   * });
   *
   * // Reschedule task
   * await activitiesApi.update('task-uuid', {
   *   due_date: new Date('2026-02-20').toISOString()
   * });
   * ```
   */
  async update(id: string, data: UpdateActivityRequest): Promise<Activity> {
    return apiClient.put<Activity>(`/api/activities/${id}`, data);
  },

  /**
   * Delete an activity
   *
   * @param id - Activity UUID
   *
   * @example
   * ```ts
   * await activitiesApi.delete('activity-uuid');
   * ```
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/activities/${id}`);
  },

  /**
   * Mark a task as complete
   *
   * Sets completed_at timestamp to current time.
   *
   * @param id - Activity UUID (must be a task)
   * @returns Updated activity with completed_at set
   *
   * @example
   * ```ts
   * const completedTask = await activitiesApi.complete('task-uuid');
   * console.log(completedTask.completed_at); // "2026-02-11T10:30:00Z"
   * ```
   */
  async complete(id: string): Promise<Activity> {
    return apiClient.post<Activity>(`/api/activities/${id}/complete`, {});
  },

  /**
   * Get activity timeline for a customer
   *
   * Returns activities chronologically ordered (newest first).
   *
   * @param customerId - Customer UUID
   * @param limit - Maximum activities to return (default: 20)
   * @returns Array of activities for the customer
   *
   * @example
   * ```ts
   * // Get recent customer interactions
   * const timeline = await activitiesApi.getCustomerTimeline('customer-uuid');
   *
   * // Get last 50 interactions
   * const extended = await activitiesApi.getCustomerTimeline('customer-uuid', 50);
   * ```
   */
  async getCustomerTimeline(
    customerId: string,
    limit = 20
  ): Promise<ActivityWithRelations[]> {
    return apiClient.get<ActivityWithRelations[]>(
      `/api/activities/customer/${customerId}?limit=${limit}`
    );
  },

  /**
   * Get activity timeline for a contact
   *
   * Returns activities chronologically ordered (newest first).
   *
   * @param contactId - Contact UUID
   * @param limit - Maximum activities to return (default: 20)
   * @returns Array of activities for the contact
   *
   * @example
   * ```ts
   * const timeline = await activitiesApi.getContactTimeline('contact-uuid');
   * ```
   */
  async getContactTimeline(
    contactId: string,
    limit = 20
  ): Promise<ActivityWithRelations[]> {
    return apiClient.get<ActivityWithRelations[]>(
      `/api/activities/contact/${contactId}?limit=${limit}`
    );
  },

  /**
   * Get pending tasks (incomplete with due dates)
   *
   * Returns tasks that have due dates but are not completed,
   * ordered by due date (soonest first).
   *
   * @returns Array of pending tasks
   *
   * @example
   * ```ts
   * const pendingTasks = await activitiesApi.getPendingTasks();
   *
   * // Check for overdue tasks
   * const overdue = pendingTasks.filter(task => {
   *   return new Date(task.due_date!) < new Date();
   * });
   * ```
   */
  async getPendingTasks(): Promise<ActivityWithRelations[]> {
    return apiClient.get<ActivityWithRelations[]>("/api/activities/pending-tasks");
  },

  /**
   * Get activity statistics
   *
   * Returns aggregated stats about activities:
   * - Count by type (calls, emails, meetings, notes, tasks)
   * - Pending tasks count
   * - Overdue tasks count
   * - Activities completed this week
   *
   * @returns Activity statistics
   *
   * @example
   * ```ts
   * const stats = await activitiesApi.getStats();
   * console.log(stats.by_type[ActivityType.CALL]); // 45
   * console.log(stats.overdue_tasks); // 3
   * ```
   */
  async getStats(): Promise<ActivityStats> {
    return apiClient.get<ActivityStats>("/api/activities/stats");
  },
};
