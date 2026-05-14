import type { Cin7WebhookSubscription } from '@/lib/api/cin7-webhook-subscriptions';

const byUser = new Map<string, Cin7WebhookSubscription[]>();

function list(userId: string): Cin7WebhookSubscription[] {
  return byUser.get(userId) ?? [];
}

function save(userId: string, rows: Cin7WebhookSubscription[]) {
  byUser.set(userId, rows);
}

export function listSubscriptions(userId: string, isActive?: boolean): Cin7WebhookSubscription[] {
  const rows = list(userId);
  if (isActive === undefined) return [...rows];
  return rows.filter((r) => r.is_active === isActive);
}

export function createSubscription(
  userId: string,
  input: { event_type: string; endpoint_url: string; secret_key?: string }
): Cin7WebhookSubscription {
  const t = new Date().toISOString();
  const row: Cin7WebhookSubscription = {
    id: crypto.randomUUID(),
    event_type: input.event_type,
    endpoint_url: input.endpoint_url,
    is_active: true,
    secret_key: input.secret_key ?? null,
    last_triggered_at: null,
    trigger_count: 0,
    created_at: t,
    updated_at: t,
  };
  const next = [...list(userId), row];
  save(userId, next);
  return row;
}

export function updateSubscription(
  userId: string,
  id: string,
  patch: { is_active?: boolean; endpoint_url?: string; secret_key?: string }
): Cin7WebhookSubscription | null {
  const rows = list(userId);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const cur = rows[idx];
  const updated: Cin7WebhookSubscription = {
    ...cur,
    ...('is_active' in patch && patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
    ...('endpoint_url' in patch && patch.endpoint_url !== undefined ? { endpoint_url: patch.endpoint_url } : {}),
    ...('secret_key' in patch && patch.secret_key !== undefined ? { secret_key: patch.secret_key } : {}),
    updated_at: new Date().toISOString(),
  };
  const next = [...rows];
  next[idx] = updated;
  save(userId, next);
  return updated;
}

export function deleteSubscription(userId: string, id: string): boolean {
  const rows = list(userId);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  save(userId, next);
  return true;
}
