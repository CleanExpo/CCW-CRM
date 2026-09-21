/**
 * UNI-2748: machine-to-consumables and parts map.
 *
 * This is the read API the other Top 5 items build on (reorder radar, service
 * plan parts kits, quote copilot, my-price reorder). Every read takes an
 * audience: customer reads return confirmed rows only, whatever the caller asks.
 */
import type { Prisma, Product, ProductFitment } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  isFitmentKind,
  statusesVisibleTo,
  suggestFromOrderHistory,
  type FitmentAudience,
  type FitmentKind,
  type FitmentSource,
  type ImportRow,
} from '@/lib/fitment/rules';

type Row = ProductFitment & { machineProduct: Product; fitProduct: Product };

function productBrief(p: Product) {
  return { id: p.id, name: p.name, sku: p.sku, category: p.category, price: p.price };
}

export function fitmentToApi(row: Row) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    source: row.source,
    evidence: row.evidence,
    usage_quantity: row.usageQuantity,
    usage_per: row.usagePer,
    confirmed_at: row.confirmedAt,
    machine: productBrief(row.machineProduct),
    product: productBrief(row.fitProduct),
  };
}

/** Customers never see how a row was drafted or who confirmed it. */
export function fitmentToCustomerApi(row: Row) {
  return {
    kind: row.kind,
    usage_quantity: row.usageQuantity,
    usage_per: row.usagePer,
    product: productBrief(row.fitProduct),
  };
}

const include = { machineProduct: true, fitProduct: true } as const;

/** Products that fit a machine product. */
export async function listFitsForMachine(
  workspaceUserIds: string[],
  machineProductId: string,
  audience: FitmentAudience
): Promise<Row[]> {
  return prisma.productFitment.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      machineProductId,
      status: { in: statusesVisibleTo(audience) },
      ...(audience === 'customer' ? { fitProduct: { isActive: true } } : {}),
    },
    include,
    orderBy: [{ kind: 'asc' }, { fitProduct: { name: 'asc' } }],
  });
}

/** Machines a product fits. */
export async function listMachinesForProduct(
  workspaceUserIds: string[],
  fitProductId: string,
  audience: FitmentAudience
): Promise<Row[]> {
  return prisma.productFitment.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      fitProductId,
      status: { in: statusesVisibleTo(audience) },
      ...(audience === 'customer' ? { machineProduct: { isActive: true } } : {}),
    },
    include,
    orderBy: { machineProduct: { name: 'asc' } },
  });
}

/**
 * What a customer-owned machine takes. Returns null when the machine is not in
 * this workspace, and `linked: false` when it has no machine product to map from.
 */
export async function listFitsForEquipment(
  workspaceUserIds: string[],
  equipmentId: string,
  audience: FitmentAudience
): Promise<{ linked: boolean; machineProductId: string | null; fits: Row[] } | null> {
  const equipment = await prisma.workshopEquipment.findFirst({
    where: { id: equipmentId, ownerUserId: { in: workspaceUserIds } },
    select: { productId: true },
  });
  if (!equipment) return null;
  if (!equipment.productId) return { linked: false, machineProductId: null, fits: [] };
  const fits = await listFitsForMachine(workspaceUserIds, equipment.productId, audience);
  return { linked: true, machineProductId: equipment.productId, fits };
}

