/**
 * UNI-2690: the workshop lists asked for one fixed page (page_size 100, and the
 * API clamps page_size to 100) with no pager, so anything past the first page
 * could not be reached. Each list now shows PaginationControls and fetches the
 * page the user asks for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api/workshop', () => ({
  workshopApi: {
    listReminders: vi.fn(),
    listEquipment: vi.fn(),
    listBookings: vi.fn(),
    generateReminders: vi.fn(),
    sendPendingReminders: vi.fn(),
    sendReminder: vi.fn(),
    suppressReminder: vi.fn(),
  },
}));

import { workshopApi } from '@/lib/api/workshop';
import RemindersPage from '../reminders/page';
import EquipmentPage from '../equipment/page';
import WorkshopSchedulePage from '../schedule/page';

const api = workshopApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const TOTAL = 132;

function pageOf<T>(item: T) {
  return (params?: { page?: number; page_size?: number }) =>
    Promise.resolve({
      items: [item],
      total: TOTAL,
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 50,
      total_pages: Math.ceil(TOTAL / (params?.page_size ?? 50)),
    });
}

const now = new Date().toISOString();

const reminder = {
  id: 'r1',
  equipment_id: 'eq-000000001',
  customer_id: 'c1',
  reminder_type: '30_day',
  scheduled_send_at: now,
  status: 'pending',
  sent_at: null,
  booking_id: null,
  email_subject: null,
  created_at: now,
  updated_at: now,
};

const machine = {
  id: 'e1',
  customer_id: 'c1',
  product_id: null,
  serial_number: 'SN-1',
  make: 'Kärcher',
  model: 'HDS 8/18',
  year: 2022,
  location: 'brisbane',
  purchase_date: null,
  warranty_expiry: null,
  status: 'active',
  interval_months: 6,
  interval_hours: null,
  current_hours: 10,
  last_service_date: null,
  last_service_hours: null,
  next_service_date: null,
  next_service_hours: null,
  reminder_lead_days: 30,
  notes: null,
  created_at: now,
  updated_at: now,
};

const booking = {
  id: 'b1',
  booking_number: 'WB-0001',
  equipment_id: 'e1',
  service_request_id: null,
  service_template_id: null,
  contractor_id: null,
  location: 'brisbane',
  scheduled_date: now,
  estimated_end_datetime: null,
  status: 'scheduled',
  purchase_order_id: null,
  parts_ordered_at: null,
  actual_hours: null,
  hours_on_completion: null,
  created_at: now,
  updated_at: now,
};

const cases = [
  { name: 'reminders', Page: RemindersPage, fn: 'listReminders', item: reminder },
  { name: 'equipment', Page: EquipmentPage, fn: 'listEquipment', item: machine },
  { name: 'schedule', Page: WorkshopSchedulePage, fn: 'listBookings', item: booking },
] as const;

describe.each(cases)('workshop $name list paging (UNI-2690)', ({ Page, fn, item }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    api[fn].mockImplementation(pageOf(item));
  });

  it('shows the pager and requests page 2 when Next is clicked', async () => {
    render(<Page />);

    expect(await screen.findByText(`Showing 1-50 of ${TOTAL} items`)).toBeInTheDocument();
    expect(api[fn]).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 50 }));

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(api[fn]).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, page_size: 50 }))
    );
    expect(await screen.findByText(`Showing 51-100 of ${TOTAL} items`)).toBeInTheDocument();
  });
});
