/**
 * @deprecated Import from `@/lib/integrations/cin7-scheduled-sync`.
 * Kept so existing imports keep resolving. Scheduling itself is server-side.
 */

export {
  CIN7_LIVE_RECON_REFRESHED_EVENT,
  CIN7_SCHEDULED_SYNC_ENTITY_ORDER as CIN7_CLIENT_SYNC_ENTITY_ORDER,
  CIN7_SCHEDULED_SYNC_ENV,
  formatCountdownUntil,
  formatScheduledFireAt,
  getCin7ScheduledSyncRaw as getCin7ScheduledSyncEnv,
  getNextCin7ScheduledFireAt,
  parseCin7ScheduledSyncAt,
  type Cin7ScheduleSpec,
  type Cin7ScheduledSyncEntity as Cin7ClientSyncEntity,
} from '@/lib/integrations/cin7-scheduled-sync';
