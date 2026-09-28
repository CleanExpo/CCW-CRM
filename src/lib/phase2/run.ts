import { prisma } from '@/lib/db/prisma';
import { fetchFullOmniStockCatalog } from '@/lib/integrations/cin7-catalog-fetch';
import { cin7OmniGet, getCin7OmniCredentials } from '@/lib/integrations/cin7-omni';
import { buildStockCatalogEvidence } from '@/lib/integrations/cin7-reconciliation';
import { compareArea1, type Area1Position } from '@/lib/phase2/area1';
import { buildCostBasis, qld1HighestValueRows, valuePositions } from '@/lib/phase2/cost-basis';
import { evaluatePhase2Gates, isPhase2SignOff, sealReport } from '@/lib/phase2/gates';
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
import {
  AREA3_MONTHLY_BASELINE,
  AREA5_CONTROLS_2026_09_27,
  CIN7_STOCK_VALUATION_2026_09_27,
  classifyPhase2Line,
} from '@/lib/phase2/schedule-a';
import { loadLatestPhase2AsOf } from '@/lib/phase2/as-of';
import { formatLandedCostProbe, probeLandedCostAllocationFeed } from '@/lib/phase2/e3-probe';
import { tallyCogsEligibility } from '@/lib/phase2/e4-accounting';
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
  return sealReport(report, gate);
}

export async function persistPhase2Snapshot(input: {
  ownerUserId: string;
  report: Phase2AreaReport;
}): Promise<string> {
  const row = await prisma.cin7ReconRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      status: input.report.blocked
        ? 'blocked'
        : isPhase2SignOff(input.report)
          ? 'complete'
          : 'failed',
      mode: `phase2_area_${input.report.area}`,
      immutable: true,
      blockedReason: input.report.blocked_reason,
      optixComplete: input.report.sku_count.optix > 0 || input.report.company.optix !== 0,
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
    stockOnHand: Number(r.stockOnHand),
    available: Number(r.available),
    incoming: Number(r.incoming),
  }));
}

