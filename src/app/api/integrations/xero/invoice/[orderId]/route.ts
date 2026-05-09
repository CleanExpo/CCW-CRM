import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getConfiguredTokenSource, getXeroMode } from '@/lib/integrations/xero';
import {
  normalizeOrderRouteParam,
  orderRouteParamIsUuid,
} from '@/lib/operations/order-route-param';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const { orderId: rawOrderId } = await context.params;
  const param = normalizeOrderRouteParam(rawOrderId);
  if (!param) {
    return NextResponse.json({ detail: 'Order id or order number is required.' }, { status: 400 });
  }

  const select = { id: true, orderNumber: true, total: true, createdAt: true } as const;
  const ownerWhere = { ownerUserId: scope.userId };
  const order = orderRouteParamIsUuid(param)
    ? await prisma.order.findFirst({ where: { id: param, ...ownerWhere }, select })
    : await prisma.order.findFirst({ where: { orderNumber: param, ...ownerWhere }, select });
  if (!order) return NextResponse.json({ detail: 'Order not found' }, { status: 404 });

  if (getXeroMode() === 'demo') {
    return NextResponse.json({
      invoice_id: `DEMO-${order.id.slice(0, 8)}`,
      invoice_number: `INV-DEMO-${order.orderNumber}`,
      status: 'DRAFT',
      total: order.total,
      amount_due: order.total,
      date: order.createdAt.toISOString(),
      due_date: new Date(order.createdAt.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    });
  }

  const tokens = getConfiguredTokenSource(request);
  if (!tokens) return NextResponse.json({ detail: 'Xero is not connected.' }, { status: 401 });

  const query = encodeURIComponent(`Reference=="${order.orderNumber}"`);
  const xeroRes = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?where=${query}`, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Xero-tenant-id': tokens.tenantId,
      Accept: 'application/json',
    },
  });
  if (!xeroRes.ok) {
    return NextResponse.json({ detail: `Failed to fetch Xero invoice (${xeroRes.status})` }, { status: 502 });
  }
  const data = (await xeroRes.json()) as {
    Invoices?: Array<{
      InvoiceID: string;
      InvoiceNumber: string;
      Status: string;
      Total: number;
      AmountDue: number;
      DateString?: string;
      DueDateString?: string;
    }>;
  };
  const invoice = data.Invoices?.[0];
  if (!invoice) return NextResponse.json({ detail: 'No Xero invoice found for this order.' }, { status: 404 });

  return NextResponse.json({
    invoice_id: invoice.InvoiceID,
    invoice_number: invoice.InvoiceNumber,
    status: invoice.Status,
    total: invoice.Total,
    amount_due: invoice.AmountDue,
    date: invoice.DateString || '',
    due_date: invoice.DueDateString || '',
  });
}

