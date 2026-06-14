/**
 * UNI-2114: Portal orders and tracking backed by Prisma.
 *
 * Uses the authenticated Customer.id from resolvePortalCustomer (UNI-2115).
 * Demo mode falls back to the in-memory fixture store when no rows exist.
 */

import { prisma } from '@/lib/db/prisma';
import { isDemoMode } from '@/lib/demo-mode';
import {
  getPortalStore,
  type PortalOrder,
  type PortalTrackingEvent,
} from '@/lib/portal/mock-store';

function mapOrderStatus(status: string): PortalOrder['status'] {
  const s = status.toLowerCase();
  if (s.includes('deliver')) return 'delivered';
  if (s.includes('ship')) return 'shipped';
  if (s.includes('process') || s.includes('confirm') || s.includes('open')) return 'processing';
  return 'pending';
}

function buildTrackingEvents(
  orders: Array<{ id: string; orderNumber: string }>,
  fulfilments: Array<{
    orderReference: string | null;
    trackingNumber: string | null;
    carrier: string | null;
    status: string;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    updatedAt: Date;
  }>
): PortalTrackingEvent[] {
  const events: PortalTrackingEvent[] = [];
  const orderByNumber = new Map(orders.map((o) => [o.orderNumber, o]));

  for (const f of fulfilments) {
    const ref = f.orderReference?.trim();
    if (!ref) continue;
    const order = orderByNumber.get(ref);
    if (!order || !f.trackingNumber) continue;

    if (f.shippedAt) {
      events.push({
        event_id: `${order.id}-shipped`,
        order_id: order.id,
        order_number: order.orderNumber,
        tracking_number: f.trackingNumber,
        carrier: f.carrier ?? 'Carrier',
        status: 'shipped',
        location: 'In transit',
        timestamp: f.shippedAt.toISOString(),
        description: `Shipment dispatched via ${f.carrier ?? 'carrier'}`,
      });
    }

    if (f.deliveredAt) {
      events.push({
        event_id: `${order.id}-delivered`,
        order_id: order.id,
        order_number: order.orderNumber,
        tracking_number: f.trackingNumber,
        carrier: f.carrier ?? 'Carrier',
        status: 'delivered',
        location: 'Delivered',
        timestamp: f.deliveredAt.toISOString(),
        description: 'Order delivered',
      });
    }

    if (!f.shippedAt && !f.deliveredAt) {
      events.push({
        event_id: `${order.id}-status`,
        order_id: order.id,
        order_number: order.orderNumber,
        tracking_number: f.trackingNumber,
        carrier: f.carrier ?? 'Carrier',
        status: f.status,
        location: 'Warehouse',
        timestamp: f.updatedAt.toISOString(),
        description: `Fulfilment status: ${f.status}`,
      });
    }
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getPortalOrdersForCustomer(customerId: string): Promise<PortalOrder[]> {
  const rows = await prisma.order.findMany({
    where: { customerId, customer: { isActive: true } },
    include: {
      lineItems: { include: { product: { select: { sku: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (rows.length === 0 && isDemoMode()) {
    return getPortalStore(customerId).orders;
  }

  const orderNumbers = rows.map((o) => o.orderNumber);
  const fulfilments =
    orderNumbers.length > 0
      ? await prisma.salesFulfilment.findMany({
          where: { orderReference: { in: orderNumbers } },
          select: {
            orderReference: true,
            trackingNumber: true,
            deliveredAt: true,
            shippedAt: true,
          },
        })
      : [];

  const trackingByOrder = new Map(
    fulfilments
      .filter((f) => f.orderReference)
      .map((f) => [f.orderReference as string, f])
  );

  return rows.map((order) => {
    const fulfilment = trackingByOrder.get(order.orderNumber);
    return {
      order_id: order.id,
      order_number: order.orderNumber,
      date: order.createdAt.toISOString(),
      status: mapOrderStatus(order.status),
      total: order.total,
      items: order.lineItems.map((line) => ({
        sku: line.product.sku,
        name: line.product.name,
        qty: line.quantity,
        unit_price: line.unitPrice,
      })),
      tracking_number: fulfilment?.trackingNumber ?? null,
      estimated_delivery: fulfilment?.shippedAt
        ? new Date(fulfilment.shippedAt.getTime() + 5 * 86400000).toISOString()
        : new Date(order.createdAt.getTime() + 7 * 86400000).toISOString(),
      delivered_at: fulfilment?.deliveredAt?.toISOString() ?? null,
    };
  });
}

export async function getPortalTrackingForCustomer(
  customerId: string,
  filters?: { orderId?: string | null; trackingNumber?: string | null }
): Promise<PortalTrackingEvent[]> {
  const orders = await prisma.order.findMany({
    where: {
      customerId,
      ...(filters?.orderId ? { id: filters.orderId } : {}),
    },
    select: { id: true, orderNumber: true },
    take: 100,
  });

  if (orders.length === 0 && isDemoMode()) {
    let events = getPortalStore(customerId).tracking;
    if (filters?.orderId) events = events.filter((e) => e.order_id === filters.orderId);
    if (filters?.trackingNumber) {
      events = events.filter((e) => e.tracking_number === filters.trackingNumber);
    }
    return events;
  }

  const orderNumbers = orders.map((o) => o.orderNumber);
  const fulfilments = await prisma.salesFulfilment.findMany({
    where: {
      orderReference: { in: orderNumbers },
      ...(filters?.trackingNumber ? { trackingNumber: filters.trackingNumber } : {}),
    },
    select: {
      orderReference: true,
      trackingNumber: true,
      carrier: true,
      status: true,
      shippedAt: true,
      deliveredAt: true,
      updatedAt: true,
    },
  });

  let events = buildTrackingEvents(orders, fulfilments);
  if (filters?.orderId) {
    events = events.filter((e) => e.order_id === filters.orderId);
  }
  return events;
}
