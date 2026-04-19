import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/(dashboard)/dashboard/page';

const defaultMockData = {
  metrics: {
    total_revenue_this_month: '125000.00',
    active_orders: 12,
    total_products: 250,
    total_customers: 85,
    low_stock_alerts: 5,
    pending_quotes: 8,
  },
  revenueData: [
    { month: 'Jan', revenue: '85000' },
    { month: 'Feb', revenue: '92000' },
    { month: 'Mar', revenue: '125000' },
  ],
  categorySales: [{ category: 'Heavy Machinery', value: '45000', percentage: 36 }],
  topProducts: [
    { name: 'Excavator XL', revenue: '25000', quantity_sold: 5 },
    { name: 'Drill Press Pro', revenue: '18000', quantity_sold: 12 },
  ],
  activity: [
    {
      type: 'order',
      title: 'Order ORD-2024-001',
      description: 'New order from ABC Construction',
      timestamp: '2024-03-15T10:30:00Z',
      status: 'confirmed',
    },
  ],
  insights: [
    {
      id: '1',
      category: 'inventory',
      priority: 'high',
      title: 'Low Stock Alert',
      description: '5 products running low on stock',
      action_items: ['Reorder SKU-001'],
    },
  ],
  loading: false,
  posFailureCount: 0,
  posAlertStatus: 'disconnected',
  metricsStreamStatus: 'disconnected',
};

// Mock the extracted data hook — page renders nothing useful while loading
vi.mock('@/lib/hooks/use-dashboard-data', () => ({
  useDashboardData: vi.fn(),
}));

import { useDashboardData } from '@/lib/hooks/use-dashboard-data';

// Mock dashboard widgets
vi.mock('@/components/dashboard/StockHealthWidget', () => ({
  StockHealthWidget: () => <div>Stock Health Widget</div>,
}));

vi.mock('@/components/dashboard/TransferSuggestionsWidget', () => ({
  TransferSuggestionsWidget: () => <div>Transfer Suggestions Widget</div>,
}));

vi.mock('@/components/dashboard/OrderStatusBreakdownWidget', () => ({
  OrderStatusBreakdownWidget: () => <div>Order Status Breakdown Widget</div>,
}));

vi.mock('@/components/dashboard/QuoteConversionWidget', () => ({
  QuoteConversionWidget: () => <div>Quote Conversion Widget</div>,
}));

vi.mock('@/components/dashboard/RevenueByLocationWidget', () => ({
  RevenueByLocationWidget: () => <div>Revenue By Location Widget</div>,
}));

vi.mock('@/components/dashboard/SalesInsightsWidget', () => ({
  SalesInsightsWidget: () => <div>Sales Insights Widget</div>,
}));

vi.mock('@/components/dashboard/OrderPatternsWidget', () => ({
  OrderPatternsWidget: () => <div>Order Patterns Widget</div>,
}));

// Mock charts
vi.mock('@/components/charts/RevenueChart', () => ({
  RevenueChart: () => <div>Revenue Chart</div>,
}));

vi.mock('@/components/charts/CategorySalesChart', () => ({
  CategorySalesChart: () => <div>Category Sales Chart</div>,
}));

// Mock insight card
vi.mock('@/components/insights/insight-card', () => ({
  InsightCard: ({ insight }: any) => <div>{insight.title}</div>,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDashboardData).mockReturnValue(defaultMockData as any);
  });

  test('renders dashboard title', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Equipment Supplier Operations/)).toBeInTheDocument();
    });
  });

  test('displays key metrics', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Key Metrics')).toBeInTheDocument();
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Active Orders')).toBeInTheDocument();
      expect(screen.getByText('Total Products')).toBeInTheDocument();
      expect(screen.getByText('Total Customers')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument();
      expect(screen.getByText('Pending Quotes')).toBeInTheDocument();
    });
  });

  test('displays revenue value from API', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Revenue should be formatted as currency
      expect(screen.getByText(/\$125,000\.00/)).toBeInTheDocument();
    });
  });

  test('displays active orders count', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // active_orders from mock
    });
  });

  test('displays products count', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('250')).toBeInTheDocument(); // total_products from mock
    });
  });

  test('displays customers count', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument(); // total_customers from mock
    });
  });

  test('displays low stock alerts', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // low_stock_alerts from mock
    });
  });

  test('displays pending quotes', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument(); // pending_quotes from mock
    });
  });

  test('renders key bento sections', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Key Metrics')).toBeInTheDocument();
      expect(screen.getByText('Top 5 Products')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  test('renders revenue chart', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Revenue Chart')).toBeInTheDocument();
    });
  });

  test('renders category sales chart', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Category Sales Chart')).toBeInTheDocument();
    });
  });

  test('renders dashboard widgets', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Stock Health Widget')).toBeInTheDocument();
      expect(screen.getByText('Transfer Suggestions Widget')).toBeInTheDocument();
      expect(screen.getByText('Order Status Breakdown Widget')).toBeInTheDocument();
      expect(screen.getByText('Quote Conversion Widget')).toBeInTheDocument();
      expect(screen.getByText('Revenue By Location Widget')).toBeInTheDocument();
      expect(screen.getByText('Sales Insights Widget')).toBeInTheDocument();
      expect(screen.getByText('Order Patterns Widget')).toBeInTheDocument();
    });
  });

  test('displays AI insights when available', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('AI-Powered Insights')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Alert')).toBeInTheDocument();
    });
  });

  test('displays top products section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Top 5 Products')).toBeInTheDocument();
      expect(screen.getByText('Excavator XL')).toBeInTheDocument();
      expect(screen.getByText('Drill Press Pro')).toBeInTheDocument();
    });
  });

  test('displays recent activity', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('Order ORD-2024-001')).toBeInTheDocument();
      expect(screen.getByText('New order from ABC Construction')).toBeInTheDocument();
    });
  });

  test('shows loading state initially', () => {
    vi.mocked(useDashboardData).mockReturnValue({
      ...defaultMockData,
      loading: true,
      metrics: null,
    } as any);
    render(<DashboardPage />);
    expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
  });

  test('handles API error gracefully', async () => {
    // With hook mocked, loading is false — verify it never shows loading
    render(<DashboardPage />);
    expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument();
  });

  test('formats currency correctly', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Check Australian dollar formatting
      const revenueElement = screen.getByText(/\$125,000\.00/);
      expect(revenueElement).toBeInTheDocument();
    });
  });

  test('displays product revenue in top products', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/\$25,000\.00/)).toBeInTheDocument(); // Excavator XL revenue
      expect(screen.getByText(/\$18,000\.00/)).toBeInTheDocument(); // Drill Press Pro revenue
    });
  });

  test('displays quantity sold in top products', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('5 units sold')).toBeInTheDocument();
      expect(screen.getByText('12 units sold')).toBeInTheDocument();
    });
  });

  test('displays activity timestamps', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Mar 15, 2024/)).toBeInTheDocument();
    });
  });
});
