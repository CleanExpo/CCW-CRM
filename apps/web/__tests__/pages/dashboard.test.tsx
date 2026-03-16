import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/(dashboard)/dashboard/page";

// Mock SSE hooks
vi.mock("@/lib/hooks/use-sse", () => ({
  usePOSFailureAlerts: vi.fn(() => ({
    data: null,
    status: "disconnected",
  })),
  useDashboardMetricsStream: vi.fn(() => ({
    data: null,
    status: "disconnected",
  })),
}));

// Mock AI insights API
vi.mock("@/lib/api/ai-insights", () => ({
  getDashboardInsights: vi.fn(() =>
    Promise.resolve({
      insights: [
        {
          id: "1",
          category: "inventory",
          priority: "high",
          title: "Low Stock Alert",
          description: "5 products running low on stock",
          action_items: ["Reorder SKU-001"],
        },
      ],
      total: 1,
      categories: ["inventory"],
    })
  ),
}));

// Mock dashboard widgets
vi.mock("@/components/dashboard/StockHealthWidget", () => ({
  StockHealthWidget: () => <div>Stock Health Widget</div>,
}));

vi.mock("@/components/dashboard/TransferSuggestionsWidget", () => ({
  TransferSuggestionsWidget: () => <div>Transfer Suggestions Widget</div>,
}));

vi.mock("@/components/dashboard/OrderStatusBreakdownWidget", () => ({
  OrderStatusBreakdownWidget: () => <div>Order Status Breakdown Widget</div>,
}));

vi.mock("@/components/dashboard/QuoteConversionWidget", () => ({
  QuoteConversionWidget: () => <div>Quote Conversion Widget</div>,
}));

vi.mock("@/components/dashboard/RevenueByLocationWidget", () => ({
  RevenueByLocationWidget: () => <div>Revenue By Location Widget</div>,
}));

vi.mock("@/components/dashboard/SalesInsightsWidget", () => ({
  SalesInsightsWidget: () => <div>Sales Insights Widget</div>,
}));

vi.mock("@/components/dashboard/OrderPatternsWidget", () => ({
  OrderPatternsWidget: () => <div>Order Patterns Widget</div>,
}));

// Mock charts
vi.mock("@/components/charts/RevenueChart", () => ({
  RevenueChart: () => <div>Revenue Chart</div>,
}));

vi.mock("@/components/charts/CategorySalesChart", () => ({
  CategorySalesChart: () => <div>Category Sales Chart</div>,
}));

// Mock insight card
vi.mock("@/components/insights/insight-card", () => ({
  InsightCard: ({ insight }: any) => <div>{insight.title}</div>,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders dashboard title", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });
  });

  test("displays key metrics", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Key Metrics")).toBeInTheDocument();
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
      expect(screen.getByText("Active Orders")).toBeInTheDocument();
      expect(screen.getByText("Total Products")).toBeInTheDocument();
      expect(screen.getByText("Total Customers")).toBeInTheDocument();
      expect(screen.getByText("Low Stock Alerts")).toBeInTheDocument();
      expect(screen.getByText("Pending Quotes")).toBeInTheDocument();
    });
  });

  test("displays revenue value from API", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Revenue should be formatted as currency
      expect(screen.getByText(/\$125,000\.00/)).toBeInTheDocument();
    });
  });

  test("displays active orders count", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument(); // active_orders from mock
    });
  });

  test("displays products count", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("250")).toBeInTheDocument(); // total_products from mock
    });
  });

  test("displays customers count", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("85")).toBeInTheDocument(); // total_customers from mock
    });
  });

  test("displays low stock alerts", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // low_stock_alerts from mock
    });
  });

  test("displays pending quotes", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument(); // pending_quotes from mock
    });
  });

  test("renders quick actions section", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      expect(screen.getByText("New Product")).toBeInTheDocument();
      expect(screen.getByText("Create Order")).toBeInTheDocument();
      expect(screen.getByText("Add Customer")).toBeInTheDocument();
      expect(screen.getByText("Generate Quote")).toBeInTheDocument();
      expect(screen.getByText("AI Insights")).toBeInTheDocument();
    });
  });

  test("renders revenue chart", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Revenue Chart")).toBeInTheDocument();
    });
  });

  test("renders category sales chart", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Category Sales Chart")).toBeInTheDocument();
    });
  });

  test("renders dashboard widgets", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Stock Health Widget")).toBeInTheDocument();
      expect(screen.getByText("Transfer Suggestions Widget")).toBeInTheDocument();
      expect(screen.getByText("Order Status Breakdown Widget")).toBeInTheDocument();
      expect(screen.getByText("Quote Conversion Widget")).toBeInTheDocument();
      expect(screen.getByText("Revenue By Location Widget")).toBeInTheDocument();
      expect(screen.getByText("Sales Insights Widget")).toBeInTheDocument();
      expect(screen.getByText("Order Patterns Widget")).toBeInTheDocument();
    });
  });

  test("displays AI insights when available", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("AI-Powered Insights")).toBeInTheDocument();
      expect(screen.getByText("Low Stock Alert")).toBeInTheDocument();
    });
  });

  test("displays top products section", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Top 5 Products")).toBeInTheDocument();
      expect(screen.getByText("Excavator XL")).toBeInTheDocument();
      expect(screen.getByText("Drill Press Pro")).toBeInTheDocument();
    });
  });

  test("displays recent activity", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
      expect(screen.getByText("Order ORD-2024-001")).toBeInTheDocument();
      expect(screen.getByText("New order from ABC Construction")).toBeInTheDocument();
    });
  });

  test("shows loading state initially", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Loading dashboard data...")).toBeInTheDocument();
  });

  test("handles API error gracefully", async () => {
    // Mock API to throw error
    const { server } = await import("../setup/msw");
    const { http, HttpResponse } = await import("msw");

    server.use(
      http.get("http://localhost:8000/api/dashboard/aggregated", () => {
        return HttpResponse.json(
          { detail: "Server error" },
          { status: 500 }
        );
      })
    );

    render(<DashboardPage />);

    // Should not show loading forever
    await waitFor(
      () => {
        expect(
          screen.queryByText("Loading dashboard data...")
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  test("formats currency correctly", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Check Australian dollar formatting
      const revenueElement = screen.getByText(/\$125,000\.00/);
      expect(revenueElement).toBeInTheDocument();
    });
  });

  test("displays product revenue in top products", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/\$25,000\.00/)).toBeInTheDocument(); // Excavator XL revenue
      expect(screen.getByText(/\$18,000\.00/)).toBeInTheDocument(); // Drill Press Pro revenue
    });
  });

  test("displays quantity sold in top products", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("5 units sold")).toBeInTheDocument();
      expect(screen.getByText("12 units sold")).toBeInTheDocument();
    });
  });

  test("displays activity timestamps", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Mar 15, 2024/)).toBeInTheDocument();
    });
  });
});
