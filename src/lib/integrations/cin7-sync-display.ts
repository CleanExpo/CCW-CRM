/**
 * Client-safe Cin7 sync display helpers (no Prisma / Node deps).
 * Keep this module free of server-only imports so Client Components can use it.
 */

/** Client-facing Recent sync labels — only these two. */
export type Cin7SyncDisplayStatus = 'complete' | 'incomplete';

/**
 * Map any stored sync status to a professional display status.
 * complete → complete; everything else (idle, running, failed, never, …) → incomplete.
 */
export function toCin7SyncDisplayStatus(status: string | null | undefined): Cin7SyncDisplayStatus {
  return status === 'complete' ? 'complete' : 'incomplete';
}
