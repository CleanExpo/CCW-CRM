import { describe, expect, it } from 'vitest';

describe('Cin7 scheduler wiring (static)', () => {
  const REPO_ROOT = process.cwd();

  it('browser runner does not fire sync or tell staff to keep the tab open', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/(dashboard)/settings/integrations/components/Cin7ScheduledSyncRunner.tsx`,
      'utf8'
    );
    expect(src).not.toContain('syncCin7EntityUntilComplete');
    expect(src).not.toContain('Keep this page open');
    expect(src).not.toContain('2_000');
    expect(src).not.toContain('border-amber-500');
    expect(src).toContain('CIN7_SYNC_SCHEDULE_LABEL');
    expect(src).not.toContain('5:00 AM');
    expect(src).not.toContain('5 minutes');
    expect(src).toContain('cin7ScheduleStatusPollDelayMs');
    expect(src).toContain('getCin7ScheduledSyncStatus');
  });

  it('nightly cron uses the server sequential walk', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/cron/nightly-full-sync/route.ts`,
      'utf8'
    );
    expect(src).toContain('runCin7ScheduledSyncJob');
    expect(src).toContain("from '@/lib/api/cron-auth'");
    expect(src).not.toContain('CIN7_RECON_GATE_ENTITIES');
  });

  it('instrumentation starts the in-process clock scheduler', async () => {
    const fs = await import('node:fs/promises');
    const instrumentation = await fs.readFile(`${REPO_ROOT}/src/instrumentation.ts`, 'utf8');
    const nodeBoot = await fs.readFile(`${REPO_ROOT}/src/instrumentation.node.ts`, 'utf8');
    const scheduler = await fs.readFile(
      `${REPO_ROOT}/src/lib/integrations/cin7-server-scheduler.ts`,
      'utf8'
    );
    const job = await fs.readFile(
      `${REPO_ROOT}/src/lib/integrations/cin7-server-scheduled-sync.ts`,
      'utf8'
    );
    expect(instrumentation).toContain('./instrumentation.node');
    expect(instrumentation).not.toContain('cin7-server-scheduled-sync');
    expect(nodeBoot).toContain('startCin7ServerScheduler');
    expect(nodeBoot).toContain('runCin7ScheduledSyncJob');
    expect(scheduler).not.toContain('CIN7_SYNC_TEST_DELAY');
    expect(scheduler).not.toContain('5 minutes');
    expect(scheduler).not.toContain('5:00 AM');
    expect(scheduler).toContain('getNextCin7ProductionFireAt');
    expect(scheduler).toContain('[cin7-scheduler] triggered');
    expect(scheduler).toContain('registerCin7ScheduledSyncRunner');
    expect(scheduler).not.toContain('cin7-server-scheduled-sync');
    expect(scheduler).not.toContain('scheduled-sync/run');
    expect(job).toContain('[cin7-scheduled-sync] started');
    expect(job).toContain('[cin7-scheduled-sync] completed');
    expect(job).toContain('postCin7SyncEntity');
    expect(job).toContain('withPgAdvisoryLock');
    expect(job).toContain('CIN7_SCHEDULED_SYNC_LOCK');
    expect(job).not.toContain("redirect: 'manual'");
  });
});
