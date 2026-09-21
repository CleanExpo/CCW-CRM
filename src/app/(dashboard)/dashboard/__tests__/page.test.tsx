import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get, getDashboardInsights } = vi.hoisted(() => ({
  toast: vi.fn(),
  get: vi.fn(),
  getDashboardInsights: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
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

type Source = 'aggregated' | 'pos-failures' | 'equipment' | 'certifications';

const RESPONSES: Record<Source, unknown> = {
  aggregated: AGGREGATED,
  'pos-failures': { alert_count: 0 },
  equipment: { expiring_soon: 0, warranty_alerts: [] },
  certifications: { expiring_soon: 0, expiring_alerts: [] },
};

/** Every source resolves with nothing to report unless listed as failing. */
function respond(failing: (Source | 'insights')[] = []) {
  get.mockImplementation((url: string) => {
    const source = (Object.keys(RESPONSES) as Source[]).find((s) => url.includes(s));
    if (!source) return Promise.reject(new Error(`unexpected url ${url}`));
    if (failing.includes(source)) return Promise.reject(new Error('Network down'));
    return Promise.resolve(RESPONSES[source]);
  });
  getDashboardInsights.mockImplementation(() =>
    failing.includes('insights')
      ? Promise.reject(new Error('Network down'))
      : Promise.resolve({ insights: [], total: 0, categories: [] })
  );
}

describe('DashboardPage per-source load failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows no error and no attention card when every source loads with nothing to report', async () => {
    respond();

    render(<DashboardPage />);

    expect(await screen.findByText('stat tiles')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Needs attention today')).not.toBeInTheDocument();
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
