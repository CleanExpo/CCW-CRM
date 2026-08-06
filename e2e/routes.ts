/**
 * The route inventory the browser harness walks.
 *
 * Kept in one place so the smoke walk, the accessibility pass and the visual
 * baselines all cover exactly the same surface — three checks over three
 * different route lists is how a screen ends up unchecked by all of them.
 */

/** Reachable without a session. Verified 2026-08-07: all return 200. */
export const PUBLIC_ROUTES = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
] as const;

/**
 * Require a session; unauthenticated they 307 to /login.
 *
 * The first four are the screens judged against Shopify Admin — Products,
 * Orders, Inventory and Transfers — so they carry the visual baselines.
 */
export const OPERATOR_ROUTES = [
  { name: 'inventory', path: '/inventory', bar: 'Shopify Products' },
  { name: 'orders', path: '/orders', bar: 'Shopify Orders' },
  { name: 'inventory-overview', path: '/inventory-overview', bar: 'Shopify Inventory' },
  { name: 'transfers', path: '/inventory/transfers', bar: 'Shopify Transfers' },
] as const;

/** Walked for smoke and console errors, not held to the visual bar. */
export const AUTHED_ROUTES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'products', path: '/products' },
  { name: 'customers', path: '/customers' },
  { name: 'quotes', path: '/quotes' },
  { name: 'invoices', path: '/invoices' },
  { name: 'purchase-orders', path: '/purchase-orders' },
  { name: 'integrations', path: '/dashboard/settings/integrations' },
] as const;

/**
 * Console messages that are noise rather than defects. Keep this list SHORT and
 * justified — every entry here is a class of real bug the harness can no longer
 * see. Anything not matched is treated as a failure.
 */
export const IGNORED_CONSOLE_PATTERNS = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

export function isIgnorableConsoleError(text: string): boolean {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}
