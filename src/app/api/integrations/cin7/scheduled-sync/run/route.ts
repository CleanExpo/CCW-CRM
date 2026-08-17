import { runCin7ScheduledSyncJob } from '@/lib/integrations/cin7-server-scheduled-sync';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

/**
 * Fire-and-forget start for the sequential Cin7 walk.
 * The job logs start, per-entity progress, and the final result in this process.
 */
export async function POST() {
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
