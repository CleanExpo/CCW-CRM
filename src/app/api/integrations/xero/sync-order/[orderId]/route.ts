import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { getConfiguredTokenSource, getXeroMode } from '@/lib/integrations/xero';
import {
  normalizeOrderRouteParam,
  orderRouteParamIsUuid,
} from '@/lib/operations/order-route-param';

async function createXeroInvoice(accessToken: string, tenantId: string, payload: unknown) {
  const res = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Xero invoice create failed (${res.status})`);
  }
  return data as { Invoices?: Array<{ InvoiceID: string; InvoiceNumber: string; Status: string; Total: number }> };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const scope = await requireAuthScopeOrCronIntegrationJob(request);
  if (!scope) {
    return NextResponse.json(
      {
        detail:
          'Not authenticated. For cron, send Authorization: Bearer CRON_SECRET and set CRON_INTEGRATION_USER_ID.',
      },
      { status: 401 }
    );
  }

  const { orderId: rawOrderId } = await context.params;
  const param = normalizeOrderRouteParam(rawOrderId);
  if (!param) {
    return NextResponse.json({ detail: 'Order id or order number is required.' }, { status: 400 });
  }

  const include = {
    customer: { select: { companyName: true } },
    lineItems: { include: { product: { select: { name: true } } } },
  } as const;

  const ownerWhere = { ownerUserId: scope.userId };
  const row = orderRouteParamIsUuid(param)
    ? await prisma.order.findFirst({ where: { id: param, ...ownerWhere }, include })
    : await prisma.order.findFirst({ where: { orderNumber: param, ...ownerWhere }, include });
  if (!row) {
    return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
  }

  const mode = getXeroMode();
  if (mode === 'demo') {
    return NextResponse.json({
      success: true,
      mode: 'demo',
      order_id: row.id,
      order_number: row.orderNumber,
      xero_invoice_id: `DEMO-${row.id.slice(0, 8)}`,
      xero_invoice_number: `INV-DEMO-${row.orderNumber}`,
      total: row.total,
      status: 'DRAFT',
    });
  }

  const tokens = getConfiguredTokenSource(request);
  if (!tokens) {
    return NextResponse.json({ detail: 'Xero is not connected.' }, { status: 401 });
  }

  const payload = {
    Type: 'ACCREC',
    Contact: { Name: row.customer.companyName || 'Customer' },
    Date: new Date().toISOString().slice(0, 10),
    DueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
    Reference: row.orderNumber,
    LineItems: row.lineItems.map((li) => ({
      Description: li.product.name,
      Quantity: li.quantity,
      UnitAmount: li.unitPrice,
      AccountCode: '200',
      LineAmount: li.lineTotal,
    })),
  };

  try {
    const created = await createXeroInvoice(tokens.accessToken, tokens.tenantId, payload);
    const invoice = created.Invoices?.[0];
    if (!invoice) throw new Error('No invoice returned from Xero');
    return NextResponse.json({
      success: true,
      mode: 'live',
      order_id: row.id,
      order_number: row.orderNumber,
      xero_invoice_id: invoice.InvoiceID,
      xero_invoice_number: invoice.InvoiceNumber,
      total: invoice.Total,
      status: invoice.Status,
    });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to sync order to Xero' },
      { status: 502 }
    );
  }
}

