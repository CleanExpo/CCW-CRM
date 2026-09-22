import { prisma } from '@/lib/db/prisma';
import { fetchFullOmniStockCatalog } from '@/lib/integrations/cin7-catalog-fetch';
import { getCin7OmniCredentials } from '@/lib/integrations/cin7-omni';
import { buildStockCatalogEvidence } from '@/lib/integrations/cin7-reconciliation';
import { compareArea1, type Area1Position } from '@/lib/phase2/area1';
import { evaluatePhase2Gates } from '@/lib/phase2/gates';
import {
  reportBalances,
  reportCogs,
  reportInvoices,
  reportMovements,
  reportPurchasing,
  reportValuation,
  reportXero,
  roundMoney,
} from '@/lib/phase2/ledgers';
import { gateInputForArea } from '@/lib/phase2/scope';
import {
  HISTORICAL_WINDOW_START,
  LEGACY_OPTIX_ONLY_CUSTOMERS,
  PHASE2_AREAS,
  type Phase2Area,
  type Phase2AreaReport,
} from '@/lib/phase2/types';
import { Prisma } from '@prisma/client';

function applyGate(
  report: Phase2AreaReport,
  gate: { allowed: boolean; reason: string | null }
): Phase2AreaReport {
  if (gate.allowed) return report;
  return {
    ...report,
    clean: false,
    blocked: true,
    blocked_reason: gate.reason,
    notes: [...report.notes, gate.reason ?? 'Prerequisite gate failed.'],
  };
}

export async function persistPhase2Snapshot(input: {
  ownerUserId: string;
  report: Phase2AreaReport;
}): Promise<string> {
  const row = await prisma.cin7ReconRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      status: input.report.blocked ? 'blocked' : input.report.clean ? 'complete' : 'failed',
      mode: `phase2_area_${input.report.area}`,
      immutable: true,
      blockedReason: input.report.blocked_reason,
      optixComplete: true,
      cin7Complete: input.report.cin7_complete,
      missingCount: input.report.counts.missing,
      extraCount: input.report.counts.extra,
      fieldMismatchCount: input.report.counts.quantity_mismatch,
      skippedCount: input.report.counts.skipped,
      summary: input.report as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  return row.id;
}

async function loadOptixStock(ownerUserId: string): Promise<Area1Position[]> {
  const rows = await prisma.cin7StockLevel.findMany({ where: { ownerUserId } });
  return rows.map((r) => ({
    sku: r.sku,
    warehouse: r.cin7BranchId,
    warehouseName: r.branchName ?? r.cin7BranchId,
    stockOnHand: r.stockOnHand,
    available: r.available,
    incoming: r.incoming,
  }));
}

async function loadCin7Stock(ownerUserId: string): Promise<{
  positions: Area1Position[];
  complete: boolean;
}> {
  const creds = getCin7OmniCredentials();
  if (!creds) {
    return { positions: [], complete: false };
  }
  const catalog = await fetchFullOmniStockCatalog(creds);
  const evidence = buildStockCatalogEvidence(catalog);
  return {
    complete: evidence.complete,
    positions: catalog.stockLevels.map((r) => ({
      sku: r.sku,
      warehouse: r.cin7BranchId,
      warehouseName: r.branchName ?? r.cin7BranchId,
      stockOnHand: r.stockOnHand,
      available: r.available,
      incoming: r.incoming,
    })),
  };
}

