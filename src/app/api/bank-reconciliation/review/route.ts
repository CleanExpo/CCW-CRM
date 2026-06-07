import { NextRequest, NextResponse } from 'next/server';
import { flagFeedForReview } from '@/lib/bank-reconciliation/apply-match';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as { feed_id?: string; reason?: string };
    const feedId = String(body.feed_id ?? '');
    if (!feedId) {
      return NextResponse.json({ detail: 'feed_id is required' }, { status: 400 });
    }

    await flagFeedForReview({
      feedId,
      userId: scope.userId,
      reason: body.reason,
    });

    return NextResponse.json({ feed_id: feedId, review_status: 'flagged' });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
