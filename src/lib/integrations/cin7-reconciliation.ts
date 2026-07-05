import { prisma } from '@/lib/db/prisma';
import {
  fetchCin7CustomerPage,
  fetchCin7ProductPage,
  getCin7CoreCredentials,
  pingCin7Core,
} from '@/lib/integrations/cin7-core';
import {
  fetchOmniBranchesPage,
  fetchOmniContactsPage,
  fetchOmniProductPage,
  getCin7OmniCredentials,
  pingCin7Omni,
} from '@/lib/integrations/cin7-omni';
import { getCin7SyncMaxPages, getCin7PageSize, shouldContinueCin7SyncPage } from '@/lib/integrations/cin7-sync-config';

const CIN7_PRODUCT_CATEGORY_PREFIX = 'Cin7';

export type Cin7ReconciliationSnapshot = {
  source: 'core' | 'omni' | 'none';
  checked_at: string;
  cin7: {
    products: { styles: number; skus: number; by_visibility: Record<string, number> };
    customers: number;
    internal_customers: number;
    suppliers: number;
    branches: number;
  };
  optix: {
    products: {
      total: number;
      cin7_sourced: number;
      active_cin7_sourced: number;
      by_visibility: Record<string, number>;
    };
    customers: { total: number; cin7_linked: number; unlinked_orphans: number };
    internal_customers: number;
    suppliers: { total: number; cin7_linked: number };
    branches: { total: number };
  };
  notes: string[];
};

function productVisibilityFromCategory(category: string | null): string {
  if (!category) return 'Unknown';
  const parts = category.split('·').map((p) => p.trim());
  return parts.length > 1 ? parts[parts.length - 1] : 'Cin7 Core';
}

export async function buildCin7Reconciliation(ownerUserId: string): Promise<Cin7ReconciliationSnapshot> {
  const notes: string[] = [];
  const coreCreds = getCin7CoreCredentials();
  const omniCreds = getCin7OmniCredentials();
  const coreLive = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniLive = omniCreds ? await pingCin7Omni(omniCreds) : false;
  const useCore = coreLive;
  const useOmni = !coreLive && omniLive;
  const pageSize = getCin7PageSize();
  const maxPages = getCin7SyncMaxPages();

  let source: Cin7ReconciliationSnapshot['source'] = 'none';
  const cin7Products = { styles: 0, skus: 0, by_visibility: {} as Record<string, number> };
  let cin7Customers = 0;
  let cin7InternalCustomers = 0;
  let cin7Suppliers = 0;
  let cin7Branches = 0;

  if (useCore && coreCreds) {
    source = 'core';
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows } = await fetchCin7ProductPage(coreCreds, page, pageSize);
      if (rows.length === 0) break;
      cin7Products.styles += rows.length;
      cin7Products.skus += rows.length;
      cin7Products.by_visibility.Cin7 = (cin7Products.by_visibility.Cin7 ?? 0) + rows.length;
      if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, rows.length, maxPages)) break;
    }
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, total } = await fetchCin7CustomerPage(coreCreds, page, pageSize);
      cin7Customers += rows.length;
      if (rows.length === 0) break;
      if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, maxPages)) break;
    }
    notes.push('Cin7 Core: supplier, branch, and internal customer paths use Omni when available.');
  } else if (useOmni && omniCreds) {
    source = 'omni';
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, sourceRowCount, skippedInactive } = await fetchOmniProductPage(
        omniCreds,
        page,
        pageSize,
        { excludeInactive: true }
      );
      if (sourceRowCount === 0) break;
      cin7Products.styles += sourceRowCount;
      cin7Products.skus += rows.length;
      for (const row of rows) {
        cin7Products.by_visibility[row.visibility] =
          (cin7Products.by_visibility[row.visibility] ?? 0) + 1;
      }
      if (skippedInactive > 0) {
        notes.push('Inactive Cin7 styles are excluded from product sync counts.');
      }
      if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, null, maxPages)) break;
    }
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, sourceRowCount } = await fetchOmniContactsPage(omniCreds, page, pageSize, {
        allowedTypes: ['Customer'],
      });
      cin7Customers += rows.length;
      if (sourceRowCount === 0) break;
      if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, null, maxPages)) break;
    }
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, sourceRowCount } = await fetchOmniContactsPage(omniCreds, page, pageSize, {
        allowedTypes: ['Internal'],
      });
      cin7InternalCustomers += rows.length;
      if (sourceRowCount === 0) break;
      if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, null, maxPages)) break;
    }
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, sourceRowCount } = await fetchOmniContactsPage(omniCreds, page, pageSize, {
        allowedTypes: ['Supplier'],
      });
      cin7Suppliers += rows.length;
      if (sourceRowCount === 0) break;
      if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, null, maxPages)) break;
    }
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, sourceRowCount } = await fetchOmniBranchesPage(omniCreds, page, pageSize);
      cin7Branches += rows.length;
      if (sourceRowCount === 0) break;
      if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, null, maxPages)) break;
    }
    notes.push(
      'Optix product SKU totals align with Cin7 when each style has one variant; multi-variant styles may show more SKUs in Optix.'
    );
  } else {
    notes.push('Cin7 is not connected — counts reflect Optix data only.');
  }

  const [
    productRows,
    customerTotal,
    customerLinked,
    customerOrphans,
    internalCustomers,
    supplierTotal,
    supplierLinked,
    branchTotal,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { ownerUserId, category: { startsWith: CIN7_PRODUCT_CATEGORY_PREFIX } },
      select: { category: true, isActive: true },
    }),
    prisma.customer.count({ where: { ownerUserId } }),
    prisma.customer.count({ where: { ownerUserId, cin7ContactId: { not: null } } }),
    prisma.customer.count({
      where: {
        ownerUserId,
        cin7ContactId: null,
        OR: [{ email: null }, { email: '' }],
      },
    }),
    prisma.customer.count({
      where: { ownerUserId, cin7ContactType: { equals: 'Internal', mode: 'insensitive' } },
    }),
    prisma.supplier.count({ where: { ownerUserId } }),
    prisma.supplier.count({
      where: { ownerUserId, supplierCode: { startsWith: 'cin7:' } },
    }),
    prisma.cin7Branch.count({ where: { ownerUserId } }),
  ]);

  const optixByVisibility: Record<string, number> = {};
  let activeCin7Sourced = 0;
  for (const row of productRows) {
    const visibility = productVisibilityFromCategory(row.category);
    optixByVisibility[visibility] = (optixByVisibility[visibility] ?? 0) + 1;
    if (row.isActive) activeCin7Sourced += 1;
  }

  return {
    source,
    checked_at: new Date().toISOString(),
    cin7: {
      products: cin7Products,
      customers: cin7Customers,
      internal_customers: cin7InternalCustomers,
      suppliers: cin7Suppliers,
      branches: cin7Branches,
    },
    optix: {
      products: {
        total: productRows.length,
        cin7_sourced: productRows.length,
        active_cin7_sourced: activeCin7Sourced,
        by_visibility: optixByVisibility,
      },
      customers: {
        total: customerTotal,
        cin7_linked: customerLinked,
        unlinked_orphans: customerOrphans,
      },
      internal_customers: internalCustomers,
      suppliers: { total: supplierTotal, cin7_linked: supplierLinked },
      branches: { total: branchTotal },
    },
    notes,
  };
}
