import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { parseAsOf } from '@/lib/reorder-radar/as-of';
import {
  INVOICE_PAGE_SIZE,
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
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    if (scope.role !== 'owner' && scope.role !== 'admin' && !scope.isAdmin) {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const sp = new URL(request.url).searchParams;
    const format = sp.get('format');
    // ?as_of= keeps invoices dated on or before that day; ?page= walks the invoice
    // history INVOICE_PAGE_SIZE at a time, so a reader can fetch all of it.
    const rawAsOf = sp.get('as_of');
    const asOf = rawAsOf ? parseAsOf(rawAsOf) : null;
    if (rawAsOf && !asOf) {
      return NextResponse.json(
        { detail: 'as_of must be a real date, YYYY-MM-DD' },
        { status: 400 }
      );
    }
    const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1);

    const [invoiceRows, movements] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          ownerUserId: { in: workspaceUserIds },
          ...(asOf ? { invoiceDate: { lte: new Date(`${asOf}T00:00:00Z`) } } : {}),
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerId: true,
          branchName: true,
          invoiceDate: true,
          status: true,
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
        orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * INVOICE_PAGE_SIZE,
        take: INVOICE_PAGE_SIZE + 1,
      }),
      prisma.stockMovement.findMany({
        where: { ownerUserId: { in: workspaceUserIds } },
        orderBy: { occurredAt: 'desc' },
        take: 5000,
      }),
    ]);

    const hasMoreInvoices = invoiceRows.length > INVOICE_PAGE_SIZE;
    const invoices = invoiceRows.slice(0, INVOICE_PAGE_SIZE);

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
        invoice_status: inv.status,
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
      invoice_page: page,
      invoice_next_page: hasMoreInvoices ? page + 1 : null,
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
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Extract failed' },
      { status: 500 }
    );
  }
}
