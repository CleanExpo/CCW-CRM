/**
 * UNI-2111: Per-workspace company settings store.
 *
 * Strategy: Prisma-first with in-memory fallback.
 *
 * - When DATABASE_URL is available at runtime, reads/writes go to the
 *   `workspace_settings` table via Prisma. Settings survive server restarts.
 * - When no DATABASE_URL is present (test environments, CI without a DB),
 *   falls back to the in-memory Map so all existing unit tests keep passing.
 *
 * Test environments mock `@/lib/db/prisma` via vi.mock (same pattern as
 * bulk-reconcile-route.test.ts). When mocked, the DB code path runs against
 * the mock; when unmocked and DATABASE_URL is absent, hasDatabaseConfig()
 * returns false and the in-memory path is used.
 *
 * Workspace isolation is enforced by the route handler: workspaceId MUST come
 * from the authenticated user's DB record, never from the request body or query
 * string.
 */

import { hasDatabaseConfig } from '@/lib/db/database-env';
import { prisma } from '@/lib/db/prisma';

export type CompanySettings = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  is_active: boolean;
  trading_name: string | null;
  abn: string | null;
  acn: string | null;
};

export type UpdateCompanySettingsInput = {
  name: string;
  trading_name?: string | null;
  abn?: string | null;
  acn?: string | null;
};

// ---------------------------------------------------------------------------
// In-memory fallback (no DB / test environments)
// ---------------------------------------------------------------------------

type SettingsMap = Map<string, CompanySettings>;

const STORE_KEY = '__ccwCompanySettingsByWorkspace__';

function getStoreMap(): SettingsMap {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: SettingsMap };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map<string, CompanySettings>();
  }
  return g[STORE_KEY] as SettingsMap;
}

function seedSettings(workspaceId: string): CompanySettings {
  return {
    id: workspaceId,
    workspaceId,
    name: 'CCW Equipment Supplies',
    slug: 'ccw-equipment-supplies',
    is_active: true,
    trading_name: null,
    abn: null,
    acn: null,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function memGet(workspaceId: string): CompanySettings {
  const map = getStoreMap();
  if (!map.has(workspaceId)) {
    map.set(workspaceId, seedSettings(workspaceId));
  }
  return map.get(workspaceId) as CompanySettings;
}

function memSave(workspaceId: string, updates: UpdateCompanySettingsInput): CompanySettings {
  const current = memGet(workspaceId);
  const updated: CompanySettings = {
    ...current,
    name: updates.name,
    slug: slugify(updates.name),
    trading_name: updates.trading_name !== undefined ? updates.trading_name ?? null : current.trading_name,
    abn: updates.abn !== undefined ? updates.abn ?? null : current.abn,
    acn: updates.acn !== undefined ? updates.acn ?? null : current.acn,
  };
  getStoreMap().set(workspaceId, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Prisma row → CompanySettings shape
// ---------------------------------------------------------------------------

function rowToSettings(row: {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  isActive: boolean;
  tradingName: string | null;
  abn: string | null;
  acn: string | null;
}): CompanySettings {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    is_active: row.isActive,
    trading_name: row.tradingName,
    abn: row.abn,
    acn: row.acn,
  };
}

// ---------------------------------------------------------------------------
// Public API (async — route handlers must await these)
// ---------------------------------------------------------------------------

/**
 * Returns the company settings for a workspace.
 * Creates a default row if none exists (upsert on first access).
 *
 * Route handlers MUST supply a workspaceId resolved from the authenticated
 * user's DB record — never a caller-supplied value.
 */
export async function getCompanySettings(workspaceId: string): Promise<CompanySettings> {
  if (!hasDatabaseConfig()) {
    return memGet(workspaceId);
  }

  const defaults = seedSettings(workspaceId);

  const row = await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      name: defaults.name,
      slug: defaults.slug,
      isActive: defaults.is_active,
      tradingName: null,
      abn: null,
      acn: null,
    },
    update: {},
  });

  return rowToSettings(row);
}

/**
 * Persists updated company settings for a workspace.
 * Returns the saved record.
 */
export async function saveCompanySettings(
  workspaceId: string,
  updates: UpdateCompanySettingsInput
): Promise<CompanySettings> {
  if (!hasDatabaseConfig()) {
    return memSave(workspaceId, updates);
  }

  const slug = slugify(updates.name);

  const row = await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      name: updates.name,
      slug,
      tradingName: updates.trading_name ?? null,
      abn: updates.abn ?? null,
      acn: updates.acn ?? null,
      isActive: true,
    },
    update: {
      name: updates.name,
      slug,
      tradingName: updates.trading_name !== undefined ? updates.trading_name ?? null : undefined,
      abn: updates.abn !== undefined ? updates.abn ?? null : undefined,
      acn: updates.acn !== undefined ? updates.acn ?? null : undefined,
    },
  });

  return rowToSettings(row);
}

// ---------------------------------------------------------------------------
// Test helpers (in-memory only — used by company-settings-route.test.ts)
// ---------------------------------------------------------------------------

/** Reset a workspace's company settings (test helper). */
export function _resetCompanySettingsForWorkspace(workspaceId: string): void {
  getStoreMap().delete(workspaceId);
}

/** Clear all company settings stores (test helper). */
export function _resetAllCompanySettings(): void {
  getStoreMap().clear();
}
