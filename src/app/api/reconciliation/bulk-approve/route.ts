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
      approvals?: Array<{ feed_id: string; pos_transaction_id?: string; target_type?: string; target_id?: string }>;
    };

    const approvals = body.approvals ?? [];
    let approved = 0;
    let failed = 0;

    for (const item of approvals) {
      try {
        const targetType = (item.target_type ?? 'pos_transaction') as
          | 'invoice'
          | 'purchase_order'
          | 'pos_transaction'
          | 'transfer'
          | 'fee'
          | 'rule';
        const targetId = item.target_id ?? item.pos_transaction_id;
        await applyBankMatch({
          feedId: item.feed_id,
          userId: scope.userId,
          targetType,
          targetId,
        });
        await exportReconciledFeedToXero({
          feedTransactionId: item.feed_id,
          performedBy: scope.userId,
        });
        approved++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ approved, failed });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
