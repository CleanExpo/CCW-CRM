import { resolveCin7SyncSource } from '@/lib/integrations/cin7-catalog-fetch';
import { flattenOmniProducts } from '@/lib/integrations/cin7-omni';
import { shouldContinueCin7SyncPage } from '@/lib/integrations/cin7-sync-config';
import { afterEach, describe, expect, it } from 'vitest';

describe('cin7 sync config pagination', () => {
  it('continues when page is full and total is unknown', () => {
    expect(shouldContinueCin7SyncPage(1, 250, 250, null, 1000)).toBe(true);
  });

  it('stops on partial page when total is unknown', () => {
    expect(shouldContinueCin7SyncPage(3, 250, 120, null, 1000)).toBe(false);
  });

  it('stops when total records reached', () => {
    expect(shouldContinueCin7SyncPage(2, 250, 250, 500, 1000)).toBe(false);
  });
});

describe('resolveCin7SyncSource', () => {
  const original = process.env.CIN7_SYNC_PREFER;

  afterEach(() => {
    if (original === undefined) delete process.env.CIN7_SYNC_PREFER;
    else process.env.CIN7_SYNC_PREFER = original;
  });

  it('prefers omni when both are live and no explicit prefer', () => {
    expect(resolveCin7SyncSource(true, true)).toBe('omni');
  });

  it('honours CIN7_SYNC_PREFER=core', () => {
    process.env.CIN7_SYNC_PREFER = 'core';
    expect(resolveCin7SyncSource(true, true)).toBe('core');
  });

  it('returns none when neither is live', () => {
    expect(resolveCin7SyncSource(false, false)).toBe('none');
  });
});

describe('flattenOmniProducts — client requires inactive included by default', () => {
  const inactiveStyle = {
    StyleCode: 'INACTIVE-1',
    Name: 'Inactive style',
    Status: 'Inactive',
    ProductOptions: [],
  };

  const publicStyle = {
    StyleCode: 'PUB-1',
    Name: 'Public style',
    Status: 'Public',
    ProductOptions: [{ ProductOptionCode: 'SKU-1', RetailPrice: 10, StockAvailable: 5 }],
  };

  it('includes inactive products when excludeInactive is not set', () => {
    const rows = flattenOmniProducts([inactiveStyle, publicStyle]);
    expect(rows.some((r) => r.sku === 'INACTIVE-1')).toBe(true);
    expect(rows.some((r) => r.sku === 'SKU-1')).toBe(true);
  });

  it('excludes inactive only when excludeInactive is true', () => {
    const rows = flattenOmniProducts([inactiveStyle, publicStyle], { excludeInactive: true });
    expect(rows.some((r) => r.sku === 'INACTIVE-1')).toBe(false);
    expect(rows.some((r) => r.isActive === false)).toBe(false);
  });

  it('maps styleCode on each SKU row', () => {
    const rows = flattenOmniProducts([publicStyle]);
    expect(rows[0]?.styleCode).toBe('PUB-1');
    expect(rows[0]?.visibility).toBe('Public');
  });
});

describe('client requirement checklist (static)', () => {
  const REPO_ROOT = process.cwd();
  it('exception report route accepts all master data entities', async () => {
    const fs = await import('node:fs/promises');
    const path = `${REPO_ROOT}/src/app/api/integrations/cin7/reconciliation/exceptions/route.ts`;
    const src = await fs.readFile(path, 'utf8');
    for (const entity of [
      'products',
      'customers',
      'suppliers',
      'branches',
      'internal-customers',
      'product-categories',
      'brands',
      'price-lists',
      'tax-codes',
      'units-of-measure',
      'stock-levels',
      'warehouses',
    ]) {
      expect(src).toContain(`'${entity}'`);
    }
  });

  it('reconciliation UI does not promote duplicate cleanup', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/(dashboard)/settings/integrations/components/Cin7ReconciliationCard.tsx`,
      'utf8'
    );
    expect(src).not.toContain('cleanupCin7DuplicateCustomers');
    expect(src).not.toContain('Remove duplicate customers');
    // The card used to say "No data is deleted". That is no longer TRUE of the card as a whole —
    // it now offers an audited, reversible surplus-stock prune that does delete rows — so the
    // assertion tracks the narrower claim the card actually makes: the REPORT is read-only, and
    // repair is a separate explicit action. Asserting the old sentence would force the UI back to
    // a statement contradicted by its own buttons.
    expect(src).toContain('This report does not heal, align, or delete Optix');
  });

  it('sync route imports full-catalog source resolver', async () => {
    const fs = await import('node:fs/promises');
    const routeSrc = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/sync/[entityType]/route.ts`,
      'utf8'
    );
    const handlerSrc = await fs.readFile(
      `${REPO_ROOT}/src/lib/integrations/cin7-sync-omni-handlers.ts`,
      'utf8'
    );
    expect(routeSrc).toContain('resolveCin7SyncSource');
    expect(handlerSrc).toContain('excludeInactive: false');
  });

  it('reconciliation implements internal-customers exception block', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/lib/integrations/cin7-reconciliation.ts`,
      'utf8'
    );
    expect(src).toContain("entity === 'internal-customers'");
    expect(src).toContain("['Internal']");
  });

  it('customer upsert does not merge by email', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(`${REPO_ROOT}/src/lib/integrations/cin7-sync-persist.ts`, 'utf8');
    expect(src).not.toContain('idByEmail');
  });

  it('contacts sync filters type in memory (not Omni where=type)', async () => {
    const fs = await import('node:fs/promises');
    const omni = await fs.readFile(`${REPO_ROOT}/src/lib/integrations/cin7-omni.ts`, 'utf8');
    const route = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/sync/[entityType]/route.ts`,
      'utf8'
    );
    // whereType remains available for optional callers, but sync must use allowedTypes only.
    expect(omni).toContain('whereType');
    expect(omni).toContain('Do NOT infer whereType from allowedTypes');
    expect(route).toContain('allowedTypes: [contactType]');
    expect(route).not.toMatch(/whereType:\s*contactType/);
    expect(route).not.toMatch(/whereType:\s*'Supplier'/);
  });

  it('reconciliation fetches catalogs sequentially', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/lib/integrations/cin7-reconciliation.ts`,
      'utf8'
    );
    expect(src).toContain('fetchAllOmniMasterCatalogsSequential');
  });

  it('reconciliation includes internal-customer exception summary', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/lib/integrations/cin7-reconciliation.ts`,
      'utf8'
    );
    expect(src).toContain('internal_customers_missing_in_optix');
  });

  it('exception report API supports offset pagination', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/reconciliation/exceptions/route.ts`,
      'utf8'
    );
    expect(src).toContain('offset');
    expect(src).toContain("format === 'csv'");
    expect(src).toContain('buildCin7ExceptionReport');
  });

  it('sync route supports Phase 1 reference master data entities', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/sync/[entityType]/route.ts`,
      'utf8'
    );
    for (const entity of [
      'product-categories',
      'brands',
      'price-lists',
      'tax-codes',
      'units-of-measure',
      'stock-levels',
      'warehouses',
    ]) {
      expect(src).toContain(`'${entity}'`);
    }
  });

  it('status treats env credentials as connected without requiring cookie', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/status/route.ts`,
      'utf8'
    );
    expect(src).toContain('explicitlyDisconnected');
    expect(src).not.toContain('connectedCookie && apiOk');
    expect(src).toContain("get('verify') === 'true'");
  });
});
