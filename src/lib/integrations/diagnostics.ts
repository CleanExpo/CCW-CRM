import { getCin7Mode } from '@/lib/integrations/cin7-core';
import { getShopifyApiVersion, getShopifyMode, normalizeShopifyHostInput } from '@/lib/integrations/shopify';
import { getXeroMode } from '@/lib/integrations/xero';

type Level = 'ok' | 'warning' | 'error';

export interface IntegrationDiagnostic {
  key: 'xero' | 'shopify' | 'cin7' | 'sendgrid' | 'ap2' | 'heygen';
  label: string;
  level: Level;
  liveReady: boolean;
  mode: 'demo' | 'live';
  checks: Array<{ level: Level; message: string }>;
}

function has(value?: string): boolean {
  return Boolean(value?.trim());
}

export function getIntegrationDiagnostics(): IntegrationDiagnostic[] {
  const diagnostics: IntegrationDiagnostic[] = [];

  const xeroMode = getXeroMode();
  const xeroChecks: IntegrationDiagnostic['checks'] = [];
  if (!has(process.env.XERO_CLIENT_ID)) xeroChecks.push({ level: 'error', message: 'Missing XERO_CLIENT_ID' });
  if (!has(process.env.XERO_CLIENT_SECRET)) xeroChecks.push({ level: 'error', message: 'Missing XERO_CLIENT_SECRET' });
  const redirectRaw = process.env.XERO_REDIRECT_URI?.trim() || '';
  if (!redirectRaw) xeroChecks.push({ level: 'error', message: 'Missing XERO_REDIRECT_URI' });
  else if (
    (redirectRaw.includes('/settings/') || redirectRaw.includes('/dashboard/settings/')) &&
    !redirectRaw.includes('/api/integrations/xero/callback')
  ) {
    xeroChecks.push({
      level: 'error',
      message:
        'XERO_REDIRECT_URI must be the API callback (…/api/integrations/xero/callback), not the settings page URL.',
    });
  } else if (!redirectRaw.includes('/api/integrations/xero/callback')) {
    xeroChecks.push({
      level: 'warning',
      message:
        'Expected path /api/integrations/xero/callback — must match Xero Developer Portal → App → Redirect URI exactly (scheme, host, no trailing slash mismatch).',
    });
  }
  if (xeroMode === 'demo') xeroChecks.push({ level: 'warning', message: 'XERO_MODE is demo; switch to live for real OAuth sync.' });
  diagnostics.push({
    key: 'xero',
    label: 'Xero',
    level: xeroChecks.some((c) => c.level === 'error') ? 'error' : xeroChecks.some((c) => c.level === 'warning') ? 'warning' : 'ok',
    liveReady: xeroChecks.every((c) => c.level !== 'error') && xeroMode === 'live',
    mode: xeroMode,
    checks: xeroChecks.length > 0 ? xeroChecks : [{ level: 'ok', message: 'Xero environment looks ready for live mode.' }],
  });

  const shopMode = getShopifyMode();
  const shopChecks: IntegrationDiagnostic['checks'] = [];
  const shopDomain = normalizeShopifyHostInput(process.env.SHOPIFY_SHOP_DOMAIN?.trim() || '');
  if (!has(process.env.SHOPIFY_CLIENT_ID) && !has(process.env.SHOPIFY_API_KEY)) {
    shopChecks.push({ level: 'error', message: 'Missing SHOPIFY_CLIENT_ID / SHOPIFY_API_KEY' });
  }
  if (!has(process.env.SHOPIFY_API_SECRET) && !has(process.env.SHOPIFY_CLIENT_SECRET)) {
    shopChecks.push({ level: 'error', message: 'Missing SHOPIFY_API_SECRET / SHOPIFY_CLIENT_SECRET' });
  }
  if (shopDomain && !shopDomain.endsWith('.myshopify.com')) {
    shopChecks.push({ level: 'error', message: 'SHOPIFY_SHOP_DOMAIN must be *.myshopify.com for Admin API.' });
  }
  if (process.env.SHOPIFY_API_VERSION?.trim() && getShopifyApiVersion() !== process.env.SHOPIFY_API_VERSION?.trim()) {
    shopChecks.push({ level: 'warning', message: 'SHOPIFY_API_VERSION format is invalid; fallback version is used.' });
  }
  if (shopMode === 'demo') shopChecks.push({ level: 'warning', message: 'SHOPIFY_MODE is demo; switch to live for production sync.' });
  diagnostics.push({
    key: 'shopify',
    label: 'Shopify',
    level: shopChecks.some((c) => c.level === 'error') ? 'error' : shopChecks.some((c) => c.level === 'warning') ? 'warning' : 'ok',
    liveReady: shopChecks.every((c) => c.level !== 'error') && shopMode === 'live',
    mode: shopMode,
    checks: shopChecks.length > 0 ? shopChecks : [{ level: 'ok', message: 'Shopify environment looks ready for live mode.' }],
  });

  const cin7Mode = getCin7Mode();
  const cin7Checks: IntegrationDiagnostic['checks'] = [];
  const cin7CoreReady =
    has(process.env.CIN7_CORE_ACCOUNT_ID) && has(process.env.CIN7_CORE_APPLICATION_KEY);
  const cin7OmniReady =
    has(process.env.CIN7_OMNI_USERNAME) && has(process.env.CIN7_OMNI_API_KEY);
  if (!cin7CoreReady && !cin7OmniReady) {
    cin7Checks.push({
      level: 'error',
      message:
        'Missing Cin7 credentials: set Core (CIN7_CORE_ACCOUNT_ID + CIN7_CORE_APPLICATION_KEY) and/or Omni (CIN7_OMNI_USERNAME + CIN7_OMNI_API_KEY).',
    });
  }
  if (cin7Mode === 'demo') cin7Checks.push({ level: 'warning', message: 'CIN7_MODE is demo; switch to live for production sync.' });
  diagnostics.push({
    key: 'cin7',
    label: 'Cin7',
    level: cin7Checks.some((c) => c.level === 'error') ? 'error' : cin7Checks.some((c) => c.level === 'warning') ? 'warning' : 'ok',
    liveReady: cin7Checks.every((c) => c.level !== 'error') && cin7Mode === 'live',
    mode: cin7Mode,
    checks: cin7Checks.length > 0 ? cin7Checks : [{ level: 'ok', message: 'Cin7 environment looks ready for live mode.' }],
  });

  const sendgridChecks: IntegrationDiagnostic['checks'] = [];
  if (!has(process.env.SENDGRID_API_KEY)) sendgridChecks.push({ level: 'error', message: 'Missing SENDGRID_API_KEY' });
  if (!has(process.env.SENDGRID_FROM_EMAIL)) sendgridChecks.push({ level: 'warning', message: 'Missing SENDGRID_FROM_EMAIL; outbound mail may fail.' });
  diagnostics.push({
    key: 'sendgrid',
    label: 'SendGrid',
    level: sendgridChecks.some((c) => c.level === 'error') ? 'error' : sendgridChecks.some((c) => c.level === 'warning') ? 'warning' : 'ok',
    liveReady: sendgridChecks.every((c) => c.level !== 'error'),
    mode: 'live',
    checks: sendgridChecks.length > 0 ? sendgridChecks : [{ level: 'ok', message: 'SendGrid environment looks ready.' }],
  });

  const ap2Checks: IntegrationDiagnostic['checks'] = [
    {
      level: 'warning',
      message:
        'AP2 API routes are placeholder (HTTP 501) until a Google AP2 backend is connected; the UI can still show the flow structure.',
    },
  ];
  diagnostics.push({
    key: 'ap2',
    label: 'AP2 (Agent Payments)',
    level: 'warning',
    liveReady: false,
    mode: 'live',
    checks: ap2Checks,
  });

  const heygenChecks: IntegrationDiagnostic['checks'] = [];
  const heygenKeySet = has(process.env.HEYGEN_API_KEY);
  if (!heygenKeySet) {
    heygenChecks.push({
      level: 'warning',
      message: 'HEYGEN_API_KEY is not set; video routes return 501 until the integration is implemented.',
    });
  } else {
    heygenChecks.push({ level: 'ok', message: 'HeyGen API key is present; wire route handlers to enable video.' });
  }
  diagnostics.push({
    key: 'heygen',
    label: 'HeyGen',
    level: heygenChecks.some((c) => c.level === 'error') ? 'error' : heygenKeySet ? 'ok' : 'warning',
    liveReady: false,
    mode: 'live',
    checks: heygenChecks,
  });

  return diagnostics;
}
