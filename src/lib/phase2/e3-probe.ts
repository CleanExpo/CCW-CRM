import { cin7OmniGet, type Cin7OmniCredentials } from '@/lib/integrations/cin7-omni';

/** Paths we try. None of these exist in the Optix client today. */
export const LANDED_COST_ALLOCATION_PROBE_PATHS = [
  '/v1/LandedCosts?page=1&rows=1',
  '/v1/LandedCostAllocations?page=1&rows=1',
  '/v1/PurchaseOrderLandedCosts?page=1&rows=1',
] as const;

export type LandedCostProbeRow = {
  path: string;
  status: number;
  exposed: boolean;
};

/**
 * E3 route (b): does Omni expose Landed Costs allocations?
 * GET only. Does not print credentials. 404/401/403 = not a usable feed.
 */
export async function probeLandedCostAllocationFeed(
  creds: Cin7OmniCredentials
): Promise<{ anyExposed: boolean; rows: LandedCostProbeRow[] }> {
  const rows: LandedCostProbeRow[] = [];
  for (const path of LANDED_COST_ALLOCATION_PROBE_PATHS) {
    const { status } = await cin7OmniGet<unknown>(path, creds, { retries: 0 });
    rows.push({
      path,
      status,
      exposed: status >= 200 && status < 300,
    });
  }
  return { anyExposed: rows.some((r) => r.exposed), rows };
}

export function formatLandedCostProbe(result: {
  anyExposed: boolean;
  rows: LandedCostProbeRow[];
}): string {
  if (result.anyExposed) {
    return `E3 allocation feed responded on ${result.rows
      .filter((r) => r.exposed)
      .map((r) => r.path)
      .join(', ')}.`;
  }
  return `E3 allocation feed not on Omni (${result.rows
    .map((r) => `${r.path}→${r.status}`)
    .join('; ')}). Fallback is a UI export of the PO landed-cost section from 1 Jul 2025.`;
}
