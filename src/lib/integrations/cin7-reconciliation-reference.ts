import { prisma } from '@/lib/db/prisma';
import type { Cin7OmniMasterCatalogs } from '@/lib/integrations/cin7-catalog-fetch';
import { dedupeOmniStockLevels, normalizeOmniStockQty } from '@/lib/integrations/cin7-omni';
import type { Cin7ExceptionRecord } from '@/lib/integrations/cin7-reconciliation';

export type Cin7ReferenceExceptionEntity =
  | 'product-categories'
  | 'brands'
  | 'price-lists'
  | 'tax-codes'
  | 'units-of-measure'
  | 'stock-levels'
  | 'warehouses';

export type Cin7ReferenceCounts = {
  product_categories: number;
  brands: number;
  price_lists: number;
  tax_codes: number;
  units_of_measure: number;
  stock_levels: number;
  warehouses: number;
};

export type Cin7ReferenceExceptionSummary = {
  product_categories_missing_in_optix: number;
  product_categories_extra_in_optix: number;
  brands_missing_in_optix: number;
  brands_extra_in_optix: number;
  price_lists_missing_in_optix: number;
  price_lists_extra_in_optix: number;
  tax_codes_missing_in_optix: number;
  tax_codes_extra_in_optix: number;
  units_of_measure_missing_in_optix: number;
  units_of_measure_extra_in_optix: number;
  stock_levels_missing_in_optix: number;
  stock_levels_extra_in_optix: number;
  stock_levels_field_mismatches: number;
};

function countSetDiff<T extends string>(
  cin7Keys: Set<T>,
  optixKeys: Set<T>
): { missing: number; extra: number } {
  let missing = 0;
  let extra = 0;
  for (const key of cin7Keys) if (!optixKeys.has(key)) missing += 1;
  for (const key of optixKeys) if (!cin7Keys.has(key)) extra += 1;
  return { missing, extra };
}

export function getCin7ReferenceCounts(catalogs: Cin7OmniMasterCatalogs): Cin7ReferenceCounts {
  return {
    product_categories: catalogs.productCategories.categories.length,
    brands: catalogs.derived.brands.length,
    price_lists: catalogs.derived.priceColumns.length,
    tax_codes: catalogs.derived.taxCodes.length,
    units_of_measure: catalogs.derived.unitsOfMeasure.length,
    // Unique branch:sku keys (raw page rows can duplicate the same key).
    stock_levels: dedupeOmniStockLevels(catalogs.stockLevels.stockLevels).size,
    warehouses: catalogs.branches.branches.length,
  };
}

export type OptixReferenceSnapshot = {
  categories: Array<{ cin7CategoryId: string }>;
  brands: Array<{ name: string }>;
  priceLists: Array<{ cin7PriceColumn: string }>;
  taxCodes: Array<{ code: string }>;
  uoms: Array<{ code: string }>;
  stockRows: Array<{
    cin7BranchId: string;
    sku: string;
    available: number;
    stockOnHand: number;
    incoming: number;
  }>;
  warehouseCount: number;
};

/** One round-trip batch for reference counts + exception keys (avoids count()+findMany). */
export async function loadOptixReferenceSnapshot(
  ownerUserId: string
): Promise<OptixReferenceSnapshot> {
  const [categories, brands, priceLists, taxCodes, uoms, stockRows, warehouseCount] =
    await Promise.all([
      prisma.cin7ProductCategory.findMany({
        where: { ownerUserId },
        select: { cin7CategoryId: true },
      }),
      prisma.cin7Brand.findMany({ where: { ownerUserId }, select: { name: true } }),
      prisma.cin7PriceList.findMany({
        where: { ownerUserId },
        select: { cin7PriceColumn: true },
      }),
      prisma.cin7TaxCode.findMany({ where: { ownerUserId }, select: { code: true } }),
      prisma.cin7UnitOfMeasure.findMany({ where: { ownerUserId }, select: { code: true } }),
      prisma.cin7StockLevel.findMany({
        where: { ownerUserId },
        select: {
          cin7BranchId: true,
          sku: true,
          available: true,
          stockOnHand: true,
          incoming: true,
        },
      }),
      prisma.cin7Branch.count({ where: { ownerUserId } }),
    ]);

  return {
    categories,
    brands,
    priceLists,
    taxCodes,
    uoms,
    stockRows,
    warehouseCount,
  };
}

export function referenceCountsFromOptixSnapshot(
  snapshot: OptixReferenceSnapshot
): Cin7ReferenceCounts {
  return {
    product_categories: snapshot.categories.length,
    brands: snapshot.brands.length,
    price_lists: snapshot.priceLists.length,
    tax_codes: snapshot.taxCodes.length,
    units_of_measure: snapshot.uoms.length,
    stock_levels: snapshot.stockRows.length,
    warehouses: snapshot.warehouseCount,
  };
}

