import { apiClient } from '@/lib/api/client';

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

// Job Card types (UNI-1825 Phase 1)
export type JobCardStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface JobCard {
  id: string;
  job_number: string;
  booking_id: string | null;
  service_request_id: string | null;
  equipment_id: string | null;
  title: string;
  description: string | null;
  status: JobCardStatus;
  assigned_technician: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  job_card_id: string;
  technician_name: string;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedJobCards {
  items: JobCard[];
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

// Equipment API
export const workshopApi = {
  // Equipment
  listEquipment: (params?: {
    page?: number;
    page_size?: number;
    customer_id?: string;
    location?: string;
    status?: string;
    overdue_only?: boolean;
    search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    if (params?.customer_id) query.set('customer_id', params.customer_id);
    if (params?.location) query.set('location', params.location);
    if (params?.status) query.set('status', params.status);
    if (params?.overdue_only) query.set('overdue_only', 'true');
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return apiClient.get<Paginated<Equipment>>(`/api/workshop/equipment${qs ? '?' + qs : ''}`);
  },
  getEquipment: (id: string) =>
    apiClient.get<{
      equipment: Equipment;
      service_history: object[];
      reminders: object[];
      bookings: object[];
    }>(`/api/workshop/equipment/${id}`),
  createEquipment: (data: EquipmentCreate) =>
    apiClient.post<Equipment>('/api/workshop/equipment', data),
  updateEquipment: (id: string, data: Partial<EquipmentCreate>) =>
    apiClient.put<Equipment>(`/api/workshop/equipment/${id}`, data),
  retireEquipment: (id: string) => apiClient.delete(`/api/workshop/equipment/${id}`),
  updateHours: (id: string, current_hours: number) =>
    apiClient.post<Equipment>(`/api/workshop/equipment/${id}/update-hours`, { current_hours }),
  recordService: (
    id: string,
    data: {
      service_date: string;
      service_type: string;
      technician?: string;
      hours_at_service?: number;
      notes?: string;
    }
  ) => apiClient.post(`/api/workshop/equipment/${id}/record-service`, data),

  // Templates
  listTemplates: (params?: {
    page?: number;
    make?: string;
    service_type?: string;
    is_active?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.make) query.set('make', params.make);
    if (params?.service_type) query.set('service_type', params.service_type);
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
    const qs = query.toString();
    return apiClient.get<Paginated<ServiceTemplate>>(
      `/api/workshop/templates${qs ? '?' + qs : ''}`
    );
  },
  getTemplate: (id: string) => apiClient.get<ServiceTemplate>(`/api/workshop/templates/${id}`),
  createTemplate: (data: Partial<ServiceTemplate>) =>
    apiClient.post<ServiceTemplate>('/api/workshop/templates', data),
  updateTemplate: (id: string, data: Partial<ServiceTemplate>) =>
    apiClient.put<ServiceTemplate>(`/api/workshop/templates/${id}`, data),
  deactivateTemplate: (id: string) => apiClient.delete(`/api/workshop/templates/${id}`),

  // Bookings
  listBookings: (params?: {
    page?: number;
    page_size?: number;
    location?: string;
    status?: string;
    equipment_id?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    if (params?.location) query.set('location', params.location);
    if (params?.status) query.set('status', params.status);
    if (params?.equipment_id) query.set('equipment_id', params.equipment_id);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    const qs = query.toString();
    return apiClient.get<Paginated<WorkshopBooking>>(`/api/workshop/bookings${qs ? '?' + qs : ''}`);
  },
  getBooking: (id: string) =>
    apiClient.get<{ booking: WorkshopBooking; equipment?: object }>(`/api/workshop/bookings/${id}`),
  createBooking: (data: {
    equipment_id: string;
    service_template_id?: string;
    contractor_id?: string;
    location: string;
    scheduled_date: string;
    customer_notes?: string;
  }) => apiClient.post<WorkshopBooking>('/api/workshop/bookings', data),
  updateBooking: (id: string, data: Partial<WorkshopBooking>) =>
    apiClient.put<WorkshopBooking>(`/api/workshop/bookings/${id}`, data),
  completeBooking: (
    id: string,
    data: { actual_hours?: number; hours_on_completion?: number; technician_notes?: string }
  ) => apiClient.post(`/api/workshop/bookings/${id}/complete`, data),

  // Reminders
  listReminders: (params?: { page?: number; page_size?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return apiClient.get<Paginated<ServiceReminder>>(
      `/api/workshop/reminders${qs ? '?' + qs : ''}`
    );
  },
  generateReminders: () =>
    apiClient.post<{ reminders_created: number; message: string }>(
      '/api/workshop/reminders/generate',
      {}
    ),
  sendReminder: (id: string) => apiClient.post(`/api/workshop/reminders/${id}/send`, {}),
  sendPendingReminders: () =>
    apiClient.post<{ sent_count: number; message: string }>(
      '/api/workshop/reminders/send-pending',
      {}
    ),
  suppressReminder: (id: string) => apiClient.put(`/api/workshop/reminders/${id}/suppress`, {}),

  // Dashboard
  getDashboard: (location?: string) => {
    const qs = location ? `?location=${location}` : '';
    return apiClient.get<DashboardData>(`/api/workshop/dashboard${qs}`);
  },

  // Job Cards (UNI-1825 Phase 1)
  listJobs: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    equipment_id?: string;
    booking_id?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    if (params?.status) query.set('status', params.status);
    if (params?.equipment_id) query.set('equipment_id', params.equipment_id);
    if (params?.booking_id) query.set('booking_id', params.booking_id);
    const qs = query.toString();
    return apiClient.get<PaginatedJobCards>(`/api/workshop/jobs${qs ? '?' + qs : ''}`);
  },
  createJob: (data: { title: string; description?: string; assigned_technician?: string; equipment_id?: string; booking_id?: string }) =>
    apiClient.post<JobCard>('/api/workshop/jobs', data),
  getJob: (id: string) =>
    apiClient.get<{ job_card: JobCard; time_logs: TimeLog[] }>(`/api/workshop/jobs/${id}`),
  updateJob: (id: string, data: { title?: string; description?: string; status?: JobCardStatus; assigned_technician?: string }) =>
    apiClient.patch<JobCard>(`/api/workshop/jobs/${id}`, data),
  listTimeLogs: (jobId: string) =>
    apiClient.get<TimeLog[]>(`/api/workshop/jobs/${jobId}/time-logs`),
  createTimeLog: (jobId: string, data: { technician_name: string; started_at: string; stopped_at?: string; notes?: string }) =>
    apiClient.post<TimeLog>(`/api/workshop/jobs/${jobId}/time-logs`, data),
  stopTimeLog: (jobId: string, logId: string, stopped_at: string) =>
    apiClient.patch<TimeLog>(`/api/workshop/jobs/${jobId}/time-logs/${logId}`, { stopped_at }),
};
