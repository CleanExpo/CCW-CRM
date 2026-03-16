import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import WalkInPage from '@/app/(portal)/walk-in/page';
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
    info: vi.fn(),
  },
}));

// Mock lodash debounce
vi.mock('lodash', () => ({
  debounce: (fn: any) => fn,
}));

describe('Walk-In Portal', () => {
  const mockProduct = {
    id: '1',
    sku: 'SKU-001',
    name: 'Test Product',
    description: 'Test description',
    category: 'hand_tools',
    price: 99.99,
    stock: 10,
    warehouse_location: 'Brisbane',
  };
  const mockCustomer = {
    id: 'cust-1',
    customer_number: 'CUST-001',
    company_name: 'Acme Co',
    contact_name: 'Alex',
    email: 'alex@acme.co',
    phone: '0400 000 000',
    address: '',
    city: 'Brisbane',
    state: 'QLD',
    postal_code: '4000',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders walk-in checkout page', () => {
    render(<WalkInPage />);

    expect(
      screen.getByText('Walk-In Sales — Professional Cleaning Equipment Brisbane')
    ).toBeInTheDocument();
    expect(screen.getByText(/fast checkout for walk-in customers/i)).toBeInTheDocument();
  });

  test('renders product search component', () => {
    render(<WalkInPage />);

    expect(screen.getByPlaceholderText(/scan barcode or search by sku/i)).toBeInTheDocument();
  });

  test('renders customer lookup', () => {
    render(<WalkInPage />);

    expect(
      screen.getByPlaceholderText(/search customer by name, phone, or email/i)
    ).toBeInTheDocument();
  });

  test('displays payment buttons when cart has items', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [mockProduct],
    });

    render(<WalkInPage />);

    // Add product to cart first
    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test Product'));

    // Now payment buttons should be visible
    await waitFor(() => {
      expect(screen.getByText('Cash')).toBeInTheDocument();
      expect(screen.getByText('Card')).toBeInTheDocument();
      expect(screen.getByText('Account (Invoice)')).toBeInTheDocument();
    });
  });

  test('shows empty cart initially', () => {
    render(<WalkInPage />);

    expect(screen.getByText('Cart is empty')).toBeInTheDocument();
  });

  test('adds product to cart when selected', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [mockProduct],
    });

    render(<WalkInPage />);

    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test Product'));

    await waitFor(() => {
      expect(screen.queryByText('Cart is empty')).not.toBeInTheDocument();
    });
  });

  test('processes cash payment successfully', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, 'post')
      .mockResolvedValueOnce({
        id: 'guest-1',
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        order_number: 'ORD-2026-001',
      });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Product'));
    });

    // Click cash payment button
    await waitFor(() => {
      const cashButton = screen.getByText('Cash');
      fireEvent.click(cashButton);
    });

    // Verify guest customer and order were created
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenNthCalledWith(
        1,
        '/api/customers',
        expect.objectContaining({
          company_name: 'Walk-In Guest',
        })
      );
      expect(apiClient.apiClient.post).toHaveBeenNthCalledWith(
        2,
        '/api/orders',
        expect.objectContaining({
          channel: 'walk-in',
          status: 'confirmed',
          customer_id: 'guest-1',
        })
      );
    });
  });

  test('processes card payment successfully', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, 'post')
      .mockResolvedValueOnce({
        id: 'guest-2',
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        order_number: 'ORD-2026-002',
      });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Product'));
    });

    // Click card payment button
    await waitFor(() => {
      const cardButton = screen.getByText('Card');
      fireEvent.click(cardButton);
    });

    // Verify guest customer and order were created
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenNthCalledWith(
        1,
        '/api/customers',
        expect.objectContaining({
          company_name: 'Walk-In Guest',
        })
      );
      expect(apiClient.apiClient.post).toHaveBeenNthCalledWith(
        2,
        '/api/orders',
        expect.objectContaining({
          channel: 'walk-in',
          status: 'confirmed',
          payment_method: 'card',
          customer_id: 'guest-2',
        })
      );
    });
  });

  test('processes account payment as pending order', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockImplementation((url: string) => {
      if (url.startsWith('/api/customers')) {
        return Promise.resolve({ items: [mockCustomer] });
      }
      if (url.startsWith('/api/orders')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({ items: [mockProduct] });
    });

    vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue({
      id: 'order-1',
      order_number: 'ORD-2026-003',
    });

    render(<WalkInPage />);

    // Select customer
    const customerInput = screen.getByPlaceholderText(/search customer by name, phone, or email/i);
    fireEvent.change(customerInput, { target: { value: 'Acme' } });

    await waitFor(() => {
      expect(screen.getByText('Acme Co')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Acme Co'));

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Product'));
    });

    // Click account payment button
    await waitFor(() => {
      const accountButton = screen.getByText('Account (Invoice)');
      fireEvent.click(accountButton);
    });

    // Verify order was created as pending
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        '/api/orders',
        expect.objectContaining({
          channel: 'walk-in',
          status: 'pending',
          payment_method: 'account',
          customer_id: 'cust-1',
        })
      );
    });
  });

  test('disables account payment until customer is selected', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [mockProduct],
    });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Product'));
    });

    await waitFor(() => {
      const accountButton = screen.getByText('Account (Invoice)');
      expect(accountButton).toBeDisabled();
    });
  });

  test('clears cart after successful payment', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, 'post').mockResolvedValue({
      id: 'order-1',
      order_number: 'ORD-2026-005',
    });

    render(<WalkInPage />);

    // Add product
    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Product'));
    });

    // Process payment
    await waitFor(() => {
      const cashButton = screen.getByText('Cash');
      fireEvent.click(cashButton);
    });

    // Cart should be empty after successful payment
    await waitFor(() => {
      expect(screen.getByText('Cart is empty')).toBeInTheDocument();
    });
  });

  test('calculates total with tax correctly', async () => {
    vi.spyOn(apiClient.apiClient, 'get').mockResolvedValue({
      items: [mockProduct],
    });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(/scan barcode or search by sku/i);
    fireEvent.change(searchInput, { target: { value: 'SKU-001' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Test Product'));
    });

    // Verify total calculation
    // Subtotal: 99.99, Tax (10%): 9.999, Total: 109.989 ~ 109.99
    // Note: Total appears twice (cart summary + payment section)
    await waitFor(() => {
      const totals = screen.getAllByText('$109.99');
      expect(totals.length).toBeGreaterThanOrEqual(1);
    });
  });
});
