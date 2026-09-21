// @vitest-environment node

/**
 * UNI-2722: the page role rules in update-session must also hold on the
 * matching /api/ paths. A member who cannot open a page must not be able to
 * call the API behind it; everything a member's own pages use stays open.
 */
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/jwt-tokens', () => ({
  // The token string is the role, so each test picks the caller's role directly.
  verifyAuthAccessJwt: vi.fn(async (token: string) => {
    if (!['owner', 'admin', 'member', 'billing'].includes(token)) return null;
    return {
      sub: `user-${token}`,
      email: `${token}@example.test`,
      is_admin: token === 'owner' || token === 'admin',
      role: token,
      session_version: 0,
    };
  }),
}));

import { updateSession } from '@/lib/auth/update-session';

function call(path: string, role: string, method = 'GET') {
  return updateSession(
    new NextRequest(`http://localhost${path}`, {
      method,
      headers: { cookie: `auth_token=${role}` },
    })
  );
}

/** NextResponse.next() carries this header; a 403 or redirect does not. */
function passedThrough(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1';
}

const MEMBER_GATED_APIS = [
  '/api/settings/company',
  '/api/billing/subscription',
  '/api/billing/invoices',
  '/api/monitoring/alerts',
  '/api/monitoring/health',
  '/api/monitoring/metrics',
  '/api/approvals',
  '/api/approvals/abc/steps',
  '/api/approvals/pending-my-approval',
  '/api/team',
  '/api/team/invite',
  '/api/team/user-1/role',
  '/api/integrations/cin7/cleanup-duplicates',
  '/api/integrations/cin7/stock-prune',
  '/api/integrations/cin7/stock-freeze',
  '/api/integrations/cin7/field-heal',
  '/api/integrations/cin7/product-heal',
  '/api/integrations/cin7/scheduled-sync',
  '/api/integrations/cin7/scheduled-sync/run',
  '/api/integrations/cin7/heal-audit/revert',
  '/api/trade-finance/summary',
  '/api/bank-reconciliation/workbench',
  '/api/reconciliation/dashboard',
];

/** APIs that pages a member CAN open call. Blocking these breaks the member's own work. */
const MEMBER_OPEN_APIS = [
  '/api/customers',
  '/api/products',
  '/api/orders',
  '/api/quotes',
  '/api/invoices',
  '/api/bank-feeds/transactions',
  '/api/dashboard/aggregated',
  '/api/monitoring/alerts/pos-failures',
  '/api/monitoring/alerts/pos-failures/stream',
  '/api/integrations/cin7/sync/products',
  '/api/integrations/cin7/status',
  '/api/notifications',
  '/api/team/invite/accept',
  // Prefix lookalikes must not be caught by a bare startsWith.
  '/api/settings-lookalike',
  '/api/teams',
];

describe('member role on gated API paths', () => {
  it.each(MEMBER_GATED_APIS)('403 JSON for member on %s', async (path) => {
    const res = await call(path, 'member', 'POST');
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { detail?: string };
    expect(typeof body.detail).toBe('string');
  });

  it.each(MEMBER_OPEN_APIS)('member still passes through on %s', async (path) => {
    const res = await call(path, 'member');
    expect(res.status).toBe(200);
    expect(passedThrough(res)).toBe(true);
  });
});

describe('owner and admin are not affected', () => {
  it.each(['owner', 'admin'])('%s passes through on every member-gated API', async (role) => {
    for (const path of MEMBER_GATED_APIS) {
      const res = await call(path, role, 'POST');
      expect(passedThrough(res), `${role} ${path}`).toBe(true);
    }
  });
});

describe('billing role on API paths', () => {
  it('403 on monitoring APIs whose only page (/monitoring) billing cannot open', async () => {
    for (const path of ['/api/monitoring/health', '/api/monitoring/metrics', '/api/monitoring/range']) {
      const res = await call(path, 'billing');
      expect(res.status, path).toBe(403);
    }
  });

  it('passes through on APIs behind pages billing can open', async () => {
    for (const path of [
      '/api/billing/subscription',
      '/api/invoices',
      '/api/trade-finance/summary',
      '/api/bank-reconciliation/workbench',
      '/api/monitoring/alerts',
      '/api/monitoring/alerts/pos-failures',
    ]) {
      const res = await call(path, 'billing');
      expect(passedThrough(res), path).toBe(true);
    }
  });
});

describe('page gates are unchanged', () => {
  it('member is still redirected away from a blocked page, not sent a 403', async () => {
    const res = await call('/dashboard/finance', 'member');
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/dashboard');
  });

  it('unauthenticated API call is still redirected to login', async () => {
    const res = await updateSession(new NextRequest('http://localhost/api/settings/company'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/login');
  });
});
