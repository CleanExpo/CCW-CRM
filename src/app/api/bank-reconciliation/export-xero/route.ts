import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { exportReconciledFeedToXero } from '@/lib/integrations/xero-reconciliation-export';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as { feed_id?: string };
    const feedId = String(body.feed_id ?? '');
    if (!feedId) {
      return NextResponse.json({ detail: 'feed_id is required' }, { status: 400 });
    }

    const result = await exportReconciledFeedToXero({
      feedTransactionId: feedId,
      performedBy: scope.userId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
