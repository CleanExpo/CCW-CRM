import { formatCin7PriceColumnLabel } from '@/lib/integrations/cin7-master-entities';
import type { Cin7OmniCredentials } from '@/lib/integrations/cin7-omni';
import {
  extractReferenceDataFromProducts,
  extractTaxCodesFromContactsAndBranches,
  fetchOmniBranchesPage,
  fetchOmniContactsPage,
  fetchOmniProductCategoriesPage,
  fetchOmniProductPage,
  fetchOmniProductsRawPage,
  fetchOmniStockPage,
  flattenOmniProducts,
  type Cin7OmniBranchRow,
  type Cin7OmniContactRow,
  type Cin7OmniProductCategoryRow,
  type Cin7OmniStockLevelRow,
} from '@/lib/integrations/cin7-omni';
import { CIN7_SYNC_SAFETY_MAX_PAGES, getCin7PageSize } from '@/lib/integrations/cin7-sync-config';

export type Cin7CatalogFetchMeta = {
  pages_fetched: number;
  errors: string[];
};

export type Cin7CatalogProductSku = {
  sku: string;
  name: string;
  price: number;
  stock: number;
  visibility: string;
  styleCode: string;
  isActive: boolean;
};

export type Cin7CatalogProducts = Cin7CatalogFetchMeta & {
  styles: number;
  skus: Cin7CatalogProductSku[];
  by_visibility: Record<string, number>;
  style_codes: Set<string>;
};

