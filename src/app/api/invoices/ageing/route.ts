/**
 * GET /api/invoices/ageing
 *
 * Returns a per-customer debtor ageing ledger.
 *
 * Query params:
 *   as_of  (ISO date string, default = today UTC)
 *
 * Response shape:
 *   {
 *     as_of: string,           // ISO date used for bucket calculation
 *     rows: CustomerAgeingRow[]
 *   }
 *
 * Only invoices with status NOT IN ('draft', 'cancelled') and outstanding > 0 are included.
 *
 * NOTE: Invoice.dueDate is used as-stored (it is the authoritative due date per the AU
 * standard for existing invoices). New invoices should compute dueDate via computeDueDate()
 * respecting the customer's creditTermsType.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  buildCustomerAgeingLedger,
  type InvoiceForAgeingWithCustomer,
} from '@/lib/finance/debtor-ageing';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const { searchParams } = new URL(request.url);
    const asOfParam = searchParams.get('as_of');
    const asOf = asOfParam ? new Date(asOfParam) : new Date();
    if (isNaN(asOf.getTime())) {
      return NextResponse.json({ detail: 'Invalid as_of date' }, { status: 400 });
    }

    // Fetch all non-draft, non-cancelled invoices that may have an outstanding balance.
    // We fetch amountPaid from the DB field — InvoicePayment sum is maintained by the
    // record-payment route (TASK-2 seam: we use the DB field, not re-summing payments,
    // because the payments relation may return empty in some call paths per PROJECT-STATUS.md).
    const invoiceRows = await prisma.invoice.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        status: { notIn: ['draft', 'cancelled'] },
      },
      select: {
        id: true,
        customerId: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: {
          select: {
            companyName: true,
            email: true,
            creditLimitAUD: true,
          },
        },
      },
    });

    const invoices: InvoiceForAgeingWithCustomer[] = invoiceRows.map((inv) => ({
      id: inv.id,
      customerId: inv.customerId,
      dueDate: inv.dueDate,
      total: inv.total,
      amountPaid: inv.amountPaid,
      companyName: inv.customer.companyName,
      email: inv.customer.email ?? null,
      creditLimitAUD: inv.customer.creditLimitAUD != null ? Number(inv.customer.creditLimitAUD) : null,
    }));

    const rows = buildCustomerAgeingLedger(invoices, asOf);

    return NextResponse.json({
      as_of: asOf.toISOString().slice(0, 10),
      rows,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
