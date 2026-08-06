import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';

/**
 * Duplicate cleanup is intentionally disabled during Phase 1 master-data
 * reconciliation. Cin7 remains source of truth — we must not merge, delete,
 * or cleanse CRM records until after go-live (client requirement).
 *
 * Re-enable only when CIN7_ALLOW_DUPLICATE_CLEANUP=true is set explicitly
 * after go-live approval.
 */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScopeOrCronIntegrationJob(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const allow =
    process.env.CIN7_ALLOW_DUPLICATE_CLEANUP?.trim().toLowerCase() === 'true';

  if (!allow) {
    return NextResponse.json(
      {
        status: 'blocked',
        detail:
          'Customer duplicate cleanup is disabled while Cin7 is the source of truth. Sync keeps records as they exist in Cin7; cleansing is deferred until after go-live. Set CIN7_ALLOW_DUPLICATE_CLEANUP=true only with explicit approval.',
        email_duplicates_removed: 0,
        orphan_no_id_removed: 0,
        kept: 0,
      },
      { status: 403 }
    );
  }

  // Lazy-import so the delete path is never loaded unless explicitly unlocked.
  const { cleanupDuplicateCustomers } = await import(
    '@/lib/integrations/cin7-duplicate-cleanup'
  );
  const result = await cleanupDuplicateCustomers(scope.userId);
  return NextResponse.json({ status: 'ok', ...result });
}
