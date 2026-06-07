import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { deriveAdvanceStatus } from '@/lib/trade-finance/status';
import { logOperationalEvent } from '@/lib/comms/operational-events';
import { dispatchWorkflowTrigger } from '@/lib/workflows/workflow-engine';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const ownerIds = await workspaceOwnerIds(scope.userId);
    const body = (await request.json()) as {
      amount?: number;
      payment_date?: string;
      reference?: string;
      notes?: string;
    };

    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ detail: 'amount must be greater than 0' }, { status: 400 });
    }

    const advance = await prisma.tradeFinanceAdvance.findFirst({
      where: { id, ownerUserId: { in: ownerIds } },
    });
    if (!advance) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const paymentDate = body.payment_date ? new Date(body.payment_date) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json({ detail: 'Invalid payment_date' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.tradeFinanceRepayment.create({
        data: {
          advanceId: id,
          amount,
          paymentDate,
          reference: body.reference ?? null,
          notes: body.notes ?? null,
        },
      });

      const repaid = advance.repaidAmount + amount;
      const status = deriveAdvanceStatus({
        principalAmount: advance.principalAmount,
        repaidAmount: repaid,
        maturityDate: advance.maturityDate,
        status: repaid >= advance.principalAmount - 0.005 ? 'closed' : advance.status,
      });

      return tx.tradeFinanceAdvance.update({
        where: { id },
        data: {
          repaidAmount: repaid,
          status: status === 'repaid' ? 'repaid' : status,
        },
      });
    });

    await logOperationalEvent({
      ownerUserId: scope.userId,
      eventType: 'trade_finance',
      source: 'system',
      title: `Repayment on ${advance.advanceNumber}`,
      description: `$${amount.toFixed(2)}`,
      entityType: 'trade_finance_advance',
      entityId: advance.id,
    });

    if (updated.repaidAmount >= updated.principalAmount - 0.005) {
      void dispatchWorkflowTrigger('advance_repaid', {
        ownerUserId: scope.userId,
        triggerEntityType: 'trade_finance_advance',
        triggerEntityId: updated.id,
        payload: { advance_number: updated.advanceNumber },
      });
    }

    return NextResponse.json({
      id: updated.id,
      repaid_amount: updated.repaidAmount,
      balance: Math.max(updated.principalAmount - updated.repaidAmount, 0),
      status: updated.status,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
