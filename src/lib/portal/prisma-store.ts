/**
 * Portal Prisma data layer (UNI-2114 seam, wired in this PR).
 *
 * Replaces getPortalStore() for the production (non-demo) path while keeping
 * the same customer-scoping contract: callers MUST supply a customerId that was
 * resolved server-side from the session JWT — never a value from the request.
 *
 * Relations used
 * ──────────────
 * Order.customerId  → Customer.id   (direct FK, ORDER BY createdAt DESC)
 *
 * Tracking (SalesFulfilment) schema gap
 * ──────────────────────────────────────
 * SalesFulfilment has no FK to Customer or Order in the current schema.
 * It carries `cin7OrderMappingId` (a plain string, not a UUID FK) and
 * `orderReference` (nullable string).  There is no Prisma relation that
 * lets us join from SalesFulfilment → Customer in a single query.
 *
 * Decision (documented for Rana):
 *   - The /tracking route continues to return an empty array from Prisma until
 *     either (a) a `orderId` UUID FK is added to SalesFulfilment pointing to
 *     Order, or (b) the orderReference is normalised and indexed.
 *   - isDemoMode() still serves full fixture tracking events.
 *   - See PR body for the exact schema gap and the recommended migration.
 */

import { prisma } from '@/lib/db/prisma';
import type { PortalOrder, PortalTrackingEvent } from './mock-store';

/**
 * Fetch all orders for a customer from Prisma, mapped to the PortalOrder shape.
 *
 * Scoping is enforced by the WHERE clause — only rows whose `customerId` matches
 * the session-resolved customer are returned.  No other customer's data can leak.
 */
export async function getPortalOrdersFromPrisma(customerId: string): Promise<PortalOrder[]> {
  const rows = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      lineItems: {
        include: { product: { select: { sku: true, name: true } } },
      },
    },
  });

  return rows.map((row) => ({
    order_id: row.id,
    order_number: row.orderNumber,
    date: row.createdAt.toISOString(),
    status: mapOrderStatus(row.status),
    total: row.total,
    items: row.lineItems.map((li) => ({
      sku: li.product.sku,
      name: li.product.name,
      qty: li.quantity,
      unit_price: li.unitPrice,
    })),
    // SalesFulfilment tracking gap: no FK from Order → SalesFulfilment in schema.
    // These fields are left null until the schema exposes a usable relation.
    tracking_number: null,
    estimated_delivery: '',
    delivered_at: null,
  }));
}

/**
 * Fetch tracking events for a customer from Prisma.
 *
 * SCHEMA GAP: SalesFulfilment has no FK to Customer or Order (only
 * `cin7OrderMappingId`, a plain string).  This function returns an empty array
 * until the schema is extended.  See PR body for the recommended migration.
 */
export async function getPortalTrackingFromPrisma(
  _customerId: string,
  _filters?: { orderId?: string; trackingNumber?: string }
): Promise<PortalTrackingEvent[]> {
  // Cannot join SalesFulfilment → Customer without a schema change.
  // Return empty; demo mode still serves fixtures.
  return [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PortalOrderStatus = PortalOrder['status'];

function mapOrderStatus(raw: string): PortalOrderStatus {
  const map: Record<string, PortalOrderStatus> = {
    pending: 'pending',
    processing: 'processing',
    shipped: 'shipped',
    delivered: 'delivered',
    // Normalise any unknown status to 'processing' so the UI always has a value.
  };
  return map[raw.toLowerCase()] ?? 'processing';
}
