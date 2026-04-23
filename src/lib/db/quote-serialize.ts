import type { Product, Quote, QuoteLineItem } from '@prisma/client';

type QuoteWithLines = Quote & {
  lineItems: (QuoteLineItem & { product: Product })[];
};

export function quoteDetailToApi(q: QuoteWithLines, customerName?: string) {
  const name = customerName ?? 'Unknown';
  const items = q.lineItems.map((li) => ({
    id: li.id,
    product_id: li.productId,
    product_name: li.product.name,
    quantity: li.quantity,
    unit_price: li.unitPrice,
    line_total: li.lineTotal,
  }));
  return {
    id: q.id,
    customer_id: q.customerId,
    quote_number: q.quoteNumber,
    status: q.status,
    total: q.total,
    valid_until: q.validUntil?.toISOString().split('T')[0] ?? null,
    notes: q.notes ?? null,
    quote_date: q.createdAt.toISOString(),
    created_at: q.createdAt.toISOString(),
    updated_at: q.updatedAt.toISOString(),
    customer_name: name,
    items,
    quote_items: items,
  };
}
