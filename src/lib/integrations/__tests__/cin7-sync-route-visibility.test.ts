/**
 * UNI-2259: route-level contract tests for the env-gated visibility tally.
 * Pins clause 1 (flag off => response shape byte-identical to before the feature)
 * and the gating rule (counts only on the Core products/inventory path).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScopeOrCronIntegrationJob: vi.fn(),
}));

vi.mock('@/lib/integrations/cin7-core', () => ({
  getCin7CoreCredentials: vi.fn(),
  pingCin7Core: vi.fn(),
  fetchCin7ProductPage: vi.fn(),
  fetchCin7CustomerPage: vi.fn(),
  fetchCin7SupplierPage: vi.fn(),
  fetchCin7SaleTotal: vi.fn(),
}));

vi.mock('@/lib/integrations/cin7-omni', () => ({
  getCin7OmniCredentials: vi.fn(),
  pingCin7Omni: vi.fn(),
  fetchOmniProductPage: vi.fn(),
  fetchOmniContactsPage: vi.fn(),
  fetchOmniSalesOrderCount: vi.fn(),
}));

vi.mock('@/lib/integrations/cin7-sync-persist', () => ({
  batchUpsertProducts: vi.fn().mockResolvedValue(0),
  batchUpsertCustomers: vi.fn().mockResolvedValue(0),
  batchUpsertSuppliers: vi.fn().mockResolvedValue(0),
  mapCoreProductRows: vi.fn(() => ({ rows: [], skipped: [] })),
  mapCoreSupplierRows: vi.fn(() => ({ rows: [], skipped: [] })),
  mapCoreCustomerRows: vi.fn(() => []),
  mapOmniProductRows: vi.fn(() => ({ rows: [], skipped: [] })),
  mapOmniCustomerRows: vi.fn(() => []),
}));

import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import {
  getCin7CoreCredentials,
  pingCin7Core,
  fetchCin7ProductPage,
  fetchCin7CustomerPage,
} from '@/lib/integrations/cin7-core';
import {
  getCin7OmniCredentials,
  pingCin7Omni,
  fetchOmniProductPage,
} from '@/lib/integrations/cin7-omni';
import { POST } from '@/app/api/integrations/cin7/sync/[entityType]/route';

const CORE_CREDS = { accountId: 'acc', applicationKey: 'key' };

function callSync(entityType: string) {
  const req = new Request(`http://localhost/api/integrations/cin7/sync/${entityType}`, {
    method: 'POST',
  });
  return POST(req as never, { params: Promise.resolve({ entityType }) });
}

function armCorePath() {
  vi.mocked(requireAuthScopeOrCronIntegrationJob).mockResolvedValue({ userId: 'user-1' } as never);
  vi.mocked(getCin7CoreCredentials).mockReturnValue(CORE_CREDS);
  vi.mocked(pingCin7Core).mockResolvedValue(true);
  vi.mocked(getCin7OmniCredentials).mockReturnValue(null);
  vi.mocked(pingCin7Omni).mockResolvedValue(false);
  // One short page of raw rows carrying the (hypothetical) visibility field.
  vi.mocked(fetchCin7ProductPage).mockResolvedValue({
    rows: [
      { Sku: 'A', Status: 'Secure Internal' },
      { Sku: 'B', Status: 'Show Public' },
      { Sku: 'C' },
    ],
    total: 3,
  });
  vi.mocked(fetchCin7CustomerPage).mockResolvedValue({ rows: [{ Name: 'X' }], total: 1 });
}

describe('cin7 sync route — visibility flag OFF (contract clause 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_FIELD', '');
    armCorePath();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('products response has exactly the pre-feature keys — no visibility_counts', async () => {
    const res = await callSync('products');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual([
      'duration_ms',
      'page_size',
      'records_processed',
      'records_skipped',
      'status',
    ]);
  });
});

describe('cin7 sync route — visibility flag ON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_FIELD', 'Status');
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_SECURE_VALUES', 'Secure Internal');
    armCorePath();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('Core products response includes correct visibility_counts tallied on raw rows', async () => {
    const res = await callSync('products');
    const body = await res.json();
    expect(body.visibility_counts).toEqual({
      secure_internal: 1,
      show_public: 1,
      unknown: 1, // row C has no Status field
    });
  });

  it('non-product entity types never return visibility_counts (no misleading zeros)', async () => {
    const res = await callSync('customers');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).not.toHaveProperty('visibility_counts');
  });

  it('the Omni products path never returns visibility_counts (raw fields are flattened away)', async () => {
    vi.mocked(pingCin7Core).mockResolvedValue(false);
    vi.mocked(getCin7OmniCredentials).mockReturnValue({ username: 'u', apiKey: 'k' });
    vi.mocked(pingCin7Omni).mockResolvedValue(true);
    vi.mocked(fetchOmniProductPage).mockResolvedValue({
      rows: [],
      total: null,
      sourceRowCount: 0,
    });
    const res = await callSync('products');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).not.toHaveProperty('visibility_counts');
  });
});
