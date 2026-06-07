import { NextRequest, NextResponse } from 'next/server';
import { applyBankMatch } from '@/lib/bank-reconciliation/apply-match';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { exportReconciledFeedToXero } from '@/lib/integrations/xero-reconciliation-export';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      feed_id?: string;
      target_type?: 'invoice' | 'purchase_order' | 'pos_transaction' | 'transfer' | 'fee' | 'rule';
      target_id?: string;
      notes?: string;
      export_to_xero?: boolean;
    };

    const feedId = String(body.feed_id ?? '');
    const targetType = body.target_type ?? 'transfer';
    if (!feedId) {
      return NextResponse.json({ detail: 'feed_id is required' }, { status: 400 });
    }

    await applyBankMatch({
      feedId,
      userId: scope.userId,
      targetType,
      targetId: body.target_id,
      notes: body.notes,
    });

    let xero = null;
    if (body.export_to_xero !== false) {
      xero = await exportReconciledFeedToXero({
        feedTransactionId: feedId,
        performedBy: scope.userId,
      });
    }

    return NextResponse.json({ feed_id: feedId, status: 'reconciled', xero });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
