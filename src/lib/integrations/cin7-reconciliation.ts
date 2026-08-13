import { prisma } from '@/lib/db/prisma';
import {
  fetchAllOmniMasterCatalogsSequential,
  fetchFullOmniBranchCatalog,
  fetchFullOmniContactsByType,
  fetchFullOmniProductCatalog,
  getReconCatalogFetchOptions,
  resolveCin7SyncSource,
  type Cin7OmniMasterCatalogs,
} from '@/lib/integrations/cin7-catalog-fetch';
import {
  fetchCin7CustomerPage,
  fetchCin7ProductPage,
  getCin7CoreCredentials,
  pingCin7Core,
} from '@/lib/integrations/cin7-core';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import {
  buildProductFieldMismatchBreakdown,
  emptyProductFieldMismatchBreakdown,
  productFieldsMatch,
  type Cin7ProductFieldMismatchBreakdown,
} from '@/lib/integrations/cin7-product-heal';
import {
  buildReferenceExceptionItems,
  buildReferenceExceptionSummary,
  getCin7ReferenceCounts,
  loadOptixReferenceSnapshot,
  referenceCountsFromOptixSnapshot,
  type Cin7ReferenceCounts,
  type Cin7ReferenceExceptionEntity,
  type Cin7ReferenceExceptionSummary,
} from '@/lib/integrations/cin7-reconciliation-reference';
import {
  buildSyncCompletenessSummary,
  type Cin7SyncCompletenessRow,
} from '@/lib/integrations/cin7-sync-completeness';
import {
  getCin7PageSize,
  getCin7SyncMaxPages,
  shouldContinueCin7SyncPage,
} from '@/lib/integrations/cin7-sync-config';

const CIN7_PRODUCT_CATEGORY_PREFIX = 'Cin7';

export type Cin7StockCatalogEvidence = {
  cin7_rows: number;
  cin7_reported_total: number | null;
  pages_fetched: number;
  truncated: boolean;
  complete: boolean;
};

export function buildStockCatalogEvidence(stock: {
  stockLevels: { length: number };
  pages_fetched: number;
  errors: string[];
  reported_total?: number | null;
  truncated?: boolean;
}): Cin7StockCatalogEvidence {
  const truncated = Boolean(stock.truncated);
  return {
    cin7_rows: stock.stockLevels.length,
    cin7_reported_total: stock.reported_total ?? null,
    pages_fetched: stock.pages_fetched,
    truncated,
    complete: stock.errors.length === 0 && !truncated,
  };
}

export type Cin7ReconciliationSnapshot = {
  source: 'core' | 'omni' | 'none';
  checked_at: string;
  cin7: {
    products: {
      styles: number;
      skus: number;
      by_visibility: Record<string, number>;
    };
    customers: number;
    internal_customers: number;
    suppliers: number;
    branches: number;
    reference: Cin7ReferenceCounts | null;
  };
  optix: {
    products: {
      total_cin7_sourced: number;
      skus: number;
      styles: number;
      by_visibility: Record<string, number>;
    };
    customers: {
      total: number;
      cin7_linked: number;
      extra_without_cin7_id: number;
    };
    internal_customers: number;
    suppliers: { total: number; cin7_linked: number; extra_without_cin7_id: number };
    branches: { total: number };
    reference: Cin7ReferenceCounts | null;
  };
  exceptions_summary: {
    products_missing_in_optix: number;
    products_extra_in_optix: number;
    products_field_mismatches: number;
    customers_missing_in_optix: number;
    customers_extra_in_optix: number;
    customers_field_mismatches: number;
    suppliers_missing_in_optix: number;
    suppliers_extra_in_optix: number;
    suppliers_field_mismatches: number;
    branches_missing_in_optix: number;
    branches_extra_in_optix: number;
    branches_field_mismatches: number;
    internal_customers_missing_in_optix: number;
    internal_customers_extra_in_optix: number;
    internal_customers_field_mismatches: number;
  } & Cin7ReferenceExceptionSummary;
  fetch_meta: {
    products_pages?: number;
    customers_pages?: number;
    suppliers_pages?: number;
    branches_pages?: number;
    stock_pages?: number;
    errors: string[];
    /** True when Cin7 pull was truncated/errored — exception zeros are not trustworthy. */
    incomplete?: boolean;
  };
  /**
   * Durable Cin7 stock walk vs Omni Total. Truncated snapshots are not sign-off numbers
   * (e.g. 9,805 fetched while Cin7 Total still reads ~10,500).
   */
  stock_evidence?: Cin7StockCatalogEvidence;
  notes: string[];
  sync_completeness?: Cin7SyncCompletenessRow[];
  /** When true, UI must not treat exception summary as sign-off clean. */
  acceptance_blocked?: boolean;
  /** Per-field product mismatch counts (matched SKUs only). */
  products_field_mismatch_breakdown?: Cin7ProductFieldMismatchBreakdown;
};

export type Cin7ExceptionEntity =
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'branches'
  | 'internal-customers'
  | Cin7ReferenceExceptionEntity;

export type Cin7ExceptionRecord = {
  cin7_id: string;
  label: string;
  reason: 'missing_in_optix' | 'extra_in_optix' | 'field_mismatch' | 'skipped_on_sync';
  fields?: Array<{ field: string; cin7_value: string; optix_value: string }>;
  skipped_reason?: string;
};