export async function getOptixReferenceCounts(ownerUserId: string): Promise<Cin7ReferenceCounts> {
  return referenceCountsFromOptixSnapshot(await loadOptixReferenceSnapshot(ownerUserId));
}

export async function buildReferenceExceptionSummary(
  ownerUserId: string,
  catalogs: Cin7OmniMasterCatalogs,
  preloaded?: OptixReferenceSnapshot
): Promise<Cin7ReferenceExceptionSummary> {
  const optix = preloaded ?? (await loadOptixReferenceSnapshot(ownerUserId));
  const optixCategories = optix.categories;
  const optixBrands = optix.brands;
  const optixPriceLists = optix.priceLists;
  const optixTaxCodes = optix.taxCodes;
  const optixUoms = optix.uoms;
  const optixStockRows = optix.stockRows;

  const catDiff = countSetDiff(
    new Set(catalogs.productCategories.categories.map((c) => c.cin7CategoryId)),
    new Set(optixCategories.map((c) => c.cin7CategoryId))
  );
  const brandDiff = countSetDiff(
    new Set(catalogs.derived.brands),
    new Set(optixBrands.map((b) => b.name))
  );
  const priceDiff = countSetDiff(
    new Set(catalogs.derived.priceColumns),
    new Set(optixPriceLists.map((p) => p.cin7PriceColumn))
  );
  const taxDiff = countSetDiff(
    new Set(catalogs.derived.taxCodes),
    new Set(optixTaxCodes.map((t) => t.code))
  );
  const uomDiff = countSetDiff(
    new Set(catalogs.derived.unitsOfMeasure),
    new Set(optixUoms.map((u) => u.code))
  );

  const cin7Stock = dedupeOmniStockLevels(catalogs.stockLevels.stockLevels);
  const optixStockByKey = new Map<string, (typeof optixStockRows)[number]>(
    optixStockRows.map((s) => [`${s.cin7BranchId}:${s.sku}`, s])
  );
  let stockMissing = 0;
  let stockExtra = 0;
  let stockMismatch = 0;
  for (const [key, cin7] of cin7Stock) {
    const optix = optixStockByKey.get(key);
    if (!optix) {
      stockMissing += 1;
      continue;
    }
    if (
      normalizeOmniStockQty(optix.available) !== cin7.available ||
      normalizeOmniStockQty(optix.stockOnHand) !== cin7.stockOnHand ||
      normalizeOmniStockQty(optix.incoming) !== cin7.incoming
    ) {
      stockMismatch += 1;
    }
  }
  for (const key of optixStockByKey.keys()) {
    if (!cin7Stock.has(key)) stockExtra += 1;
  }

  return {
    product_categories_missing_in_optix: catDiff.missing,
    product_categories_extra_in_optix: catDiff.extra,
    brands_missing_in_optix: brandDiff.missing,
    brands_extra_in_optix: brandDiff.extra,
    price_lists_missing_in_optix: priceDiff.missing,
    price_lists_extra_in_optix: priceDiff.extra,
    tax_codes_missing_in_optix: taxDiff.missing,
    tax_codes_extra_in_optix: taxDiff.extra,
    units_of_measure_missing_in_optix: uomDiff.missing,
    units_of_measure_extra_in_optix: uomDiff.extra,
    stock_levels_missing_in_optix: stockMissing,
    stock_levels_extra_in_optix: stockExtra,
    stock_levels_field_mismatches: stockMismatch,
  };
}

