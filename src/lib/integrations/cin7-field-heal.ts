/**
 * Heal Optix field diffs from live Cin7 for entities that recon compares field-by-field.
 * Matched keys only — does not create missing rows or delete extras.
 */

import { prisma } from '@/lib/db/prisma';
import {
  fetchAllOmniMasterCatalogsSequential,
  getReconCatalogFetchOptions,
  type Cin7OmniMasterCatalogs,
} from '@/lib/integrations/cin7-catalog-fetch';
import type {
  Cin7OmniBranchRow,
  Cin7OmniContactRow,
  Cin7OmniCredentials,
} from '@/lib/integrations/cin7-omni';
import { healOptixProductFieldMismatches } from '@/lib/integrations/cin7-product-heal';
import { healOptixStockFieldMismatches } from '@/lib/integrations/cin7-stock-prune';
import {
  batchUpsertBranches,
  batchUpsertCustomers,
  batchUpsertSuppliers,
  mapOmniBranchRows,
  mapOmniCustomerRows,
  mapOmniSupplierRows,
} from '@/lib/integrations/cin7-sync-persist';

export type Cin7FieldHealEntity =
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'branches'
  | 'internal-customers'
  | 'stock';

export type Cin7EntityHealResult = {
  healed: number;
  checked: number;
  skipped_dirty_catalog: boolean;
};

const ALL_ENTITIES: Cin7FieldHealEntity[] = [
  'products',
  'customers',
  'suppliers',
  'branches',
  'internal-customers',
  'stock',
];

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function emptyEntityResult(skipped = false): Cin7EntityHealResult {
  return { healed: 0, checked: 0, skipped_dirty_catalog: skipped };
}

function customerFieldsMatch(
  optix: { companyName: string; email: string | null; phone: string | null; city: string | null },
  cin7: Cin7OmniContactRow
): boolean {
  return (
    normalize(optix.companyName) === normalize(cin7.companyName) &&
    normalize(optix.email) === normalize(cin7.email) &&
    normalize(optix.phone) === normalize(cin7.phone) &&
    normalize(optix.city) === normalize(cin7.city)
  );
}

function internalCustomerFieldsMatch(
  optix: { companyName: string; email: string | null },
  cin7: Cin7OmniContactRow
): boolean {
  return (
    normalize(optix.companyName) === normalize(cin7.companyName) &&
    normalize(optix.email) === normalize(cin7.email)
  );
}

function supplierFieldsMatch(
  optix: { companyName: string; email: string | null; phone: string | null },
  cin7: Cin7OmniContactRow
): boolean {
  return (
    normalize(optix.companyName) === normalize(cin7.companyName) &&
    normalize(optix.email) === normalize(cin7.email) &&
    normalize(optix.phone) === normalize(cin7.phone)
  );
}

function branchFieldsMatch(
  optix: {
    name: string;
    city: string | null;
    state: string | null;
    postCode: string | null;
    isActive: boolean;
  },
  cin7: Cin7OmniBranchRow
): boolean {
  return (
    normalize(optix.name) === normalize(cin7.name) &&
    normalize(optix.city) === normalize(cin7.city) &&
    normalize(optix.state) === normalize(cin7.state) &&
    normalize(optix.postCode) === normalize(cin7.postCode) &&
    optix.isActive === cin7.isActive
  );
}

/** Exported for unit tests — same compare rules as recon. */
export const cin7FieldHealCompare = {
  customerFieldsMatch,
  internalCustomerFieldsMatch,
  supplierFieldsMatch,
  branchFieldsMatch,
};

export async function healOptixCustomerFieldMismatches(
  ownerUserId: string,
  cin7Contacts: Cin7OmniContactRow[]
): Promise<Cin7EntityHealResult> {
  const cin7ById = new Map(
    cin7Contacts.filter((c) => c.cin7ContactId).map((c) => [c.cin7ContactId, c] as const)
  );
  if (cin7ById.size === 0) return emptyEntityResult();

  const optixRows = await prisma.customer.findMany({
    where: {
      ownerUserId,
      cin7ContactId: { not: null },
      OR: [
        { cin7ContactType: { equals: 'Customer', mode: 'insensitive' } },
        { cin7ContactType: null },
      ],
    },
    select: {
      cin7ContactId: true,
      companyName: true,
      email: true,
      phone: true,
      city: true,
    },
  });

  const toHeal: Cin7OmniContactRow[] = [];
  for (const row of optixRows) {
    const id = row.cin7ContactId;
    if (!id) continue;
    const cin7 = cin7ById.get(id);
    if (!cin7) continue;
    if (!customerFieldsMatch(row, cin7)) toHeal.push(cin7);
  }

  if (toHeal.length === 0)
    return { healed: 0, checked: optixRows.length, skipped_dirty_catalog: false };
  await batchUpsertCustomers(ownerUserId, mapOmniCustomerRows(toHeal));
  console.log(
    `[Cin7 field heal] customers owner=${ownerUserId} healed=${toHeal.length} checked=${optixRows.length}`
  );
  return { healed: toHeal.length, checked: optixRows.length, skipped_dirty_catalog: false };
}