function uniqueNotes(notes: string[]): string[] {
  return [...new Set(notes)];
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

async function loadOptixMasterForReconciliation(ownerUserId: string) {
  const [
    productRows,
    customerRows,
    internalCustomerRows,
    supplierRows,
    branchRows,
    customerTotal,
    customerExtraWithoutId,
    supplierTotal,
    supplierExtraWithoutId,
    referenceSnapshot,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { ownerUserId, category: { startsWith: CIN7_PRODUCT_CATEGORY_PREFIX } },
      select: {
        sku: true,
        name: true,
        price: true,
        stock: true,
        isActive: true,
        cin7StyleCode: true,
        cin7Visibility: true,
        category: true,
      },
    }),
    prisma.customer.findMany({
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
    }),
    prisma.customer.findMany({
      where: { ownerUserId, cin7ContactType: { equals: 'Internal', mode: 'insensitive' } },
      select: {
        cin7ContactId: true,
        companyName: true,
        email: true,
        phone: true,
        city: true,
      },
    }),
    prisma.supplier.findMany({
      where: { ownerUserId, supplierCode: { startsWith: 'cin7:' } },
      select: { supplierCode: true, companyName: true, email: true, phone: true },
    }),
    prisma.cin7Branch.findMany({
      where: { ownerUserId },
      select: {
        cin7BranchId: true,
        name: true,
        city: true,
        state: true,
        postCode: true,
        isActive: true,
      },
    }),
    prisma.customer.count({ where: { ownerUserId } }),
    prisma.customer.count({
      where: {
        ownerUserId,
        cin7ContactId: null,
        OR: [
          { cin7ContactType: { equals: 'Customer', mode: 'insensitive' } },
          { cin7ContactType: null },
        ],
      },
    }),
    prisma.supplier.count({ where: { ownerUserId } }),
    prisma.supplier.count({
      where: { ownerUserId, NOT: { supplierCode: { startsWith: 'cin7:' } } },
    }),
    loadOptixReferenceSnapshot(ownerUserId),
  ]);

  return {
    productRows,
    customerRows,
    internalCustomerRows,
    internalCustomerCount: internalCustomerRows.length,
    supplierRows,
    branchRows,
    customerTotal,
    customerExtraWithoutId,
    supplierTotal,
    supplierExtraWithoutId,
    referenceSnapshot,
  };
}

