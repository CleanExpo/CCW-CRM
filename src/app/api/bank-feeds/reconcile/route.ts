import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { applyBankMatch } from '@/lib/bank-reconciliation/apply-match';
import { exportReconciledFeedToXero } from '@/lib/integrations/xero-reconciliation-export';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      feed_id?: string;
      pos_transaction_id?: string;
      target_type?: string;
      target_id?: string;
      export_to_xero?: boolean;
    };

    const feedId = String(body.feed_id ?? '');
    const targetId = body.target_id ?? body.pos_transaction_id;
    const targetType = (body.target_type ?? 'pos_transaction') as
      | 'invoice'
      | 'purchase_order'
      | 'pos_transaction'
      | 'transfer'
      | 'fee'
      | 'rule';

    if (!feedId || !targetId) {
      return NextResponse.json(
        { detail: 'feed_id and target_id (or pos_transaction_id) are required' },
        { status: 400 }
      );
    }

    await applyBankMatch({
      feedId,
      userId: scope.userId,
      targetType,
      targetId,
    });

    let xero = null;
    if (body.export_to_xero !== false) {
      xero = await exportReconciledFeedToXero({
        feedTransactionId: feedId,
        performedBy: scope.userId,
      });
    }

    return NextResponse.json({
      feed_id: feedId,
      target_id: targetId,
      status: 'reconciled',
      xero,
    });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
