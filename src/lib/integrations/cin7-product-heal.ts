/**
 * Heal Optix product field diffs from live Cin7 catalog rows.
 * Same idea as stock heal: keys already match, push Cin7 name/price/stock/active/visibility.
 */

import { prisma } from '@/lib/db/prisma';
import { fetchFullOmniProductCatalog } from '@/lib/integrations/cin7-catalog-fetch';
import type { Cin7OmniCredentials } from '@/lib/integrations/cin7-omni';
import { batchUpsertProducts, mapOmniProductRows } from '@/lib/integrations/cin7-sync-persist';

const CIN7_PRODUCT_CATEGORY_PREFIX = 'Cin7';

export type Cin7ProductFieldKey = 'name' | 'price' | 'stock' | 'is_active' | 'visibility';

export type Cin7ProductFieldMismatchBreakdown = Record<Cin7ProductFieldKey, number>;

export type Cin7ProductCompareRow = {
  sku: string;
  name: string;
  price: number;
  stock: number;
  visibility: string;
  isActive: boolean;
  styleCode?: string;
};

export function emptyProductFieldMismatchBreakdown(): Cin7ProductFieldMismatchBreakdown {
  return { name: 0, price: 0, stock: 0, is_active: 0, visibility: 0 };
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function productFieldsMatch(
  optix: Cin7ProductCompareRow,
  cin7: Cin7ProductCompareRow
): boolean {
  return (
    normalize(optix.name) === normalize(cin7.name) &&
    Math.abs(optix.price - cin7.price) <= 0.01 &&
    optix.stock === cin7.stock &&
    optix.isActive === cin7.isActive &&
    normalize(optix.visibility) === normalize(cin7.visibility)
  );
}

/** Count how many matched SKUs differ on each compared field. */
export function buildProductFieldMismatchBreakdown(
  cin7BySku: Map<string, Cin7ProductCompareRow>,
  optixBySku: Map<string, Cin7ProductCompareRow>
): { mismatchedSkus: number; breakdown: Cin7ProductFieldMismatchBreakdown } {
  const breakdown = emptyProductFieldMismatchBreakdown();
  let mismatchedSkus = 0;
  for (const [sku, cin7] of cin7BySku) {
    const optix = optixBySku.get(sku);
    if (!optix) continue;
    if (productFieldsMatch(optix, cin7)) continue;
    mismatchedSkus += 1;
    if (normalize(optix.name) !== normalize(cin7.name)) breakdown.name += 1;
    if (Math.abs(optix.price - cin7.price) > 0.01) breakdown.price += 1;
    if (optix.stock !== cin7.stock) breakdown.stock += 1;
    if (optix.isActive !== cin7.isActive) breakdown.is_active += 1;
    if (normalize(optix.visibility) !== normalize(cin7.visibility)) breakdown.visibility += 1;
  }
  return { mismatchedSkus, breakdown };
}

/**
 * Push live Cin7 product fields onto Optix for SKUs that exist on both sides but differ.
 */
export async function healOptixProductFieldMismatches(
  ownerUserId: string,
  cin7Products: Cin7ProductCompareRow[]
): Promise<{
  healed: number;
  checked: number;
  breakdown_before: Cin7ProductFieldMismatchBreakdown;
  mismatched_before: number;
}> {
  const cin7BySku = new Map<string, Cin7ProductCompareRow>();
  for (const row of cin7Products) {
    const sku = row.sku.trim();
    if (!sku) continue;
    cin7BySku.set(sku, { ...row, sku });
  }
  if (cin7BySku.size === 0) {
    return {
      healed: 0,
      checked: 0,
      breakdown_before: emptyProductFieldMismatchBreakdown(),
      mismatched_before: 0,
    };
  }

  const optixRows = await prisma.product.findMany({
    where: { ownerUserId, category: { startsWith: CIN7_PRODUCT_CATEGORY_PREFIX } },
    select: {
      sku: true,
      name: true,
      price: true,
      stock: true,
      isActive: true,
      cin7Visibility: true,
      cin7StyleCode: true,
    },
  });

  const optixBySku = new Map<string, Cin7ProductCompareRow>();
  for (const row of optixRows) {
    optixBySku.set(row.sku, {
      sku: row.sku,
      name: row.name,
      price: Number(row.price),
      stock: row.stock,
      visibility: row.cin7Visibility ?? 'Unknown',
      isActive: row.isActive,
      styleCode: row.cin7StyleCode ?? undefined,
    });
  }

  const { mismatchedSkus, breakdown } = buildProductFieldMismatchBreakdown(cin7BySku, optixBySku);
  const toHeal: Cin7ProductCompareRow[] = [];
  for (const [sku, cin7] of cin7BySku) {
    const optix = optixBySku.get(sku);
    if (!optix) continue;
    if (!productFieldsMatch(optix, cin7)) toHeal.push(cin7);
  }

  if (toHeal.length === 0) {
    return {
      healed: 0,
      checked: optixRows.length,
      breakdown_before: breakdown,
      mismatched_before: mismatchedSkus,
    };
  }

  await batchUpsertProducts(ownerUserId, mapOmniProductRows(toHeal));
  console.log(
    `[Cin7 product heal] owner=${ownerUserId} healed=${toHeal.length} checked=${optixRows.length} ` +
      `stock=${breakdown.stock} price=${breakdown.price} name=${breakdown.name}`
  );
  return {
    healed: toHeal.length,
    checked: optixRows.length,
    breakdown_before: breakdown,
    mismatched_before: mismatchedSkus,
  };
}

/** Full Omni product walk → heal Optix field mismatches from live Cin7. */
export async function healOptixProductsFromLiveCin7(
  ownerUserId: string,
  omniCreds: Cin7OmniCredentials
): Promise<{
  healed: number;
  checked: number;
  cin7_skus: number;
  mismatched_before: number;
  breakdown_before: Cin7ProductFieldMismatchBreakdown;
  errors: string[];
}> {
  const catalog = await fetchFullOmniProductCatalog(omniCreds);
  if (catalog.errors.length > 0 && catalog.skus.length === 0) {
    return {
      healed: 0,
      checked: 0,
      cin7_skus: 0,
      mismatched_before: 0,
      breakdown_before: emptyProductFieldMismatchBreakdown(),
      errors: catalog.errors,
    };
  }

  const result = await healOptixProductFieldMismatches(
    ownerUserId,
    catalog.skus.map((s) => ({
      sku: s.sku,
      name: s.name,
      price: s.price,
      stock: s.stock,
      visibility: s.visibility,
      isActive: s.isActive,
      styleCode: s.styleCode,
    }))
  );

  return {
    ...result,
    cin7_skus: catalog.skus.length,
    errors: catalog.errors.slice(0, 20),
  };
}
