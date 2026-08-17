/**
 * Node-only Cin7 scheduler boot. Keep this file out of the webpack browser
 * compile of `instrumentation.ts` — it imports Prisma/`pg` (`tls`, `net`).
 */
import { runCin7ScheduledSyncJob } from '@/lib/integrations/cin7-server-scheduled-sync';
import {
  registerCin7ScheduledSyncRunner,
  startCin7ServerScheduler,
} from '@/lib/integrations/cin7-server-scheduler';

registerCin7ScheduledSyncRunner(runCin7ScheduledSyncJob);
startCin7ServerScheduler();
