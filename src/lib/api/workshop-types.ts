export type EquipmentStatus = 'active' | 'in_service' | 'retired';
export type BookingStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'suppressed';

export interface Equipment {
  id: string;
  customer_id: string;
  product_id: string | null;
  serial_number: string;
  make: string;
  model: string;
  year: number | null;
  location: string;
  purchase_date: string | null;
  warranty_expiry: string | null;
  status: EquipmentStatus;
  interval_months: number | null;
  interval_hours: number | null;
  current_hours: number;
  last_service_date: string | null;
  last_service_hours: number | null;
  next_service_date: string | null;
  next_service_hours: number | null;
  reminder_lead_days: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCreate {
  customer_id: string;
  product_id?: string;
  serial_number: string;
  make: string;
  model: string;
  year?: number;
  location: string;
  purchase_date?: string;
  warranty_expiry?: string;
  interval_months?: number;
  interval_hours?: number;
  current_hours?: number;
  last_service_date?: string;
  last_service_hours?: number;
  next_service_date?: string;
  next_service_hours?: number;
  reminder_lead_days?: number;
  notes?: string;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  service_type: string;
  applies_to_make: string | null;
  applies_to_model: string | null;
  description: string;
  estimated_hours: number;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items: ServiceTemplateItem[];
}

export interface ServiceTemplateItem {
  id: string;
  template_id: string;
  product_id: string;
  quantity: number;
  lead_time_days: number;
  notes: string | null;
}

export interface WorkshopBooking {
  id: string;
  booking_number: string;
  equipment_id: string;
  service_request_id: string | null;
  service_template_id: string | null;
  contractor_id: string | null;
  location: string;
  scheduled_date: string;
  estimated_end_datetime: string | null;
  status: BookingStatus;
  purchase_order_id: string | null;
  parts_ordered_at: string | null;
  actual_hours: number | null;
  hours_on_completion: number | null;
  technician_notes: string | null;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceReminder {
  id: string;
  equipment_id: string;
  customer_id: string;
  reminder_type: string;
  scheduled_send_at: string;
  status: ReminderStatus;
  sent_at: string | null;
  booking_id: string | null;
  email_subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardData {
  location: string;
  today: { bookings: WorkshopBooking[]; count: number };
  this_week: { booking_count: number };
  overdue_equipment_count: number;
  pending_reminders_count: number;
  upcoming_30_days: Record<string, number>;
}