export async function healOptixInternalCustomerFieldMismatches(
  ownerUserId: string,
  cin7Contacts: Cin7OmniContactRow[]
): Promise<Cin7EntityHealResult> {
  const cin7ById = new Map(
    cin7Contacts.filter((c) => c.cin7ContactId).map((c) => [c.cin7ContactId, c] as const)
  );
  if (cin7ById.size === 0) return emptyEntityResult();

  const optixRows = await prisma.customer.findMany({
    where: {
      ownerUserId,
      cin7ContactId: { not: null },
      cin7ContactType: { equals: 'Internal', mode: 'insensitive' },
    },
    select: {
      cin7ContactId: true,
      companyName: true,
      email: true,
    },
  });

  const toHeal: Cin7OmniContactRow[] = [];
  for (const row of optixRows) {
    const id = row.cin7ContactId;
    if (!id) continue;
    const cin7 = cin7ById.get(id);
    if (!cin7) continue;
    if (!internalCustomerFieldsMatch(row, cin7)) toHeal.push(cin7);
  }

  if (toHeal.length === 0)
    return { healed: 0, checked: optixRows.length, skipped_dirty_catalog: false };
  await batchUpsertCustomers(ownerUserId, mapOmniCustomerRows(toHeal));
  console.log(
    `[Cin7 field heal] internal owner=${ownerUserId} healed=${toHeal.length} checked=${optixRows.length}`
  );
  return { healed: toHeal.length, checked: optixRows.length, skipped_dirty_catalog: false };
}

export async function healOptixSupplierFieldMismatches(
  ownerUserId: string,
  cin7Contacts: Cin7OmniContactRow[]
): Promise<Cin7EntityHealResult> {
  const cin7ById = new Map(
    cin7Contacts.filter((c) => c.cin7ContactId).map((c) => [c.cin7ContactId, c] as const)
  );
  if (cin7ById.size === 0) return emptyEntityResult();

  const optixRows = await prisma.supplier.findMany({
    where: { ownerUserId, supplierCode: { startsWith: 'cin7:' } },
    select: { supplierCode: true, companyName: true, email: true, phone: true },
  });

  const toHeal: Cin7OmniContactRow[] = [];
  for (const row of optixRows) {
    const id = row.supplierCode.replace(/^cin7:/, '');
    const cin7 = cin7ById.get(id);
    if (!cin7) continue;
    if (!supplierFieldsMatch(row, cin7)) toHeal.push(cin7);
  }

  if (toHeal.length === 0)
    return { healed: 0, checked: optixRows.length, skipped_dirty_catalog: false };
  await batchUpsertSuppliers(ownerUserId, mapOmniSupplierRows(toHeal));
  console.log(
    `[Cin7 field heal] suppliers owner=${ownerUserId} healed=${toHeal.length} checked=${optixRows.length}`
  );
  return { healed: toHeal.length, checked: optixRows.length, skipped_dirty_catalog: false };
}

export async function healOptixBranchFieldMismatches(
  ownerUserId: string,
  cin7Branches: Cin7OmniBranchRow[]
): Promise<Cin7EntityHealResult> {
  const cin7ById = new Map(
    cin7Branches.filter((b) => b.cin7BranchId).map((b) => [b.cin7BranchId, b] as const)
  );
  if (cin7ById.size === 0) return emptyEntityResult();

  const optixRows = await prisma.cin7Branch.findMany({
    where: { ownerUserId },
    select: {
      cin7BranchId: true,
      name: true,
      city: true,
      state: true,
      postCode: true,
      isActive: true,
    },
  });

  const toHeal: Cin7OmniBranchRow[] = [];
  for (const row of optixRows) {
    const cin7 = cin7ById.get(row.cin7BranchId);
    if (!cin7) continue;
    if (!branchFieldsMatch(row, cin7)) toHeal.push(cin7);
  }

  if (toHeal.length === 0)
    return { healed: 0, checked: optixRows.length, skipped_dirty_catalog: false };
  await batchUpsertBranches(ownerUserId, mapOmniBranchRows(toHeal));
  console.log(
    `[Cin7 field heal] branches owner=${ownerUserId} healed=${toHeal.length} checked=${optixRows.length}`
  );
  return { healed: toHeal.length, checked: optixRows.length, skipped_dirty_catalog: false };
}

export type Cin7FieldHealResult = {
  by_entity: {
    products: Cin7EntityHealResult;
    customers: Cin7EntityHealResult;
    suppliers: Cin7EntityHealResult;
    branches: Cin7EntityHealResult;
    internal_customers: Cin7EntityHealResult;
    stock: Cin7EntityHealResult;
  };
  healed_total: number;
  errors: string[];
};

/**
 * Heal from catalogs already in memory (live recon path).
 * Skips an entity when that catalog slice reported errors (fail-closed).
 */
