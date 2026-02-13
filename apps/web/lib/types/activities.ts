// Activity types mirroring backend CRM schemas

/**
 * Activity type enum - types of customer interactions
 */
export enum ActivityType {
  CALL = "call",
  EMAIL = "email",
  MEETING = "meeting",
  NOTE = "note",
  TASK = "task",
}

/**
 * Core Activity interface (mirrors backend Activity model)
 */
export interface Activity {
  id: string;
  activity_type: ActivityType;
  subject: string;
  description: string | null;

  // Entity relationships (all optional - activities can link to any combination)
  customer_id: string | null;
  contact_id: string | null;
  order_id: string | null;
  quote_id: string | null;

  // Task-specific fields
  due_date: string | null; // ISO datetime string
  completed_at: string | null; // ISO datetime string when task was completed

  // Audit fields
  created_by: string | null;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

/**
 * Extended activity response with related entity names
 * (returned by backend for list/get endpoints)
 */
export interface ActivityWithRelations extends Activity {
  customer_name?: string; // Resolved customer company name
  contact_name?: string; // Resolved contact full name
  order_number?: string; // Resolved order number
  quote_number?: string; // Resolved quote number
}

/**
 * Request payload for creating a new activity
 */
export interface CreateActivityRequest {
  activity_type: ActivityType;
  subject: string;
  description?: string;

  // Entity relationships (all optional)
  customer_id?: string;
  contact_id?: string;
  order_id?: string;
  quote_id?: string;

  // Task-specific
  due_date?: string; // ISO datetime string for tasks
}

/**
 * Request payload for updating an existing activity
 * (all fields optional except id in URL)
 */
export interface UpdateActivityRequest {
  activity_type?: ActivityType;
  subject?: string;
  description?: string;

  // Entity relationships
  customer_id?: string;
  contact_id?: string;
  order_id?: string;
  quote_id?: string;

  // Task-specific
  due_date?: string;
}

/**
 * Paginated response for activities list endpoint
 * Note: Uses "items" not "data" to match backend pagination pattern
 */
export interface PaginatedActivities {
  items: ActivityWithRelations[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Activity statistics from /api/activities/stats endpoint
 */
export interface ActivityStats {
  by_type: Record<ActivityType, number>; // Count of activities per type
  pending_tasks: number; // Tasks not completed
  overdue_tasks: number; // Tasks past due date
  completed_this_week: number; // Activities completed in last 7 days
}

/**
 * Helper type for activity type display configuration
 */
export interface ActivityTypeConfig {
  label: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
}

/**
 * Activity type configurations for UI display
 */
export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  [ActivityType.CALL]: {
    label: "Call",
    icon: "Phone",
    color: "text-blue-600",
  },
  [ActivityType.EMAIL]: {
    label: "Email",
    icon: "Mail",
    color: "text-purple-600",
  },
  [ActivityType.MEETING]: {
    label: "Meeting",
    icon: "Calendar",
    color: "text-green-600",
  },
  [ActivityType.NOTE]: {
    label: "Note",
    icon: "FileText",
    color: "text-gray-600",
  },
  [ActivityType.TASK]: {
    label: "Task",
    icon: "CheckSquare",
    color: "text-orange-600",
  },
};

/**
 * Helper to check if an activity is a task
 */
export function isTask(activity: Activity): boolean {
  return activity.activity_type === ActivityType.TASK;
}

/**
 * Helper to check if a task is completed
 */
export function isCompleted(activity: Activity): boolean {
  return activity.completed_at !== null;
}

/**
 * Helper to check if a task is overdue
 * (has due date in the past and not completed)
 */
export function isOverdue(activity: Activity): boolean {
  if (!activity.due_date || activity.completed_at) {
    return false;
  }

  const dueDate = new Date(activity.due_date);
  const now = new Date();
  return dueDate < now;
}

/**
 * Helper to get activity status label
 */
export function getActivityStatus(activity: Activity): "completed" | "overdue" | "pending" | "active" {
  if (isCompleted(activity)) {
    return "completed";
  }

  if (isTask(activity)) {
    return isOverdue(activity) ? "overdue" : "pending";
  }

  return "active";
}
