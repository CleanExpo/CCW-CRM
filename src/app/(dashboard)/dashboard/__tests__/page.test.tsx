import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get, getDashboardInsights, getCurrentUser } = vi.hoisted(() => ({
  toast: vi.fn(),
  get: vi.fn(),
  getDashboardInsights: vi.fn(),
  getCurrentUser: vi.fn(
    async (): Promise<{ role: string; is_admin?: boolean } | null> => ({
      role: 'admin',
    })
  ),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
vi.mock('@/lib/api/auth', () => ({ authApi: { getCurrentUser } }));
vi.mock('@/lib/api/ai-insights', () => ({ getDashboardInsights }));
vi.mock('@/hooks/use-sse', () => ({
  usePOSFailureAlerts: () => ({ data: null, status: 'disconnected' }),
  useDashboardMetricsStream: () => ({ data: null, status: 'disconnected' }),
}));
// Each chart renders its own empty-state copy for an empty series, so the stand-in
// renders a marker: a chart mounted over a failed read is the defect under test.
vi.mock('@/components/charts/CategorySalesChart', () => ({
  CategorySalesChart: () => <div>category chart</div>,
}));
vi.mock('@/components/charts/RevenueChart', () => ({
  RevenueChart: () => <div>revenue chart</div>,
}));
vi.mock('@/components/dashboard/OrderStatusBreakdownWidget', () => ({
  OrderStatusBreakdownWidget: () => null,
}));
vi.mock('@/components/dashboard/QuoteConversionWidget', () => ({
  QuoteConversionWidget: () => null,
}));
vi.mock('@/components/dashboard/RevenueByLocationWidget', () => ({
  RevenueByLocationWidget: () => null,
}));
vi.mock('@/components/dashboard/StockHealthWidget', () => ({ StockHealthWidget: () => null }));
vi.mock('@/components/dashboard/TransferSuggestionsWidget', () => ({
  TransferSuggestionsWidget: () => null,
}));
vi.mock('@/components/dashboard/SalesInsightsWidget', () => ({ SalesInsightsWidget: () => null }));
vi.mock('@/components/dashboard/OrderPatternsWidget', () => ({ OrderPatternsWidget: () => null }));
vi.mock('@/components/dashboard/Cin7SyncStatusWidget', () => ({
  Cin7SyncStatusWidget: () => null,
}));
vi.mock('@/components/dashboard/AgentMetricsWidget', () => ({ AgentMetricsWidget: () => null }));
vi.mock('@/components/dashboard/dashboard-ambient', () => ({ DashboardAmbient: () => null }));
vi.mock('@/components/dashboard/dashboard-quick-actions', () => ({
  DashboardQuickActions: () => null,
}));
vi.mock('@/components/dashboard/MiniRevenueSparkline', () => ({
  MiniRevenueSparkline: () => null,
}));
vi.mock('@/components/dashboard/dashboard-stat-tiles', () => ({
  DashboardStatTiles: () => <div>stat tiles</div>,
  DashboardOperationalMix: () => null,
}));
vi.mock('@/components/insights/insight-card', () => ({ InsightCard: () => null }));

import DashboardPage from '../page';

const AGGREGATED = {
  metrics: { low_stock_alerts: 0 },
  revenue_chart: [],
  category_sales: [],
  top_products: [],
  inventory_status: [],
  recent_activity: [],
  rollup: 'inventory',
};

type Source =
  | 'aggregated'
  | 'pos-failures'
  | 'equipment'
  | 'certifications'
  | 'reorder-radar'
  | 'workshop/recall'
  | 'workshop/plans'
  | 'invoices/ageing'
  | 'approvals';

const EMPTY_BUCKETS = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };

const RESPONSES: Record<Source, unknown> = {
  aggregated: AGGREGATED,
  'pos-failures': { alert_count: 0 },
  equipment: { expiring_soon: 0, warranty_alerts: [] },
  certifications: { expiring_soon: 0, expiring_alerts: [] },
  'reorder-radar': { as_of: '2026-09-21', due: [], overdue: [], gone_quiet: [] },
  'workshop/recall': { items: [] },
  'workshop/plans': { items: [] },
  'invoices/ageing': { as_of: '2026-09-21', rows: [] },
  approvals: { data: [], total: 0, page: 1, page_size: 1, total_pages: 1 },
};

/**
 * Every source resolves with nothing to report unless listed as failing,
 * given a different response in `overrides`, or refused with a 403.
 */
function respond(
  failing: (Source | 'insights')[] = [],
  overrides: Partial<Record<Source, unknown>> = {},
  forbidden: Source[] = []
) {
  get.mockImplementation((url: string) => {
    const source = (Object.keys(RESPONSES) as Source[]).find((s) => url.includes(s));
    if (!source) return Promise.reject(new Error(`unexpected url ${url}`));
    if (failing.includes(source)) return Promise.reject(new Error('Network down'));
    if (forbidden.includes(source)) {
      return Promise.reject(Object.assign(new Error('Forbidden'), { status: 403 }));
    }
    return Promise.resolve(source in overrides ? overrides[source] : RESPONSES[source]);
  });
  getDashboardInsights.mockImplementation(() =>
    failing.includes('insights')
      ? Promise.reject(new Error('Network down'))
      : Promise.resolve({ insights: [], total: 0, categories: [] })
  );
}

function radarRow(company: string, product: string, daysLate: number) {
  return {
    customer: { id: company, company_name: company, contact_name: null, phone: null },
    product: { id: product, name: product, sku: '' },
    purchases: 4,
    cadence_days: 30,
    avg_quantity: 1,
    last_purchase: '2026-08-01',
    expected: '2026-08-31',
    days_late: daysLate,
    machine_needs: [],
  };
}

function attentionCard() {
  return screen.getByText('Needs attention today').closest('.rounded-2xl') as HTMLElement;
}

describe('DashboardPage per-source load failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows no error and says nothing needs you when every source loads with nothing to report', async () => {
    respond();

    render(<DashboardPage />);

    expect(await screen.findByText('stat tiles')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
    expect(screen.getByText('Needs attention today')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you today')).toBeInTheDocument();
  });

  it('shows the metrics failure instead of silently rendering no numbers', async () => {
    respond(['aggregated']);

    render(<DashboardPage />);

    expect(await screen.findByText("Couldn't load dashboard metrics")).toBeInTheDocument();
    expect(screen.queryByText('stat tiles')).not.toBeInTheDocument();
  });

  it('does not draw the revenue and category charts as empty when metrics fail', async () => {
    respond(['aggregated']);

    render(<DashboardPage />);

    expect(await screen.findByText("Couldn't load the revenue trend")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load category sales")).toBeInTheDocument();
    expect(screen.queryByText('revenue chart')).not.toBeInTheDocument();
    expect(screen.queryByText('category chart')).not.toBeInTheDocument();
  });

  it('still draws the charts when metrics load', async () => {
    respond();

    render(<DashboardPage />);

    expect(await screen.findByText('revenue chart')).toBeInTheDocument();
    expect(screen.getByText('category chart')).toBeInTheDocument();
  });

  it('keeps "Needs attention today" visible when the warranty and certification reads fail', async () => {
    respond(['equipment', 'certifications']);

    render(<DashboardPage />);

    expect(await screen.findByText('Needs attention today')).toBeInTheDocument();
    expect(screen.getByText("Couldn't load warranty alerts")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load certification alerts")).toBeInTheDocument();
  });

  it('says POS failure alerts could not be loaded rather than implying zero failures', async () => {
    respond(['pos-failures']);

    render(<DashboardPage />);

    expect(await screen.findByText("Couldn't load POS failure alerts")).toBeInTheDocument();
  });

  it('says AI insights could not be loaded rather than hiding the card', async () => {
    respond(['insights']);

    render(<DashboardPage />);

    expect(await screen.findByText("Couldn't load AI insights")).toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    respond(['aggregated']);
    render(<DashboardPage />);
    await screen.findByText("Couldn't load dashboard metrics");
    const callsBefore = get.mock.calls.length;

    respond();
    const metricsError = screen
      .getByText("Couldn't load dashboard metrics")
      .closest('[role="alert"]') as HTMLElement;
    await userEvent.click(within(metricsError).getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('stat tiles')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });
});

describe('DashboardPage "what do I do now" sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists due and overdue reorder calls with the top three, linking to customer health', async () => {
    respond([], {
      'reorder-radar': {
        as_of: '2026-09-21',
        due: [radarRow('Delta Cleaning', 'Hose kit', 0), radarRow('Echo Hire', 'Filter bag', -2)],
        overdue: [radarRow('Alpha Wash', 'Detergent 20L', 20), radarRow('Bravo Pty', 'Nozzle', 9)],
        gone_quiet: [],
      },
    });

    render(<DashboardPage />);

    const item = (await screen.findByText('2 reorder calls due, 2 overdue')).closest('a');
    // Under /dashboard so the billing role, which may only open /dashboard pages, can follow it.
    expect(item).toHaveAttribute('href', '/dashboard/crm/client-health');
    expect(within(item as HTMLElement).getByText('Alpha Wash: Detergent 20L')).toBeInTheDocument();
    expect(within(item as HTMLElement).getByText('Bravo Pty: Nozzle')).toBeInTheDocument();
    expect(within(item as HTMLElement).getByText('Delta Cleaning: Hose kit')).toBeInTheDocument();
    expect(within(item as HTMLElement).queryByText(/Echo Hire/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing needs you today')).not.toBeInTheDocument();
  });

  it('counts machines due for a workshop recall, linking to recall review', async () => {
    respond([], {
      'workshop/recall': {
        items: [
          { equipment_id: 'e1', status: 'queued' },
          { equipment_id: 'e2', status: 'queued' },
          { equipment_id: 'e3', status: 'held' },
        ],
      },
    });

    render(<DashboardPage />);

    const item = (await screen.findByText('3 machines due for service')).closest('a');
    expect(item).toHaveAttribute('href', '/dashboard/workshop/recall');
    expect(within(item as HTMLElement).getByText('2 awaiting review')).toBeInTheDocument();
  });

  it('counts service plans due for renewal in the next 30 days, linking to the plans list', async () => {
    respond([], {
      'workshop/plans': {
        items: [
          {
            id: 'p1',
            customer: 'Alpha Wash',
            machine: 'Kärcher HDS 8/18',
            renewal_date: '2026-09-30',
          },
          { id: 'p2', customer: 'Bravo Pty', machine: 'Nilfisk MC 5M', renewal_date: '2026-10-12' },
        ],
      },
    });

    render(<DashboardPage />);

    const item = (await screen.findByText('2 service plans due for renewal')).closest('a');
    expect(item).toHaveAttribute('href', '/dashboard/workshop/plans');
    expect(
      within(item as HTMLElement).getByText('Next: Alpha Wash, Kärcher HDS 8/18')
    ).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.stringContaining('renewal_within_days=30'));
  });

  it('shows overdue invoices as a count and total owed, linking to debtor ageing', async () => {
    respond([], {
      'invoices/ageing': {
        as_of: '2026-09-21',
        rows: [
          {
            customerId: 'c1',
            companyName: 'Alpha Wash',
            email: null,
            creditLimitAUD: null,
            buckets: { ...EMPTY_BUCKETS, current: 500, '1-30': 1000, '90+': 250.5, total: 1750.5 },
          },
          {
            customerId: 'c2',
            companyName: 'Bravo Pty',
            email: null,
            creditLimitAUD: null,
            buckets: { ...EMPTY_BUCKETS, '31-60': 2000, total: 2000 },
          },
          {
            customerId: 'c3',
            companyName: 'Current Only',
            email: null,
            creditLimitAUD: null,
            buckets: { ...EMPTY_BUCKETS, current: 900, total: 900 },
          },
        ],
      },
    });

    render(<DashboardPage />);

    const item = (await screen.findByText('$3,250.50 overdue')).closest('a');
    expect(item).toHaveAttribute('href', '/dashboard/finance/debtors');
    expect(within(item as HTMLElement).getByText('2 customers past due')).toBeInTheDocument();
  });

  it('does not show members an overdue-invoices row they cannot open', async () => {
    getCurrentUser.mockResolvedValueOnce({ role: 'member' });
    respond([], {
      'invoices/ageing': {
        as_of: '2026-09-21',
        rows: [
          {
            customerId: 'c1',
            companyName: 'Alpha Wash',
            email: null,
            creditLimitAUD: null,
            buckets: { ...EMPTY_BUCKETS, '1-30': 1000, total: 1000 },
          },
        ],
      },
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Nothing needs you today')).toBeInTheDocument();
    expect(screen.queryByText(/overdue$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load overdue invoices")).not.toBeInTheDocument();
  });

  it('does not tell members overdue invoices failed to load when they cannot open them', async () => {
    getCurrentUser.mockResolvedValueOnce({ role: 'member' });
    respond(['invoices/ageing']);

    render(<DashboardPage />);

    expect(await screen.findByText('Nothing needs you today')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load overdue invoices")).not.toBeInTheDocument();
  });

  it('counts approvals waiting, linking to approvals', async () => {
    respond([], { approvals: { data: [], total: 4, page: 1, page_size: 1, total_pages: 4 } });

    render(<DashboardPage />);

    const item = (await screen.findByText('4 approvals waiting')).closest('a');
    expect(item).toHaveAttribute('href', '/dashboard/approvals');
    expect(get).toHaveBeenCalledWith(expect.stringContaining('status_filter=pending'));
  });

  it.each([
    ['reorder-radar', "Couldn't load reorder calls", /reorder calls? due/],
    ['workshop/recall', "Couldn't load workshop recalls", /due for service/],
    ['workshop/plans', "Couldn't load service plan renewals", /due for renewal/],
    ['invoices/ageing', "Couldn't load overdue invoices", /overdue$/],
    ['approvals', "Couldn't load approvals", /approvals? waiting/],
  ] as const)(
    'says %s could not be loaded instead of showing zero or nothing',
    async (source, message, countText) => {
      respond([source]);

      render(<DashboardPage />);

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(within(attentionCard()).queryByText(countText)).not.toBeInTheDocument();
      expect(within(attentionCard()).queryByText(/^0 /)).not.toBeInTheDocument();
      expect(screen.queryByText('Nothing needs you today')).not.toBeInTheDocument();
    }
  );

  it('hides approvals for a role the API refuses, without calling it a failure', async () => {
    respond([], {}, ['approvals']);

    render(<DashboardPage />);

    expect(await screen.findByText('Needs attention today')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approvals? waiting/)).not.toBeInTheDocument();
    expect(screen.getByText('Nothing needs you today')).toBeInTheDocument();
  });

  it('keeps the existing warranty item alongside the new sources', async () => {
    respond([], {
      equipment: {
        expiring_soon: 1,
        warranty_alerts: [
          {
            serial_number: 'SN1',
            product_name: 'Pressure washer',
            company_name: 'Alpha Wash',
            days_until_expiry: 5,
          },
        ],
      },
      approvals: { data: [], total: 1, page: 1, page_size: 1, total_pages: 1 },
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Warranty expiring: Pressure washer')).toBeInTheDocument();
    expect(screen.getByText('1 approval waiting')).toBeInTheDocument();
  });
});
