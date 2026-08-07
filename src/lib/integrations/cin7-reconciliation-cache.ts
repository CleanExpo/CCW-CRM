import type { Cin7ReconciliationSnapshot } from '@/lib/integrations/cin7-reconciliation';

type CacheEntry = {
  snapshot: Cin7ReconciliationSnapshot;
  cachedAt: number;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Cin7ReconciliationSnapshot>>();

function inflightKey(ownerUserId: string, force: boolean): string {
  return `${ownerUserId}:${force ? 'force' : 'cached'}`;
}

/** Snapshots that must not be cached (would present false-clean acceptance numbers). */
export function isReconciliationSnapshotCacheable(snapshot: Cin7ReconciliationSnapshot): boolean {
  if (snapshot.source === 'none') return false;
  if (snapshot.fetch_meta.errors.length > 0) return false;
  if (snapshot.fetch_meta.incomplete) return false;
  if (snapshot.acceptance_blocked) return false;
  return true;
}

export function getReconciliationCacheTtlMs(): number {
  return CACHE_TTL_MS;
}

export function getCachedReconciliation(
  ownerUserId: string
): { snapshot: Cin7ReconciliationSnapshot; cachedAt: string; age_ms: number } | null {
  const entry = cache.get(ownerUserId);
  if (!entry) return null;
  const ageMs = Date.now() - entry.cachedAt;
  if (ageMs > CACHE_TTL_MS) {
    cache.delete(ownerUserId);
    return null;
  }
  if (!isReconciliationSnapshotCacheable(entry.snapshot)) {
    cache.delete(ownerUserId);
    return null;
  }
  return {
    snapshot: entry.snapshot,
    cachedAt: new Date(entry.cachedAt).toISOString(),
    age_ms: ageMs,
  };
}

export function setCachedReconciliation(
  ownerUserId: string,
  snapshot: Cin7ReconciliationSnapshot
): void {
  if (!isReconciliationSnapshotCacheable(snapshot)) {
    cache.delete(ownerUserId);
    return;
  }
  cache.set(ownerUserId, { snapshot, cachedAt: Date.now() });
}

export function clearCachedReconciliation(ownerUserId: string): void {
  cache.delete(ownerUserId);
}

export async function getOrBuildReconciliation(
  ownerUserId: string,
  build: () => Promise<Cin7ReconciliationSnapshot>,
  options: { force?: boolean } = {}
): Promise<{
  snapshot: Cin7ReconciliationSnapshot;
  from_cache: boolean;
  cached_at: string | null;
}> {
  const force = options.force === true;

  if (!force) {
    const cached = getCachedReconciliation(ownerUserId);
    if (cached) {
      return {
        snapshot: cached.snapshot,
        from_cache: true,
        cached_at: cached.cachedAt,
      };
    }
  }

  // Force must not join a non-force in-flight build (stale/partial risk).
  const key = inflightKey(ownerUserId, force);
  const existing = inflight.get(key);
  if (existing) {
    const snapshot = await existing;
    return {
      snapshot,
      from_cache: false,
      cached_at: getCachedReconciliation(ownerUserId)?.cachedAt ?? null,
    };
  }

  const promise = build()
    .then((snapshot) => {
      setCachedReconciliation(ownerUserId, snapshot);
      return snapshot;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  const snapshot = await promise;
  return {
    snapshot,
    from_cache: false,
    cached_at: isReconciliationSnapshotCacheable(snapshot) ? new Date().toISOString() : null,
  };
}
