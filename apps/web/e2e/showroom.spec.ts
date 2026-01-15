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

  await page.goto("/portal/showroom");

  await expect(page.getByTestId("pipeline-card")).toBeVisible();
  await expect(page.getByTestId("selected-product-name")).toHaveText("Hydra Pro Extractor");

  await page.getByTestId("product-card").nth(1).click();
  await expect(page.getByTestId("selected-product-name")).toHaveText("AeroMax Air Mover");

  await expect(page.getByTestId("pipeline-stage")).toHaveText("Quote prepared");

  await page.getByTestId("pipeline-advance").click();
  await expect(page.getByTestId("pipeline-stage")).toHaveText("Quote sent");

  await page.getByTestId("pipeline-advance").click();
  await expect(page.getByTestId("pipeline-stage")).toHaveText("Order confirmed");

  await page.getByTestId("pipeline-advance").click();
  await expect(page.getByTestId("pipeline-stage")).toHaveText("Invoice issued");
});