export async function runPhase2Area(
  ownerUserId: string,
  area: Phase2Area
): Promise<Phase2AreaReport> {
  if (area === 1) {
    const [optix, cin7] = await Promise.all([
      loadOptixStock(ownerUserId),
      loadCin7Stock(ownerUserId),
    ]);
    const report = compareArea1({
      cin7: cin7.positions,
      optix,
      cin7Complete: cin7.complete,
    });
    const gate = evaluatePhase2Gates(await gateInputForArea(ownerUserId, 1, cin7.complete));
    return applyGate(report, gate);
  }

  if (area === 2) {
    const [optix, cin7, products, poCosts] = await Promise.all([
      loadOptixStock(ownerUserId),
      loadCin7Stock(ownerUserId),
      prisma.product.findMany({ where: { ownerUserId }, select: { sku: true, price: true } }),
      prisma.purchaseOrderLine.findMany({
        where: { purchaseOrder: { ownerUserId } },
        select: { unitCost: true, product: { select: { sku: true } } },
        orderBy: { id: 'desc' },
      }),
    ]);
    const costBySku = new Map<string, number>();
    for (const p of products) costBySku.set(p.sku, p.price);
    for (const line of poCosts) {
      if (!costBySku.has(line.product.sku) || costBySku.get(line.product.sku) === 0) {
        costBySku.set(line.product.sku, line.unitCost);
      }
    }
    const valueSide = (rows: Area1Position[]) => {
      const byWh = new Map<string, number>();
      let qtyWithoutCost = 0;
      for (const r of rows) {
        const cost = costBySku.get(r.sku);
        if (cost == null || cost === 0) {
          if (r.stockOnHand !== 0) qtyWithoutCost += 1;
          continue;
        }
        const name = r.warehouseName ?? r.warehouse;
        byWh.set(name, (byWh.get(name) ?? 0) + r.stockOnHand * cost);
      }
      return {
        warehouses: [...byWh.entries()].map(([warehouse, value]) => ({
          warehouse,
          value: roundMoney(value),
        })),
        qtyWithoutCost,
      };
    };
    const cin7Val = valueSide(cin7.positions);
    const optixVal = valueSide(optix);
    const report = reportValuation({
      cin7ValueByWarehouse: cin7Val.warehouses,
      optixValueByWarehouse: optixVal.warehouses,
      qtyWithoutCost: optixVal.qtyWithoutCost,
      cin7Complete: cin7.complete,
      costingNote:
        'Uses last PO unit cost when present, otherwise list price. Not Cin7 FIFO layers until E1 lands.',
    });
    return applyGate(
      report,
      evaluatePhase2Gates(await gateInputForArea(ownerUserId, 2, cin7.complete))
    );
  }

  const windowStart = new Date(`${HISTORICAL_WINDOW_START}T00:00:00.000Z`);

  if (area === 3) {
    const invoices = await prisma.invoice.findMany({
      where: { ownerUserId, invoiceDate: { gte: windowStart } },
      select: { invoiceDate: true, total: true },
    });
    const byMonth = new Map<string, { count: number; value: number }>();
    for (const inv of invoices) {
      const month = inv.invoiceDate.toISOString().slice(0, 7);
      const cur = byMonth.get(month) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += inv.total;
      byMonth.set(month, cur);
    }
    const monthly = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        cin7Count: v.count,
        optixCount: v.count,
        cin7Value: v.value,
        optixValue: v.value,
      }));
    const report = reportInvoices({
      monthly,
      cin7Complete: false,
      warrantyUnmarked: true,
    });
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 3, false)));
  }

  if (area === 4) {
    const lines = await prisma.invoiceLineItem.findMany({
      where: { invoice: { ownerUserId, invoiceDate: { gte: windowStart } } },
      select: { quantity: true, unitPrice: true, product: { select: { sku: true } } },
    });
    const poCosts = await prisma.purchaseOrderLine.findMany({
      where: { purchaseOrder: { ownerUserId } },
      select: { unitCost: true, product: { select: { sku: true } } },
    });
    const costBySku = new Map(poCosts.map((l) => [l.product.sku, l.unitCost]));
    let cogs = 0;
    let missing = 0;
    for (const line of lines) {
      const sku = line.product?.sku;
      const cost = sku ? costBySku.get(sku) : undefined;
      if (cost == null) {
        missing += 1;
        continue;
      }
      cogs += line.quantity * cost;
    }
    const report = reportCogs({
      periodCin7: 0,
      periodOptix: roundMoney(cogs),
      missingZeroCogsLines: missing,
      cin7Complete: false,
    });
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 4, false)));
  }

  if (area === 5) {
    const invoices = await prisma.invoice.findMany({
      where: { ownerUserId },
      select: { total: true, amountPaid: true, customer: { select: { cin7ContactId: true } } },
    });
    let ar = 0;
    for (const inv of invoices) {
      if (!inv.customer.cin7ContactId) continue;
      ar += Math.max(0, inv.total - inv.amountPaid);
    }
    const pos = await prisma.purchaseOrder.findMany({
      where: { ownerUserId },
      select: { total: true, status: true },
    });
    const ap = pos
      .filter((p) => p.status !== 'cancelled' && p.status !== 'draft')
      .reduce((s, p) => s + p.total, 0);
    const legacy = await prisma.customer.count({
      where: { ownerUserId, cin7ContactId: null },
    });
    const report = reportBalances({
      arCin7: 0,
      arOptix: roundMoney(ar),
      apCin7: 0,
      apOptix: roundMoney(ap),
      legacyExcluded: Math.min(legacy, LEGACY_OPTIX_ONLY_CUSTOMERS),
      cin7Complete: false,
    });
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 5, false)));
  }

  if (area === 6) {
    const [pos, receipts] = await Promise.all([
      prisma.purchaseOrder.count({ where: { ownerUserId } }),
      prisma.goodsReceipt.count({ where: { ownerUserId } }),
    ]);
    const report = reportPurchasing({
      poCin7: 0,
      poOptix: pos,
      grCin7: 0,
      grOptix: receipts,
      cin7Complete: false,
    });
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 6, false)));
  }

  if (area === 7) {
    const moves = await prisma.stockMovement.count({ where: { ownerUserId } });
    const report = reportMovements({ cin7Moves: 0, optixMoves: moves, cin7Complete: false });
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 7, false)));
  }

  const area2 = await runPhase2Area(ownerUserId, 2);
  const area4 = await runPhase2Area(ownerUserId, 4);
  const report = reportXero({
    inventoryCin7: area2.company.cin7,
    inventoryOptix: area2.company.optix,
    inventoryXero: null,
    cogsCin7: area4.company.cin7,
    cogsOptix: area4.company.optix,
    cogsXero: null,
    e5Agree: null,
  });
  return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 8, false)));
}

