/**
 * UNI-2111: Per-workspace company settings store (in-memory, same pattern as POS mock-store).
 *
 * Workspace isolation is enforced by the route handler: workspaceId MUST come from the
 * authenticated user's DB record, never from the request body or query string.
 */

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

/**
 * Returns the company settings for a workspace, seeding defaults on first access.
 *
 * Route handlers MUST supply a workspaceId resolved from the authenticated user's
 * DB record — never a caller-supplied value.
 */
export function getCompanySettings(workspaceId: string): CompanySettings {
  const map = getStoreMap();
  if (!map.has(workspaceId)) {
    map.set(workspaceId, seedSettings(workspaceId));
  }
  return map.get(workspaceId) as CompanySettings;
}

/**
 * Persists updated company settings for a workspace.
 * Returns the saved record.
 */
export function saveCompanySettings(
  workspaceId: string,
  updates: UpdateCompanySettingsInput
): CompanySettings {
  const current = getCompanySettings(workspaceId);
  const slug = updates.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const updated: CompanySettings = {
    ...current,
    name: updates.name,
    slug,
    trading_name: updates.trading_name !== undefined ? updates.trading_name ?? null : current.trading_name,
    abn: updates.abn !== undefined ? updates.abn ?? null : current.abn,
    acn: updates.acn !== undefined ? updates.acn ?? null : current.acn,
  };

  getStoreMap().set(workspaceId, updated);
  return updated;
}

/** Reset a workspace's company settings (test helper). */
export function _resetCompanySettingsForWorkspace(workspaceId: string): void {
  getStoreMap().delete(workspaceId);
}

/** Clear all company settings stores (test helper). */
export function _resetAllCompanySettings(): void {
  getStoreMap().clear();
}
