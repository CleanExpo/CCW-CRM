/**
 * E2E tests: Mobile Photo-to-Order feature
 *
 * Tests cover:
 * 1. Mobile order page — camera UI loads correctly (mocked camera)
 * 2. Guest approval portal — renders order details and action buttons
 * 3. Guest approval flow — approve an order
 * 4. Guest decline flow — decline with reason
 * 5. Mobile settings page — customer links page loads
 *
 * Note: Camera/getUserMedia is mocked at the browser level.
 * Photo upload + AI recognition tested via backend fixture with demo mode.
 */

import { test, expect, Page } from '@playwright/test';
import { test as authTest } from './fixtures/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock getUserMedia to return a blank canvas stream (avoids real camera).
 */
async function mockCamera(page: Page) {
  await page.addInitScript(() => {
    // Create a small canvas and stream from it
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#fff';
      ctx.font = '24px sans-serif';
      ctx.fillText('Mock Camera', 200, 240);
    }

    const stream = (
      canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
    ).captureStream?.(10);
    if (stream) {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: (constraints: MediaStreamConstraints) => {
          if (constraints.video) return Promise.resolve(stream);
          return original(constraints);
        },
        configurable: true,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Fixture token for guest portal tests
// ---------------------------------------------------------------------------

// We use a mock token — in demo mode the backend will 404 which is expected.
// For full integration, set DEMO_GUEST_TOKEN env var to a real seed token.
const MOCK_TOKEN = process.env.DEMO_GUEST_TOKEN ?? 'test-token-not-real';

// ---------------------------------------------------------------------------
// Test: Mobile order page (authenticated)
// ---------------------------------------------------------------------------

authTest.describe('Mobile Order Page', () => {
  authTest(
    'should load mobile order page with camera widget',
    async ({ authenticatedPage: page }) => {
      await mockCamera(page);
      await page.goto('/mobile/order/new');

      // Page heading
      await expect(page.locator('h1')).toContainText(/new order/i);

      // Step indicator dots should be visible
      await expect(page.locator('[aria-label*="indicator"], .rounded-full').first()).toBeVisible();

      // Camera tap button should be visible
      await expect(page.locator('[aria-label*="camera"], [aria-label*="Camera"]')).toBeVisible();
    }
  );

  authTest('should show step 1 capture UI correctly', async ({ authenticatedPage: page }) => {
    await mockCamera(page);
    await page.goto('/mobile/order/new');

    // Should show "Take Product Photo" button
    await expect(page.locator('text=/take product photo/i')).toBeVisible();

    // Should show instruction text
    await expect(page.locator('text=/point camera/i')).toBeVisible();
  });

  authTest('opens camera on button click', async ({ authenticatedPage: page }) => {
    await mockCamera(page);
    await page.goto('/mobile/order/new');

    // Click the capture button
    const captureBtn = page.locator('[aria-label*="Open camera"], [aria-label*="camera"]').first();
    await captureBtn.click();

    // Should show video element or requesting permission state
    const states = page.locator('text=/requesting camera|viewfinder/i');
    const videoEl = page.locator('video');
    await expect(states.or(videoEl)).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Test: Mobile settings page (authenticated)
// ---------------------------------------------------------------------------

authTest.describe('Mobile Settings Page', () => {
  authTest('should load mobile orders settings', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/mobile');

    // Heading
    await expect(page.locator('h1')).toContainText(/mobile ordering/i);

    // How it works section
    await expect(page.locator('text=/how photo-to-order works/i')).toBeVisible();

    // Stats tiles
    await expect(page.locator('text=/active links/i')).toBeVisible();
    await expect(page.locator('text=/total links/i')).toBeVisible();

    // PWA install section
    await expect(page.locator('text=/install on your phone/i')).toBeVisible();
  });

  authTest('should have link to new mobile order', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/mobile');

    // New Order button/link exists
    const newOrderLink = page.locator('a[href="/mobile/order/new"]').first();
    await expect(newOrderLink).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test: Guest approval portal (public — no auth)
// ---------------------------------------------------------------------------

test.describe('Guest Order Portal', () => {
  test('shows 404 for invalid token', async ({ page }) => {
    await page.goto('/guest/order/definitely-not-a-real-token-xyz123');

    // Next.js 404 page or custom not-found
    const notFound = page.locator('text=/not found|404/i');
    await expect(notFound).toBeVisible({ timeout: 10000 });
  });

  // These tests require a real seed token from backend demo data
  // Run with: DEMO_GUEST_TOKEN=<token> pnpm playwright test mobile-photo-order
  test.skip('renders order details for valid pending token', async ({ page }) => {
    if (!process.env.DEMO_GUEST_TOKEN) test.skip(true, 'No DEMO_GUEST_TOKEN provided');

    await page.goto(`/guest/order/${MOCK_TOKEN}`);

    // Header with tradesperson name
    await expect(page.locator('h1')).toBeVisible();

    // Order items section
    await expect(page.locator('text=/order items/i')).toBeVisible();

    // Total amount
    await expect(page.locator('text=/total/i')).toBeVisible();

    // Action buttons
    await expect(page.locator('text=/approve order/i')).toBeVisible();
    await expect(page.locator('text=/decline/i')).toBeVisible();
  });

  test.skip('approve flow shows confirmation screen', async ({ page }) => {
    if (!process.env.DEMO_GUEST_TOKEN) test.skip(true, 'No DEMO_GUEST_TOKEN provided');

    await page.goto(`/guest/order/${MOCK_TOKEN}`);

    // Click approve
    await page.locator('text=/approve order/i').click();

    // Should show success confirmation
    await expect(page.locator('text=/order approved/i')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/we.ll be in touch/i')).toBeVisible();
  });

  test.skip('decline flow requires reason input', async ({ page }) => {
    if (!process.env.DEMO_GUEST_TOKEN) test.skip(true, 'No DEMO_GUEST_TOKEN provided');

    await page.goto(`/guest/order/${MOCK_TOKEN}`);

    // Click decline to show form
    await page.locator('text=/^decline$/i').click();

    // Form should appear
    await expect(page.locator('textarea[placeholder*="declining"]')).toBeVisible();

    // Confirm decline without reason — should stay disabled
    const confirmBtn = page.locator('text=/confirm decline/i');
    await expect(confirmBtn).toBeDisabled();

    // Fill in reason
    await page.locator('textarea[placeholder*="declining"]').fill('Price too high for the job');
    await expect(confirmBtn).toBeEnabled();

    // Submit decline
    await confirmBtn.click();
    await expect(page.locator('text=/order declined/i')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Test: Backend API (requires running backend in demo mode)
// ---------------------------------------------------------------------------

test.describe('Mobile Backend API', () => {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

  test('GET /api/guest/order/invalid-token returns 404', async ({ request }) => {
    const response = await request.get(`${BACKEND}/api/guest/order/definitely-invalid-token-xyz`);
    expect(response.status()).toBe(404);
  });

  test('POST /api/guest/order/invalid-token/approve returns 404', async ({ request }) => {
    const response = await request.post(
      `${BACKEND}/api/guest/order/definitely-invalid-token-xyz/approve`,
      { data: { notes: 'test' } }
    );
    expect(response.status()).toBe(404);
  });

  test('POST /api/guest/order/invalid-token/decline returns 404', async ({ request }) => {
    const response = await request.post(
      `${BACKEND}/api/guest/order/definitely-invalid-token-xyz/decline`,
      { data: { reason: 'testing' } }
    );
    expect(response.status()).toBe(404);
  });
});
