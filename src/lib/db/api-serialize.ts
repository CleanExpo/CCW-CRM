/**
 * Map Prisma models to API JSON shapes (snake_case) previously returned by Supabase.
 */

import type {
  Customer,
  Invoice as InvoiceRow,
  InvoiceLineItem,
  Order,
  Product,
  Quote,
} from '@prisma/client';

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
  const short = c.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return {
    id: c.id,
    /** Stable display ref for selects/lists (schema has no separate customer_number column). */
    customer_number: `C-${short}`,
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
    valid_until: q.validUntil ? q.validUntil.toISOString().split('T')[0] : null,
    notes: q.notes ?? null,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
    customer_name: name,
  };
}

export function invoiceLineToApi(
  line: InvoiceLineItem & { product?: Product | null }
) {
  return {
    id: line.id,
    invoice_id: line.invoiceId,
    product_id: line.productId ?? '',
    product_name: line.product?.name,
    product_sku: line.product?.sku,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    tax_rate: line.taxRate,
    tax_amount: line.taxAmount,
    subtotal: line.lineSubtotal,
    total: line.lineTotal,
    created_at: line.createdAt.toISOString(),
    updated_at: line.updatedAt.toISOString(),
  };
}

export function invoiceToApi(
  inv: InvoiceRow & {
    customer?: Pick<Customer, 'companyName' | 'email'> | null;
    items?: Array<InvoiceLineItem & { product?: Product | null }>;
  }
) {
  const amountDue = inv.total - inv.amountPaid;
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    order_id: inv.orderId ?? undefined,
    customer_id: inv.customerId,
    customer_name: inv.customer?.companyName,
    customer_email: inv.customer?.email ?? undefined,
    invoice_date: inv.invoiceDate.toISOString().split('T')[0],
    due_date: inv.dueDate.toISOString().split('T')[0],
    status: inv.status,
    notes: inv.notes ?? undefined,
    subtotal: inv.subtotal,
    tax_total: inv.taxTotal,
    total: inv.total,
    amount_paid: inv.amountPaid,
    amount_due: amountDue,
    items: (inv.items ?? []).map((li) => invoiceLineToApi(li)),
    payments: [],
    created_at: inv.createdAt.toISOString(),
    updated_at: inv.updatedAt.toISOString(),
  };
}

export function invoiceSummaryToApi(
  inv: InvoiceRow & {
    customer: Pick<Customer, 'companyName'>;
    _count: { items: number };
  }
) {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    customer_name: inv.customer.companyName,
    invoice_date: inv.invoiceDate.toISOString().split('T')[0],
    due_date: inv.dueDate.toISOString().split('T')[0],
    status: inv.status,
    total: inv.total,
    amount_due: inv.total - inv.amountPaid,
    item_count: inv._count.items,
  };
}