export async function healOptixFieldMismatchesFromCatalogs(
  ownerUserId: string,
  catalogs: Cin7OmniMasterCatalogs,
  options?: { entities?: Cin7FieldHealEntity[] }
): Promise<Cin7FieldHealResult> {
  const want = new Set(options?.entities ?? ALL_ENTITIES);
  const errors: string[] = [];

  let products = emptyEntityResult();
  let customers = emptyEntityResult();
  let suppliers = emptyEntityResult();
  let branches = emptyEntityResult();
  let internalCustomers = emptyEntityResult();
  let stock = emptyEntityResult();

  if (want.has('products')) {
    if (catalogs.products.errors.length > 0) {
      products = emptyEntityResult(true);
      errors.push(...catalogs.products.errors.slice(0, 5));
    } else {
      const r = await healOptixProductFieldMismatches(
        ownerUserId,
        catalogs.products.skus.map((s) => ({
          sku: s.sku,
          name: s.name,
          price: s.price,
          stock: s.stock,
          visibility: s.visibility,
          isActive: s.isActive,
          styleCode: s.styleCode,
        }))
      );
      products = { healed: r.healed, checked: r.checked, skipped_dirty_catalog: false };
    }
  }

  if (want.has('customers')) {
    if (catalogs.customers.errors.length > 0) {
      customers = emptyEntityResult(true);
      errors.push(...catalogs.customers.errors.slice(0, 5));
    } else {
      customers = await healOptixCustomerFieldMismatches(ownerUserId, catalogs.customers.contacts);
    }
  }

  if (want.has('internal-customers')) {
    if (catalogs.internalCustomers.errors.length > 0) {
      internalCustomers = emptyEntityResult(true);
      errors.push(...catalogs.internalCustomers.errors.slice(0, 5));
    } else {
      internalCustomers = await healOptixInternalCustomerFieldMismatches(
        ownerUserId,
        catalogs.internalCustomers.contacts
      );
    }
  }

  if (want.has('suppliers')) {
    if (catalogs.suppliers.errors.length > 0) {
      suppliers = emptyEntityResult(true);
      errors.push(...catalogs.suppliers.errors.slice(0, 5));
    } else {
      suppliers = await healOptixSupplierFieldMismatches(ownerUserId, catalogs.suppliers.contacts);
    }
  }

  if (want.has('branches')) {
    if (catalogs.branches.errors.length > 0) {
      branches = emptyEntityResult(true);
      errors.push(...catalogs.branches.errors.slice(0, 5));
    } else {
      branches = await healOptixBranchFieldMismatches(ownerUserId, catalogs.branches.branches);
    }
  }

  if (want.has('stock')) {
    if (catalogs.stockLevels.errors.length > 0) {
      stock = emptyEntityResult(true);
      errors.push(...catalogs.stockLevels.errors.slice(0, 5));
    } else {
      const r = await healOptixStockFieldMismatches(ownerUserId, catalogs.stockLevels.stockLevels);
      stock = { healed: r.healed, checked: r.checked, skipped_dirty_catalog: false };
    }
  }

  const healed_total =
    products.healed +
    customers.healed +
    suppliers.healed +
    branches.healed +
    internalCustomers.healed +
    stock.healed;

  if (healed_total > 0) {
    console.log(
      `[Cin7 field heal] owner=${ownerUserId} total=${healed_total} ` +
        `products=${products.healed} customers=${customers.healed} ` +
        `suppliers=${suppliers.healed} branches=${branches.healed} ` +
        `internal=${internalCustomers.healed} stock=${stock.healed}`
    );
  }

  return {
    by_entity: {
      products,
      customers,
      suppliers,
      branches,
      internal_customers: internalCustomers,
      stock,
    },
    healed_total,
    errors: [...new Set(errors)].slice(0, 20),
  };
}

/** Full Omni catalog pull → heal all (or selected) field-mismatch entities. */
export async function healOptixFieldMismatchesFromLiveCin7(
  ownerUserId: string,
  omniCreds: Cin7OmniCredentials,
  options?: { entities?: Cin7FieldHealEntity[] }
): Promise<Cin7FieldHealResult> {
  const catalogs = await fetchAllOmniMasterCatalogsSequential(
    omniCreds,
    getReconCatalogFetchOptions()
  );
  return healOptixFieldMismatchesFromCatalogs(ownerUserId, catalogs, options);
}

/** One-line summary for notes / toasts. */
export function summarizeFieldHeal(result: Cin7FieldHealResult): string {
  if (result.healed_total === 0) return 'No field diffs to heal.';
  const parts: string[] = [];
  const e = result.by_entity;
  if (e.products.healed) parts.push(`${e.products.healed} products`);
  if (e.customers.healed) parts.push(`${e.customers.healed} customers`);
  if (e.suppliers.healed) parts.push(`${e.suppliers.healed} suppliers`);
  if (e.branches.healed) parts.push(`${e.branches.healed} branches`);
  if (e.internal_customers.healed) parts.push(`${e.internal_customers.healed} internal`);
  if (e.stock.healed) parts.push(`${e.stock.healed} stock`);
  return `Aligned ${result.healed_total} row${result.healed_total === 1 ? '' : 's'} to Cin7 (${parts.join(', ')}).`;
}
