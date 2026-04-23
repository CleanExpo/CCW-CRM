/**
 * Map Prisma models to API JSON shapes (snake_case) previously returned by Supabase.
 */

import type { Customer, Order, Product, Quote } from '@prisma/client';

export type OrderLineApi = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export function orderLinesToApi(
  lines: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    product: { name: string };
  }>
): OrderLineApi[] {
  return lines.map((li) => ({
    id: li.id,
    product_id: li.productId,
    product_name: li.product.name,
    quantity: li.quantity,
    unit_price: li.unitPrice,
    line_total: li.lineTotal,
  }));
}

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

export function orderToApi(
  o: Order,
  customerName?: string,
  options?: { lines?: OrderLineApi[]; itemCount?: number }
) {
  const name = customerName ?? 'Unknown';
  const base = {
    id: o.id,
    customer_id: o.customerId,
    order_number: o.orderNumber,
    status: o.status,
    total: o.total,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    customer_name: name,
  };
  if (options?.lines?.length) {
    return {
      ...base,
      items: options.lines,
      order_items: options.lines,
      item_count: options.lines.length,
    };
  }
  if (options?.itemCount !== undefined) {
    return {
      ...base,
      item_count: options.itemCount,
    };
  }
  return base;
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
