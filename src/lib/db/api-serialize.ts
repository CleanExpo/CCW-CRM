/**
 * Map Prisma models to API JSON shapes (snake_case) previously returned by Supabase.
 */

import type { Customer, Order, Product, Quote } from '@prisma/client';

export function customerToApi(c: Customer) {
  return {
    id: c.id,
    company_name: c.companyName,
    contact_name: c.contactName,
    email: c.email,
    phone: c.phone,
    city: c.city,
    is_active: c.isActive,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function productToApi(p: Product) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    price: p.price,
    stock: p.stock,
    is_active: p.isActive,
    warehouse_location: p.warehouseLocation,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function orderToApi(o: Order, customerName?: string) {
  const name = customerName ?? 'Unknown';
  return {
    id: o.id,
    customer_id: o.customerId,
    order_number: o.orderNumber,
    status: o.status,
    total: o.total,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    customer_name: name,
  };
}

export function quoteToApi(q: Quote, customerName?: string) {
  const name = customerName ?? 'Unknown';
  return {
    id: q.id,
    customer_id: q.customerId,
    quote_number: q.quoteNumber,
    status: q.status,
    total: q.total,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
    customer_name: name,
  };
}
