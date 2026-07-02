/** Cin7 Omni/Core list page size (API default batch). */
export const CIN7_PAGE_SIZE = 100;

/** Hard safety ceiling when syncing “all” (~100k records). */
export const CIN7_SYNC_SAFETY_MAX_PAGES = 1000;

/**
 * Resolve max pages per sync run from env.
 * `0`, `all`, or unset with explicit all → paginate until Cin7 runs out (safety cap applies).
 * Positive integer → explicit page limit.
 */
export function getCin7SyncMaxPages(): number {
  const raw = process.env.CIN7_SYNC_MAX_PAGES?.trim().toLowerCase();
  if (!raw || raw === '0' || raw === 'all') {
    return CIN7_SYNC_SAFETY_MAX_PAGES;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return CIN7_SYNC_SAFETY_MAX_PAGES;
  }
  return Math.min(CIN7_SYNC_SAFETY_MAX_PAGES, Math.floor(n));
}

export function shouldContinueCin7SyncPage(
  page: number,
  pageSize: number,
  rowCount: number,
  total: number | null,
  maxPages: number
): boolean {
  if (rowCount === 0) return false;
  if (page >= maxPages) return false;
  if (total != null && total > 0 && page * pageSize >= total) return false;
  if (rowCount < pageSize) return false;
  return true;
}
