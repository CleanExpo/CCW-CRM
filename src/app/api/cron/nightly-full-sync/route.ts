import { getApiRequestBase } from '@/lib/api/backend-url';
import { NextResponse } from 'next/server';

/**
 * Nightly Full Sync Cron Job
 *
 * Schedule: Daily at 9:00 PM AEST / Brisbane (11:00 UTC) — "0 11 * * *"
 *
 * Orchestrates a full data sync across all connected integrations:
 * 1. Cin7 — products, customers, orders, inventory
 * 2. Xero — invoices, contacts, payments
 * 3. Shopify — products, orders
 *
 * Each sync is called sequentially to avoid overwhelming external APIs.
 * Individual failures do not block subsequent syncs.
 * Cin7 entities auto-resume via start_page when a run hits the time budget.
 */

const CIN7_RESUME_MAX_CHUNKS = 40;

type Cin7SyncBody = {
  complete?: boolean;
  timed_out?: boolean;
  next_page?: number | null;
  records_processed?: number;
  status?: string;
  detail?: string;
};

async function syncCin7EntityWithResume(
  base: string,
  endpoint: string,
  headers: Record<string, string>
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  let startPage = 1;
  let totalRecords = 0;
  let lastData: Cin7SyncBody = {};
  const chunks: Cin7SyncBody[] = [];

  for (let chunk = 0; chunk < CIN7_RESUME_MAX_CHUNKS; chunk += 1) {
    const qs = startPage > 1 ? `?start_page=${startPage}` : '';
    const res = await fetch(`${base}${endpoint}${qs}`, {
      method: 'POST',
      headers,
    });
    const data = (await res.json().catch(() => ({}))) as Cin7SyncBody;
    chunks.push(data);
    lastData = data;
    totalRecords += data.records_processed ?? 0;

    if (!res.ok) {
      return {
        success: false,
        error: data.detail ?? `HTTP ${res.status}`,
        data: { ...data, records_processed_total: totalRecords, chunks: chunks.length },
      };
    }

    if (data.complete !== false) {
      return {
        success: true,
        data: { ...data, records_processed_total: totalRecords, chunks: chunks.length },
      };
    }

    if (data.next_page == null || data.next_page <= startPage) {
      return {
        success: false,
        error: `Incomplete sync without a valid next_page (status=${data.status ?? 'unknown'})`,
        data: { ...data, records_processed_total: totalRecords, chunks: chunks.length },
      };
    }

    startPage = data.next_page;
  }

  return {
    success: false,
    error: `Stopped after ${CIN7_RESUME_MAX_CHUNKS} resume chunks — still incomplete`,
    data: { ...lastData, records_processed_total: totalRecords, chunks: chunks.length },
  };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const results: Record<string, { success: boolean; error?: string; data?: unknown }> = {};
    const base = getApiRequestBase();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    };

    // 1. Cin7 full sync — entity paths must match `cin7/sync/[entityType]`.
    const cin7Endpoints = [
      '/api/integrations/cin7/sync/products',
      '/api/integrations/cin7/sync/customers',
      '/api/integrations/cin7/sync/internal-customers',
      '/api/integrations/cin7/sync/suppliers',
      '/api/integrations/cin7/sync/branches',
      '/api/integrations/cin7/sync/product-categories',
      '/api/integrations/cin7/sync/brands',
      '/api/integrations/cin7/sync/price-lists',
      '/api/integrations/cin7/sync/tax-codes',
      '/api/integrations/cin7/sync/units-of-measure',
      '/api/integrations/cin7/sync/stock-levels',
      '/api/integrations/cin7/sync/orders',
    ];

    for (const endpoint of cin7Endpoints) {
      const name = endpoint.split('/').pop() || endpoint;
      try {
        results[`cin7_${name}`] = await syncCin7EntityWithResume(base, endpoint, headers);
      } catch (error) {
        results[`cin7_${name}`] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // 2. Xero — bulk order → invoice (uses env or cookie Xero tokens per child request)
    const xeroEndpoints = ['/api/integrations/xero/sync-all?max_orders=30'];

    for (const endpoint of xeroEndpoints) {
      const name = endpoint.split('/').pop() || endpoint;
      try {
        const res = await fetch(`${base}${endpoint}`, {
          method: 'POST',
          headers,
        });
        const data = await res.json().catch(() => ({}));
        results[`xero_${name}`] = { success: res.ok, data };
      } catch (error) {
        results[`xero_${name}`] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // 3. Shopify — import recent orders, then push inventory levels
    const shopifyEndpoints = [
      '/api/integrations/shopify/import-orders?max_orders=25',
      '/api/integrations/shopify/sync-all-inventory?max_products=200',
    ];

    for (const endpoint of shopifyEndpoints) {
      const name = endpoint.split('/').pop() || endpoint;
      try {
        const res = await fetch(`${base}${endpoint}`, {
          method: 'POST',
          headers,
        });
        const data = await res.json().catch(() => ({}));
        results[`shopify_${name}`] = { success: res.ok, data };
      } catch (error) {
        results[`shopify_${name}`] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const allSuccess = Object.values(results).every((r) => r.success);
    const failedCount = Object.values(results).filter((r) => !r.success).length;

    return NextResponse.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      schedule: 'Daily 9:00 PM AEST / Brisbane (11:00 UTC)',
      note: 'For Cin7 and Shopify order imports, set CRON_INTEGRATION_USER_ID to a valid app user id; integrations must be configured via env or cookies on the server.',
      summary: {
        total: Object.keys(results).length,
        succeeded: Object.keys(results).length - failedCount,
        failed: failedCount,
      },
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
