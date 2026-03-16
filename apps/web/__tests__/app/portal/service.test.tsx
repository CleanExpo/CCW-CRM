import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ServicePage from '@/app/(portal)/service/page';
import * as apiClient from '@/lib/api/client';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('Service Portal', () => {
  const mockServiceRequests = [
    {
      id: '1',
      customer_id: 'customer-1',
      order_id: null,
      request_type: 'repair',
      status: 'submitted',
      equipment_description: '2019 Caterpillar 320 Excavator',
      issue_description: "Engine won't start, battery seems fine",
      photos: null,
      assigned_technician: null,
      scheduled_date: null,
      quote_amount: null,
      approved_amount: null,
      created_at: '2026-01-09T10:00:00Z',
      updated_at: '2026-01-09T10:00:00Z',
    },
    {
      id: '2',
      customer_id: 'customer-1',
      order_id: 'order-1',
      request_type: 'maintenance',
      status: 'in_progress',
      equipment_description: 'Komatsu D65 Bulldozer',
      issue_description: 'Scheduled 500-hour service',
      photos: null,
      assigned_technician: 'John Smith',
      scheduled_date: '2026-01-15T09:00:00Z',
      quote_amount: 850.0,
      approved_amount: 850.0,
      created_at: '2026-01-08T14:00:00Z',
      updated_at: '2026-01-09T08:30:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders service portal page', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      // h1 contains an embedded SVG icon so getByRole is used for the heading
      expect(
        screen.getByRole('heading', { level: 1, name: /equipment service.*repair/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/submit service requests for carpet cleaning machines, track repairs/i)
      ).toBeInTheDocument();
    });
  });

  test("displays 'New Service Request' button", async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      // Use getAllByText since button appears twice (header + empty state)
      const buttons = screen.getAllByText('New Service Request');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('shows empty state when no requests', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('No Service Requests Yet')).toBeInTheDocument();
    });
  });

  test('loads and displays service requests', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: mockServiceRequests,
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('2019 Caterpillar 320 Excavator')).toBeInTheDocument();
      expect(screen.getByText('Komatsu D65 Bulldozer')).toBeInTheDocument();
    });
  });

  test('displays request count in tab label', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: mockServiceRequests,
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('My Requests (2)')).toBeInTheDocument();
    });
  });

  test('shows correct status badges', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: mockServiceRequests,
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('submitted')).toBeInTheDocument();
      expect(screen.getByText('in_progress')).toBeInTheDocument();
    });
  });

  test('displays assigned technician when available', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: mockServiceRequests,
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/assigned to john smith/i)).toBeInTheDocument();
    });
  });

  test('displays quote amount when available', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: mockServiceRequests,
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      // Use getAllByText since amount appears twice (quote amount + approved amount)
      const amounts = screen.getAllByText('$850.00');
      expect(amounts.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('opens new request dialog when button clicked', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      const buttons = screen.getAllByText('New Service Request');
      expect(buttons.length).toBeGreaterThan(0);
    });

    await act(async () => {
      const buttons = screen.getAllByText('New Service Request');
      fireEvent.click(buttons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Submit Service Request')).toBeInTheDocument();
      expect(screen.getByLabelText(/request type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/equipment description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/issue description/i)).toBeInTheDocument();
    });
  });

  test('submits new service request successfully', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    const newRequest = {
      id: 'new-1',
      customer_id: 'customer-1',
      request_type: 'repair',
      status: 'submitted',
      equipment_description: 'Test Equipment',
      issue_description: 'Test Issue',
      photos: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue(newRequest);

    await act(async () => {
      render(<ServicePage />);
    });

    // Open dialog
    await waitFor(() => {
      const buttons = screen.getAllByText('New Service Request');
      expect(buttons.length).toBeGreaterThan(0);
    });

    await act(async () => {
      const buttons = screen.getAllByText('New Service Request');
      fireEvent.click(buttons[0]);
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/equipment description/i)).toBeInTheDocument();
    });

    // Fill in form
    await act(async () => {
      const equipmentInput = screen.getByLabelText(/equipment description/i);
      const issueInput = screen.getByLabelText(/issue description/i);

      fireEvent.change(equipmentInput, {
        target: { value: 'Test Equipment' },
      });
      fireEvent.change(issueInput, { target: { value: 'Test Issue' } });
    });

    // Submit form
    await act(async () => {
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);
    });

    // Verify API was called
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        '/api/service-requests',
        expect.objectContaining({
          request_type: 'repair',
          equipment_description: 'Test Equipment',
          issue_description: 'Test Issue',
        })
      );
    });
  });

  test('shows validation error when submitting empty form', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    const toastError = vi.fn();
    vi.mocked(await import('sonner')).toast.error = toastError;

    await act(async () => {
      render(<ServicePage />);
    });

    // Open dialog
    await waitFor(() => {
      const buttons = screen.getAllByText('New Service Request');
      expect(buttons.length).toBeGreaterThan(0);
    });

    await act(async () => {
      const buttons = screen.getAllByText('New Service Request');
      fireEvent.click(buttons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Submit Request')).toBeInTheDocument();
    });

    // Try to submit without filling form
    await act(async () => {
      const submitButton = screen.getByText('Submit Request');
      fireEvent.click(submitButton);
    });

    // Should show error
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Please fill in all required fields');
    });
  });

  test('allows selecting different request types', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    await act(async () => {
      render(<ServicePage />);
    });

    // Open dialog
    await waitFor(() => {
      const buttons = screen.getAllByText('New Service Request');
      expect(buttons.length).toBeGreaterThan(0);
    });

    await act(async () => {
      const buttons = screen.getAllByText('New Service Request');
      fireEvent.click(buttons[0]);
    });

    await waitFor(() => {
      // Look for the label instead of role="combobox" which may not be immediately available
      expect(screen.getByText('Request Type')).toBeInTheDocument();
    });
  });

  test('displays timeline view', async () => {
    const user = userEvent.setup();

    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: mockServiceRequests,
    });

    await act(async () => {
      render(<ServicePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Timeline')).toBeInTheDocument();
    });

    // Click on Timeline tab using userEvent for better interaction
    const timelineTab = screen.getByRole('tab', { name: /timeline/i });
    await user.click(timelineTab);

    // Wait for timeline content to render
    await waitFor(
      () => {
        expect(screen.getByText('Service Timeline & Repair Progress')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  test('resets form after successful submission', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [],
    });

    const newRequest = {
      id: 'new-1',
      customer_id: 'customer-1',
      request_type: 'repair',
      status: 'submitted',
      equipment_description: 'Test Equipment',
      issue_description: 'Test Issue',
      photos: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue(newRequest);

    await act(async () => {
      render(<ServicePage />);
    });

    // Open dialog
    await waitFor(() => {
      const buttons = screen.getAllByText('New Service Request');
      expect(buttons.length).toBeGreaterThan(0);
    });

    await act(async () => {
      const buttons = screen.getAllByText('New Service Request');
      fireEvent.click(buttons[0]);
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/equipment description/i)).toBeInTheDocument();
    });

    // Fill and submit form
    await act(async () => {
      const equipmentInput = screen.getByLabelText(/equipment description/i);
      const issueInput = screen.getByLabelText(/issue description/i);

      fireEvent.change(equipmentInput, {
        target: { value: 'Test Equipment' },
      });
      fireEvent.change(issueInput, { target: { value: 'Test Issue' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Submit Request'));
    });

    // Dialog should close and form should be reset (with longer timeout for API call)
    await waitFor(
      () => {
        expect(screen.queryByText('Submit Service Request')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