export async function buildCin7Reconciliation(
  ownerUserId: string
): Promise<Cin7ReconciliationSnapshot> {
  const wallStart = Date.now();
  const notes: string[] = [];
  const fetchErrors: string[] = [];
  const coreCreds = getCin7CoreCredentials();
  const omniCreds = getCin7OmniCredentials();

  // Ping Core/Omni in parallel — sequential pings wasted a round-trip.
  const [coreLive, omniLive] = await Promise.all([
    coreCreds ? pingCin7Core(coreCreds) : Promise.resolve(false),
    omniCreds ? pingCin7Omni(omniCreds) : Promise.resolve(false),
  ]);
  const source = resolveCin7SyncSource(coreLive, omniLive);

  const cin7Products = { styles: 0, skus: 0, by_visibility: {} as Record<string, number> };
  let cin7Customers = 0;
  let cin7InternalCustomers = 0;
  let cin7Suppliers = 0;
  let cin7Branches = 0;

  const cin7ProductBySku = new Map<
    string,
    { name: string; price: number; stock: number; visibility: string; isActive: boolean }
  >();
  const cin7CustomerById = new Map<
    string,
    { companyName: string; email: string; phone?: string; city?: string }
  >();
  const cin7InternalCustomerById = new Map<
    string,
    { companyName: string; email: string; phone?: string; city?: string }
  >();
  const cin7SupplierById = new Map<
    string,
    { companyName: string; email?: string; phone?: string }
  >();
  const cin7BranchById = new Map<
    string,
    { name: string; city?: string; state?: string; postCode?: string; isActive: boolean }
  >();

  const fetchMeta: Cin7ReconciliationSnapshot['fetch_meta'] = { errors: [] };
  let omniCatalogs: Cin7OmniMasterCatalogs | null = null;

  // Optix DB work runs in parallel with the Cin7 catalog pull (independent I/O).
  const optixPromise = loadOptixMasterForReconciliation(ownerUserId);

  if (source === 'omni' && omniCreds) {
    const catalogs = await fetchAllOmniMasterCatalogsSequential(
      omniCreds,
      getReconCatalogFetchOptions()
    );
    omniCatalogs = catalogs;
    const {
      products: productCatalog,
      customers,
      internalCustomers,
      suppliers,
      branches,
    } = catalogs;

    fetchMeta.products_pages = productCatalog.pages_fetched;
    fetchMeta.customers_pages = customers.pages_fetched;
    fetchMeta.suppliers_pages = suppliers.pages_fetched;
    fetchMeta.branches_pages = branches.pages_fetched;
    fetchMeta.stock_pages = catalogs.stockLevels.pages_fetched;
    fetchErrors.push(
      ...productCatalog.errors,
      ...customers.errors,
      ...internalCustomers.errors,
      ...suppliers.errors,
      ...branches.errors,
      ...catalogs.stockLevels.errors,
      ...catalogs.productCategories.errors
    );

    cin7Products.styles = productCatalog.styles;
    cin7Products.skus = productCatalog.skus.length;
    cin7Products.by_visibility = productCatalog.by_visibility;
    for (const sku of productCatalog.skus) {
      cin7ProductBySku.set(sku.sku, sku);
    }

    cin7Customers = customers.contacts.length;
    for (const c of customers.contacts) {
      cin7CustomerById.set(c.cin7ContactId, {
        companyName: c.companyName,
        email: c.email,
        phone: c.phone,
        city: c.city,
      });
    }

    cin7InternalCustomers = internalCustomers.contacts.length;
    for (const c of internalCustomers.contacts) {
      cin7InternalCustomerById.set(c.cin7ContactId, {
        companyName: c.companyName,
        email: c.email,
        phone: c.phone,
        city: c.city,
      });
    }

    cin7Suppliers = suppliers.contacts.length;
    for (const s of suppliers.contacts) {
      cin7SupplierById.set(s.cin7ContactId, {
        companyName: s.companyName,
        email: s.email,
        phone: s.phone,
      });
    }

    cin7Branches = branches.branches.length;
    for (const b of branches.branches) {
      cin7BranchById.set(b.cin7BranchId, {
        name: b.name,
        city: b.city,
        state: b.state,
        postCode: b.postCode,
        isActive: b.isActive,
      });
    }

    notes.push(
      'Cin7 is the source of truth — inactive products and all visibility types are included.'
    );
    notes.push('Style count = distinct StyleCode values; SKU count includes all variants.');
  } else if (source === 'core' && coreCreds) {
    const pageSize = getCin7PageSize();
    const maxPages = getCin7SyncMaxPages();
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, total } = await fetchCin7ProductPage(coreCreds, page, pageSize);
      if (rows.length === 0) break;
      cin7Products.styles += rows.length;
      for (const row of rows) {
        const sku = String(row.Sku ?? '').trim();
        if (!sku) continue;
        cin7Products.skus += 1;
        cin7ProductBySku.set(sku, {
          name: String(row.Name ?? sku),
          price: Number(row.Price ?? row.SellPrice ?? 0) || 0,
          stock: Math.max(0, Math.floor(Number(row.Available ?? 0))),
          visibility: 'Cin7 Core',
          isActive: true,
        });
        cin7Products.by_visibility['Cin7 Core'] =
          (cin7Products.by_visibility['Cin7 Core'] ?? 0) + 1;
      }
      if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, maxPages)) break;
    }
    for (let page = 1; page <= maxPages; page += 1) {
      const { rows, total } = await fetchCin7CustomerPage(coreCreds, page, pageSize);
      if (rows.length === 0) break;
      for (const row of rows) {
        const id = String(row.ID ?? '').trim();
        if (!id) continue;
        cin7Customers += 1;
        cin7CustomerById.set(id, {
          companyName: String(row.Name ?? 'Cin7 customer'),
          email: String(row.Email ?? ''),
          phone: row.Phone ? String(row.Phone) : undefined,
          city: row.City ? String(row.City) : undefined,
        });
      }
      if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, maxPages)) break;
    }
    notes.push('Supplier, branch, and internal customer reconciliation require Cin7 Omni.');
  } else {
    notes.push('Cin7 is not connected — Optix counts only.');
  }

  const optixStarted = Date.now();
  let {
    productRows,
    customerRows,
    internalCustomerRows,
    internalCustomerCount,
    supplierRows,
    branchRows,
    customerTotal,
    customerExtraWithoutId,
    supplierTotal,
    supplierExtraWithoutId,
    referenceSnapshot,
  } = await optixPromise;
  const optixMs = Date.now() - optixStarted;

  const rebuildOptixProductMaps = (rows: typeof productRows) => {
    const byVisibility: Record<string, number> = {};
    const styleCodes = new Set<string>();
    const bySku = new Map<
      string,
      { name: string; price: number; stock: number; visibility: string; isActive: boolean }
    >();
    for (const row of rows) {
      const visibility =
        row.cin7Visibility ??
        (row.category?.includes('·') ? row.category.split('·').pop()?.trim() : 'Unknown') ??
        'Unknown';
      byVisibility[visibility] = (byVisibility[visibility] ?? 0) + 1;
      if (row.cin7StyleCode) styleCodes.add(row.cin7StyleCode);
      bySku.set(row.sku, {
        name: row.name,
        price: Number(row.price),
        stock: row.stock,
        visibility,
        isActive: row.isActive,
      });
    }
    return { byVisibility, styleCodes, bySku };
  };

  const {
    byVisibility: optixByVisibility,
    styleCodes: optixStyleCodes,
    bySku: optixProductBySku,
  } = rebuildOptixProductMaps(productRows);

  // READ-ONLY measurement path (Toby precondition): never write Optix from recon.
  // Field heal / stock prune are separate explicit actions with their own audit logs.
  notes.push(
    'This reconciliation is read-only. It does not align, heal, or delete Optix data. Field heal is a separate logged action. Stock prune is not part of this report.'
  );

  const optixCustomerById = new Map(
    customerRows
      .filter((r) => r.cin7ContactId)
      .map((r) => [
        r.cin7ContactId!,
        { companyName: r.companyName, email: r.email ?? '', phone: r.phone, city: r.city },
      ])
  );

  const optixInternalCustomerById = new Map(
    internalCustomerRows
      .filter((r) => r.cin7ContactId)
      .map((r) => [
        r.cin7ContactId!,
        { companyName: r.companyName, email: r.email ?? '', phone: r.phone, city: r.city },
      ])
  );

  const optixSupplierById = new Map(
    supplierRows.map((r) => {
      const id = r.supplierCode.replace(/^cin7:/, '');
      return [id, { companyName: r.companyName, email: r.email, phone: r.phone }] as const;
    })
  );

  const optixBranchById = new Map(
    branchRows.map((r) => [
      r.cin7BranchId,
      { name: r.name, city: r.city, state: r.state, postCode: r.postCode, isActive: r.isActive },
    ])
  );

  const countExceptions = <TCin7 extends string, TOptix extends string>(
    cin7Map: Map<TCin7, unknown>,
    optixMap: Map<TOptix, unknown>,
    fieldCompare?: (cin7Key: TCin7, optixKey: TOptix) => boolean
  ) => {
    let missing = 0;
    let extra = 0;
    let fieldMismatch = 0;
    for (const key of cin7Map.keys()) {
      if (!optixMap.has(key as unknown as TOptix)) {
        missing += 1;
      } else if (fieldCompare && !fieldCompare(key, key as unknown as TOptix)) {
        fieldMismatch += 1;
      }
    }
    for (const key of optixMap.keys()) {
      if (!cin7Map.has(key as unknown as TCin7)) extra += 1;
    }
    return { missing, extra, fieldMismatch };
  };

  const productExceptions = countExceptions(cin7ProductBySku, optixProductBySku, (sku) => {
    const cin7 = cin7ProductBySku.get(sku)!;
    const optix = optixProductBySku.get(sku)!;
    return productFieldsMatch({ sku, ...optix }, { sku, ...cin7 });
  });

  const productsFieldMismatchBreakdown = buildProductFieldMismatchBreakdown(
    new Map(
      [...cin7ProductBySku.entries()].map(([sku, row]) => [
        sku,
        {
          sku,
          name: row.name,
          price: row.price,
          stock: row.stock,
          visibility: row.visibility,
          isActive: row.isActive,
        },
      ])
    ),
    new Map(
      [...optixProductBySku.entries()].map(([sku, row]) => [
        sku,
        {
          sku,
          name: row.name,
          price: row.price,
          stock: row.stock,
          visibility: row.visibility,
          isActive: row.isActive,
        },
      ])
    )
  ).breakdown;

  const customerExceptions = countExceptions(cin7CustomerById, optixCustomerById, (id) => {
    const cin7 = cin7CustomerById.get(id)!;
    const optix = optixCustomerById.get(id)!;
    return (
      normalize(optix.companyName) === normalize(cin7.companyName) &&
      normalize(optix.email) === normalize(cin7.email) &&
      normalize(optix.phone) === normalize(cin7.phone) &&
      normalize(optix.city) === normalize(cin7.city)
    );
  });

  const supplierExceptions = countExceptions(cin7SupplierById, optixSupplierById, (id) => {
    const cin7 = cin7SupplierById.get(id)!;
    const optix = optixSupplierById.get(id)!;
    return (
      normalize(optix.companyName) === normalize(cin7.companyName) &&
      normalize(optix.email) === normalize(cin7.email) &&
      normalize(optix.phone) === normalize(cin7.phone)
    );
  });

  const internalCustomerExceptions = countExceptions(
    cin7InternalCustomerById,
    optixInternalCustomerById,
    (id) => {
      const cin7 = cin7InternalCustomerById.get(id)!;
      const optix = optixInternalCustomerById.get(id)!;
      return (
        normalize(optix.companyName) === normalize(cin7.companyName) &&
        normalize(optix.email) === normalize(cin7.email)
      );
    }
  );

  const branchExceptions = countExceptions(cin7BranchById, optixBranchById, (id) => {
    const cin7 = cin7BranchById.get(id)!;
    const optix = optixBranchById.get(id)!;
    return (
      normalize(optix.name) === normalize(cin7.name) &&
      normalize(optix.city) === normalize(cin7.city) &&
      normalize(optix.state) === normalize(cin7.state) &&
      normalize(optix.postCode) === normalize(cin7.postCode) &&
      optix.isActive === cin7.isActive
    );
  });

  const customerLinked = customerRows.length;
  const supplierLinked = supplierRows.length;

  const catalogFetchIncomplete =
    fetchErrors.length > 0 ||
    Boolean(
      omniCatalogs &&
      (omniCatalogs.products.errors.length > 0 ||
        omniCatalogs.customers.errors.length > 0 ||
        omniCatalogs.suppliers.errors.length > 0 ||
        omniCatalogs.branches.errors.length > 0 ||
        omniCatalogs.stockLevels.errors.length > 0 ||
        omniCatalogs.stockLevels.truncated ||
        omniCatalogs.productCategories.errors.length > 0)
    );

  const stockEvidence = omniCatalogs
    ? buildStockCatalogEvidence(omniCatalogs.stockLevels)
    : undefined;

  if (fetchErrors.length > 0) {
    notes.push(`Cin7 fetch warnings: ${fetchErrors.slice(0, 3).join('; ')}`);
  }
  notes.push(
    'Use the exception report to review individual records — no data is deleted during sync.'
  );

  fetchMeta.errors = [...new Set(fetchErrors)];
  fetchMeta.incomplete = catalogFetchIncomplete || source === 'none';

  const emptyReferenceExceptions: Cin7ReferenceExceptionSummary = {
    product_categories_missing_in_optix: 0,
    product_categories_extra_in_optix: 0,
    brands_missing_in_optix: 0,
    brands_extra_in_optix: 0,
    price_lists_missing_in_optix: 0,
    price_lists_extra_in_optix: 0,
    tax_codes_missing_in_optix: 0,
    tax_codes_extra_in_optix: 0,
    units_of_measure_missing_in_optix: 0,
    units_of_measure_extra_in_optix: 0,
    stock_levels_missing_in_optix: 0,
    stock_levels_extra_in_optix: 0,
    stock_levels_field_mismatches: 0,
  };

  let referenceCin7: Cin7ReferenceCounts | null = null;
  let referenceOptix: Cin7ReferenceCounts | null = null;
  let referenceExceptions = emptyReferenceExceptions;

  if (omniCatalogs) {
    referenceCin7 = getCin7ReferenceCounts(omniCatalogs);
    referenceOptix = referenceCountsFromOptixSnapshot(referenceSnapshot);
    referenceExceptions = await buildReferenceExceptionSummary(
      ownerUserId,
      omniCatalogs,
      referenceSnapshot
    );
    notes.push(
      'Warehouses in Cin7 Omni map to Branches; stock levels are per branch from /v1/Stock.'
    );
    notes.push(
      'Brands, price lists, units of measure, and tax codes are derived from product and contact data.'
    );
  }

  if (source === 'none') {
    notes.push(
      'Cin7 is unreachable — counts below are not valid for acceptance. Reconnect and refresh from live Cin7.'
    );
  }
  if (stockEvidence) {
    if (stockEvidence.truncated) {
      notes.push(
        `Durable Cin7 stock snapshot is truncated: fetched ${stockEvidence.cin7_rows} of Cin7 Total ${stockEvidence.cin7_reported_total}. This is not a sign-off stock number (prior complete readings were ~10,500).`
      );
    } else if (stockEvidence.cin7_reported_total == null) {
      notes.push(
        `Durable Cin7 stock snapshot fetched ${stockEvidence.cin7_rows} rows; Cin7 did not report Total, so completeness cannot be proven against the ~10,500 prior readings.`
      );
    } else {
      notes.push(
        `Durable Cin7 stock snapshot is complete: ${stockEvidence.cin7_rows} rows matching Cin7 Total ${stockEvidence.cin7_reported_total}.`
      );
    }
  }
  if (catalogFetchIncomplete) {
    notes.push(
      'Cin7 fetch was incomplete — do not use this snapshot for sign-off until a clean live refresh succeeds.'
    );
    notes.push(
      'Exception summary is masked while the Cin7 pull is incomplete (fail-closed — zeros would be misleading).'
    );
  }

  // Fail-closed: never present clean zero exceptions against a truncated Cin7 pull.
  const maskExceptions = source === 'none' || catalogFetchIncomplete;
  const blockedReferenceExceptions: Cin7ReferenceExceptionSummary = {
    ...emptyReferenceExceptions,
    stock_levels_missing_in_optix: 1,
  };

  const snapshotWithoutCompleteness: Cin7ReconciliationSnapshot = {
    source,
    checked_at: new Date().toISOString(),
    cin7: {
      products: cin7Products,
      customers: cin7Customers,
      internal_customers: cin7InternalCustomers,
      suppliers: cin7Suppliers,
      branches: cin7Branches,
      reference: referenceCin7,
    },
    optix: {
      products: {
        total_cin7_sourced: productRows.length,
        skus: productRows.length,
        styles: optixStyleCodes.size || productRows.length,
        by_visibility: optixByVisibility,
      },
      customers: {
        total: customerTotal,
        cin7_linked: customerLinked,
        extra_without_cin7_id: customerExtraWithoutId,
      },
      internal_customers: internalCustomerCount,
      suppliers: {
        total: supplierTotal,
        cin7_linked: supplierLinked,
        extra_without_cin7_id: supplierExtraWithoutId,
      },
      branches: { total: branchRows.length },
      reference: referenceOptix,
    },
    exceptions_summary: maskExceptions
      ? {
          products_missing_in_optix: 1,
          products_extra_in_optix: 0,
          products_field_mismatches: 0,
          customers_missing_in_optix: 1,
          customers_extra_in_optix: 0,
          customers_field_mismatches: 0,
          suppliers_missing_in_optix: 1,
          suppliers_extra_in_optix: 0,
          suppliers_field_mismatches: 0,
          branches_missing_in_optix: 1,
          branches_extra_in_optix: 0,
          branches_field_mismatches: 0,
          internal_customers_missing_in_optix: 0,
          internal_customers_extra_in_optix: 0,
          internal_customers_field_mismatches: 0,
          ...blockedReferenceExceptions,
        }
      : {
          products_missing_in_optix: productExceptions.missing,
          products_extra_in_optix: productExceptions.extra,
          products_field_mismatches: productExceptions.fieldMismatch,
          customers_missing_in_optix: customerExceptions.missing,
          customers_extra_in_optix: customerExceptions.extra,
          customers_field_mismatches: customerExceptions.fieldMismatch,
          suppliers_missing_in_optix: supplierExceptions.missing,
          suppliers_extra_in_optix: supplierExceptions.extra,
          suppliers_field_mismatches: supplierExceptions.fieldMismatch,
          branches_missing_in_optix: branchExceptions.missing,
          branches_extra_in_optix: branchExceptions.extra,
          branches_field_mismatches: branchExceptions.fieldMismatch,
          internal_customers_missing_in_optix: internalCustomerExceptions.missing,
          internal_customers_extra_in_optix: internalCustomerExceptions.extra,
          internal_customers_field_mismatches: internalCustomerExceptions.fieldMismatch,
          ...referenceExceptions,
        },
    fetch_meta: fetchMeta,
    stock_evidence: stockEvidence,
    notes: uniqueNotes(notes),
    acceptance_blocked: maskExceptions,
    products_field_mismatch_breakdown: maskExceptions
      ? emptyProductFieldMismatchBreakdown()
      : productsFieldMismatchBreakdown,
  };

  const syncCompleteness =
    source === 'omni'
      ? await buildSyncCompletenessSummary(ownerUserId, snapshotWithoutCompleteness)
      : undefined;

  if (syncCompleteness?.some((row) => row.likely_incomplete)) {
    notes.push(
      'One or more entities show fewer Optix records than Cin7 — re-run sync (resume if timed out) before signing off.'
    );
  }

  const snapshot: Cin7ReconciliationSnapshot = {
    ...snapshotWithoutCompleteness,
    notes: uniqueNotes(notes),
    sync_completeness: syncCompleteness,
  };

  console.log(
    `[Cin7 recon] total=${Date.now() - wallStart}ms optix_await=${optixMs}ms ` +
      `source=${source} cin7_skus=${cin7Products.skus} cin7_customers=${cin7Customers}`
  );

  return snapshot;
}

