import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'cust-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
vi.mock('../../../contacts/components/ContactForm', () => ({ ContactForm: () => null }));
vi.mock('../../../contacts/components/DeleteContactDialog', () => ({
  DeleteContactDialog: () => null,
}));
vi.mock('../components/ActivityTimeline', () => ({ ActivityTimeline: () => null }));
vi.mock('../components/ActivityForm', () => ({ ActivityForm: () => null }));
vi.mock('../components/DeleteActivityDialog', () => ({ DeleteActivityDialog: () => null }));
vi.mock('../components/PricingTierPanel', () => ({ PricingTierPanel: () => null }));

import CustomerDetailPage from '../page';

const CUSTOMER = {
  id: 'cust-1',
  customer_number: 'C-001',
  company_name: 'Acme Cleaning',
  contact_name: 'Jo',
  email: 'jo@example.com',
  phone: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'AU',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

/** Route each read by URL prefix; an entry set to an Error rejects. */
function routeGets(overrides: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/customers/': CUSTOMER,
    '/api/orders': { items: [] },
    '/api/quotes': { items: [] },
    '/api/contacts/customer/': [],
    '/api/certifications': [],
    '/api/pricing/customers/': null,
    ...overrides,
  };
  get.mockImplementation(async (url: string) => {
    const key = Object.keys(table).find((k) => url.startsWith(k));
    const value = key ? table[key] : undefined;
    if (value instanceof Error) throw value;
    return value;
  });
}

describe('CustomerDetailPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error state, not "Customer not found", when the customer read fails', async () => {
    routeGets({ '/api/customers/': new Error('Network down') });

    render(<CustomerDetailPage />);

    expect(await screen.findByText("Couldn't load this customer")).toBeInTheDocument();
    expect(screen.queryByText('Customer not found')).not.toBeInTheDocument();
  });

  it('shows an error state, not "No orders yet", when a related list read fails', async () => {
    routeGets({ '/api/quotes': new Error('Network down') });

    render(<CustomerDetailPage />);

    expect(await screen.findByText("Couldn't load this customer")).toBeInTheDocument();
    expect(screen.queryByText('No orders yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders (0)')).not.toBeInTheDocument();
  });

  it('still shows the genuine empty lists when every read succeeds', async () => {
    routeGets();

    render(<CustomerDetailPage />);

    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this customer")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    routeGets({ '/api/customers/': new Error('Network down') });
    render(<CustomerDetailPage />);
    await screen.findByText("Couldn't load this customer");
    const callsBefore = get.mock.calls.length;

    routeGets();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this customer")).not.toBeInTheDocument();
  });
});

describe('CustomerDetailPage certifications load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('says certifications failed to load, not "No certifications on record"', async () => {
    routeGets({ '/api/certifications': new Error('Network down') });
    render(<CustomerDetailPage />);
    await screen.findByText('No orders yet');

    expect(screen.queryByText(/Certifications \(0\)/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /certifications/i }));

    expect(await screen.findByText("Couldn't load certifications")).toBeInTheDocument();
    expect(screen.queryByText('No certifications on record')).not.toBeInTheDocument();
  });

  it('still says "No certifications on record" when there genuinely are none', async () => {
    routeGets();
    render(<CustomerDetailPage />);
    await screen.findByText('No orders yet');

    expect(screen.getByText(/Certifications \(0\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /certifications/i }));

    expect(await screen.findByText('No certifications on record')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load certifications")).not.toBeInTheDocument();
  });
});