export async function buildReferenceExceptionItems(
  ownerUserId: string,
  entity: Cin7ReferenceExceptionEntity,
  catalogs: Cin7OmniMasterCatalogs
): Promise<Cin7ExceptionRecord[]> {
  const items: Cin7ExceptionRecord[] = [];

  if (entity === 'product-categories') {
    const optix = await prisma.cin7ProductCategory.findMany({ where: { ownerUserId } });
    const optixById = new Map(optix.map((r) => [r.cin7CategoryId, r]));
    for (const cin7 of catalogs.productCategories.categories) {
      if (!optixById.has(cin7.cin7CategoryId)) {
        items.push({
          cin7_id: cin7.cin7CategoryId,
          label: cin7.name,
          reason: 'missing_in_optix',
        });
      }
    }
    for (const row of optix) {
      if (
        !catalogs.productCategories.categories.some((c) => c.cin7CategoryId === row.cin7CategoryId)
      ) {
        items.push({ cin7_id: row.cin7CategoryId, label: row.name, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'brands') {
    const optix = await prisma.cin7Brand.findMany({ where: { ownerUserId } });
    const optixNames = new Set(optix.map((b) => b.name));
    for (const name of catalogs.derived.brands) {
      if (!optixNames.has(name)) {
        items.push({ cin7_id: name, label: name, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!catalogs.derived.brands.includes(row.name)) {
        items.push({ cin7_id: row.name, label: row.name, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'price-lists') {
    const optix = await prisma.cin7PriceList.findMany({ where: { ownerUserId } });
    const optixCols = new Set(optix.map((p) => p.cin7PriceColumn));
    for (const col of catalogs.derived.priceColumns) {
      if (!optixCols.has(col)) {
        items.push({ cin7_id: col, label: col, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!catalogs.derived.priceColumns.includes(row.cin7PriceColumn)) {
        items.push({
          cin7_id: row.cin7PriceColumn,
          label: row.name,
          reason: 'extra_in_optix',
        });
      }
    }
  }

  if (entity === 'tax-codes') {
    const optix = await prisma.cin7TaxCode.findMany({ where: { ownerUserId } });
    const optixCodes = new Set(optix.map((t) => t.code));
    for (const code of catalogs.derived.taxCodes) {
      if (!optixCodes.has(code)) {
        items.push({ cin7_id: code, label: code, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!catalogs.derived.taxCodes.includes(row.code)) {
        items.push({ cin7_id: row.code, label: row.name, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'units-of-measure') {
    const optix = await prisma.cin7UnitOfMeasure.findMany({ where: { ownerUserId } });
    const optixCodes = new Set(optix.map((u) => u.code));
    for (const code of catalogs.derived.unitsOfMeasure) {
      if (!optixCodes.has(code)) {
        items.push({ cin7_id: code, label: code, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!catalogs.derived.unitsOfMeasure.includes(row.code)) {
        items.push({ cin7_id: row.code, label: row.name, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'stock-levels') {
    const optix = await prisma.cin7StockLevel.findMany({ where: { ownerUserId } });
    const optixByKey = new Map(optix.map((r) => [`${r.cin7BranchId}:${r.sku}`, r]));
    const cin7Stock = dedupeOmniStockLevels(catalogs.stockLevels.stockLevels);
    for (const [key, cin7] of cin7Stock) {
      const row = optixByKey.get(key);
      if (!row) {
        items.push({
          cin7_id: key,
          label: `${cin7.sku} @ ${cin7.branchName ?? cin7.cin7BranchId}`,
          reason: 'missing_in_optix',
        });
        continue;
      }
      const fields: Cin7ExceptionRecord['fields'] = [];
      if (normalizeOmniStockQty(row.available) !== cin7.available) {
        fields.push({
          field: 'available',
          cin7_value: String(cin7.available),
          optix_value: String(normalizeOmniStockQty(row.available)),
        });
      }
      if (normalizeOmniStockQty(row.stockOnHand) !== cin7.stockOnHand) {
        fields.push({
          field: 'stock_on_hand',
          cin7_value: String(cin7.stockOnHand),
          optix_value: String(normalizeOmniStockQty(row.stockOnHand)),
        });
      }
      if (normalizeOmniStockQty(row.incoming) !== cin7.incoming) {
        fields.push({
          field: 'incoming',
          cin7_value: String(cin7.incoming),
          optix_value: String(normalizeOmniStockQty(row.incoming)),
        });
      }
      if (fields.length > 0) {
        items.push({ cin7_id: key, label: cin7.sku, reason: 'field_mismatch', fields });
      }
    }
    for (const row of optix) {
      const key = `${row.cin7BranchId}:${row.sku}`;
      if (!cin7Stock.has(key)) {
        items.push({ cin7_id: key, label: row.sku, reason: 'extra_in_optix' });
      }
    }
  }

  if (entity === 'warehouses') {
    // Warehouses are Cin7 branches — reuse branch exception logic via catalogs.branches
    const optix = await prisma.cin7Branch.findMany({ where: { ownerUserId } });
    const optixById = new Map(optix.map((b) => [b.cin7BranchId, b]));
    for (const cin7 of catalogs.branches.branches) {
      if (!optixById.has(cin7.cin7BranchId)) {
        items.push({ cin7_id: cin7.cin7BranchId, label: cin7.name, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!catalogs.branches.branches.some((b) => b.cin7BranchId === row.cin7BranchId)) {
        items.push({ cin7_id: row.cin7BranchId, label: row.name, reason: 'extra_in_optix' });
      }
    }
  }

  return items;
}
