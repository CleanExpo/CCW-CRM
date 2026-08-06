import { randomUUID } from 'crypto';

/** Mirrors `ShadowSessionResponse` in `@/lib/api/shadow` (server-only to avoid client imports). */
export interface ShadowSessionRecord {
  id: string;
  client_name: string;
  status: string;
  start_date: string;
  target_end_date: string | null;
  completed_at: string | null;
  readiness_score: number | null;
  total_syncs_run: number;
  successful_syncs: number;
  products_observed: number;
  orders_observed: number;
  customers_observed: number;
  invoices_observed: number;
  day_number: number;
  days_remaining: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

declare global {
  var __ccwShadowSessionsByUser: Map<string, ShadowSessionRecord> | undefined;
}

function getStore(): Map<string, ShadowSessionRecord> {
  if (!globalThis.__ccwShadowSessionsByUser) {
    globalThis.__ccwShadowSessionsByUser = new Map();
  }
  return globalThis.__ccwShadowSessionsByUser;
}

export function getShadowSessionForUser(userId: string): ShadowSessionRecord | null {
  return getStore().get(userId) ?? null;
}

export function upsertShadowSession(userId: string, session: ShadowSessionRecord): void {
  getStore().set(userId, session);
}

export function clearShadowSession(userId: string): void {
  getStore().delete(userId);
}

export function createShadowSessionRecord(input: {
  client_name?: string;
  notes?: string | null;
  duration_days?: number;
}): ShadowSessionRecord {
  const now = new Date();
  const iso = now.toISOString();
  const duration = Math.max(1, Math.min(365, input.duration_days ?? 30));
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + duration);

  return {
    id: randomUUID(),
    client_name: input.client_name?.trim() || 'Shadow programme',
    status: 'active',
    start_date: iso.split('T')[0],
    target_end_date: end.toISOString().split('T')[0],
    completed_at: null,
    readiness_score: null,
    total_syncs_run: 0,
    successful_syncs: 0,
    products_observed: 0,
    orders_observed: 0,
    customers_observed: 0,
    invoices_observed: 0,
    day_number: 1,
    days_remaining: Math.max(0, duration - 1),
    notes: input.notes ?? null,
    created_at: iso,
    updated_at: iso,
  };
}

export function isSessionActive(s: ShadowSessionRecord): boolean {
  return s.status === 'active' && !s.completed_at;
}
