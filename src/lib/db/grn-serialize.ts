import { prisma } from '@/lib/db/prisma';
import type { GoodsReceipt, GoodsReceiptLine } from '@prisma/client';

export function lineToApi(l: GoodsReceiptLine) {
  return {
    id: l.id,
    goods_receipt_id: l.goodsReceiptId,
    product_id: l.productId,
    sku: l.sku,
    product_name: l.productName,
    ordered_qty: l.orderedQty,
    received_qty: l.receivedQty,
    put_away_location: l.putAwayLocation,
    batch_number: l.batchNumber,
    expiry_date: l.expiryDate?.toISOString().split('T')[0] ?? null,
    condition: l.condition as 'good' | 'damaged' | 'short',
    notes: l.notes,
  };
}

export function grnToApi(r: GoodsReceipt & { lines: GoodsReceiptLine[] }) {
  return {
    id: r.id,
    cin7_po_mapping_id: r.cin7PoMappingId,
    po_reference: r.poReference,
    supplier_name: r.supplierName,
    received_by: r.receivedBy,
    received_date: r.receivedDate.toISOString().split('T')[0],
    location_id: r.locationId,
    notes: r.notes,
    status: r.status as 'draft' | 'confirmed' | 'synced' | 'failed',
    cin7_receipt_id: r.cin7ReceiptId,
    total_items_received: r.totalItemsReceived,
    created_at: r.createdAt.toISOString(),
    confirmed_at: r.confirmedAt?.toISOString() ?? null,
    synced_at: r.syncedAt?.toISOString() ?? null,
    lines: r.lines.map(lineToApi),
  };
}

export async function refreshGrnTotals(grnId: string) {
  const lines = await prisma.goodsReceiptLine.findMany({ where: { goodsReceiptId: grnId } });
  const total = lines.reduce((s: number, l: { receivedQty: number }) => s + l.receivedQty, 0);
  await prisma.goodsReceipt.update({
    where: { id: grnId },
    data: { totalItemsReceived: total },
  });
}
