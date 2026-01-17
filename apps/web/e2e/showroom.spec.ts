import { test, expect } from "@playwright/test";

const mockProducts = [
  {
    id: "ccw-001",
    title: "Hydra Pro Extractor",
    handle: "hydra-pro-extractor",
    vendor: "CCW",
    category: "Extractors",
    tags: ["featured"],
    price: 2499,
    compareAtPrice: null,
    available: true,
    sku: "HYDRA-01",
    image: "https://placehold.co/600x400/0d9488/ffffff?text=Hydra+Pro",
    description: "High-performance extraction unit with rapid dry tech.",
    url: "https://www.ccwonline.com.au/products/hydra-pro-extractor",
  },
  {
    id: "ccw-002",
    title: "AeroMax Air Mover",
    handle: "aeromax-air-mover",
    vendor: "CCW",
    category: "Air Movers",
    tags: ["new"],
    price: 649,
    compareAtPrice: null,
    available: false,
    sku: "AERO-02",
    image: "https://placehold.co/600x400/6366f1/ffffff?text=AeroMax",
    description: "Compact air mover designed for rapid drying.",
    url: "https://www.ccwonline.com.au/products/aeromax-air-mover",
  },
];

test("showroom pipeline advances through lifecycle", async ({ page }) => {
  await page.route("**/api/ccw/products**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ source: "mock", products: mockProducts }),
    });
  });

  await page.route("**/api/ccw/summary**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ summary: "Mock summary from Jina." }),
    });
  });

  const mockCustomer = {
    id: "11111111-1111-1111-1111-111111111111",
    customer_number: "CUST-2031",
    company_name: "Metro Facility Services",
    email: "ops@metrofss.au",
  };
  const mockProductsBySku: Record<string, { id: string; sku: string; name: string }> = {
    "HYDRA-01": {
      id: "22222222-2222-2222-2222-222222222222",
      sku: "HYDRA-01",
      name: "Hydra Pro Extractor",
    },
    "AERO-02": {
      id: "33333333-3333-3333-3333-333333333333",
      sku: "AERO-02",
      name: "AeroMax Air Mover",
    },
  };

  await page.route("**/api/customers**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [mockCustomer],
          total: 1,
          page: 1,
          page_size: 5,
          total_pages: 1,
        }),
      });
      return;
    }

    if (method === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(mockCustomer),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/products**", async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === "GET") {
      const search = url.searchParams.get("search") ?? "";
      const match = mockProductsBySku[search];
      const items = match ? [match] : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          total: items.length,
          page: 1,
          page_size: 5,
          total_pages: 1,
        }),
      });
      return;
    }

    if (method === "POST") {
      const data = route.request().postDataJSON() as { sku?: string; name?: string };
      const created = {
        id: "44444444-4444-4444-4444-444444444444",
        sku: data.sku ?? "CCW-NEW",
        name: data.name ?? "New Product",
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/orders**", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "55555555-5555-5555-5555-555555555555",
          order_number: "ORD-2026-001",
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/portal/showroom");

  await expect(page.getByTestId("pipeline-card")).toBeVisible();
  await expect(page.getByTestId("selected-product-name")).toHaveText("Hydra Pro Extractor");
  await expect(page.getByTestId("summary-text")).toContainText("High-performance");

  await page.getByTestId("product-card").nth(1).click();
  await expect(page.getByTestId("selected-product-name")).toHaveText("AeroMax Air Mover");
  await page
    .getByTestId("product-card")
    .nth(1)
    .getByRole("button", { name: "Add to quote" })
    .click();
  await expect(page.getByTestId("quote-item-count")).toContainText("2 items");

  await expect(page.getByTestId("pipeline-stage")).toHaveText("Quote prepared");

  await page.getByRole("button", { name: "Refresh with Jina" }).click();
  await expect(page.getByTestId("summary-text")).toContainText("Mock summary from Jina.");

  await page.getByTestId("pipeline-advance").click();
  await expect(page.getByTestId("pipeline-stage")).toHaveText("Quote sent");

  await page.getByTestId("pipeline-advance").click();
  await expect(page.getByTestId("pipeline-stage")).toHaveText("Order confirmed");

  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText("Order created")).toBeVisible();

  await page.getByRole("button", { name: "View invoice" }).click();
  await expect(page.getByText("Invoice preview")).toBeVisible();
});
