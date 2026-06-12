/**
 * POST /api/bank-feeds/bulk-reconcile
 *
 * Bulk match N bank-feed transactions to N POS transactions.
 *
 * UNI-2113 requirements:
 * (a) Audit trail — one ReconciliationMatchAudit row per pair (success or failure).
 * (b) Partial failures — if some pairs fail validation the rest still succeed.
 *     The 200 response itemises every failure with its reason.
 * (c) Auth/workspace scoping — requireAuthScope → getWorkspaceIdForUser → 401/403.
 *
 * Request body:
 *   { "matches": [{ "bank_feed_id": "…", "pos_transaction_id": "…" }] }
 *
 * Response 200:
 *   {
 *     "success": boolean,        // true only when failed_count === 0
 *     "matched_count": number,
 *     "failed_count": number,
 *     "failures": [{ "bank_feed_id": "…", "pos_transaction_id": "…", "reason": "…" }],
 *     "errors": string[]         // legacy alias kept for backwards compat
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';

interface MatchPair {
  bank_feed_id?: string;
  pos_transaction_id?: string;
}

interface FailureDetail {
  bank_feed_id: string;
  pos_transaction_id: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  // ── Input validation ───────────────────────────────────────────────────────
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

  // ── Per-pair processing with partial-failure semantics ─────────────────────
  let matchedCount = 0;
  let failedCount = 0;
  const failures: FailureDetail[] = [];
  const errors: string[] = []; // backwards-compat field

  for (const pair of matches) {
    const feedId = String(pair.bank_feed_id ?? '').trim();
    const posId = String(pair.pos_transaction_id ?? '').trim();

    // Validate IDs present
    if (!feedId || !posId) {
      const reason = 'Missing bank_feed_id or pos_transaction_id';
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;

      // Audit the failure (no DB rows to update, but record intent)
      await prisma.reconciliationMatchAudit.create({
        data: {
          matchedByUserId: scope.userId,
          bankFeedId: feedId || '00000000-0000-0000-0000-000000000000',
          posTransactionId: posId || '00000000-0000-0000-0000-000000000000',
          outcome: 'failed',
          failureReason: reason,
        },
      });
      continue;
    }

    // Validate ownership: bank feed must belong to this user's workspace,
    // POS transaction must be owned by this user.
    const [feed, pos] = await Promise.all([
      prisma.bankFeedTransaction.findFirst({
        where: { id: feedId, bankAccount: { ownerUserId: scope.userId } },
      }),
      prisma.posTransaction.findFirst({
        where: { id: posId, ownerUserId: scope.userId },
      }),
    ]);

    if (!feed) {
      const reason = `Bank feed transaction not found or not accessible: ${feedId}`;
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await prisma.reconciliationMatchAudit.create({
        data: {
          matchedByUserId: scope.userId,
          bankFeedId: feedId,
          posTransactionId: posId,
          outcome: 'failed',
          failureReason: reason,
        },
      });
      continue;
    }

    if (!pos) {
      const reason = `POS transaction not found or not accessible: ${posId}`;
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await prisma.reconciliationMatchAudit.create({
        data: {
          matchedByUserId: scope.userId,
          bankFeedId: feedId,
          posTransactionId: posId,
          outcome: 'failed',
          failureReason: reason,
        },
      });
      continue;
    }

    // Guard: skip already-reconciled pairs
    if (feed.reconciled) {
      const reason = `Bank feed transaction already reconciled: ${feedId}`;
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await prisma.reconciliationMatchAudit.create({
        data: {
          matchedByUserId: scope.userId,
          bankFeedId: feedId,
          posTransactionId: posId,
          outcome: 'failed',
          failureReason: reason,
        },
      });
      continue;
    }

    if (pos.reconciliationStatus === 'reconciled') {
      const reason = `POS transaction already reconciled: ${posId}`;
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;
      await prisma.reconciliationMatchAudit.create({
        data: {
          matchedByUserId: scope.userId,
          bankFeedId: feedId,
          posTransactionId: posId,
          outcome: 'failed',
          failureReason: reason,
        },
      });
      continue;
    }

    // Attempt the match inside a DB transaction; catch per-pair errors
    try {
      await prisma.$transaction([
        prisma.bankFeedTransaction.update({
          where: { id: feedId },
          data: { reconciled: true, matchedPosTxId: posId },
        }),
        prisma.posTransaction.update({
          where: { id: posId },
          data: { reconciliationStatus: 'reconciled' },
        }),
        // Audit record — the single source of truth for "who matched what, when"
        prisma.reconciliationMatchAudit.create({
          data: {
            matchedByUserId: scope.userId,
            bankFeedId: feedId,
            posTransactionId: posId,
            outcome: 'matched',
          },
        }),
      ]);
      matchedCount += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ bank_feed_id: feedId, pos_transaction_id: posId, reason });
      errors.push(reason);
      failedCount += 1;

      // Best-effort audit of the failure
      try {
        await prisma.reconciliationMatchAudit.create({
          data: {
            matchedByUserId: scope.userId,
            bankFeedId: feedId,
            posTransactionId: posId,
            outcome: 'failed',
            failureReason: reason,
          },
        });
      } catch {
        // If even the audit write fails we still return the correct counts
      }
    }
  }

  return NextResponse.json({
    success: failedCount === 0,
    matched_count: matchedCount,
    failed_count: failedCount,
    failures,
    errors, // backwards compat
  });
}
