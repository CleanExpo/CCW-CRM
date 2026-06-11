/**
 * UNI-2115: In-memory store for portal service requests.
 *
 * Scoped by customerId — each customer sees only their own requests.
 * Mirrors the POS mock-store pattern from UNI-2107.
 *
 * In production this would be replaced by a Prisma `ServiceRequest` table;
 * for now an in-memory map is sufficient and keeps the PR focused on the
 * auth / customer-context layer.
 */

import { randomUUID } from 'crypto';

export type PortalRequestType = 'warranty_claim' | 'service_booking' | 'general_inquiry';

export interface PortalServiceRequest {
  request_id: string;
  customer_id: string;
  reference_number: string;
  request_type: PortalRequestType;
  description: string;
  order_id: string | null;
  product_sku: string | null;
  preferred_contact: string;
  status: string;
  created_at: string;
}

interface CustomerStore {
  requests: PortalServiceRequest[];
  sequence: number;
}

/** Map<customerId, CustomerStore> */
const stores = new Map<string, CustomerStore>();

function getStore(customerId: string): CustomerStore {
  if (!stores.has(customerId)) {
    stores.set(customerId, { requests: [], sequence: 0 });
  }
  return stores.get(customerId)!;
}

export function getRequestsForCustomer(customerId: string): PortalServiceRequest[] {
  return getStore(customerId).requests.slice();
}

export function createRequest(
  customerId: string,
  input: {
    request_type: PortalRequestType;
    description: string;
    order_id: string | null;
    product_sku: string | null;
    preferred_contact: string;
  }
): PortalServiceRequest {
  const store = getStore(customerId);
  store.sequence += 1;
  const ref = `SR-${new Date().getFullYear()}-${String(store.sequence).padStart(4, '0')}`;
  const req: PortalServiceRequest = {
    request_id: randomUUID(),
    customer_id: customerId,
    reference_number: ref,
    request_type: input.request_type,
    description: input.description,
    order_id: input.order_id,
    product_sku: input.product_sku,
    preferred_contact: input.preferred_contact,
    status: 'submitted',
    created_at: new Date().toISOString(),
  };
  store.requests.unshift(req);
  return req;
}

/** Test helper — wipes all stores so tests are isolated. */
export function _resetAllPortalStores(): void {
  stores.clear();
}