export type Cin7CatalogFetchOptions = {
  /** Delay between pages within one entity. */
  pageGapMs?: number;
  /** Delay between different entities. */
  entityGapMs?: number;
  maxPages?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getCatalogPageGapMs(): number {
  const n = Number(process.env.CIN7_CATALOG_PAGE_GAP_MS || 300);
  if (!Number.isFinite(n) || n < 0) return 300;
  return Math.min(5_000, Math.floor(n));
}

export function getCatalogEntityGapMs(): number {
  const n = Number(process.env.CIN7_CATALOG_ENTITY_GAP_MS || 1_500);
  if (!Number.isFinite(n) || n < 0) return 1_500;
  return Math.min(10_000, Math.floor(n));
}

/**
 * Gaps for live reconciliation. Default 0 — wall-clock is dominated by Cin7 latency,
 * and independent catalogs run in parallel (Retry-After still handles 429s).
 */
export function getReconCatalogFetchOptions(): Cin7CatalogFetchOptions {
  const pageRaw = Number(process.env.CIN7_RECON_PAGE_GAP_MS ?? 0);
  const entityRaw = Number(process.env.CIN7_RECON_ENTITY_GAP_MS ?? 0);
  return {
    pageGapMs: Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.min(5_000, Math.floor(pageRaw)) : 0,
    entityGapMs:
      Number.isFinite(entityRaw) && entityRaw >= 0 ? Math.min(10_000, Math.floor(entityRaw)) : 0,
  };
}

async function paginateUntilDone<T>(input: {
  maxPages?: number;
  pageGapMs?: number;
  fetchPage: (
    page: number
  ) => Promise<{ items: T[]; sourceRowCount: number; total: number | null; error?: string }>;
}): Promise<{ items: T[]; pages_fetched: number; errors: string[] }> {
  const pageSize = getCin7PageSize();
  const maxPages = input.maxPages ?? CIN7_SYNC_SAFETY_MAX_PAGES;
  const pageGapMs = input.pageGapMs ?? getCatalogPageGapMs();
  const items: T[] = [];
  const errors: string[] = [];
  let pagesFetched = 0;
  let emptyRetries = 0;
  let sourceRowsFetched = 0;
  const maxEmptyRetries = 4;

  for (let page = 1; page <= maxPages; page += 1) {
    if (page > 1 && pageGapMs > 0) {
      await sleep(pageGapMs);
    }
    const result = await input.fetchPage(page);
    pagesFetched = page;
    if (result.error) {
      errors.push(`Page ${page}: ${result.error}`);
    }
    if (result.sourceRowCount === 0) {
      // Empty + error (incl. 429) is NEVER clean EOF — retry then abort with error retained.
      if (result.error || emptyRetries > 0) {
        if (emptyRetries < maxEmptyRetries) {
          emptyRetries += 1;
          errors.push(
            `Page ${page}: empty${result.error ? ` after error (${result.error})` : ''} — retry ${emptyRetries}/${maxEmptyRetries}`
          );
          await sleep(Math.max(pageGapMs, 500) * (emptyRetries + 2));
          page -= 1;
          continue;
        }
        errors.push(`Page ${page}: giving up after empty/error — catalog incomplete`);
        break;
      }
      // Clean empty with no prior error → EOF
      break;
    }
    emptyRetries = 0;
    items.push(...result.items);
    sourceRowsFetched += result.sourceRowCount;

    // Prefer authoritative Total when Cin7 provides it.
    if (result.total != null && result.total > 0 && sourceRowsFetched >= result.total) {
      break;
    }
    // Short page is EOF when Total is missing/unreliable.
    if (result.sourceRowCount < pageSize) break;
  }

  return { items, pages_fetched: pagesFetched, errors };
}

function resolvePageGap(options?: Cin7CatalogFetchOptions): number {
  return options?.pageGapMs ?? getCatalogPageGapMs();
}

function resolveEntityGap(options?: Cin7CatalogFetchOptions): number {
  return options?.entityGapMs ?? getCatalogEntityGapMs();
}

async function entityGap(options?: Cin7CatalogFetchOptions): Promise<void> {
  const ms = resolveEntityGap(options);
  if (ms > 0) await sleep(ms);
}

/** Build product SKU catalog from already-fetched raw Omni product styles. */
export function buildProductCatalogFromRawStyles(
  rawStyles: unknown[],
  meta: Cin7CatalogFetchMeta
): Cin7CatalogProducts {
  const flat = flattenOmniProducts(rawStyles, { excludeInactive: false });
  const styleCodes = new Set<string>();
  const byVisibility: Record<string, number> = {};
  const skus: Cin7CatalogProductSku[] = [];

  for (const row of flat) {
    skus.push(row);
    if (row.styleCode) styleCodes.add(row.styleCode);
    byVisibility[row.visibility] = (byVisibility[row.visibility] ?? 0) + 1;
  }

  return {
    styles: styleCodes.size,
    skus,
    by_visibility: byVisibility,
    style_codes: styleCodes,
    pages_fetched: meta.pages_fetched,
    errors: meta.errors,
  };
}

/** Derive brands / price lists / UOM / tax codes without extra Cin7 round-trips. */
export function buildDerivedReferenceFromParts(input: {
  rawStyles: unknown[];
  customers: Cin7OmniContactRow[];
  branches: Cin7OmniBranchRow[];
}): Cin7DerivedReferenceCatalog {
  const extracted = extractReferenceDataFromProducts(input.rawStyles);
  const contactPriceColumns = input.customers
    .map((c) => c.priceColumn?.trim())
    .filter((v): v is string => Boolean(v));
  const taxCodes = extractTaxCodesFromContactsAndBranches({
    contacts: input.customers,
    branches: input.branches,
  });
  const priceColumns = new Set([...extracted.priceColumns, ...contactPriceColumns]);
  return {
    brands: extracted.brands,
    priceColumns: [...priceColumns].sort(),
    unitsOfMeasure: extracted.unitsOfMeasure,
    taxCodes,
  };
}

/** Full Cin7 Omni product catalog — includes inactive and all visibility types. */
export async function fetchFullOmniProductCatalog(
  creds: Cin7OmniCredentials,
  maxPages?: number,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7CatalogProducts> {
  const styleCodes = new Set<string>();
  const byVisibility: Record<string, number> = {};
  const skus: Cin7CatalogProductSku[] = [];

  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages: maxPages ?? options?.maxPages,
    pageGapMs: resolvePageGap(options),
    fetchPage: async (page) => {
      const result = await fetchOmniProductPage(creds, page, getCin7PageSize(), {
        excludeInactive: false,
      });
      const mapped: Cin7CatalogProductSku[] = result.rows.map((row) => ({
        sku: row.sku,
        name: row.name,
        price: row.price,
        stock: row.stock,
        visibility: row.visibility,
        styleCode: row.styleCode,
        isActive: row.isActive,
      }));
      return {
        items: mapped,
        sourceRowCount: result.sourceRowCount,
        total: result.total,
        error: result.error,
      };
    },
  });

  for (const row of items) {
    skus.push(row);
    if (row.styleCode) styleCodes.add(row.styleCode);
    byVisibility[row.visibility] = (byVisibility[row.visibility] ?? 0) + 1;
  }

  return {
    styles: styleCodes.size,
    skus,
    by_visibility: byVisibility,
    style_codes: styleCodes,
    pages_fetched,
    errors,
  };
}

/**
 * Full Cin7 Omni contacts filtered by business contact type (Customer, Supplier, Internal).
 * Walks the unfiltered Contacts feed and filters in memory — same approach as live recon.
 * Omni's server-side `where=type='…'` under-counts and must not be used for catalog completeness.
 */
