import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { syncBankAccountFeeds } from '@/lib/bank-reconciliation/sync-feeds';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      account_id?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    };

    const result = await syncBankAccountFeeds({
      userId: scope.userId,
      accountId: body.account_id,
      startDate: body.start_date,
      endDate: body.end_date,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
