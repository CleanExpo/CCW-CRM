import { NextRequest, NextResponse } from 'next/server';
import { applySplitMatch } from '@/lib/bank-reconciliation/apply-match';
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
      allocations?: Array<{
        allocation_type: string;
        target_id?: string;
        amount: number;
        gst_category?: string;
        account_code?: string;
        notes?: string;
      }>;
      export_to_xero?: boolean;
    };

    const feedId = String(body.feed_id ?? '');
    if (!feedId || !body.allocations?.length) {
      return NextResponse.json(
        { detail: 'feed_id and allocations are required' },
        { status: 400 }
      );
    }

    await applySplitMatch({
      feedId,
      userId: scope.userId,
      allocations: body.allocations,
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