export async function fetchFullOmniContactsByType(
  creds: Cin7OmniCredentials,
  allowedTypes: string[],
  maxPages?: number,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7CatalogFetchMeta & { contacts: Cin7OmniContactRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages: maxPages ?? options?.maxPages,
    pageGapMs: resolvePageGap(options),
    fetchPage: async (page) => {
      const result = await fetchOmniContactsPage(creds, page, getCin7PageSize(), {
        allowedTypes,
      });
      return {
        items: result.rows,
        sourceRowCount: result.sourceRowCount,
        total: result.total,
        error: result.error,
      };
    },
  });

  return { contacts: items, pages_fetched, errors };
}

/** All Omni contacts (no type filter) — one walk for recon partitioning. */
export async function fetchFullOmniAllContacts(
  creds: Cin7OmniCredentials,
  maxPages?: number,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7CatalogFetchMeta & { contacts: Cin7OmniContactRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages: maxPages ?? options?.maxPages,
    pageGapMs: resolvePageGap(options),
    fetchPage: async (page) => {
      const result = await fetchOmniContactsPage(creds, page, getCin7PageSize());
      return {
        items: result.rows,
        sourceRowCount: result.sourceRowCount,
        total: result.total,
        error: result.error,
      };
    },
  });
  return { contacts: items, pages_fetched, errors };
}

export function partitionOmniContactsByType(contacts: Cin7OmniContactRow[]): {
  customers: Cin7OmniContactRow[];
  internalCustomers: Cin7OmniContactRow[];
  suppliers: Cin7OmniContactRow[];
} {
  const customers: Cin7OmniContactRow[] = [];
  const internalCustomers: Cin7OmniContactRow[] = [];
  const suppliers: Cin7OmniContactRow[] = [];
  for (const c of contacts) {
    const t = c.contactType.trim().toLowerCase();
    if (t === 'customer') customers.push(c);
    else if (t === 'internal') internalCustomers.push(c);
    else if (t === 'supplier') suppliers.push(c);
  }
  return { customers, internalCustomers, suppliers };
}

/** Full Cin7 Omni branch catalog. */
export async function fetchFullOmniBranchCatalog(
  creds: Cin7OmniCredentials,
  maxPages?: number,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7CatalogFetchMeta & { branches: Cin7OmniBranchRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages: maxPages ?? options?.maxPages,
    pageGapMs: resolvePageGap(options),
    fetchPage: async (page) => {
      const result = await fetchOmniBranchesPage(creds, page, getCin7PageSize());
      return {
        items: result.rows,
        sourceRowCount: result.sourceRowCount,
        total: result.total,
        error: result.error,
      };
    },
  });

  return { branches: items, pages_fetched, errors };
}

export async function fetchFullOmniProductCategoryCatalog(
  creds: Cin7OmniCredentials,
  maxPages?: number,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7CatalogFetchMeta & { categories: Cin7OmniProductCategoryRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages: maxPages ?? options?.maxPages,
    pageGapMs: resolvePageGap(options),
    fetchPage: async (page) => {
      const result = await fetchOmniProductCategoriesPage(creds, page, getCin7PageSize());
      return {
        items: result.rows,
        sourceRowCount: result.sourceRowCount,
        total: result.total,
        error: result.error,
      };
    },
  });
  return { categories: items, pages_fetched, errors };
}

export async function fetchFullOmniStockCatalog(
  creds: Cin7OmniCredentials,
  maxPages?: number,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7CatalogFetchMeta & { stockLevels: Cin7OmniStockLevelRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages: maxPages ?? options?.maxPages,
    pageGapMs: resolvePageGap(options),
    fetchPage: async (page) => {
      const result = await fetchOmniStockPage(creds, page, getCin7PageSize());
      return {
        items: result.rows,
        sourceRowCount: result.sourceRowCount,
        total: result.total,
        error: result.error,
      };
    },
  });
  return { stockLevels: items, pages_fetched, errors };
}

export async function fetchFullOmniProductsRawCatalog(
  creds: Cin7OmniCredentials,
  maxPages?: number,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7CatalogFetchMeta & { styles: unknown[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages: maxPages ?? options?.maxPages,
    pageGapMs: resolvePageGap(options),
    fetchPage: async (page) => {
      const result = await fetchOmniProductsRawPage(creds, page, getCin7PageSize());
      return {
        items: result.rows,
        sourceRowCount: result.sourceRowCount,
        total: result.total,
        error: result.error,
      };
    },
  });
  return { styles: items, pages_fetched, errors };
}

export type Cin7DerivedReferenceCatalog = {
  brands: string[];
  priceColumns: string[];
  unitsOfMeasure: string[];
  taxCodes: string[];
};

