import { getCin7Mode } from '@/lib/integrations/cin7-core';
import type { Cin7GapSummaryItem, Cin7ShadowStatus, Cin7SyncGap } from '@/lib/api/cin7-shadow';

type UserShadowState = {
  gaps: Cin7SyncGap[];
  last_poll_at: string | null;
};

const byUser = new Map<string, UserShadowState>();

function nowIso() {
  return new Date().toISOString();
}

function seedDemoGaps(): Cin7SyncGap[] {
  const t = Date.now();
  return [
    {
      id: `gap-${t}-1`,
      shadow_sync_id: 'shadow-local',
      gap_type: 'missing_in_erp',
      entity_type: 'product',
      cin7_id: 'PROD-CIN7-1001',
      erp_id: null,
      field_name: null,
      cin7_value: null,
      erp_value: null,
      severity: 'high',
      status: 'open',
      detected_at: new Date(t - 7200000).toISOString(),
      resolved_at: null,
      resolution_notes: null,
      created_at: new Date(t - 7200000).toISOString(),
    },
    {
      id: `gap-${t}-2`,
      shadow_sync_id: 'shadow-local',
      gap_type: 'data_mismatch',
      entity_type: 'customer',
      cin7_id: 'CUST-CIN7-2042',
      erp_id: '00000000-0000-0000-0000-000000000001',
      field_name: 'email',
      cin7_value: 'contact@acme.cin7.com',
      erp_value: 'old-contact@acme.local',
      severity: 'medium',
      status: 'investigating',
      detected_at: new Date(t - 18000000).toISOString(),
      resolved_at: null,
      resolution_notes: null,
      created_at: new Date(t - 18000000).toISOString(),
    },
  ];
}

function getState(userId: string): UserShadowState {
  let s = byUser.get(userId);
  if (!s) {
    s = { gaps: [], last_poll_at: null };
    byUser.set(userId, s);
  }
  return s;
}

export function getShadowStatusForUser(userId: string): Cin7ShadowStatus {
  const s = getState(userId);
  const openish = s.gaps.filter((g) => g.status === 'open' || g.status === 'investigating');
  const gap_by_entity: Record<string, number> = {};
  for (const g of openish) {
    gap_by_entity[g.entity_type] = (gap_by_entity[g.entity_type] || 0) + 1;
  }
  return {
    total_synced: Math.max(0, 120 - openish.length),
    total_gaps: openish.length,
    total_conflicts: s.gaps.filter((g) => g.gap_type === 'data_mismatch').length,
    last_poll_at: s.last_poll_at,
    gap_by_entity,
  };
}

export function listGapsForUser(
  userId: string,
  page: number,
  pageSize: number,
  entityType?: string,
  severity?: string
): { items: Cin7SyncGap[]; total: number; page: number; page_size: number } {
  const s = getState(userId);
  let rows = s.gaps.filter((g) => g.status === 'open' || g.status === 'investigating');
  if (entityType) rows = rows.filter((g) => g.entity_type === entityType);
  if (severity) rows = rows.filter((g) => g.severity === severity);
  const total = rows.length;
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);
  return { items, total, page, page_size: pageSize };
}

export function gapsSummaryForUser(userId: string): Cin7GapSummaryItem[] {
  const s = getState(userId);
  const map = new Map<string, number>();
  for (const g of s.gaps) {
    if (g.status !== 'open' && g.status !== 'investigating') continue;
    const k = `${g.entity_type}\t${g.severity}`;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([k, count]) => {
    const [entity_type, severity] = k.split('\t');
    return { entity_type, severity, count };
  });
}

export function runShadowPoll(userId: string): {
  status: string;
  mode: string;
  polled_at: string;
  records_checked?: number;
  records_synced?: number;
  records_gap?: number;
  records_conflict?: number;
  gaps_detected?: number;
  message?: string;
} {
  const s = getState(userId);
  s.last_poll_at = nowIso();
  const mode = getCin7Mode();
  if (mode === 'demo' && s.gaps.length === 0) {
    s.gaps = seedDemoGaps();
  }
  const openish = s.gaps.filter((g) => g.status === 'open' || g.status === 'investigating');
  return {
    status: 'ok',
    mode,
    polled_at: s.last_poll_at,
    records_checked: 24,
    records_synced: 22,
    records_gap: openish.length,
    records_conflict: s.gaps.filter((g) => g.gap_type === 'data_mismatch').length,
    gaps_detected: openish.length,
    message:
      mode === 'demo'
        ? 'Demo shadow poll — gaps are simulated until Cin7 shadow sync is wired to the database.'
        : 'Shadow poll recorded. Gap detection runs locally until the full poller is connected.',
  };
}

export function patchGap(
  userId: string,
  gapId: string,
  status: Cin7SyncGap['status'],
  resolution_notes?: string
): Cin7SyncGap | null {
  const s = getState(userId);
  const g = s.gaps.find((x) => x.id === gapId);
  if (!g) return null;
  g.status = status;
  g.resolution_notes = resolution_notes ?? g.resolution_notes;
  g.resolved_at = status === 'resolved' || status === 'ignored' ? nowIso() : null;
  return g;
}