export async function listFitments(
  workspaceUserIds: string[],
  filter: { status?: string; search?: string; page: number; pageSize: number }
) {
  const where: Prisma.ProductFitmentWhereInput = { ownerUserId: { in: workspaceUserIds } };
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    const q = { contains: filter.search, mode: 'insensitive' as const };
    where.OR = [
      { machineProduct: { name: q } },
      { machineProduct: { sku: q } },
      { fitProduct: { name: q } },
      { fitProduct: { sku: q } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.productFitment.findMany({
      where,
      include,
      orderBy: [{ status: 'desc' }, { machineProduct: { name: 'asc' } }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.productFitment.count({ where }),
  ]);
  return { rows, total };
}

async function productsInWorkspace(workspaceUserIds: string[], ids: string[]) {
  const found = await prisma.product.findMany({
    where: { id: { in: ids }, ownerUserId: { in: workspaceUserIds } },
    select: { id: true },
  });
  return new Set(found.map((p) => p.id));
}

export class FitmentInputError extends Error {}

/** Same rule as the spreadsheet import: absent, or a positive number. */
function assertUsageQuantity(v: number | null | undefined) {
  if (v != null && !(Number.isFinite(v) && v > 0)) {
    throw new FitmentInputError('usage_quantity must be a positive number');
  }
}

/** Staff adds a row by hand. A hand-entered row is confirmed by the person entering it. */
export async function createFitment(
  workspaceUserIds: string[],
  actorUserId: string,
  input: {
    machineProductId: string;
    fitProductId: string;
    kind: string;
    usageQuantity?: number | null;
    usagePer?: string | null;
  }
): Promise<Row> {
  if (!isFitmentKind(input.kind)) throw new FitmentInputError('Invalid kind');
  if (input.machineProductId === input.fitProductId) {
    throw new FitmentInputError('A product cannot fit itself');
  }
  const ok = await productsInWorkspace(workspaceUserIds, [
    input.machineProductId,
    input.fitProductId,
  ]);
  if (ok.size !== 2) throw new FitmentInputError('Product not found');
  assertUsageQuantity(input.usageQuantity);
  const data = {
    kind: input.kind,
    usageQuantity: input.usageQuantity ?? null,
    usagePer: input.usagePer ?? null,
    status: 'confirmed',
    source: 'manual',
    confirmedBy: actorUserId,
    confirmedAt: new Date(),
  };
  return prisma.productFitment.upsert({
    where: {
      machineProductId_fitProductId: {
        machineProductId: input.machineProductId,
        fitProductId: input.fitProductId,
      },
    },
    create: {
      ...data,
      ownerUserId: actorUserId,
      machineProductId: input.machineProductId,
      fitProductId: input.fitProductId,
    },
    update: data,
    include,
  });
}

/** Confirm, reject, or edit one row. */
export async function reviewFitment(
  workspaceUserIds: string[],
  actorUserId: string,
  id: string,
  input: { status?: string; kind?: string; usageQuantity?: number | null; usagePer?: string | null }
): Promise<Row | null> {
  const existing = await prisma.productFitment.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!existing) return null;
  const data: Prisma.ProductFitmentUpdateInput = {};
  if (input.status !== undefined) {
    if (!['confirmed', 'rejected', 'suggested'].includes(input.status)) {
      throw new FitmentInputError('Invalid status');
    }
    data.status = input.status;
    data.confirmedBy = input.status === 'confirmed' ? actorUserId : null;
    data.confirmedAt = input.status === 'confirmed' ? new Date() : null;
  }
  if (input.kind !== undefined) {
    if (!isFitmentKind(input.kind)) throw new FitmentInputError('Invalid kind');
    data.kind = input.kind;
  }
  if (input.usageQuantity !== undefined) {
    assertUsageQuantity(input.usageQuantity);
    data.usageQuantity = input.usageQuantity;
  }
  if (input.usagePer !== undefined) data.usagePer = input.usagePer;
  return prisma.productFitment.update({ where: { id }, data, include });
}

export async function deleteFitment(workspaceUserIds: string[], id: string): Promise<boolean> {
  const res = await prisma.productFitment.deleteMany({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  return res.count > 0;
}

/**
 * Imports the spreadsheet. Rows land as "suggested" with source "import" so a
 * second person still confirms them, unless `confirm` is set by the importer.
 * Unknown SKUs are reported per line, never skipped silently.
 */
export async function importFitments(
  workspaceUserIds: string[],
  actorUserId: string,
  rows: ImportRow[],
  opts: { confirm: boolean }
): Promise<{ imported: number; errors: { line: number; message: string }[] }> {
  const skus = [...new Set(rows.flatMap((r) => [r.machineSku, r.fitSku]))];
  const products = await prisma.product.findMany({
    where: { ownerUserId: { in: workspaceUserIds }, sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const bySku = new Map<string, string[]>();
  for (const p of products) bySku.set(p.sku, [...(bySku.get(p.sku) ?? []), p.id]);

  // A staff decision (confirmed or rejected) is only overwritten when the importer
  // explicitly marks the sheet as confirmed. An unconfirmed sheet never downgrades it.
  const existing = await prisma.productFitment.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      machineProductId: { in: products.map((p) => p.id) },
    },
    select: { machineProductId: true, fitProductId: true, status: true },
  });
  const decided = new Map(
    existing
      .filter((e) => e.status === 'confirmed' || e.status === 'rejected')
      .map((e) => [`${e.machineProductId}:${e.fitProductId}`, e.status])
  );

  const errors: { line: number; message: string }[] = [];
  let imported = 0;
  for (const r of rows) {
    const m = bySku.get(r.machineSku) ?? [];
    const f = bySku.get(r.fitSku) ?? [];
    if (m.length !== 1 || f.length !== 1) {
      const bad = m.length !== 1 ? r.machineSku : r.fitSku;
      const n = m.length !== 1 ? m.length : f.length;
      errors.push({
        line: r.line,
        message: n === 0 ? `Unknown SKU ${bad}` : `SKU ${bad} matches ${n} products`,
      });
      continue;
    }
    const prior = decided.get(`${m[0]}:${f[0]}`);
    if (prior && !opts.confirm) {
      errors.push({
        line: r.line,
        message: `Already ${prior} by staff, so left unchanged. Tick "Mark imported rows as confirmed" to overwrite.`,
      });
      continue;
    }
    const data = {
      kind: r.kind,
      usageQuantity: r.usageQuantity,
      usagePer: r.usagePer,
      source: 'import' as FitmentSource,
      status: opts.confirm ? 'confirmed' : 'suggested',
      confirmedBy: opts.confirm ? actorUserId : null,
      confirmedAt: opts.confirm ? new Date() : null,
    };
    if (opts.confirm) {
      await prisma.productFitment.upsert({
        where: { machineProductId_fitProductId: { machineProductId: m[0], fitProductId: f[0] } },
        create: { ...data, ownerUserId: actorUserId, machineProductId: m[0], fitProductId: f[0] },
        update: data,
      });
    } else {
      // The check above gives a clear message; this is what makes it safe. An
      // unconfirmed sheet may only change a row that is STILL suggested, in one
      // statement, so a confirmation landing mid-import cannot be overwritten.
      const updated = await prisma.productFitment.updateMany({
        where: { machineProductId: m[0], fitProductId: f[0], status: 'suggested' },
        data,
      });
      if (updated.count === 0) {
        try {
          await prisma.productFitment.create({
            data: { ...data, ownerUserId: actorUserId, machineProductId: m[0], fitProductId: f[0] },
          });
        } catch (e) {
          if ((e as { code?: string })?.code !== 'P2002') throw e;
          errors.push({
            line: r.line,
            message: `Already decided by staff, so left unchanged. Tick "Mark imported rows as confirmed" to overwrite.`,
          });
          continue;
        }
      }
    }
    imported++;
  }
  return { imported, errors };
}

/**
 * Drafts suggestions from Cin7 BOMs (a machine's components are its parts) and
 * from past orders (what machine buyers bought afterwards). Never overwrites a
 * row that already exists, so a confirmed or rejected decision stands.
 */
export async function generateSuggestions(
  workspaceUserIds: string[],
  actorUserId: string
): Promise<{ fromBom: number; fromOrders: number; skippedExisting: number }> {
  const scope = { ownerUserId: { in: workspaceUserIds } };
  const [products, boms, equipment, existing] = await Promise.all([
    prisma.product.findMany({ where: scope, select: { id: true, sku: true, category: true } }),
    prisma.cin7BomMaster.findMany({
      where: { ...scope, status: 'active' },
      include: { components: true },
    }),
    prisma.workshopEquipment.findMany({
      where: { ...scope, productId: { not: null } },
      select: { productId: true },
    }),
    prisma.productFitment.findMany({
      where: scope,
      select: { machineProductId: true, fitProductId: true },
    }),
  ]);

  const idBySku = new Map<string, string>();
  const dupSkus = new Set<string>();
  for (const p of products) {
    if (idBySku.has(p.sku)) dupSkus.add(p.sku);
    idBySku.set(p.sku, p.id);
  }
  for (const s of dupSkus) idBySku.delete(s);

  const taken = new Set(existing.map((e) => `${e.machineProductId}:${e.fitProductId}`));
  let skippedExisting = 0;
  const drafts: {
    machineProductId: string;
    fitProductId: string;
    kind: FitmentKind;
    source: FitmentSource;
    evidence: string;
  }[] = [];
  const add = (d: (typeof drafts)[number]) => {
    const key = `${d.machineProductId}:${d.fitProductId}`;
    if (d.machineProductId === d.fitProductId) return;
    if (taken.has(key)) {
      skippedExisting++;
      return;
    }
    taken.add(key);
    drafts.push(d);
  };

  const machineIds = new Set<string>();
  for (const p of products) if (p.category === 'heavy_machinery') machineIds.add(p.id);
  for (const e of equipment) if (e.productId) machineIds.add(e.productId);

  let fromBom = 0;
  for (const bom of boms) {
    const machineId = bom.finishedGoodSku ? idBySku.get(bom.finishedGoodSku) : undefined;
    if (!machineId) continue;
    machineIds.add(machineId);
    for (const c of bom.components) {
      const fitId = idBySku.get(c.componentSku);
      if (!fitId) continue;
      const before = drafts.length;
      add({
        machineProductId: machineId,
        fitProductId: fitId,
        kind: 'part',
        source: 'bom',
        evidence: `Component of Cin7 BOM ${bom.sku} (qty ${c.quantity} ${c.uom})`,
      });
      if (drafts.length > before) fromBom++;
    }
  }

  const orders = await prisma.order.findMany({
    where: scope,
    select: { customerId: true, createdAt: true, lineItems: { select: { productId: true } } },
  });
  const suggestions = suggestFromOrderHistory(
    orders.map((o) => ({
      customerId: o.customerId,
      createdAt: o.createdAt,
      productIds: o.lineItems.map((l) => l.productId),
    })),
    machineIds
  );
  let fromOrders = 0;
  for (const s of suggestions) {
    const before = drafts.length;
    add({
      machineProductId: s.machineProductId,
      fitProductId: s.fitProductId,
      kind: 'consumable',
      source: 'order_history',
      evidence: `${s.buyers} of ${s.machineBuyers} buyers of this machine later bought it`,
    });
    if (drafts.length > before) fromOrders++;
  }

  if (drafts.length > 0) {
    await prisma.productFitment.createMany({
      data: drafts.map((d) => ({ ...d, ownerUserId: actorUserId, status: 'suggested' })),
      skipDuplicates: true,
    });
  }
  return { fromBom, fromOrders, skippedExisting };
}
