import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Mock API Handlers
 * Add handlers for endpoints you want to mock in tests
 */
export const handlers = [
  // Dashboard metrics
  http.get(`${BACKEND_URL}/api/dashboard/aggregated`, () => {
    return HttpResponse.json({
      metrics: {
        total_revenue_this_month: "125000.00",
        active_orders: 12,
        total_products: 250,
        total_customers: 85,
        low_stock_alerts: 5,
        pending_quotes: 8,
      },
      revenue_chart: [
        { month: "Jan", revenue: "85000" },
        { month: "Feb", revenue: "92000" },
        { month: "Mar", revenue: "125000" },
      ],
      category_sales: [
        { category: "Heavy Machinery", value: "45000", percentage: 36 },
        { category: "Power Tools", value: "35000", percentage: 28 },
        { category: "Hand Tools", value: "25000", percentage: 20 },
      ],
      top_products: [
        { name: "Excavator XL", revenue: "25000", quantity_sold: 5 },
        { name: "Drill Press Pro", revenue: "18000", quantity_sold: 12 },
      ],
      inventory_status: [],
      recent_activity: [
        {
          type: "order",
          title: "Order ORD-2024-001",
          description: "New order from ABC Construction",
          timestamp: "2024-03-15T10:30:00Z",
          status: "confirmed",
        },
      ],
    });
  }),

  // Products list
  http.get(`${BACKEND_URL}/api/products`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    const mockProducts = [
      {
        id: "1",
        sku: "SKU-001",
        name: "Excavator XL",
        category: "heavy_machinery",
        price: "5000.00",
        stock: 10,
        is_active: true,
      },
      {
        id: "2",
        sku: "SKU-002",
        name: "Drill Press Pro",
        category: "power_tools",
        price: "1500.00",
        stock: 25,
        is_active: true,
      },
    ];

    const filtered = search
      ? mockProducts.filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase())
        )
      : mockProducts;

    return HttpResponse.json({
      data: filtered,
      total: filtered.length,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
  }),

  // Product create
  http.post(`${BACKEND_URL}/api/products`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: "new-product-id",
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // Product update
  http.put(`${BACKEND_URL}/api/products/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      ...body,
      updated_at: new Date().toISOString(),
    });
  }),

  // Product delete
  http.delete(`${BACKEND_URL}/api/products/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Customers list
  http.get(`${BACKEND_URL}/api/customers`, () => {
    return HttpResponse.json({
      data: [
        {
          id: "1",
          customer_number: "CUST-001",
          company_name: "ABC Construction",
          contact_name: "John Doe",
          email: "john@abc.com",
          phone: "555-1234",
          is_active: true,
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
  }),

  // Orders list
  http.get(`${BACKEND_URL}/api/orders`, () => {
    return HttpResponse.json({
      data: [
        {
          id: "1",
          order_number: "ORD-2024-001",
          customer_id: "1",
          status: "confirmed",
          total: "5000.00",
          order_date: "2024-03-15",
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
  }),

  // Quotes list
  http.get(`${BACKEND_URL}/api/quotes`, () => {
    return HttpResponse.json({
      data: [
        {
          id: "1",
          quote_number: "Q-2024-001",
          customer_id: "1",
          status: "sent",
          total: "3000.00",
          quote_date: "2024-03-10",
          valid_until: "2024-04-10",
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
  }),

  // AI Insights
  http.get(`${BACKEND_URL}/api/ai/insights`, () => {
    return HttpResponse.json({
      insights: [
        {
          id: "1",
          category: "inventory",
          priority: "high",
          title: "Low Stock Alert",
          description: "5 products are running low on stock",
          action_items: ["Reorder SKU-001", "Check supplier availability"],
        },
      ],
      total: 1,
      categories: ["inventory"],
    });
  }),

  // Auth endpoints
  http.post(`${BACKEND_URL}/api/auth/login`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      access_token: "mock-jwt-token",
      token_type: "bearer",
    });
  }),

  http.post(`${BACKEND_URL}/api/auth/refresh`, () => {
    return HttpResponse.json({
      access_token: "refreshed-mock-jwt-token",
      token_type: "bearer",
    });
  }),

  http.post(`${BACKEND_URL}/api/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];

/**
 * MSW Server for Node.js test environment
 */
export const server = setupServer(...handlers);

/**
 * Setup MSW server lifecycle
 */
export function setupMSW() {
  beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
