#!/usr/bin/env node
/**
 * Dashboard route smoke test — checks HTTP status and common React error strings.
 * Requires valid DATABASE_URL + JWT_SECRET in .env.local for authenticated routes.
 *
 * Usage: node scripts/dashboard-route-smoke.mjs
 */
import { config } from 'dotenv';
import { SignJWT } from 'jose';

config({ path: '.env.local' });
config({ path: '.env' });

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

const ROUTES = [
  '/dashboard',
  '/dashboard/operations',
  '/dashboard/operations/quotes',
  '/dashboard/operations/orders',
  '/dashboard/operations/fulfilment',
  '/dashboard/operations/purchase-orders',
  '/dashboard/operations/pos',
  '/dashboard/operations/pos/reconciliation',
  '/dashboard/crm',
  '/dashboard/crm/customers',
  '/dashboard/crm/client-health',
  '/dashboard/crm/onboarding',
  '/dashboard/crm/personas',
  '/dashboard/crm/contacts',
  '/dashboard/crm/contractors',
  '/dashboard/crm/service-requests',
  '/dashboard/crm/activities',
  '/dashboard/workshop',
  '/dashboard/workshop/schedule',
  '/dashboard/workshop/equipment',
  '/dashboard/workshop/templates',
  '/dashboard/workshop/reminders',
  '/dashboard/inventory',
  '/dashboard/inventory/products',
  '/dashboard/inventory/bom',
  '/dashboard/inventory/stock',
  '/dashboard/inventory/transfers',
  '/dashboard/inventory/reservations',
  '/dashboard/inventory/forecast',
  '/dashboard/inventory/warehouse',
  '/dashboard/inventory/containers',
  '/dashboard/inventory/backorders',
  '/dashboard/finance',
  '/dashboard/finance/invoices',
  '/dashboard/finance/debtors',
  '/dashboard/finance/invoices/bas',
  '/dashboard/finance/bank-feeds',
  '/dashboard/finance/emails',
  '/dashboard/workspace',
  '/dashboard/settings',
  '/dashboard/settings?panel=team',
  '/dashboard/settings?panel=billing',
  '/dashboard/settings?panel=shadow',
  '/dashboard/ai-reports/ai-assistant',
  '/dashboard/ccw-feasibility',
  '/dashboard/ccw-phone-agent',
  '/dashboard/comms',
  '/dashboard/workflows',
];

const ERROR_PATTERNS = [
  /Element type is invalid/i,
  /Application error/i,
  /Something went wrong/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
];

async function mintAccessToken() {
  const raw = process.env.JWT_SECRET ?? process.env.JWT_SECRET_KEY;
  if (!raw) throw new Error('JWT_SECRET or JWT_SECRET_KEY is not configured');
  const secret = new TextEncoder().encode(raw);
  return new SignJWT({
    email: 'admin@demo.com',
    is_admin: true,
    role: 'owner',
    typ: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('00000000-0000-0000-0000-000000000001')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function checkRoute(path, token) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Cookie: `auth_token=${token}` },
    redirect: 'manual',
  });
  const status = res.status;
  let body = '';
  if (status >= 200 && status < 400) {
    body = await res.text();
  }
  const errors = ERROR_PATTERNS.filter((p) => p.test(body)).map((p) => p.source);
  const redirectedToLogin = status === 307 || status === 302;
  const location = res.headers.get('location') ?? '';
  return { path, status, errors, redirectedToLogin, location, ok: status === 200 && errors.length === 0 };
}

async function main() {
  const token = await mintAccessToken();
  const results = [];
  for (const path of ROUTES) {
    results.push(await checkRoute(path, token));
  }

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(JSON.stringify({ base: BASE, total: results.length, passed: passed.length, failed: failed.length, results }, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
