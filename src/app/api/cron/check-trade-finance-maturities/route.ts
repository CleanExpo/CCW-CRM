import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { deriveAdvanceStatus } from '@/lib/trade-finance/status';
import { logOperationalEvent } from '@/lib/comms/operational-events';
import { dispatchWorkflowTrigger } from '@/lib/workflows/workflow-engine';
import { cronAuthFailure } from '@/lib/api/cron-auth';

export async function GET(request: Request) {
  try {
    const unauthorized = cronAuthFailure(request);
    if (unauthorized) return unauthorized;

    const userId = process.env.CRON_INTEGRATION_USER_ID?.trim();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'CRON_INTEGRATION_USER_ID not set' },
        { status: 503 }
      );
    }

    const advances = await prisma.tradeFinanceAdvance.findMany({
      where: {
        ownerUserId: userId,
        status: { notIn: ['repaid', 'closed'] },
      },
    });

    let overdue_marked = 0;
    let due_soon = 0;
    let workflows_dispatched = 0;
    const now = new Date();
    const since = new Date(Date.now() - 24 * 3600000);

    for (const adv of advances) {
      const derived = deriveAdvanceStatus({
        principalAmount: adv.principalAmount,
        repaidAmount: adv.repaidAmount,
        maturityDate: adv.maturityDate,
        status: adv.status,
      });

      if (derived === 'overdue' && adv.status !== 'overdue') {
        await prisma.tradeFinanceAdvance.update({
          where: { id: adv.id },
          data: { status: 'overdue' },
        });
        overdue_marked++;

        await logOperationalEvent({
          ownerUserId: userId,
          eventType: 'trade_finance',
          source: 'system',
          title: `Advance ${adv.advanceNumber} overdue`,
          entityType: 'trade_finance_advance',
          entityId: adv.id,
        });

        const recent = await prisma.workflowInstance.findFirst({
          where: {
            ownerUserId: userId,
            triggerEntityType: 'trade_finance_advance',
            triggerEntityId: adv.id,
            startedAt: { gte: since },
          },
        });
        if (!recent) {
          const result = await dispatchWorkflowTrigger('advance_overdue', {
            ownerUserId: userId,
            triggerEntityType: 'trade_finance_advance',
            triggerEntityId: adv.id,
            payload: { advance_number: adv.advanceNumber },
          });
          workflows_dispatched += result.instances;
        }
      } else if (derived === 'due' && adv.status !== 'due' && adv.status !== 'overdue') {
        await prisma.tradeFinanceAdvance.update({
          where: { id: adv.id },
          data: { status: 'due' },
        });
        due_soon++;
      }
    }

    const expiringLcs = await prisma.tradeFinanceLetterOfCredit.findMany({
      where: {
        ownerUserId: userId,
        status: { notIn: ['paid', 'cancelled', 'expired'] },
        expiryDate: { lte: new Date(now.getTime() + 14 * 86400000) },
      },
    });

    let lc_expiring = 0;
    for (const lc of expiringLcs) {
      if (lc.expiryDate.getTime() < now.getTime()) {
        await prisma.tradeFinanceLetterOfCredit.update({
          where: { id: lc.id },
          data: { status: 'expired' },
        });
      }
      lc_expiring++;
    }

    logger.info('Trade finance maturity cron', {
      overdue_marked,
      due_soon,
      lc_expiring,
      workflows_dispatched,
    });

    return NextResponse.json({
      success: true,
      overdue_marked,
      due_soon,
      lc_expiring,
      workflows_dispatched,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Trade finance maturity cron error', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
