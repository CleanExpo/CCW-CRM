import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { logger } from '@/lib/logger';
import { dispatchWorkflowTrigger } from '@/lib/workflows/workflow-engine';
import { logOperationalEvent } from '@/lib/comms/operational-events';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = process.env.CRON_INTEGRATION_USER_ID?.trim();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'CRON_INTEGRATION_USER_ID not set' },
        { status: 503 }
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        ownerUserId: userId,
        status: { in: ['sent', 'partial'] },
      },
      include: {
        customer: { select: { id: true, email: true, companyName: true } },
      },
      take: 500,
    });

    let overdue_found = 0;
    let workflows_dispatched = 0;
    const since = new Date(Date.now() - 24 * 3600000);

    for (const inv of invoices) {
      const status = deriveInvoiceStatus(inv);
      if (status !== 'overdue') continue;
      overdue_found++;

      const recentRun = await prisma.workflowInstance.findFirst({
        where: {
          ownerUserId: userId,
          triggerEntityType: 'invoice',
          triggerEntityId: inv.id,
          startedAt: { gte: since },
        },
      });
      if (recentRun) continue;

      await logOperationalEvent({
        ownerUserId: userId,
        customerId: inv.customerId,
        eventType: 'invoice',
        source: 'system',
        title: `Invoice ${inv.invoiceNumber} overdue`,
        description: inv.customer?.companyName ?? null,
        entityType: 'invoice',
        entityId: inv.id,
        metadata: { total: inv.total, amount_paid: inv.amountPaid },
      });

      const result = await dispatchWorkflowTrigger('invoice_overdue', {
        ownerUserId: userId,
        triggerEntityType: 'invoice',
        triggerEntityId: inv.id,
        customerId: inv.customerId,
        customerEmail: inv.customer?.email ?? null,
        payload: { invoice_number: inv.invoiceNumber, total: inv.total },
      });
      workflows_dispatched += result.instances;
    }

    logger.info('Check invoice overdue cron', {
      overdue_found,
      workflows_dispatched,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      overdue_found,
      workflows_dispatched,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Check invoice overdue cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
