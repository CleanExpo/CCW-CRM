import {
  CIN7_SYNC_SAFETY_MAX_PAGES,
  getCin7PageSize,
} from '@/lib/integrations/cin7-sync-config';
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
  type Cin7OmniBranchRow,
  type Cin7OmniContactRow,
  type Cin7OmniProductCategoryRow,
  type Cin7OmniStockLevelRow,
} from '@/lib/integrations/cin7-omni';
import { formatCin7PriceColumnLabel } from '@/lib/integrations/cin7-master-entities';

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

async function paginateUntilDone<T>(input: {
  maxPages?: number;
  fetchPage: (
    page: number
  ) => Promise<{ items: T[]; sourceRowCount: number; total: number | null; error?: string }>;
}): Promise<{ items: T[]; pages_fetched: number; errors: string[] }> {
  const pageSize = getCin7PageSize();
  const maxPages = input.maxPages ?? CIN7_SYNC_SAFETY_MAX_PAGES;
  const pageGapMs = getCatalogPageGapMs();
  const items: T[] = [];
  const errors: string[] = [];
  let pagesFetched = 0;
  let emptyRetries = 0;
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
      if (emptyRetries < maxEmptyRetries) {
        emptyRetries += 1;
        errors.push(`Page ${page}: empty response — retry ${emptyRetries}/${maxEmptyRetries}`);
        await sleep(pageGapMs * (emptyRetries + 2));
        page -= 1;
        continue;
      }
      break;
    }
    emptyRetries = 0;
    items.push(...result.items);
    if (result.sourceRowCount < pageSize) break;
  }

  return { items, pages_fetched: pagesFetched, errors };
}

/** Full Cin7 Omni product catalog — includes inactive and all visibility types. */
export async function fetchFullOmniProductCatalog(
  creds: Cin7OmniCredentials,
  maxPages?: number
): Promise<Cin7CatalogProducts> {
  const styleCodes = new Set<string>();
  const byVisibility: Record<string, number> = {};
  const skus: Cin7CatalogProductSku[] = [];

  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages,
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

/** Full Cin7 Omni contacts filtered by business contact type (Customer, Supplier, Internal). */
export async function fetchFullOmniContactsByType(
  creds: Cin7OmniCredentials,
  allowedTypes: string[],
  maxPages?: number
): Promise<Cin7CatalogFetchMeta & { contacts: Cin7OmniContactRow[] }> {
  const whereType = allowedTypes[0];
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages,
    fetchPage: async (page) => {
      const result = await fetchOmniContactsPage(creds, page, getCin7PageSize(), {
        whereType,
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

/** Full Cin7 Omni branch catalog. */
export async function fetchFullOmniBranchCatalog(
  creds: Cin7OmniCredentials,
  maxPages?: number
): Promise<Cin7CatalogFetchMeta & { branches: Cin7OmniBranchRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages,
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
  maxPages?: number
): Promise<Cin7CatalogFetchMeta & { categories: Cin7OmniProductCategoryRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages,
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
  maxPages?: number
): Promise<Cin7CatalogFetchMeta & { stockLevels: Cin7OmniStockLevelRow[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages,
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
  maxPages?: number
): Promise<Cin7CatalogFetchMeta & { styles: unknown[] }> {
  const { items, pages_fetched, errors } = await paginateUntilDone({
    maxPages,
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
  creds: Cin7OmniCredentials
): Promise<Cin7DerivedReferenceCatalog & Cin7CatalogFetchMeta> {
  const entityGapMs = getCatalogEntityGapMs();
  const rawProducts = await fetchFullOmniProductsRawCatalog(creds);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const customers = await fetchFullOmniContactsByType(creds, ['Customer']);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const branches = await fetchFullOmniBranchCatalog(creds);

  const extracted = extractReferenceDataFromProducts(rawProducts.styles);
  const contactPriceColumns = customers.contacts
    .map((c) => c.priceColumn?.trim())
    .filter((v): v is string => Boolean(v));
  const taxCodes = extractTaxCodesFromContactsAndBranches({
    contacts: customers.contacts,
    branches: branches.branches,
  });

  const priceColumns = new Set([...extracted.priceColumns, ...contactPriceColumns]);
  for (const col of contactPriceColumns) {
    if (col) priceColumns.add(col);
  }

  return {
    brands: extracted.brands,
    priceColumns: [...priceColumns].sort(),
    unitsOfMeasure: extracted.unitsOfMeasure,
    taxCodes,
    pages_fetched:
      rawProducts.pages_fetched + customers.pages_fetched + branches.pages_fetched,
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

/** Fetch all master catalogs sequentially to avoid Cin7 API rate limits. */
export async function fetchAllOmniMasterCatalogsSequential(
  creds: Cin7OmniCredentials
): Promise<Cin7OmniMasterCatalogs> {
  const entityGapMs = getCatalogEntityGapMs();
  const products = await fetchFullOmniProductCatalog(creds);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const customers = await fetchFullOmniContactsByType(creds, ['Customer']);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const internalCustomers = await fetchFullOmniContactsByType(creds, ['Internal']);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const suppliers = await fetchFullOmniContactsByType(creds, ['Supplier']);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const branches = await fetchFullOmniBranchCatalog(creds);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const productCategories = await fetchFullOmniProductCategoryCatalog(creds);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const stockLevels = await fetchFullOmniStockCatalog(creds);
  if (entityGapMs > 0) await sleep(entityGapMs);
  const derived = await fetchDerivedReferenceCatalog(creds);
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

export function resolveCin7SyncSource(coreLive: boolean, omniLive: boolean): 'core' | 'omni' | 'none' {
  const prefer = process.env.CIN7_SYNC_PREFER?.trim().toLowerCase();
  if (prefer === 'core' && coreLive) return 'core';
  if (prefer === 'omni' && omniLive) return 'omni';
  if (omniLive) return 'omni';
  if (coreLive) return 'core';
  return 'none';
}
