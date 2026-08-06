import { getApiRequestBase } from '@/lib/api/backend-url';
import { prisma } from '@/lib/db/prisma';
import { CIN7_RECON_GATE_ENTITIES } from '@/lib/integrations/cin7-reconciliation-job';
import { NextResponse } from 'next/server';
import { cronAuthFailure } from '@/lib/api/cron-auth';

/**
 * Nightly Full Sync Cron Job
 *
 * Schedule: Daily at 9:00 PM AEST / Brisbane (11:00 UTC) — "0 11 * * *" in vercel.json
 *
 * For each Phase 1 entity:
 * - incomplete/running → RESUME (no restart) so multi-night pulls can finish ~30k customers
 * - complete/failed/idle/missing → restart from page 1 for a fresh pull
 * Overall success only if every entity ends status===complete.
 * Writes Cin7NightlySyncLedger with consecutiveCompleteCount.
 */
export async function GET(request: Request) {
  try {
    const unauthorized = cronAuthFailure(request);
    if (unauthorized) return unauthorized;

    const ownerUserId = process.env.CRON_INTEGRATION_USER_ID?.trim();
    if (!ownerUserId) {
      return NextResponse.json(
        {
          success: false,
          error: 'CRON_INTEGRATION_USER_ID is required for Cin7 nightly ledger.',
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

    const startedAt = new Date();
    const entityResults: Record<
      string,
      {
        status: string;
        records: number;
        pages: number;
        failed_page: number | null;
        complete: boolean;
        resumed: boolean;
      }
    > = {};

    const maxChunksPerEntity = Number(process.env.CIN7_NIGHTLY_MAX_CHUNKS || 80);

    for (const entity of CIN7_RECON_GATE_ENTITIES) {
      const existing = await prisma.cin7SyncRun.findFirst({
        where: { ownerUserId, entityType: entity },
        select: { status: true, nextPage: true, lastCommittedPage: true },
        orderBy: { updatedAt: 'desc' },
      });

      // Resume incomplete runs across nights — never wipe a mid-catalog checkpoint.
      const shouldRestart =
        !existing ||
        existing.status === 'complete' ||
        existing.status === 'failed' ||
        existing.status === 'idle';

      let lastData: {
        status?: string;
        complete?: boolean;
        next_page?: number | null;
        failed_page?: number | null;
        records_processed?: number;
        last_committed_page?: number;
      } = {};
      let success = false;

      console.log(
        `[nightly-full-sync] ${entity}: ${shouldRestart ? 'restart' : `resume page=${existing?.nextPage ?? (existing?.lastCommittedPage ?? 0) + 1}`}`
      );

      for (let chunk = 0; chunk < maxChunksPerEntity; chunk += 1) {
        const qs = shouldRestart && chunk === 0 ? '?restart=true' : '';
        try {
          const res = await fetch(`${base}/api/integrations/cin7/sync/${entity}${qs}`, {
            method: 'POST',
            headers,
          });
          const data = (await res.json().catch(() => ({}))) as typeof lastData;
          lastData = data;
          const complete = data.complete === true || data.status === 'complete';
          if (complete) {
            success = true;
            break;
          }
          if (data.status === 'failed') {
            success = false;
            break;
          }
          if (data.complete === false && data.next_page != null) {
            // Chunk time budget — continue next chunk (resume, no restart)
            continue;
          }
          success = false;
          break;
        } catch (error) {
          lastData = { status: 'failed', complete: false };
          results[`cin7_${entity}`] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          break;
        }
      }

      entityResults[entity] = {
        status: lastData.status ?? (success ? 'complete' : 'failed'),
        records: lastData.records_processed ?? 0,
        pages: lastData.last_committed_page ?? 0,
        failed_page: lastData.failed_page ?? null,
        complete: success,
        resumed: !shouldRestart,
      };
      results[`cin7_${entity}`] = {
        success,
        data: lastData,
        error: success ? undefined : `status=${lastData.status}`,
      };
    }

    const cin7AllComplete = CIN7_RECON_GATE_ENTITIES.every(
      (entity) => entityResults[entity]?.complete === true
    );

    const prevLedger = await prisma.cin7NightlySyncLedger.findFirst({
      where: { ownerUserId },
      orderBy: { startedAt: 'desc' },
      select: { consecutiveCompleteCount: true },
    });
    const consecutiveCompleteCount = cin7AllComplete
      ? (prevLedger?.consecutiveCompleteCount ?? 0) + 1
      : 0;

    const finishedAt = new Date();
    await prisma.cin7NightlySyncLedger.create({
      data: {
        ownerUserId,
        startedAt,
        finishedAt,
        overallStatus: cin7AllComplete ? 'complete' : 'failed',
        entityResults,
        consecutiveCompleteCount,
      },
    });

    // Xero / Shopify after Cin7
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

    const failedCount = Object.values(results).filter((r) => !r.success).length;

    console.log(
      `[nightly-full-sync] cin7=${cin7AllComplete ? 'complete' : 'failed'} consecutive=${consecutiveCompleteCount} failed=${failedCount}`
    );

    return NextResponse.json({
      success: cin7AllComplete && failedCount === 0,
      cin7_complete: cin7AllComplete,
      consecutive_complete_count: consecutiveCompleteCount,
      proof_ready: consecutiveCompleteCount >= 3,
      timestamp: new Date().toISOString(),
      schedule: 'Daily 9:00 PM AEST / Brisbane (11:00 UTC)',
      note: 'Incomplete entities resume across nights; complete entities restart for fresh pull. All upserts persist to Postgres.',
      summary: {
        total: Object.keys(results).length,
        succeeded: Object.keys(results).length - failedCount,
        failed: failedCount,
      },
      entity_results: entityResults,
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
