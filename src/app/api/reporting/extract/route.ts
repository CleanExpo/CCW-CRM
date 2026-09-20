import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  toReportingCsv,
  type ExtractInvoiceLine,
  type ExtractStockMovement,
  type ReportingExtract,
} from '@/lib/reporting/transaction-extract';

/**
 * Dedicated read path (cutover list item 3). Authenticated extract of invoice
 * lines and stock movements — not the screen APIs, not a database URL.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  if (scope.role !== 'owner' && scope.role !== 'admin' && !scope.isAdmin) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
  const format = new URL(request.url).searchParams.get('format');

  const [invoices, movements] = await Promise.all([
    prisma.invoice.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        branchName: true,
        invoiceDate: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            product: { select: { sku: true } },
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 2000,
    }),
    prisma.stockMovement.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      orderBy: { occurredAt: 'desc' },
      take: 5000,
    }),
  ]);

  const invoice_lines: ExtractInvoiceLine[] = invoices.flatMap((inv) =>
    inv.items.map((item) => ({
      kind: 'invoice_line' as const,
      invoice_id: inv.id,
      invoice_number: inv.invoiceNumber,
      customer_id: inv.customerId,
      branch_name: inv.branchName,
      product_id: item.productId,
      sku: item.product?.sku ?? null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      invoice_date: inv.invoiceDate.toISOString().split('T')[0],
    }))
  );

  const stock_movements: ExtractStockMovement[] = movements.map((row) => ({
    kind: 'stock_movement' as const,
    movement_id: row.id,
    sku: row.sku,
    branch_name: row.branchName,
    quantity: row.quantity,
    movement_type: row.movementType,
    source_type: row.sourceType,
    source_id: row.sourceId,
    occurred_at: row.occurredAt.toISOString(),
  }));

  const extract: ReportingExtract = {
    generated_at: new Date().toISOString(),
    invoice_lines,
    stock_movements,
  };

  if (format === 'csv') {
    return new NextResponse(toReportingCsv(extract), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="optix-transaction-extract.csv"',
      },
    });
  }

  return NextResponse.json(extract);
}
