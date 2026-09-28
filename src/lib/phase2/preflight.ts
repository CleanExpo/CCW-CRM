import { SCHEDULE_A } from '@/lib/phase2/schedule-a';

export const PHASE2_PREFLIGHT = [
  {
    id: 'E1',
    check:
      'Stock control by primary product: FIFO 9,082 · Serial 452 · Batch 1 · Non-stock 9 (28 option rows). 23 of 28 non-stock carry a cost; none hold stock.',
    areas: [2, 4],
    result: 'recorded_2026-09-23',
  },
  {
    id: 'E2',
    check:
      'POs since 1 Jul 2025: AUD 2,000 / USD 367 / GBP 1. Multi-currency is in scope for Areas 2 and 6.',
    areas: [2, 6],
    result: 'recorded_2026-09-23',
  },
  {
    id: 'E3',
    check:
      'Landed cost: product Cost / AverageLandedCost on the option (route a). Allocation API is probed at Area 2 runtime; if unexposed, Toby supplies a PO landed-cost UI export from 1 Jul 2025. Cin7→Xero mapping is his this week before E5.',
    areas: [2, 6],
    result: 'probe_at_area2',
  },
  {
    id: 'E4',
    check:
      'COGS-eligible only when FullyDispatchedDate, invoice date, and AccountingStatus are set (classifyCogsEligibility). First SalesOrders page is tallied on each Area 4 run.',
    areas: [4],
    result: 'condition_in_code_catalog_open',
  },
  {
    id: 'E5',
    check:
      'Toby 27 Sep: mapping and queue push this week. Errors tab: $800 Dhamark payment and $17.25 PO-121510 allocation. Area 8 waits until he says the queue is clear.',
    areas: [8],
    result: 'toby_this_week',
  },
  {
    id: 'E6',
    check:
      'No consistent warranty marker. Area 3 excludes zero-priced lines from the pricing-exception check and reports them as their own population.',
    areas: [3, 4],
    result: 'recorded_2026-09-23',
  },
  {
    id: 'E7',
    check:
      'Workshop labour is costed: XLABOUR $80; XLABOUR-OS $86.36; XLABOUR-BOM $80. Area 4 reports labour as a non-stock population.',
    areas: [4],
    result: 'recorded_2026-09-23',
  },
  {
    id: 'E8',
    check:
      'Branches (12) and Warehouses (12) are the same 12 Cin7 branch records. No separate warehouse entity.',
    areas: [1],
    result: 'recorded_2026-09-23',
  },
] as const;

export const PHASE2_SOURCE_MATRIX = [
  {
    area: 1,
    cin7: 'Anne SOH export at the declared as-of (Part 1.3), not live Cin7',
    optix: 'Frozen Optix snapshot at the same as-of',
  },
  {
    area: 2,
    cin7: 'Per-product cost including both landed-cost routes (PO IMP-*/XFREIGHT-* + Landed Costs allocation)',
    optix: 'SOH × Cin7 cost basis, kits as their own population',
  },
  {
    area: 3,
    cin7: 'Invoices + 700-MISC trade-ins + Aberford re-books as own populations; monthly control totals Part 3.2',
    optix: 'invoices from 1 July 2025, Aberford excluded from customer totals',
  },
  {
    area: 4,
    cin7: 'COGS including 82900 trade-in credits; labour and kits as own populations',
    optix: 'Invoice lines × Cin7 cost basis',
  },
  {
    area: 5,
    cin7: 'Cin7 AR/AP control totals',
    optix: 'Cin7-linked invoice outstanding; Aberford excluded from customer AR',
  },
  {
    area: 6,
    cin7: 'POs including USD/GBP and both landed-cost routes',
    optix: 'purchase_orders + goods_receipts',
  },
  {
    area: 7,
    cin7: 'Movements + 700-MISC trade-in receipts + 85140 monthly adjustments line by line',
    optix: 'stock_movements',
  },
  {
    area: 8,
    cin7: 'Inventory 14000 / 14000-1; monthly COGS journals after the pending queue is cleared',
    optix:
      'Signed Area 2 / 4 vs Xero. 81000/83339/85160 dormant. 82900 and 85140 explained by Part 1.5 — nothing booked twice.',
  },
] as const;

export const SCHEDULE_A_NOTE = `${SCHEDULE_A.author} Schedule A Rev ${SCHEDULE_A.revision} (${SCHEDULE_A.date}) supersedes the morning copy, prevails over v1.1 where they differ, and is treated as signed with v1.1.`;
