import { prisma } from '@/lib/db/prisma';
import type { Cin7BomComponent, Cin7BomMaster, Cin7ProductionRun } from '@/lib/api/cin7-bom';
import type { Cin7BomComponent as PrismaComp, Cin7BomMaster as PrismaMaster, Cin7ProductionRun as PrismaRun } from '@prisma/client';

function masterToApi(m: PrismaMaster & { components: PrismaComp[] }): Cin7BomMaster {
  const lines: Cin7BomComponent[] = [...m.components]
    .sort((a, b) => a.componentSku.localeCompare(b.componentSku))
    .map((c) => ({
      id: c.id,
      bom_master_id: m.id,
      component_sku: c.componentSku,
      component_name: c.componentName,
      quantity: c.quantity,
      uom: c.uom,
      wastage_percent: c.wastagePercent,
      notes: c.notes,
    }));

  return {
    id: m.id,
    cin7_bom_id: m.cin7BomId,
    name: m.name,
    sku: m.sku,
    version: m.version,
    status: m.status,
    finished_good_sku: m.finishedGoodSku,
    finished_good_name: m.finishedGoodName,
    quantity_produced: m.quantityProduced,
    uom: m.uom,
    notes: m.notes,
    last_synced_at: m.lastSyncedAt?.toISOString() ?? null,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
    components: lines,
  };
}

function runToApi(r: PrismaRun & { bomMaster: { name: string } }): Cin7ProductionRun {
  return {
    id: r.id,
    bom_master_id: r.bomMasterId,
    bom_name: r.bomMaster.name,
    cin7_production_id: r.cin7ProductionId,
    quantity_planned: r.quantityPlanned,
    quantity_completed: r.quantityCompleted,
    status: r.status,
    planned_date: r.plannedDate?.toISOString() ?? null,
    completed_date: r.completedDate?.toISOString() ?? null,
    location_id: r.locationId,
    notes: r.notes,
    cin7_synced: r.cin7Synced,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export async function syncBomsFromCatalog(workspaceUserIds: string[]): Promise<number> {
  const products = await prisma.product.findMany({
    where: { ownerUserId: { in: workspaceUserIds }, isActive: true },
    orderBy: [{ ownerUserId: 'asc' }, { sku: 'asc' }],
  });
  if (products.length === 0) return 0;

  let count = 0;
  for (const p of products) {
    const cin7BomId = `ERP-${p.sku}`;
    const peers = products.filter((x) => x.ownerUserId === p.ownerUserId && x.id !== p.id);
    const componentSources = peers.slice(0, 4);

    await prisma.$transaction(async (tx) => {
      const master = await tx.cin7BomMaster.upsert({
        where: {
          ownerUserId_cin7BomId: { ownerUserId: p.ownerUserId, cin7BomId },
        },
        create: {
          ownerUserId: p.ownerUserId,
          cin7BomId,
          name: p.name,
          sku: p.sku,
          version: '1',
          status: 'active',
          finishedGoodSku: p.sku,
          finishedGoodName: p.name,
          quantityProduced: '1.0000',
          uom: 'EA',
          notes: p.category ? `Synced from catalog · ${p.category}` : 'Synced from product catalog',
          lastSyncedAt: new Date(),
        },
        update: {
          name: p.name,
          sku: p.sku,
          finishedGoodSku: p.sku,
          finishedGoodName: p.name,
          notes: p.category ? `Synced from catalog · ${p.category}` : 'Synced from product catalog',
          lastSyncedAt: new Date(),
        },
      });

      await tx.cin7BomComponent.deleteMany({ where: { bomMasterId: master.id } });
      if (componentSources.length > 0) {
        await tx.cin7BomComponent.createMany({
          data: componentSources.map((c) => ({
            bomMasterId: master.id,
            componentSku: c.sku,
            componentName: c.name,
            quantity: '1.0000',
            uom: 'EA',
            wastagePercent: '0.00',
            notes: null,
          })),
        });
      }
    });
    count += 1;
  }
  return count;
}

export async function listBomsForWorkspace(
  workspaceUserIds: string[],
  page: number,
  pageSize: number,
  status?: string,
): Promise<{ items: Cin7BomMaster[]; total: number; page: number; page_size: number; total_pages: number }> {
  let total = await prisma.cin7BomMaster.count({
    where: {
      ownerUserId: { in: workspaceUserIds },
      ...(status ? { status } : {}),
    },
  });

  if (total === 0) {
    await syncBomsFromCatalog(workspaceUserIds);
    total = await prisma.cin7BomMaster.count({
      where: {
        ownerUserId: { in: workspaceUserIds },
        ...(status ? { status } : {}),
      },
    });
  }

  const rows = await prisma.cin7BomMaster.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      ...(status ? { status } : {}),
    },
    include: { components: true },
    orderBy: { sku: 'asc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const total_pages = Math.ceil(total / pageSize) || 1;
  return {
    items: rows.map(masterToApi),
    total,
    page,
    page_size: pageSize,
    total_pages,
  };
}

export async function getBomForWorkspace(
  workspaceUserIds: string[],
  bomId: string,
): Promise<Cin7BomMaster | null> {
  const row = await prisma.cin7BomMaster.findFirst({
    where: { id: bomId, ownerUserId: { in: workspaceUserIds } },
    include: { components: true },
  });
  return row ? masterToApi(row) : null;
}

export async function listRunsForWorkspace(
  workspaceUserIds: string[],
  page: number,
  pageSize: number,
  status?: string,
): Promise<{
  items: Cin7ProductionRun[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}> {
  const where = {
    ownerUserId: { in: workspaceUserIds },
    ...(status ? { status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.cin7ProductionRun.findMany({
      where,
      include: { bomMaster: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cin7ProductionRun.count({ where }),
  ]);

  const total_pages = Math.ceil(total / pageSize) || 1;
  return {
    items: rows.map(runToApi),
    total,
    page,
    page_size: pageSize,
    total_pages,
  };
}

export async function createRunForWorkspace(
  workspaceUserIds: string[],
  ownerUserId: string,
  data: {
    bom_master_id: string;
    quantity_planned: number;
    planned_date?: string | null;
    location_id?: string | null;
    notes?: string | null;
  },
): Promise<Cin7ProductionRun | null> {
  const bom = await prisma.cin7BomMaster.findFirst({
    where: { id: data.bom_master_id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!bom) return null;

  const run = await prisma.cin7ProductionRun.create({
    data: {
      ownerUserId,
      bomMasterId: bom.id,
      quantityPlanned: String(data.quantity_planned),
      quantityCompleted: '0',
      status: 'planned',
      plannedDate: data.planned_date ? new Date(data.planned_date) : null,
      locationId: data.location_id,
      notes: data.notes,
    },
    include: { bomMaster: { select: { name: true } } },
  });
  return runToApi(run);
}

export async function patchRunStatusForWorkspace(
  workspaceUserIds: string[],
  runId: string,
  patch: {
    status: string;
    quantity_completed?: number;
    completed_date?: string | null;
    notes?: string | null;
  },
): Promise<Cin7ProductionRun | null> {
  const existing = await prisma.cin7ProductionRun.findFirst({
    where: { id: runId, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return null;

  const run = await prisma.cin7ProductionRun.update({
    where: { id: runId },
    data: {
      status: patch.status,
      ...(patch.quantity_completed !== undefined
        ? { quantityCompleted: String(patch.quantity_completed) }
        : {}),
      ...(patch.completed_date !== undefined
        ? { completedDate: patch.completed_date ? new Date(patch.completed_date) : null }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    },
    include: { bomMaster: { select: { name: true } } },
  });
  return runToApi(run);
}
