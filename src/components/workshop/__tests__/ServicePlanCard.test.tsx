import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ apiClient: api }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { ServicePlanCard } from '../ServicePlanCard';

const TEMPLATES = {
  items: [
    { id: 'tpl-annual', name: 'Annual service' },
    { id: 'tpl-major', name: 'Major service' },
  ],
};
const PLAN = {
  id: 'plan-1',
  interval_months: 12,
  interval_hours: null,
  price: 250,
  includes: 'Filters',
  start_date: '2026-10-01',
  renewal_date: '2027-10-01',
};

function routeGets(plans: unknown[], templates: unknown = TEMPLATES) {
  api.get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/workshop/plans')) return { items: plans };
    if (url.startsWith('/api/workshop/templates')) {
      if (templates instanceof Error) throw templates;
      return templates;
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset().mockResolvedValue({});
  api.delete.mockReset().mockResolvedValue({});
});

describe('ServicePlanCard', () => {
  it('lets staff choose the service template the plan books with, and sends it', async () => {
    routeGets([]);
    render(<ServicePlanCard equipmentId="eq-1" />);
    const select = await screen.findByLabelText('Service template');
    await screen.findByRole('option', { name: 'Major service' });
    fireEvent.change(select, { target: { value: 'tpl-major' } });
    fireEvent.click(screen.getByRole('button', { name: /put this machine on a plan/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][0]).toBe('/api/workshop/plans');
    expect(api.post.mock.calls[0][1]).toMatchObject({
      equipment_id: 'eq-1',
      service_template_id: 'tpl-major',
    });
  });

  it('says so when the templates cannot be loaded, instead of offering none', async () => {
    routeGets([], new Error('boom'));
    render(<ServicePlanCard equipmentId="eq-1" />);
    expect(await screen.findByText(/could not load service templates/i)).toBeInTheDocument();
  });

  it('shows which template an existing plan books with', async () => {
    routeGets([{ ...PLAN, service_template_id: 'tpl-annual' }]);
    render(<ServicePlanCard equipmentId="eq-1" />);
    expect(await screen.findByText(/Template: Annual service/)).toBeInTheDocument();
  });

  it('flags a plan with no template and lets staff cancel it to set one up again', async () => {
    routeGets([{ ...PLAN, service_template_id: null }]);
    render(<ServicePlanCard equipmentId="eq-1" />);
    expect(await screen.findByText(/no service template/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel plan/i }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/workshop/plans/plan-1'));
  });
});
