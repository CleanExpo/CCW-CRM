import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { runCapture } from '@/lib/price-mole/price-mole-service';

/**
 * Runs one budgeted capture. Staff call it from the Price Mole screen; a cron
 * job can call it with the cron secret. It is deliberately NOT registered on a
 * schedule: turning on regular fetching of competitor sites is a human decision.
 * Body: { page_budget?, competitor_product_id? }.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScopeOrCronIntegrationJob(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const secret = process.env.CRON_SECRET?.trim();
    const isCron = Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
    const body = await request.json().catch(() => ({}));
    const pageBudget = body.page_budget === undefined ? undefined : Number(body.page_budget);
    if (pageBudget !== undefined && !(Number.isFinite(pageBudget) && pageBudget >= 1)) {
      return NextResponse.json(
        { detail: 'page_budget must be a number of at least 1' },
        { status: 400 }
      );
    }
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const res = await runCapture(ids, scope.userId, {
      trigger: isCron ? 'cron' : 'manual',
      pageBudget,
      onlyId:
        typeof body.competitor_product_id === 'string' ? body.competitor_product_id : undefined,
    });
    return NextResponse.json({
      run: {
        id: res.run.id,
        page_budget: res.run.pageBudget,
        attempted: res.run.attempted,
        succeeded: res.run.succeeded,
        failed: res.run.failed,
        skipped: res.run.skipped,
        stopped_reason: res.run.stoppedReason,
      },
      outcomes: res.outcomes,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
