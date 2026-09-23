import { prisma } from '@/lib/db/prisma';
import { listClosedB1Residuals } from '@/lib/integrations/cin7-recon-residuals';
import {
  evaluatePhase2Gates,
  isPhase2SignOff,
  previousAreaForSignOff,
  type Phase2GateInput,
} from '@/lib/phase2/gates';
import { PHASE2_MATERIALITY } from '@/lib/phase2/materiality';
import { PHASE2_PREFLIGHT, PHASE2_SOURCE_MATRIX, SCHEDULE_A_NOTE } from '@/lib/phase2/preflight';
import { PHASE2_BRANCHES, SCHEDULE_A, XERO_AREA8 } from '@/lib/phase2/schedule-a';
import { PHASE2_AREAS, type Phase2Area } from '@/lib/phase2/types';

export async function loadPhase2Facts(ownerUserId: string) {
  const [residuals, priceListRun, signed] = await Promise.all([
    listClosedB1Residuals(ownerUserId),
    prisma.cin7SyncRun.findFirst({
      where: { ownerUserId, entityType: 'price-lists' },
      select: { status: true },
    }),
    prisma.cin7ReconRun.findMany({
      where: {
        ownerUserId,
        immutable: true,
        status: 'complete',
        mode: { startsWith: 'phase2_area_' },
      },
      select: { mode: true, summary: true },
    }),
  ]);
  const signedAreas = new Set(
    signed
      .filter((row) => isPhase2SignOff(row.summary))
      .map((row) => Number(row.mode.replace('phase2_area_', '')))
      .filter((n): n is Phase2Area => PHASE2_AREAS.includes(n as Phase2Area))
  );
  const phase1Missing =
    residuals.counts.products.missing +
    residuals.counts.customers.missing +
    residuals.counts.suppliers.missing +
    residuals.counts['tax-codes'].missing;

  return {
    phase1Missing,
    phase1ResidualSigned: phase1Missing === 0,
    priceListsComplete: priceListRun?.status === 'complete',
    signedAreas,
  };
}

export async function gateInputForArea(
  ownerUserId: string,
  area: Phase2Area,
  stockCatalogComplete: boolean
): Promise<Phase2GateInput> {
  const facts = await loadPhase2Facts(ownerUserId);
  const previous = previousAreaForSignOff(area);
  return {
    area,
    phase1Missing: facts.phase1Missing,
    phase1ResidualSigned: facts.phase1ResidualSigned,
    stockCatalogComplete,
    priceListsComplete: facts.priceListsComplete,
    previousAreaSigned: previous == null || facts.signedAreas.has(previous),
    e2e3Ready: true,
    e5Cin7XeroAgree: null,
  };
}

export async function buildPhase2Scope(ownerUserId: string) {
  const facts = await loadPhase2Facts(ownerUserId);
  const gates = PHASE2_AREAS.map((area) => ({
    area,
    ...evaluatePhase2Gates({
      area,
      phase1Missing: facts.phase1Missing,
      phase1ResidualSigned: facts.phase1ResidualSigned,
      stockCatalogComplete: false,
      priceListsComplete: facts.priceListsComplete,
      previousAreaSigned:
        previousAreaForSignOff(area) == null ||
        facts.signedAreas.has(previousAreaForSignOff(area)!),
      e2e3Ready: true,
      e5Cin7XeroAgree: null,
    }),
  }));
  return {
    document: 'CCW Phase 2 Scope of Work v1.1 + Schedule A Rev 1 (23 Sep 2026)',
    unsigned: true,
    schedule_a: { ...SCHEDULE_A, note: SCHEDULE_A_NOTE },
    branches: PHASE2_BRANCHES,
    xero: XERO_AREA8,
    cin7_is_source_of_truth: true,
    read_only: true,
    historical_window_start: '2025-07-01',
    warehouses_in_scope: 12,
    materiality: PHASE2_MATERIALITY,
    preflight: PHASE2_PREFLIGHT,
    source_of_truth: PHASE2_SOURCE_MATRIX,
    phase1_missing: facts.phase1Missing,
    price_lists_complete: facts.priceListsComplete,
    signed_areas: [...facts.signedAreas],
    gates,
    out_of_scope: [
      'New ERP features',
      'Editing live Cin7 data',
      'Independent Optix costing engine',
      'Full Xero bookkeeping or POS cash-up',
      'New Shopify or POS tooling',
    ],
  };
}
