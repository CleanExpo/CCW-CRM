import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend-url";

/**
 * Nightly Full Sync Cron Job
 *
 * Schedule: Daily at 11:00 PM AEST (13:00 UTC) — "0 13 * * *"
 *
 * Orchestrates a full data sync across all connected integrations:
 * 1. Cin7 — products, customers, orders, inventory
 * 2. Xero — invoices, contacts, payments
 * 3. Shopify — products, orders
 *
 * Each sync is called sequentially to avoid overwhelming external APIs.
 * Individual failures do not block subsequent syncs.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const results: Record<string, { success: boolean; error?: string; data?: unknown }> = {};
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    };

    // 1. Cin7 full sync (products → customers → orders → inventory)
    const cin7Endpoints = [
      "/api/integrations/cin7/sync/products",
      "/api/integrations/cin7/sync/customers",
      "/api/integrations/cin7/sync/sales",
      "/api/integrations/cin7/sync/inventory",
    ];

    for (const endpoint of cin7Endpoints) {
      const name = endpoint.split("/").pop() || endpoint;
      try {
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: "POST",
          headers,
        });
        const data = await res.json().catch(() => ({}));
        results[`cin7_${name}`] = { success: res.ok, data };
      } catch (error) {
        results[`cin7_${name}`] = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // 2. Xero sync (invoices, contacts)
    const xeroEndpoints = [
      "/api/integrations/xero/sync/contacts",
      "/api/integrations/xero/sync/invoices",
    ];

    for (const endpoint of xeroEndpoints) {
      const name = endpoint.split("/").pop() || endpoint;
      try {
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: "POST",
          headers,
        });
        const data = await res.json().catch(() => ({}));
        results[`xero_${name}`] = { success: res.ok, data };
      } catch (error) {
        results[`xero_${name}`] = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // 3. Shopify sync (products, orders)
    const shopifyEndpoints = [
      "/api/integrations/shopify/sync/products",
      "/api/integrations/shopify/sync/orders",
    ];

    for (const endpoint of shopifyEndpoints) {
      const name = endpoint.split("/").pop() || endpoint;
      try {
        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: "POST",
          headers,
        });
        const data = await res.json().catch(() => ({}));
        results[`shopify_${name}`] = { success: res.ok, data };
      } catch (error) {
        results[`shopify_${name}`] = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    const allSuccess = Object.values(results).every((r) => r.success);
    const failedCount = Object.values(results).filter((r) => !r.success).length;

    return NextResponse.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      schedule: "Daily 11:00 PM AEST (13:00 UTC)",
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
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
