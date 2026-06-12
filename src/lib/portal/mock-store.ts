/**
 * Portal customer-scoped in-memory store (UNI-2114).
 *
 * Each customer (identified by their userId / portal session subject) has their
 * own isolated slice.  Route handlers MUST supply the customerId resolved from
 * the server-side auth session — never a value from the request body/query.
 *
 * Demo-fixture data is only surfaced when isDemoMode() returns true.
 */

export interface PortalOrderItem {
  sku: string;
  name: string;
  qty: number;
  unit_price: number;
}

export interface PortalOrder {
  order_id: string;
  order_number: string;
  date: string;
  status: 'processing' | 'shipped' | 'delivered' | 'pending';
  total: number;
  items: PortalOrderItem[];
  tracking_number: string | null;
  estimated_delivery: string;
  delivered_at: string | null;
}

export interface PortalTrackingEvent {
  event_id: string;
  order_id: string;
  order_number: string;
  tracking_number: string;
  carrier: string;
  status: string;
  location: string;
  timestamp: string;
  description: string;
}

export interface PortalCustomerStore {
  orders: PortalOrder[];
  tracking: PortalTrackingEvent[];
}

const STORE_KEY = '__ccwPortalCustomerStore__';

function nowIso() {
  return new Date().toISOString();
}

function seedStore(customerId: string): PortalCustomerStore {
  const now = nowIso();
  // Each customer seed is deterministically keyed so different customers get different data
  const suffix = customerId.slice(-4).toUpperCase();
  return {
    orders: [
      {
        order_id: `ord-${customerId}-001`,
        order_number: `CCW-${suffix}-0001`,
        date: '2026-03-15T00:00:00.000Z',
        status: 'delivered',
        total: 1234.56,
        items: [
          { sku: 'CHEM-001', name: 'Pro-Clean Concentrate 5L', qty: 2, unit_price: 89.5 },
          { sku: 'EQUIP-042', name: 'Extraction Wand — 12" TurboForce', qty: 1, unit_price: 1055.56 },
        ],
        tracking_number: `AUPOST-${suffix}-111`,
        estimated_delivery: '2026-03-20T00:00:00.000Z',
        delivered_at: '2026-03-19T14:30:00.000Z',
      },
      {
        order_id: `ord-${customerId}-002`,
        order_number: `CCW-${suffix}-0002`,
        date: '2026-05-01T00:00:00.000Z',
        status: 'processing',
        total: 345.0,
        items: [{ sku: 'CHEM-007', name: 'Enzyme Pre-Spray 1L', qty: 6, unit_price: 57.5 }],
        tracking_number: null,
        estimated_delivery: '2026-05-10T00:00:00.000Z',
        delivered_at: null,
      },
    ],
    tracking: [
      {
        event_id: `evt-${customerId}-001`,
        order_id: `ord-${customerId}-001`,
        order_number: `CCW-${suffix}-0001`,
        tracking_number: `AUPOST-${suffix}-111`,
        carrier: 'Australia Post',
        status: 'Delivered',
        location: 'Brisbane, QLD',
        timestamp: '2026-03-19T14:30:00.000Z',
        description: 'Parcel delivered to front door',
      },
      {
        event_id: `evt-${customerId}-002`,
        order_id: `ord-${customerId}-001`,
        order_number: `CCW-${suffix}-0001`,
        tracking_number: `AUPOST-${suffix}-111`,
        carrier: 'Australia Post',
        status: 'Out for Delivery',
        location: 'Brisbane, QLD',
        timestamp: '2026-03-19T08:00:00.000Z',
        description: 'Parcel is out for delivery',
      },
    ],
  };
}

type StoreMap = Map<string, PortalCustomerStore>;

function getStoreMap(): StoreMap {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: StoreMap };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map<string, PortalCustomerStore>();
  }
  return g[STORE_KEY] as StoreMap;
}

/**
 * Returns the portal store scoped to a customer.
 *
 * Route handlers MUST supply the customerId resolved from the server-side auth
 * session — never a value from the request body/query.
 */
export function getPortalStore(customerId: string): PortalCustomerStore {
  const map = getStoreMap();
  if (!map.has(customerId)) {
    map.set(customerId, seedStore(customerId));
  }
  return map.get(customerId) as PortalCustomerStore;
}

/** Reset a specific customer's store (test helper). */
export function _resetPortalStoreForCustomer(customerId: string): void {
  getStoreMap().delete(customerId);
}

/** Clear all stores (test helper). */
export function _resetAllPortalStores(): void {
  getStoreMap().clear();
}
