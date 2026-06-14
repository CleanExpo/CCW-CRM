/**
 * POST /api/bank-feeds/bulk-reconcile
 *
 * UNI-2113: bulk POS matching with audit trail, partial failures, workspace scoping.
 * Uses the shared applyBankMatch path (same as single reconcile) plus POS audit rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { applyBankMatch } from '@/lib/bank-reconciliation/apply-match';
import {
  bankAccountOwnerFilter,
  workspaceOwnerIds,
} from '@/lib/bank-reconciliation/scope';
import { exportReconciledFeedToXero } from '@/lib/integrations/xero-reconciliation-export';

interface MatchPair {
  bank_feed_id?: string;
  pos_transaction_id?: string;
}

interface FailureDetail {
  bank_feed_id: string;
  pos_transaction_id: string;
  reason: string;
}

const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';

async function recordBulkMatchAudit(input: {
  userId: string;
  bankFeedId: string;
  posTransactionId: string;
  outcome: 'matched' | 'failed';
  failureReason?: string;
}) {
  try {
    await prisma.reconciliationMatchAudit.create({
      data: {
        matchedByUserId: input.userId,
        bankFeedId: input.bankFeedId,
        posTransactionId: input.posTransactionId,
        outcome: input.outcome,
        failureReason: input.failureReason ?? null,
      },
    });
  } catch {
    // Audit failure must not block bulk response counts
  }
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const ownerIds = await workspaceOwnerIds(scope.userId);

  let body: { matches?: MatchPair[] };
  try {
    body = (await request.json()) as { matches?: MatchPair[] };
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  const matches = Array.isArray(body.matches) ? body.matches : [];
  if (matches.length === 0) {
    return NextResponse.json(
      { detail: 'matches array is required and must be non-empty' },
      { status: 400 }
    );
  }

  let matchedCount = 0;
  let failedCount = 0;
  const failures: FailureDetail[] = [];
  const errors: string[] = [];

  for (const pair of matches) {
    const feedId = String(pair.bank_feed_id ?? '').trim();
    const posId = String(pair.pos_transaction_id ?? '').trim();

    if (!feedId || !posId) {
      const reason = 'Missing bank_feed_id or pos_transaction_id';
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await recordBulkMatchAudit({
        userId: scope.userId,
        bankFeedId: feedId || PLACEHOLDER_UUID,
        posTransactionId: posId || PLACEHOLDER_UUID,
        outcome: 'failed',
        failureReason: reason,
      });
      continue;
    }

    const [feed, pos] = await Promise.all([
      prisma.bankFeedTransaction.findFirst({
        where: {
          id: feedId,
          reconciled: false,
          bankAccount: bankAccountOwnerFilter(ownerIds),
        },
      }),
      prisma.posTransaction.findFirst({
        where: {
          id: posId,
          ownerUserId: { in: ownerIds },
        },
      }),
    ]);

    if (!feed) {
      const reason = `Bank feed transaction not found or not accessible: ${feedId}`;
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await recordBulkMatchAudit({
        userId: scope.userId,
        bankFeedId: feedId,
        posTransactionId: posId,
        outcome: 'failed',
        failureReason: reason,
      });
      continue;
    }

    if (!pos) {
      const reason = `POS transaction not found or not accessible: ${posId}`;
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await recordBulkMatchAudit({
        userId: scope.userId,
        bankFeedId: feedId,
        posTransactionId: posId,
        outcome: 'failed',
        failureReason: reason,
      });
      continue;
    }

    if (pos.reconciliationStatus === 'reconciled') {
      const reason = `POS transaction already reconciled: ${posId}`;
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await recordBulkMatchAudit({
        userId: scope.userId,
        bankFeedId: feedId,
        posTransactionId: posId,
        outcome: 'failed',
        failureReason: reason,
      });
      continue;
    }

    try {
      await applyBankMatch({
        feedId,
        userId: scope.userId,
        targetType: 'pos_transaction',
        targetId: posId,
        notes: 'Bulk POS reconciliation',
      });
      await exportReconciledFeedToXero({
        feedTransactionId: feedId,
        performedBy: scope.userId,
      });
      await recordBulkMatchAudit({
        userId: scope.userId,
        bankFeedId: feedId,
        posTransactionId: posId,
        outcome: 'matched',
      });
      matchedCount += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await recordBulkMatchAudit({
        userId: scope.userId,
        bankFeedId: feedId,
        posTransactionId: posId,
        outcome: 'failed',
        failureReason: reason,
      });
    }
  }

  return NextResponse.json({
    success: failedCount === 0,
    matched_count: matchedCount,
    failed_count: failedCount,
    failures,
    errors,
  });
}
