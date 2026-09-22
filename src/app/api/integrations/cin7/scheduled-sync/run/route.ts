import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { runCin7ScheduledSyncJob } from '@/lib/integrations/cin7-server-scheduled-sync';
import { NextResponse, type NextRequest } from 'next/server';

export const maxDuration = 300;

/**
 * Fire-and-forget start for the sequential Cin7 walk.
 * The job logs start, per-entity progress, and the final result in this process.
 * Owner/admin (or the cron integration job) only: it runs a full Cin7 sync.
 */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScopeOrCronIntegrationJob(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  if (scope.role !== 'owner' && scope.role !== 'admin') {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 });
  }

  void runCin7ScheduledSyncJob()
    .then((result) => {
      console.log('[cin7-scheduled-sync] result', JSON.stringify(result));
    })
    .catch((error) => {
      console.error(
        '[cin7-scheduled-sync/run]',
        error instanceof Error ? error.message : error
      );
    });

  return NextResponse.json({ ok: true, started: true }, { status: 202 });
}
