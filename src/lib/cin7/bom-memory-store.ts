/**
 * In-process BOM and production-run store for /api/cin7/bom when Cin7 sync is not wired.
 * Scoped per authenticated user so workspace members see the same catalog via owner id.
 */

import type { Cin7BomMaster, Cin7ProductionRun } from '@/lib/api/cin7-bom';

type Store = {
  boms: Map<string, Cin7BomMaster>;
  runs: Map<string, Cin7ProductionRun>;
};

const byOwner = new Map<string, Store>();

function storeFor(ownerUserId: string): Store {
  let s = byOwner.get(ownerUserId);
  if (!s) {
    s = { boms: new Map(), runs: new Map() };
    byOwner.set(ownerUserId, s);
  }
  return s;
}

function nowIso() {
  return new Date().toISOString();
}

function demoBoms(ownerUserId: string): Cin7BomMaster[] {
  const t = nowIso();
  const mkId = (suffix: string) => `bom-${ownerUserId.slice(0, 8)}-${suffix}`;
  return [
    {
      id: mkId('1'),
      cin7_bom_id: 'BOM-001',
      name: 'Industrial Pressure Washer Assembly',
      sku: 'FG-PWA-3000',
      version: '2',
      status: 'active',
      finished_good_sku: 'FG-PWA-3000',
      finished_good_name: 'Industrial Pressure Washer 3000 PSI',
      quantity_produced: '1.0000',
      uom: 'EA',
      notes: 'Assembled from pump unit, frame, and hose kit',
      last_synced_at: t,
      created_at: t,
      updated_at: t,
      components: [
        {
          id: `${mkId('1')}-c1`,
          bom_master_id: mkId('1'),
          component_sku: 'RM-PUMP-3000',
          component_name: 'High-Pressure Pump Unit 3000 PSI',
          quantity: '1.0000',
          uom: 'EA',
          wastage_percent: '2.00',
          notes: null,
        },
        {
          id: `${mkId('1')}-c2`,
          bom_master_id: mkId('1'),
          component_sku: 'RM-FRAME-PWA',
          component_name: 'Welded frame assembly',
          quantity: '1.0000',
          uom: 'EA',
          wastage_percent: '0.00',
          notes: null,
        },
      ],
    },
    {
      id: mkId('2'),
      cin7_bom_id: 'BOM-002',
      name: 'Compact Scrubber Dryer Kit',
      sku: 'FG-SCR-1200',
      version: '1',
      status: 'active',
      finished_good_sku: 'FG-SCR-1200',
      finished_good_name: 'Compact Scrubber Dryer 1200mm',
      quantity_produced: '1.0000',
      uom: 'EA',
      notes: null,
      last_synced_at: t,
      created_at: t,
      updated_at: t,
      components: [
        {
          id: `${mkId('2')}-c1`,
          bom_master_id: mkId('2'),
          component_sku: 'RM-BRUSH-KIT',
          component_name: 'Brush deck kit',
          quantity: '1.0000',
          uom: 'EA',
          wastage_percent: '1.00',
          notes: null,
        },
      ],
    },
    {
      id: mkId('3'),
      cin7_bom_id: 'BOM-003',
      name: 'Chemical Dilution Station',
      sku: 'FG-DIL-500',
      version: '1',
      status: 'draft',
      finished_good_sku: 'FG-DIL-500',
      finished_good_name: 'Wall-mount dilution station',
      quantity_produced: '1.0000',
      uom: 'EA',
      notes: 'Draft BOM pending engineering sign-off',
      last_synced_at: t,
      created_at: t,
      updated_at: t,
      components: [],
    },
  ];
}

export function syncBomsForOwner(ownerUserId: string): { count: number } {
  const s = storeFor(ownerUserId);
  const demos = demoBoms(ownerUserId);
  for (const b of demos) {
    s.boms.set(b.id, { ...b, last_synced_at: nowIso(), updated_at: nowIso() });
  }
  return { count: demos.length };
}

export function listBomsForOwner(
  ownerUserId: string,
  page: number,
  pageSize: number,
  status?: string,
): { items: Cin7BomMaster[]; total: number; page: number; page_size: number; total_pages: number } {
  const s = storeFor(ownerUserId);
  if (s.boms.size === 0) {
    syncBomsForOwner(ownerUserId);
  }
  let items = [...s.boms.values()];
  if (status) {
    items = items.filter((b) => b.status === status);
  }
  items.sort((a, b) => a.sku.localeCompare(b.sku));
  const total = items.length;
  const total_pages = Math.ceil(total / pageSize) || 1;
  const slice = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: slice, total, page, page_size: pageSize, total_pages };
}

export function getBomForOwner(ownerUserId: string, bomId: string): Cin7BomMaster | null {
  const s = storeFor(ownerUserId);
  if (s.boms.size === 0) {
    syncBomsForOwner(ownerUserId);
  }
  return s.boms.get(bomId) ?? null;
}

export function listRunsForOwner(
  ownerUserId: string,
  page: number,
  pageSize: number,
  status?: string,
): { items: Cin7ProductionRun[]; total: number; page: number; page_size: number; total_pages: number } {
  const s = storeFor(ownerUserId);
  let items = [...s.runs.values()];
  if (status) {
    items = items.filter((r) => r.status === status);
  }
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = items.length;
  const total_pages = Math.ceil(total / pageSize) || 1;
  const slice = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: slice, total, page, page_size: pageSize, total_pages };
}

export function createRunForOwner(
  ownerUserId: string,
  data: {
    bom_master_id: string;
    quantity_planned: number;
    planned_date?: string | null;
    location_id?: string | null;
    notes?: string | null;
  },
): Cin7ProductionRun | null {
  const s = storeFor(ownerUserId);
  const bom = s.boms.get(data.bom_master_id);
  if (!bom) return null;

  const t = nowIso();
  const id = `run-${ownerUserId.slice(0, 8)}-${Date.now()}`;
  const run: Cin7ProductionRun = {
    id,
    bom_master_id: bom.id,
    bom_name: bom.name,
    cin7_production_id: null,
    quantity_planned: String(data.quantity_planned),
    quantity_completed: '0',
    status: 'planned',
    planned_date: data.planned_date ?? null,
    completed_date: null,
    location_id: data.location_id ?? null,
    notes: data.notes ?? null,
    cin7_synced: false,
    created_at: t,
    updated_at: t,
  };
  s.runs.set(id, run);
  return run;
}

export function patchRunStatusForOwner(
  ownerUserId: string,
  runId: string,
  patch: {
    status: string;
    quantity_completed?: number | null;
    completed_date?: string | null;
    notes?: string | null;
  },
): Cin7ProductionRun | null {
  const s = storeFor(ownerUserId);
  const run = s.runs.get(runId);
  if (!run) return null;

  const t = nowIso();
  const next: Cin7ProductionRun = {
    ...run,
    status: patch.status,
    quantity_completed:
      patch.quantity_completed != null ? String(patch.quantity_completed) : run.quantity_completed,
    completed_date: patch.completed_date ?? run.completed_date,
    notes: patch.notes !== undefined ? patch.notes : run.notes,
    updated_at: t,
  };
  s.runs.set(runId, next);
  return next;
}