export function parsePhase2Area(raw: string | null): Phase2Area | null {
  const n = Number(raw);
  return PHASE2_AREAS.includes(n as Phase2Area) ? (n as Phase2Area) : null;
}

export async function buildSameAnswerPack(ownerUserId: string) {
  const [a1, a2, a3, a4, a5, a6, a7] = await Promise.all([
    runPhase2Area(ownerUserId, 1),
    runPhase2Area(ownerUserId, 2),
    runPhase2Area(ownerUserId, 3),
    runPhase2Area(ownerUserId, 4),
    runPhase2Area(ownerUserId, 5),
    runPhase2Area(ownerUserId, 6),
    runPhase2Area(ownerUserId, 7),
  ]);
  return {
    as_of: new Date().toISOString(),
    read_only: true,
    questions: {
      stock_value_now: a2.company.optix,
      stock_value_by_warehouse: a2.warehouses,
      sku_quantity_by_warehouse: a1.warehouses,
      last_period_sales: a3.company.optix,
      last_period_cogs: a4.company.optix,
      last_period_margin: roundMoney(a3.company.optix - a4.company.optix),
      ar_control: a5.sample.find((s) => s.document === 'AR control')?.optix ?? a5.company.optix,
      ap_control: a5.sample.find((s) => s.document === 'AP control')?.optix ?? 0,
      purchase_orders_on_file: a6.sku_count.optix,
      inventory_movements: a7.company.optix,
    },
    notes: [
      'Margin is shown from Optix invoices minus estimated COGS until Cin7 COGS (E4) is attached.',
      'Warranty-included vs warranty-excluded margin waits on E6.',
    ],
  };
}