export async function buildCin7ExceptionReport(
  ownerUserId: string,
  entity: Cin7ExceptionEntity,
  limit = 100,
  offset = 0
): Promise<{
  entity: Cin7ExceptionEntity;
  total: number;
  offset: number;
  limit: number;
  items: Cin7ExceptionRecord[];
}> {
  const items: Cin7ExceptionRecord[] = [];
  const omniCreds = getCin7OmniCredentials();
  const omniLive = omniCreds ? await pingCin7Omni(omniCreds) : false;
  const coreCreds = getCin7CoreCredentials();
  const coreLive = coreCreds ? await pingCin7Core(coreCreds) : false;
  const source = resolveCin7SyncSource(coreLive, omniLive);

  if (source === 'none') {
    throw new Error(
      'Cin7 is not reachable. Reconnect Cin7 and refresh before reviewing the exception report.'
    );
  }

  if (entity === 'products' && source === 'omni' && omniCreds) {
    const catalog = await fetchFullOmniProductCatalog(omniCreds);
    const optixRows = await prisma.product.findMany({
      where: { ownerUserId, category: { startsWith: CIN7_PRODUCT_CATEGORY_PREFIX } },
      select: {
        sku: true,
        name: true,
        price: true,
        stock: true,
        isActive: true,
        cin7Visibility: true,
      },
    });
    const optixBySku = new Map(optixRows.map((r) => [r.sku, r]));

    for (const cin7 of catalog.skus) {
      const optix = optixBySku.get(cin7.sku);
      if (!optix) {
        items.push({ cin7_id: cin7.sku, label: cin7.name, reason: 'missing_in_optix' });
        continue;
      }
      const fields: Cin7ExceptionRecord['fields'] = [];
      if (normalize(optix.name) !== normalize(cin7.name)) {
        fields.push({ field: 'name', cin7_value: cin7.name, optix_value: optix.name });
      }
      if (Math.abs(optix.price - cin7.price) > 0.01) {
        fields.push({
          field: 'price',
          cin7_value: String(cin7.price),
          optix_value: String(optix.price),
        });
      }
      if (optix.stock !== cin7.stock) {
        fields.push({
          field: 'stock',
          cin7_value: String(cin7.stock),
          optix_value: String(optix.stock),
        });
      }
      if (optix.isActive !== cin7.isActive) {
        fields.push({
          field: 'is_active',
          cin7_value: String(cin7.isActive),
          optix_value: String(optix.isActive),
        });
      }
      const optixVis = optix.cin7Visibility ?? '';
      if (normalize(optixVis) !== normalize(cin7.visibility)) {
        fields.push({ field: 'visibility', cin7_value: cin7.visibility, optix_value: optixVis });
      }
      if (fields.length > 0) {
        items.push({ cin7_id: cin7.sku, label: cin7.name, reason: 'field_mismatch', fields });
      }
    }
    for (const optix of optixRows) {
      if (!catalog.skus.some((c) => c.sku === optix.sku)) {
        items.push({ cin7_id: optix.sku, label: optix.name, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'customers' && source === 'omni' && omniCreds) {
    const { contacts } = await fetchFullOmniContactsByType(omniCreds, ['Customer']);
    const optixRows = await prisma.customer.findMany({
      where: {
        ownerUserId,
        cin7ContactId: { not: null },
        OR: [
          { cin7ContactType: { equals: 'Customer', mode: 'insensitive' } },
          { cin7ContactType: null },
        ],
      },
      select: { cin7ContactId: true, companyName: true, email: true, phone: true, city: true },
    });
    const optixById = new Map(
      optixRows.filter((r) => r.cin7ContactId).map((r) => [r.cin7ContactId!, r])
    );

    for (const cin7 of contacts) {
      const optix = optixById.get(cin7.cin7ContactId);
      if (!optix) {
        items.push({
          cin7_id: cin7.cin7ContactId,
          label: cin7.companyName,
          reason: 'missing_in_optix',
        });
        continue;
      }
      const fields: Cin7ExceptionRecord['fields'] = [];
      if (normalize(optix.companyName) !== normalize(cin7.companyName)) {
        fields.push({
          field: 'company_name',
          cin7_value: cin7.companyName,
          optix_value: optix.companyName,
        });
      }
      if (normalize(optix.email ?? '') !== normalize(cin7.email)) {
        fields.push({ field: 'email', cin7_value: cin7.email, optix_value: optix.email ?? '' });
      }
      if (normalize(optix.phone ?? '') !== normalize(cin7.phone ?? '')) {
        fields.push({
          field: 'phone',
          cin7_value: cin7.phone ?? '',
          optix_value: optix.phone ?? '',
        });
      }
      if (normalize(optix.city ?? '') !== normalize(cin7.city ?? '')) {
        fields.push({ field: 'city', cin7_value: cin7.city ?? '', optix_value: optix.city ?? '' });
      }
      if (fields.length > 0) {
        items.push({
          cin7_id: cin7.cin7ContactId,
          label: cin7.companyName,
          reason: 'field_mismatch',
          fields,
        });
      }
    }
    for (const optix of optixRows) {
      if (!optix.cin7ContactId) continue;
      if (!contacts.some((c) => c.cin7ContactId === optix.cin7ContactId)) {
        items.push({
          cin7_id: optix.cin7ContactId,
          label: optix.companyName,
          reason: 'extra_in_optix',
        });
      }
    }
  }

  if (entity === 'suppliers' && source === 'omni' && omniCreds) {
    const { contacts } = await fetchFullOmniContactsByType(omniCreds, ['Supplier']);
    const optixRows = await prisma.supplier.findMany({
      where: { ownerUserId, supplierCode: { startsWith: 'cin7:' } },
      select: { supplierCode: true, companyName: true, email: true, phone: true },
    });
    const optixById = new Map(optixRows.map((r) => [r.supplierCode.replace(/^cin7:/, ''), r]));

    for (const cin7 of contacts) {
      const optix = optixById.get(cin7.cin7ContactId);
      if (!optix) {
        items.push({
          cin7_id: cin7.cin7ContactId,
          label: cin7.companyName,
          reason: 'missing_in_optix',
        });
        continue;
      }
      const fields: Cin7ExceptionRecord['fields'] = [];
      if (normalize(optix.companyName) !== normalize(cin7.companyName)) {
        fields.push({
          field: 'company_name',
          cin7_value: cin7.companyName,
          optix_value: optix.companyName,
        });
      }
      if (normalize(optix.email ?? '') !== normalize(cin7.email)) {
        fields.push({ field: 'email', cin7_value: cin7.email, optix_value: optix.email ?? '' });
      }
      if (normalize(optix.phone ?? '') !== normalize(cin7.phone ?? '')) {
        fields.push({
          field: 'phone',
          cin7_value: cin7.phone ?? '',
          optix_value: optix.phone ?? '',
        });
      }
      if (fields.length > 0) {
        items.push({
          cin7_id: cin7.cin7ContactId,
          label: cin7.companyName,
          reason: 'field_mismatch',
          fields,
        });
      }
    }
    for (const [id, optix] of optixById) {
      if (!contacts.some((c) => c.cin7ContactId === id)) {
        items.push({ cin7_id: id, label: optix.companyName, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'branches' && source === 'omni' && omniCreds) {
    const { branches } = await fetchFullOmniBranchCatalog(omniCreds);
    const optixRows = await prisma.cin7Branch.findMany({ where: { ownerUserId } });
    const optixById = new Map(optixRows.map((r) => [r.cin7BranchId, r]));

    for (const cin7 of branches) {
      const optix = optixById.get(cin7.cin7BranchId);
      if (!optix) {
        items.push({ cin7_id: cin7.cin7BranchId, label: cin7.name, reason: 'missing_in_optix' });
        continue;
      }
      const fields: Cin7ExceptionRecord['fields'] = [];
      if (normalize(optix.name) !== normalize(cin7.name)) {
        fields.push({ field: 'name', cin7_value: cin7.name, optix_value: optix.name });
      }
      if (normalize(optix.city ?? '') !== normalize(cin7.city ?? '')) {
        fields.push({ field: 'city', cin7_value: cin7.city ?? '', optix_value: optix.city ?? '' });
      }
      if (normalize(optix.state ?? '') !== normalize(cin7.state ?? '')) {
        fields.push({
          field: 'state',
          cin7_value: cin7.state ?? '',
          optix_value: optix.state ?? '',
        });
      }
      if (normalize(optix.postCode ?? '') !== normalize(cin7.postCode ?? '')) {
        fields.push({
          field: 'post_code',
          cin7_value: cin7.postCode ?? '',
          optix_value: optix.postCode ?? '',
        });
      }
      if (optix.isActive !== cin7.isActive) {
        fields.push({
          field: 'is_active',
          cin7_value: String(cin7.isActive),
          optix_value: String(optix.isActive),
        });
      }
      if (fields.length > 0) {
        items.push({
          cin7_id: cin7.cin7BranchId,
          label: cin7.name,
          reason: 'field_mismatch',
          fields,
        });
      }
    }
    for (const optix of optixRows) {
      if (!branches.some((b) => b.cin7BranchId === optix.cin7BranchId)) {
        items.push({ cin7_id: optix.cin7BranchId, label: optix.name, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'internal-customers' && source === 'omni' && omniCreds) {
    const { contacts } = await fetchFullOmniContactsByType(omniCreds, ['Internal']);
    const optixRows = await prisma.customer.findMany({
      where: { ownerUserId, cin7ContactType: { equals: 'Internal', mode: 'insensitive' } },
      select: { cin7ContactId: true, companyName: true, email: true, phone: true, city: true },
    });
    const optixById = new Map(
      optixRows.filter((r) => r.cin7ContactId).map((r) => [r.cin7ContactId!, r])
    );

    for (const cin7 of contacts) {
      const optix = optixById.get(cin7.cin7ContactId);
      if (!optix) {
        items.push({
          cin7_id: cin7.cin7ContactId,
          label: cin7.companyName,
          reason: 'missing_in_optix',
        });
        continue;
      }
      const fields: Cin7ExceptionRecord['fields'] = [];
      if (normalize(optix.companyName) !== normalize(cin7.companyName)) {
        fields.push({
          field: 'company_name',
          cin7_value: cin7.companyName,
          optix_value: optix.companyName,
        });
      }
      if (normalize(optix.email ?? '') !== normalize(cin7.email)) {
        fields.push({ field: 'email', cin7_value: cin7.email, optix_value: optix.email ?? '' });
      }
      if (fields.length > 0) {
        items.push({
          cin7_id: cin7.cin7ContactId,
          label: cin7.companyName,
          reason: 'field_mismatch',
          fields,
        });
      }
    }
    for (const optix of optixRows) {
      if (!optix.cin7ContactId) continue;
      if (!contacts.some((c) => c.cin7ContactId === optix.cin7ContactId)) {
        items.push({
          cin7_id: optix.cin7ContactId,
          label: optix.companyName,
          reason: 'extra_in_optix',
        });
      }
    }
  }

  const referenceEntities: Cin7ReferenceExceptionEntity[] = [
    'product-categories',
    'brands',
    'price-lists',
    'tax-codes',
    'units-of-measure',
    'stock-levels',
    'warehouses',
  ];
  if (
    referenceEntities.includes(entity as Cin7ReferenceExceptionEntity) &&
    source === 'omni' &&
    omniCreds
  ) {
    const catalogs = await fetchAllOmniMasterCatalogsSequential(
      omniCreds,
      getReconCatalogFetchOptions()
    );
    const refItems = await buildReferenceExceptionItems(
      ownerUserId,
      entity as Cin7ReferenceExceptionEntity,
      catalogs
    );
    items.push(...refItems);
  }

  const entityType = entity === 'internal-customers' ? 'internal-customers' : entity;

  const skipRows = await prisma.cin7SyncSkipRecord.findMany({
    where: { ownerUserId, entityType },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { cin7Id: true, label: true, reason: true },
  });
  for (const row of skipRows) {
    items.push({
      cin7_id: row.cin7Id,
      label: row.label ?? row.cin7Id,
      reason: 'skipped_on_sync',
      skipped_reason: row.reason.replace(/_/g, ' '),
    });
  }

  const lastRun = await prisma.cin7SyncRun.findFirst({
    where: { ownerUserId, entityType },
    orderBy: { createdAt: 'desc' },
  });
  if (lastRun?.skipped && typeof lastRun.skipped === 'object' && skipRows.length === 0) {
    const skipped = lastRun.skipped as Record<string, number>;
    for (const [key, count] of Object.entries(skipped)) {
      if (count > 0) {
        items.push({
          cin7_id: '—',
          label: `Last sync skipped ${count} record(s)`,
          reason: 'skipped_on_sync',
          skipped_reason: key.replace(/_/g, ' '),
        });
      }
    }
  }

  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  return {
    entity,
    total: items.length,
    offset: safeOffset,
    limit: safeLimit,
    items: items.slice(safeOffset, safeOffset + safeLimit),
  };
}