async function loadCin7Stock(ownerUserId: string): Promise<{
  positions: Area1Position[];
  complete: boolean;
}> {
  try {
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
  } catch {
    return { positions: [], complete: false };
  }
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
    const asof = await loadLatestPhase2AsOf(ownerUserId);
    if (!asof?.summary.anne) {
      report.clean = false;
      report.notes.push(
        'This is a live walk, not Part 1.3. As-of is Tuesday 29 Sep 2026 11:00 AEST. Capture Optix before 10:55, Anne at 11:00, one snapshot ID, no prune/sync between.'
      );
      if (asof) {
        report.notes.push(
          `Optix as-of snapshot ${asof.id} is stored (${asof.summary.optix_qty_total} qty) waiting for Anne’s SOH timestamp.`
        );
      }
    } else {
      report.notes.push(
        `Part 1.3 snapshot ${asof.id}: Optix ${asof.summary.optix_qty_total} at ${asof.summary.optix_captured_at}; Anne ${asof.summary.anne.qty_total} at ${asof.summary.anne.run_timestamp}.`
      );
    }
    const gate = evaluatePhase2Gates(await gateInputForArea(ownerUserId, 1, cin7.complete));
    return applyGate(report, gate);
  }

  if (area === 2) {
    const [optix, cin7, products, orders] = await Promise.all([
      loadOptixStock(ownerUserId),
      loadCin7Stock(ownerUserId),
      prisma.product.findMany({
        where: { ownerUserId },
        select: { sku: true, cin7Cost: true, cin7AverageLandedCost: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { ownerUserId },
        select: {
          shippingCost: true,
          lines: { select: { unitCost: true, quantity: true, product: { select: { sku: true } } } },
        },
      }),
    ]);
    const basis = buildCostBasis({
      products,
      orders: orders.map((po) => ({
        shippingCost: po.shippingCost ?? 0,
        lines: po.lines.map((line) => ({
          sku: line.product.sku,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      })),
    });
    const cin7Val = valuePositions(cin7.positions, basis.effectiveCostBySku);
    const optixVal = valuePositions(optix, basis.effectiveCostBySku);
    const report = reportValuation({
      cin7ValueByWarehouse: cin7Val.warehouses,
      optixValueByWarehouse: optixVal.warehouses,
      qtyWithoutCost: optixVal.qtyWithoutCost,
      cin7Complete: cin7.complete,
      costingNote:
        'Area 2 uses Cin7 Average Landed Cost, then Cin7 Cost — never RetailPrice. IMP-* / header freight is recorded, not added on top of Cin7 cost. Company Cin7 is SOH × Average Landed Cost $1,601,866 (23 Sep master), not a reconstructed self-tie.',
      populations: {
        landed_po_line_aud: Math.round(basis.landedPoLineTotal * 100) / 100,
        header_freight_aud: Math.round(basis.headerFreightTotal * 100) / 100,
        cin7_allocation_unread: 1,
      },
      cin7CompanyControl: CIN7_STOCK_VALUATION_2026_09_27.primary,
      cin7CompanyControlLabel: CIN7_STOCK_VALUATION_2026_09_27.primary_label,
    });
    const qld1 = qld1HighestValueRows(optix, basis, 20);
    report.cost_basis = qld1;
    report.clean = false;
    report.notes.push(
      'E3 route (b) Cin7 Landed Costs allocation is unread. This run is measurement only until Optix matches Cin7 valuation ($1,601,866 ALC).'
    );
    report.notes.push(
      `QLD1 cost basis: ${qld1.filter((r) => r.source !== 'none').length} highest-value rows and ${qld1.filter((r) => r.source === 'none').length} uncosted positions (cost_basis on this report and evidence CSV).`
    );
    const creds = getCin7OmniCredentials();
    if (creds) {
      try {
        const probe = await probeLandedCostAllocationFeed(creds);
        report.notes.push(formatLandedCostProbe(probe));
      } catch {
        report.notes.push('E3 allocation probe did not complete; feed still treated as unread.');
      }
    }
    return applyGate(
      report,
      evaluatePhase2Gates(await gateInputForArea(ownerUserId, 2, cin7.complete))
    );
  }

  const windowStart = new Date(`${HISTORICAL_WINDOW_START}T00:00:00.000Z`);

  if (area === 3) {
    const invoices = await prisma.invoice.findMany({
      where: { ownerUserId, invoiceDate: { gte: windowStart } },
      select: {
        invoiceDate: true,
        total: true,
        customer: { select: { companyName: true } },
        items: { select: { quantity: true, unitPrice: true, product: { select: { sku: true } } } },
      },
    });
    const populations = {
      ordinary: 0,
      trade_in: 0,
      aberford_revaluation: 0,
      zero_price_excluded: 0,
      workshop_labour: 0,
    };
    const byMonth = new Map<string, { count: number; value: number }>();
    for (const inv of invoices) {
      const kinds = inv.items.map((item) =>
        classifyPhase2Line({
          sku: item.product?.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          customerName: inv.customer.companyName,
        })
      );
      if (kinds.includes('aberford_revaluation')) {
        populations.aberford_revaluation += 1;
        continue;
      }
      for (const kind of kinds) {
        if (kind === 'trade_in') populations.trade_in += 1;
        else if (kind === 'zero_price_excluded') populations.zero_price_excluded += 1;
        else if (kind === 'workshop_labour') populations.workshop_labour += 1;
        else if (kind === 'ordinary') populations.ordinary += 1;
      }
      const month = inv.invoiceDate.toISOString().slice(0, 7);
      const cur = byMonth.get(month) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += inv.total;
      byMonth.set(month, cur);
    }
    const cin7Months = new Map<string, { month: string; count: number; total_excl: number }>(
      AREA3_MONTHLY_BASELINE.map((r) => [r.month, r])
    );
    const months = new Set([...byMonth.keys(), ...cin7Months.keys()]);
    const monthly = [...months].sort().map((month) => {
      const optix = byMonth.get(month) ?? { count: 0, value: 0 };
      const cin7 = cin7Months.get(month);
      return {
        month,
        cin7Count: cin7?.count ?? 0,
        optixCount: optix.count,
        cin7Value: cin7?.total_excl ?? 0,
        optixValue: optix.value,
      };
    });
    const report = reportInvoices({
      monthly,
      cin7Complete: true,
      populations,
    });
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 3, true)));
  }

  if (area === 4) {
    const lines = await prisma.invoiceLineItem.findMany({
      where: { invoice: { ownerUserId, invoiceDate: { gte: windowStart } } },
      select: {
        quantity: true,
        unitPrice: true,
        product: { select: { sku: true } },
        invoice: { select: { customer: { select: { companyName: true } } } },
      },
    });
    const poCosts = await prisma.purchaseOrderLine.findMany({
      where: { purchaseOrder: { ownerUserId } },
      select: { unitCost: true, product: { select: { sku: true } } },
    });
    const costBySku = new Map(poCosts.map((l) => [l.product.sku, l.unitCost]));
    const populations = {
      ordinary_cogs: 0,
      trade_in_cogs_credit: 0,
      aberford_revaluation: 0,
      workshop_labour: 0,
    };
    let cogs = 0;
    let missing = 0;
    for (const line of lines) {
      const kind = classifyPhase2Line({
        sku: line.product?.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        customerName: line.invoice.customer.companyName,
      });
      if (kind === 'trade_in') {
        populations.trade_in_cogs_credit += 1;
        continue;
      }
      if (kind === 'aberford_revaluation') {
        populations.aberford_revaluation += 1;
        continue;
      }
      if (kind === 'workshop_labour') {
        populations.workshop_labour += 1;
      }
      const sku = line.product?.sku;
      const cost = sku ? costBySku.get(sku) : undefined;
      if (cost == null) {
        missing += 1;
        continue;
      }
      if (kind === 'ordinary' || kind === 'workshop_labour') {
        populations.ordinary_cogs += kind === 'ordinary' ? 1 : 0;
        cogs += line.quantity * cost;
      }
    }
    const creds = getCin7OmniCredentials();
    let e4Note =
      'E4: accounting-status condition is in classifyCogsEligibility (dispatched + invoice date + accounting status).';
    if (creds) {
      try {
        const { ok, data } = await cin7OmniGet<unknown>(
          `/v1/SalesOrders?page=1&rows=50`,
          creds,
          { retries: 0 }
        );
        if (ok && data && typeof data === 'object') {
          const list = Array.isArray(data)
            ? data
            : ((data as { Items?: unknown[] }).Items ??
              (data as { items?: unknown[] }).items ??
              []);
          const sales = (Array.isArray(list) ? list : []).filter(
            (row): row is Record<string, unknown> => !!row && typeof row === 'object'
          );
          const tally = tallyCogsEligibility(sales);
          e4Note = `E4 on first 50 sales orders: ok ${tally.ok} · no dispatch date ${tally.no_fully_dispatched_date} · no invoice date ${tally.no_invoice_date} · no accounting status ${tally.no_accounting_status}. Full catalog still required.`;
        }
      } catch {
        e4Note = 'E4: SalesOrders GET did not complete; accounting-status still not closed.';
      }
    }
    const report = reportCogs({
      periodCin7: 0,
      periodOptix: roundMoney(cogs),
      missingZeroCogsLines: missing,
      cin7Complete: false,
      populations,
    });
    report.notes.push(e4Note);
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 4, false)));
  }

  if (area === 5) {
    const invoices = await prisma.invoice.findMany({
      where: { ownerUserId },
      select: {
        total: true,
        amountPaid: true,
        customer: { select: { cin7ContactId: true, companyName: true } },
      },
    });
    let ar = 0;
    for (const inv of invoices) {
      if (!inv.customer.cin7ContactId) continue;
      if (
        classifyPhase2Line({ customerName: inv.customer.companyName }) === 'aberford_revaluation'
      ) {
        continue;
      }
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
    const ctrl = AREA5_CONTROLS_2026_09_27;
    const report = reportBalances({
      arCin7: ctrl.cin7_open_sales_order_payments.owing,
      arOptix: roundMoney(ar),
      apCin7: 0,
      apOptix: roundMoney(ap),
      legacyExcluded: Math.min(legacy, LEGACY_OPTIX_ONLY_CUSTOMERS),
      cin7Complete: false,
    });
    report.populations = {
      xero_ar_12010: ctrl.xero_ar_12010.amount,
      xero_ap_51200: ctrl.xero_ap_51200.amount,
      cin7_open_sales_owing: ctrl.cin7_open_sales_order_payments.owing,
      supplier_prepayments: 1,
    };
    report.notes.push(
      `Xero AR 12010 $${ctrl.xero_ar_12010.amount} (${ctrl.xero_ar_12010.invoices} invoices / ${ctrl.xero_ar_12010.customers} customers) is Area 8, not Cin7.`
    );
    report.notes.push(
      `Xero AP 51200 $${ctrl.xero_ap_51200.amount} (${ctrl.xero_ap_51200.note}). Own population in Areas 5 and 8.`
    );
    report.notes.push(
      `Cin7 Open Sales Order Payments owing $${ctrl.cin7_open_sales_order_payments.owing} on $${ctrl.cin7_open_sales_order_payments.open_orders} open orders. Invoiced-and-unpaid SO/PO still to be walked from the API.`
    );
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 5, false)));
  }

  if (area === 6) {
    const [pos, receipts, poRows] = await Promise.all([
      prisma.purchaseOrder.count({ where: { ownerUserId } }),
      prisma.goodsReceipt.count({ where: { ownerUserId } }),
      prisma.purchaseOrder.findMany({
        where: { ownerUserId },
        select: {
          shippingCost: true,
          lines: { select: { unitCost: true, quantity: true, product: { select: { sku: true } } } },
        },
      }),
    ]);
    const basis = buildCostBasis({
      products: [],
      orders: poRows.map((po) => ({
        shippingCost: po.shippingCost ?? 0,
        lines: po.lines.map((line) => ({
          sku: line.product.sku,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      })),
    });
    const report = reportPurchasing({
      poCin7: 0,
      poOptix: pos,
      grCin7: 0,
      grOptix: receipts,
      cin7Complete: false,
    });
    report.populations = {
      landed_po_line_aud: Math.round(basis.landedPoLineTotal * 100) / 100,
      header_freight_aud: Math.round(basis.headerFreightTotal * 100) / 100,
    };
    return applyGate(report, evaluatePhase2Gates(await gateInputForArea(ownerUserId, 6, false)));
  }

  if (area === 7) {
    const moves = await prisma.stockMovement.findMany({
      where: { ownerUserId },
      select: { sku: true, quantity: true },
    });
    const tradeIns = moves.filter(
      (m) => classifyPhase2Line({ sku: m.sku, quantity: m.quantity }) === 'trade_in'
    );
    const report = reportMovements({
      cin7Moves: 0,
      optixMoves: moves.length,
      cin7Complete: false,
      populations: {
        trade_in_receipts: tradeIns.length,
        other_movements: moves.length - tradeIns.length,
      },
    });
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
      'Area 3 monthly Cin7 figures are Toby’s 23 Sep baseline (Total Excl). Aberford is excluded from those Optix counts.',
      'Area 2 includes IMP-* / XFREIGHT-* and header freight. Cin7 Landed Costs allocation is still unread.',
      'Zero-priced lines are excluded from pricing exceptions (E6). E5 waits on his Xero queue.',
    ],
  };
}
