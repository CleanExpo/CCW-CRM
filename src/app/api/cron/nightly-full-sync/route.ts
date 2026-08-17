import { getApiRequestBase } from '@/lib/api/backend-url';
import { cronAuthFailure } from '@/lib/api/cron-auth';
import { runCin7ScheduledSyncJob } from '@/lib/integrations/cin7-server-scheduled-sync';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

/**
 * Nightly Full Sync Cron Job
 *
 * Backup trigger for the in-process 9:00 PM Australia/Sydney Cin7 walk,
 * then Xero/Shopify follow-on. Duplicate Cin7 starts are skipped by the
 * advisory lock and tonight's completed ledger.
 */
export async function GET(request: Request) {
  try {
    const unauthorized = cronAuthFailure(request);
    if (unauthorized) return unauthorized;

    const cin7 = await runCin7ScheduledSyncJob();
    if (cin7.skipped && cin7.skip_reason === 'missing_owner') {
      return NextResponse.json(
        {
          success: false,
          error: 'No account has a Cin7 login refresh in progress.',
        },
        { status: 500 }
      );
    }

    const results: Record<string, { success: boolean; error?: string; data?: unknown }> = {};
    const base = getApiRequestBase();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    };

    if (!cin7.skipped) {
      for (const [entity, outcome] of Object.entries(cin7.entity_results ?? {})) {
        results[`cin7_${entity}`] = {
          success: outcome.complete,
          data: outcome,
          error: outcome.complete ? undefined : `status=${outcome.status}`,
        };
      }
    }

    const skipFollowOn = cin7.skip_reason === 'lock_held';
    if (!skipFollowOn) {
      const xeroEndpoints = ['/api/integrations/xero/sync-all?max_orders=30'];
      for (const endpoint of xeroEndpoints) {
        const name = endpoint.split('/').pop() || endpoint;
        try {
          const res = await fetch(`${base}${endpoint}`, { method: 'POST', headers });
          const data = await res.json().catch(() => ({}));
          results[`xero_${name}`] = { success: res.ok, data };
        } catch (error) {
          results[`xero_${name}`] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      const shopifyEndpoints = [
        '/api/integrations/shopify/import-orders?max_orders=25',
        '/api/integrations/shopify/sync-all-inventory?max_products=200',
      ];
      for (const endpoint of shopifyEndpoints) {
        const name = endpoint.split('/').pop() || endpoint;
        try {
          const res = await fetch(`${base}${endpoint}`, { method: 'POST', headers });
          const data = await res.json().catch(() => ({}));
          results[`shopify_${name}`] = { success: res.ok, data };
        } catch (error) {
          results[`shopify_${name}`] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    }

    const failedCount = Object.values(results).filter((r) => !r.success).length;
    const cin7AllComplete = cin7.cin7_complete === true;
    const cin7Accepted =
      cin7.skip_reason === 'already_ran' ||
      cin7.skip_reason === 'lock_held' ||
      (!cin7.skipped && cin7AllComplete);

    return NextResponse.json({
      success: cin7Accepted && failedCount === 0,
      skipped: cin7.skipped,
      skip_reason: cin7.skip_reason,
      cin7_complete: cin7AllComplete,
      consecutive_complete_count: cin7.consecutive_complete_count ?? 0,
      proof_ready: (cin7.consecutive_complete_count ?? 0) >= 3,
      timestamp: new Date().toISOString(),
      schedule: 'Daily 9:00 PM Australia/Sydney',
      note: 'Server-side sequential Cin7 walk. Incomplete entities resume; complete entities restart. Browser does not need to stay open.',
      summary: {
        total: Object.keys(results).length,
        succeeded: Object.keys(results).length - failedCount,
        failed: failedCount,
      },
      entity_results: cin7.entity_results ?? {},
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
