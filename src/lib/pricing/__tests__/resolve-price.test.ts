/**
 * Unit tests for the price resolver (src/lib/pricing/resolve-price.ts).
 *
 * All Prisma calls are mocked — no real DB connection needed.
 *
 * Test coverage:
 *   1. Tier volume-break: highest applicable min_qty wins.
 *   2. Tier flat override: product override price is returned.
 *   3. Expiry fallback: expired tier → catalogue price.
 *   4. No-tier fallback: customer has no tier → catalogue price.
 *   5. Anonymous customer (null customerId) → catalogue price.
 *   6. Volume-break only applies when min_qty <= qty (boundary).
 *   7. Inactive price list → catalogue price.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the module under test.
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    product: { findFirst: vi.fn() },
    customerPriceTier: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/prisma';
import { resolvePrice } from '../resolve-price';

// ---- helpers ---------------------------------------------------------------

const OWNER = 'owner-user-1';
const CUSTOMER = 'customer-uuid-1';
const PRODUCT = 'product-uuid-1';
const PRICE_LIST_ID = 'price-list-uuid-1';

function mockProduct(price: number) {
  vi.mocked(prisma.product.findFirst).mockResolvedValue({
    price,
  } as never);
}

function mockNoTier() {
  vi.mocked(prisma.customerPriceTier.findUnique).mockResolvedValue(null);
}

function mockTier(opts: {
  expiresAt?: Date | null;
  isActive?: boolean;
  priceOverrides?: unknown;
  volumeBreaks?: unknown;
}) {
  vi.mocked(prisma.customerPriceTier.findUnique).mockResolvedValue({
    id: 'tier-1',
    customerId: CUSTOMER,
    priceListId: PRICE_LIST_ID,
    expiresAt: opts.expiresAt ?? null,
    ownerUserId: OWNER,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    priceList: {
      id: PRICE_LIST_ID,
      name: 'Trade-A',
      isActive: opts.isActive !== false,
      priceOverrides: opts.priceOverrides ?? [],
      volumeBreaks: opts.volumeBreaks ?? [],
    },
  } as never);
}

// ---- tests -----------------------------------------------------------------

describe('resolvePrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Volume-break: highest applicable min_qty wins
  // ---------------------------------------------------------------------------
  it('returns the highest-matching volume-break price when qty satisfies multiple breaks', async () => {
    mockProduct(100);
    mockTier({
      volumeBreaks: [
        { product_id: PRODUCT, min_qty: 10, unit_price: 90 },
        { product_id: PRODUCT, min_qty: 50, unit_price: 75 },
        { product_id: PRODUCT, min_qty: 100, unit_price: 60 },
      ],
    });

    const result = await resolvePrice(CUSTOMER, PRODUCT, 55, [OWNER]);

    expect(result.unitPrice).toBe(75);
    expect(result.source).toBe('tier_volume');
    expect(result.priceListId).toBe(PRICE_LIST_ID);
    expect(result.priceListName).toBe('Trade-A');
  });

  it('returns the 100-break price when qty exactly meets the highest break', async () => {
    mockProduct(100);
    mockTier({
      volumeBreaks: [
        { product_id: PRODUCT, min_qty: 10, unit_price: 90 },
        { product_id: PRODUCT, min_qty: 100, unit_price: 60 },
      ],
    });

    const result = await resolvePrice(CUSTOMER, PRODUCT, 100, [OWNER]);

    expect(result.unitPrice).toBe(60);
    expect(result.source).toBe('tier_volume');
  });

  it('does NOT apply a volume-break when qty is below min_qty', async () => {
    mockProduct(100);
    mockTier({
      priceOverrides: [{ product_id: PRODUCT, unit_price: 85 }],
      volumeBreaks: [{ product_id: PRODUCT, min_qty: 10, unit_price: 80 }],
    });

    // qty = 9, min_qty = 10 → volume break does NOT apply; override wins
    const result = await resolvePrice(CUSTOMER, PRODUCT, 9, [OWNER]);

    expect(result.unitPrice).toBe(85);
    expect(result.source).toBe('tier_override');
  });

  // ---------------------------------------------------------------------------
  // 2. Tier flat override
  // ---------------------------------------------------------------------------
  it('returns the flat override price when no volume-break matches', async () => {
    mockProduct(100);
    mockTier({
      priceOverrides: [{ product_id: PRODUCT, unit_price: 88 }],
      volumeBreaks: [],
    });

    const result = await resolvePrice(CUSTOMER, PRODUCT, 3, [OWNER]);

    expect(result.unitPrice).toBe(88);
    expect(result.source).toBe('tier_override');
  });

  // ---------------------------------------------------------------------------
  // 3. Expiry fallback
  // ---------------------------------------------------------------------------
  it('falls back to catalogue price when the tier is expired', async () => {
    mockProduct(100);
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // yesterday
    mockTier({
      expiresAt: pastDate,
      priceOverrides: [{ product_id: PRODUCT, unit_price: 50 }],
    });

    const result = await resolvePrice(CUSTOMER, PRODUCT, 1, [OWNER]);

    expect(result.unitPrice).toBe(100);
    expect(result.source).toBe('catalogue');
    expect(result.priceListId).toBeNull();
  });

  it('uses tier when expiresAt is in the future', async () => {
    mockProduct(100);
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days from now
    mockTier({
      expiresAt: futureDate,
      priceOverrides: [{ product_id: PRODUCT, unit_price: 70 }],
    });

    const result = await resolvePrice(CUSTOMER, PRODUCT, 1, [OWNER]);

    expect(result.unitPrice).toBe(70);
    expect(result.source).toBe('tier_override');
  });

  // ---------------------------------------------------------------------------
  // 4. No-tier fallback
  // ---------------------------------------------------------------------------
  it('falls back to catalogue price when the customer has no tier assigned', async () => {
    mockProduct(120);
    mockNoTier();

    const result = await resolvePrice(CUSTOMER, PRODUCT, 5, [OWNER]);

    expect(result.unitPrice).toBe(120);
    expect(result.source).toBe('catalogue');
    expect(result.priceListId).toBeNull();
    expect(result.priceListName).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 5. Anonymous customer (null customerId)
  // ---------------------------------------------------------------------------
  it('returns catalogue price immediately when customerId is null', async () => {
    mockProduct(95);

    const result = await resolvePrice(null, PRODUCT, 10, [OWNER]);

    expect(result.unitPrice).toBe(95);
    expect(result.source).toBe('catalogue');
    // Should NOT even call customerPriceTier.findUnique
    expect(prisma.customerPriceTier.findUnique).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 7. Inactive price list
  // ---------------------------------------------------------------------------
  it('falls back to catalogue price when the price list is inactive', async () => {
    mockProduct(100);
    mockTier({
      isActive: false,
      priceOverrides: [{ product_id: PRODUCT, unit_price: 50 }],
    });

    const result = await resolvePrice(CUSTOMER, PRODUCT, 1, [OWNER]);

    expect(result.unitPrice).toBe(100);
    expect(result.source).toBe('catalogue');
  });

  // ---------------------------------------------------------------------------
  // No matching override → catalogue fallback (within an active tier)
  // ---------------------------------------------------------------------------
  it('falls back to catalogue price when no override or break matches the product', async () => {
    mockProduct(99);
    mockTier({
      priceOverrides: [{ product_id: 'other-product-uuid', unit_price: 50 }],
      volumeBreaks: [{ product_id: 'other-product-uuid', min_qty: 1, unit_price: 40 }],
    });

    const result = await resolvePrice(CUSTOMER, PRODUCT, 1, [OWNER]);

    expect(result.unitPrice).toBe(99);
    expect(result.source).toBe('catalogue');
  });
});
