import type {
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  Supplier,
} from '@prisma/client';

type PoWithRelations = PurchaseOrder & {
  supplier: Supplier;
  lines: (PurchaseOrderLine & { product: Product })[];
};

export function purchaseOrderToApi(po: PoWithRelations) {
  return {
    id: po.id,
    po_number: po.poNumber,
    supplier_id: po.supplierId,
    supplier_name: po.supplier.companyName,
    supplier_code: po.supplier.supplierCode,
    delivery_location: po.deliveryLocation,
    status: po.status,
    order_date: po.orderDate.toISOString(),
    expected_delivery_date: po.expectedDeliveryDate?.toISOString() ?? undefined,
    actual_delivery_date: po.actualDeliveryDate?.toISOString() ?? undefined,
    subtotal: po.subtotal,
    tax: po.tax,
    shipping_cost: po.shippingCost ?? undefined,
    total: po.total,
    notes: po.notes ?? undefined,
    items: po.lines.map((l: { id: string; productId: string; product: { name: string; sku: string }; quantity: number; quantityReceived: number; unitCost: number; subtotal: number }) => ({
      id: l.id,
      product_id: l.productId,
      product_name: l.product.name,
      product_sku: l.product.sku,
      quantity: l.quantity,
      quantity_received: l.quantityReceived,
      unit_cost: l.unitCost,
      subtotal: l.subtotal,
      calculationMode: 'unit_cost' as const,
    })),
    created_at: po.createdAt.toISOString(),
    updated_at: po.updatedAt.toISOString(),
  };
}
