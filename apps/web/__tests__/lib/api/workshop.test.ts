/**
 * Workshop API Client Tests
 *
 * Tests the type-safe workshop API client functions for equipment,
 * templates, bookings, reminders, and dashboard endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { workshopApi } from '@/lib/api/workshop';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

// ─── Equipment ──────────────────────────────────────────────────────

describe('workshopApi.listEquipment', () => {
  it('calls GET /api/workshop/equipment with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listEquipment();
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/equipment');
  });

  it('appends query params when provided', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 10, total_pages: 0 });
    await workshopApi.listEquipment({
      page: 2,
      page_size: 10,
      customer_id: 'cust-1',
      location: 'Brisbane',
      status: 'active',
    });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('page_size=10');
    expect(url).toContain('customer_id=cust-1');
    expect(url).toContain('location=Brisbane');
    expect(url).toContain('status=active');
  });

  it('includes overdue_only flag', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listEquipment({ overdue_only: true });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('overdue_only=true');
  });

  it('includes search param', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listEquipment({ search: 'truckmount' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('search=truckmount');
  });
});

describe('workshopApi.getEquipment', () => {
  it('calls GET /api/workshop/equipment/:id', async () => {
    mockGet.mockResolvedValue({ equipment: {}, service_history: [], reminders: [], bookings: [] });
    await workshopApi.getEquipment('eq-123');
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/equipment/eq-123');
  });
});

describe('workshopApi.createEquipment', () => {
  it('posts to /api/workshop/equipment', async () => {
    const data = {
      customer_id: 'c-1',
      serial_number: 'SN-001',
      make: 'Steamaster',
      model: 'Cobra',
      location: 'Brisbane',
    };
    mockPost.mockResolvedValue({ id: 'eq-new', ...data });
    await workshopApi.createEquipment(data);
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/equipment', data);
  });
});

describe('workshopApi.updateEquipment', () => {
  it('puts to /api/workshop/equipment/:id', async () => {
    const data = { make: 'Updated' };
    mockPut.mockResolvedValue({ id: 'eq-1', make: 'Updated' });
    await workshopApi.updateEquipment('eq-1', data);
    expect(mockPut).toHaveBeenCalledWith('/api/workshop/equipment/eq-1', data);
  });
});

describe('workshopApi.retireEquipment', () => {
  it('deletes /api/workshop/equipment/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await workshopApi.retireEquipment('eq-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/workshop/equipment/eq-1');
  });
});

describe('workshopApi.updateHours', () => {
  it('posts hours update', async () => {
    mockPost.mockResolvedValue({ id: 'eq-1', current_hours: 500 });
    await workshopApi.updateHours('eq-1', 500);
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/equipment/eq-1/update-hours', {
      current_hours: 500,
    });
  });
});

describe('workshopApi.recordService', () => {
  it('posts service record', async () => {
    const data = {
      service_date: '2026-03-10',
      service_type: 'annual',
      technician: 'John',
      hours_at_service: 480,
      notes: 'All good',
    };
    mockPost.mockResolvedValue({ success: true });
    await workshopApi.recordService('eq-1', data);
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/equipment/eq-1/record-service', data);
  });
});

// ─── Templates ──────────────────────────────────────────────────────

describe('workshopApi.listTemplates', () => {
  it('calls GET /api/workshop/templates with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listTemplates();
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/templates');
  });

  it('appends make and service_type params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listTemplates({
      make: 'Steamaster',
      service_type: 'annual',
      is_active: true,
    });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('make=Steamaster');
    expect(url).toContain('service_type=annual');
    expect(url).toContain('is_active=true');
  });
});

describe('workshopApi.getTemplate', () => {
  it('calls GET /api/workshop/templates/:id', async () => {
    mockGet.mockResolvedValue({ id: 't-1', name: 'Annual Service' });
    await workshopApi.getTemplate('t-1');
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/templates/t-1');
  });
});

describe('workshopApi.createTemplate', () => {
  it('posts to /api/workshop/templates', async () => {
    const data = { name: 'New Template', service_type: 'quarterly' };
    mockPost.mockResolvedValue({ id: 't-new', ...data });
    await workshopApi.createTemplate(data);
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/templates', data);
  });
});

describe('workshopApi.updateTemplate', () => {
  it('puts to /api/workshop/templates/:id', async () => {
    const data = { name: 'Updated' };
    mockPut.mockResolvedValue({ id: 't-1', name: 'Updated' });
    await workshopApi.updateTemplate('t-1', data);
    expect(mockPut).toHaveBeenCalledWith('/api/workshop/templates/t-1', data);
  });
});

describe('workshopApi.deactivateTemplate', () => {
  it('deletes /api/workshop/templates/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await workshopApi.deactivateTemplate('t-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/workshop/templates/t-1');
  });
});

// ─── Bookings ───────────────────────────────────────────────────────

describe('workshopApi.listBookings', () => {
  it('calls GET /api/workshop/bookings with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listBookings();
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/bookings');
  });

  it('appends all filter params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
    await workshopApi.listBookings({
      page: 1,
      page_size: 20,
      location: 'Brisbane',
      status: 'scheduled',
      equipment_id: 'eq-1',
      date_from: '2026-03-01',
      date_to: '2026-03-31',
    });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('location=Brisbane');
    expect(url).toContain('status=scheduled');
    expect(url).toContain('equipment_id=eq-1');
    expect(url).toContain('date_from=2026-03-01');
    expect(url).toContain('date_to=2026-03-31');
  });
});

describe('workshopApi.getBooking', () => {
  it('calls GET /api/workshop/bookings/:id', async () => {
    mockGet.mockResolvedValue({ booking: {}, equipment: {} });
    await workshopApi.getBooking('b-1');
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/bookings/b-1');
  });
});

describe('workshopApi.createBooking', () => {
  it('posts to /api/workshop/bookings', async () => {
    const data = { equipment_id: 'eq-1', location: 'Brisbane', scheduled_date: '2026-04-01' };
    mockPost.mockResolvedValue({ id: 'b-new', ...data });
    await workshopApi.createBooking(data);
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/bookings', data);
  });
});

describe('workshopApi.updateBooking', () => {
  it('puts to /api/workshop/bookings/:id', async () => {
    const data = { status: 'confirmed' as const };
    mockPut.mockResolvedValue({ id: 'b-1', status: 'confirmed' });
    await workshopApi.updateBooking('b-1', data);
    expect(mockPut).toHaveBeenCalledWith('/api/workshop/bookings/b-1', data);
  });
});

describe('workshopApi.completeBooking', () => {
  it('posts completion data', async () => {
    const data = { actual_hours: 3.5, hours_on_completion: 520, technician_notes: 'Done' };
    mockPost.mockResolvedValue({ success: true });
    await workshopApi.completeBooking('b-1', data);
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/bookings/b-1/complete', data);
  });
});

// ─── Reminders ──────────────────────────────────────────────────────

describe('workshopApi.listReminders', () => {
  it('calls GET /api/workshop/reminders with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listReminders();
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/reminders');
  });

  it('appends status filter', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await workshopApi.listReminders({ status: 'pending' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('status=pending');
  });
});

describe('workshopApi.generateReminders', () => {
  it('posts to /api/workshop/reminders/generate', async () => {
    mockPost.mockResolvedValue({ reminders_created: 5, message: 'ok' });
    await workshopApi.generateReminders();
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/reminders/generate', {});
  });
});

describe('workshopApi.sendReminder', () => {
  it('posts to /api/workshop/reminders/:id/send', async () => {
    mockPost.mockResolvedValue({ success: true });
    await workshopApi.sendReminder('r-1');
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/reminders/r-1/send', {});
  });
});

describe('workshopApi.sendPendingReminders', () => {
  it('posts to /api/workshop/reminders/send-pending', async () => {
    mockPost.mockResolvedValue({ sent_count: 3, message: 'ok' });
    await workshopApi.sendPendingReminders();
    expect(mockPost).toHaveBeenCalledWith('/api/workshop/reminders/send-pending', {});
  });
});

describe('workshopApi.suppressReminder', () => {
  it('puts to /api/workshop/reminders/:id/suppress', async () => {
    mockPut.mockResolvedValue({ success: true });
    await workshopApi.suppressReminder('r-1');
    expect(mockPut).toHaveBeenCalledWith('/api/workshop/reminders/r-1/suppress', {});
  });
});

// ─── Dashboard ──────────────────────────────────────────────────────

describe('workshopApi.getDashboard', () => {
  it('calls GET /api/workshop/dashboard with no location', async () => {
    mockGet.mockResolvedValue({ location: 'all', today: { bookings: [], count: 0 } });
    await workshopApi.getDashboard();
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/dashboard');
  });

  it('appends location query param', async () => {
    mockGet.mockResolvedValue({ location: 'Brisbane', today: { bookings: [], count: 0 } });
    await workshopApi.getDashboard('Brisbane');
    expect(mockGet).toHaveBeenCalledWith('/api/workshop/dashboard?location=Brisbane');
  });
});

// ─── Error propagation ──────────────────────────────────────────────

describe('error handling', () => {
  it('propagates errors from apiClient on listEquipment', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    await expect(workshopApi.listEquipment()).rejects.toThrow('Network error');
  });

  it('propagates errors from apiClient on createBooking', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));
    await expect(
      workshopApi.createBooking({
        equipment_id: 'eq-1',
        location: 'X',
        scheduled_date: '2026-01-01',
      })
    ).rejects.toThrow('Server error');
  });
});
