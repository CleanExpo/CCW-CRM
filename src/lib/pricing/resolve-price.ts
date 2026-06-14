/**
 * Price resolver: the single source of truth for unit price calculation.
 *
 * Resolution order:
 *   1. If the customer has an active (non-expired) CustomerPriceTier:
 *      a. Check volumeBreaks for a min_qty rule covering the requested qty (highest-winning min_qty first).
 *      b. Else check priceOverrides for a flat per-product price.
 *   2. Fall back to Product.price (catalogue price).
 *
 * Returns { unitPrice, source } so callers can log/audit which path was taken.
 */

import { prisma } from '@/lib/db/prisma';

export type PriceSource = 'tier_volume' | 'tier_override' | 'catalogue';

export interface ResolvedPrice {
  unitPrice: number;
  source: PriceSource;
  priceListId: string | null;
  priceListName: string | null;
}

interface PriceOverrideEntry {
  product_id: string;
  unit_price: number;
}

interface VolumeBreakEntry {
  product_id: string;
  min_qty: number;
  unit_price: number;
}

function isPriceOverrideArray(v: unknown): v is PriceOverrideEntry[] {
  return Array.isArray(v);
}

function isVolumeBreakArray(v: unknown): v is VolumeBreakEntry[] {
  return Array.isArray(v);
}

/**
 * Resolve the unit price for a given customer / product / quantity combination.
 *
 * @param customerId   - UUID of the customer (may be null for anonymous/POS).
 * @param productId    - UUID of the product.
 * @param qty          - Requested quantity (used for volume-break evaluation).
 * @param ownerUserIds - Workspace user-ids list (for product ownership check).
 */
export async function resolvePrice(
  customerId: string | null,
  productId: string,
  qty: number,
  ownerUserIds: string[]
): Promise<ResolvedPrice> {
  // Always fetch the catalogue price — needed as fallback and for validation.
  const product = await prisma.product.findFirst({
    where: { id: productId, ownerUserId: { in: ownerUserIds }, isActive: true },
    select: { price: true },
  });

  const cataloguePrice = product?.price ?? 0;
  const fallback: ResolvedPrice = {
    unitPrice: cataloguePrice,
    source: 'catalogue',
    priceListId: null,
    priceListName: null,
  };

  if (!customerId) return fallback;

  // Load the customer's active price tier (if any).
  const tier = await prisma.customerPriceTier.findUnique({
    where: { customerId },
    include: { priceList: true },
  });

  if (!tier) return fallback;

  // Check expiry.
  if (tier.expiresAt && tier.expiresAt < new Date()) return fallback;

  if (!tier.priceList.isActive) return fallback;

  const meta = { priceListId: tier.priceListId, priceListName: tier.priceList.name };

  // 1. Volume-break check (highest applicable min_qty wins).
  if (isVolumeBreakArray(tier.priceList.volumeBreaks)) {
    const applicable = (tier.priceList.volumeBreaks as VolumeBreakEntry[])
      .filter((r) => r.product_id === productId && r.min_qty <= qty)
      .sort((a, b) => b.min_qty - a.min_qty);

    if (applicable.length > 0) {
      return {
        unitPrice: applicable[0].unit_price,
        source: 'tier_volume',
        ...meta,
      };
    }
  }

  // 2. Flat override check.
  if (isPriceOverrideArray(tier.priceList.priceOverrides)) {
    const override = (tier.priceList.priceOverrides as PriceOverrideEntry[]).find(
      (r) => r.product_id === productId
    );
    if (override) {
      return {
        unitPrice: override.unit_price,
        source: 'tier_override',
        ...meta,
      };
    }
  }

  // 3. No matching rule — fall back to catalogue.
  return fallback;
}