export async function fetchDerivedReferenceCatalog(
  creds: Cin7OmniCredentials,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7DerivedReferenceCatalog & Cin7CatalogFetchMeta> {
  const rawProducts = await fetchFullOmniProductsRawCatalog(creds, undefined, options);
  await entityGap(options);
  const customers = await fetchFullOmniContactsByType(creds, ['Customer'], undefined, options);
  await entityGap(options);
  const branches = await fetchFullOmniBranchCatalog(creds, undefined, options);

  const derived = buildDerivedReferenceFromParts({
    rawStyles: rawProducts.styles,
    customers: customers.contacts,
    branches: branches.branches,
  });

  return {
    ...derived,
    pages_fetched: rawProducts.pages_fetched + customers.pages_fetched + branches.pages_fetched,
    errors: [...rawProducts.errors, ...customers.errors, ...branches.errors],
  };
}

export function mapPriceColumnLabels(
  columns: string[]
): Array<{ cin7PriceColumn: string; name: string }> {
  return columns.map((cin7PriceColumn) => ({
    cin7PriceColumn,
    name: formatCin7PriceColumnLabel(cin7PriceColumn),
  }));
}

export type Cin7OmniMasterCatalogs = {
  products: Cin7CatalogProducts;
  customers: Cin7CatalogFetchMeta & { contacts: Cin7OmniContactRow[] };
  internalCustomers: Cin7CatalogFetchMeta & { contacts: Cin7OmniContactRow[] };
  suppliers: Cin7CatalogFetchMeta & { contacts: Cin7OmniContactRow[] };
  branches: Cin7CatalogFetchMeta & { branches: Cin7OmniBranchRow[] };
  productCategories: Cin7CatalogFetchMeta & { categories: Cin7OmniProductCategoryRow[] };
  stockLevels: Cin7CatalogFetchMeta & { stockLevels: Cin7OmniStockLevelRow[] };
  derived: Cin7DerivedReferenceCatalog;
};

/**
 * Fetch all master catalogs for reconciliation/sync proof.
 *
 * Performance (same accuracy as sequential typed walks):
 * - Products raw pulled once → SKU flatten + derived brands/UOM/price columns
 * - Contacts pulled once (no type filter) → partitioned in-memory
 * - Products / Contacts / Stock / Branches / Categories run in parallel
 */
export async function fetchAllOmniMasterCatalogsSequential(
  creds: Cin7OmniCredentials,
  options?: Cin7CatalogFetchOptions
): Promise<Cin7OmniMasterCatalogs> {
  const started = Date.now();

  const [rawProducts, allContacts, stockLevels, branches, productCategories] = await Promise.all([
    fetchFullOmniProductsRawCatalog(creds, undefined, options),
    fetchFullOmniAllContacts(creds, undefined, options),
    fetchFullOmniStockCatalog(creds, undefined, options),
    fetchFullOmniBranchCatalog(creds, undefined, options),
    fetchFullOmniProductCategoryCatalog(creds, undefined, options),
  ]);

  const products = buildProductCatalogFromRawStyles(rawProducts.styles, {
    pages_fetched: rawProducts.pages_fetched,
    errors: rawProducts.errors,
  });

  const partitioned = partitionOmniContactsByType(allContacts.contacts);
  const customers = {
    contacts: partitioned.customers,
    pages_fetched: allContacts.pages_fetched,
    errors: allContacts.errors,
  };
  const internalCustomers = {
    contacts: partitioned.internalCustomers,
    pages_fetched: 0,
    errors: [] as string[],
  };
  const suppliers = {
    contacts: partitioned.suppliers,
    pages_fetched: 0,
    errors: [] as string[],
  };

  const derived = buildDerivedReferenceFromParts({
    rawStyles: rawProducts.styles,
    customers: customers.contacts,
    branches: branches.branches,
  });

  // Drop raw styles ASAP — SKUs + derived already extracted (large heap win).
  rawProducts.styles.length = 0;

  console.log(
    `[Cin7 recon catalog] parallel fetch in ${Date.now() - started}ms ` +
      `(products_pages=${products.pages_fetched} contacts_pages=${allContacts.pages_fetched} ` +
      `stock_pages=${stockLevels.pages_fetched} skus=${products.skus.length} ` +
      `customers=${customers.contacts.length} suppliers=${suppliers.contacts.length} ` +
      `stock=${stockLevels.stockLevels.length})`
  );

  return {
    products,
    customers,
    internalCustomers,
    suppliers,
    branches,
    productCategories,
    stockLevels,
    derived,
  };
}

export function resolveCin7SyncSource(
  coreLive: boolean,
  omniLive: boolean
): 'core' | 'omni' | 'none' {
  const prefer = process.env.CIN7_SYNC_PREFER?.trim().toLowerCase();
  if (prefer === 'core' && coreLive) return 'core';
  if (prefer === 'omni' && omniLive) return 'omni';
  if (omniLive) return 'omni';
  if (coreLive) return 'core';
  return 'none';
}
