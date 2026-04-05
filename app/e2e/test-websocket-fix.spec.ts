import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3005";

test("orders page loads without WebSocket error", async ({ page }) => {
  const errors: string[] = [];

  // Capture page errors
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  // Navigate to orders page
  await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });

  // Wait a bit for any async errors
  await page.waitForTimeout(2000);

  // Check if Create Order button is visible (would be hidden if page crashed)
  const createButton = page.locator('button:has-text("Create Order")');
  const isVisible = await createButton.isVisible().catch(() => false);

  console.log("\n=== TEST RESULTS ===");
  console.log(`Create Order button visible: ${isVisible}`);
  console.log(`Errors captured: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
  }

  // Assertions
  expect(errors.filter(e => e.includes("useWebSocketContext")).length).toBe(0);
  expect(isVisible).toBe(true);
});
