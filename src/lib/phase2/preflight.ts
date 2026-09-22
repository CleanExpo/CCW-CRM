export const PHASE2_PREFLIGHT = [
  {
    id: 'E1',
    check: 'Count of products by stock control (FIFO / Batch / Serial / Non-Stock), plus the non-stock GP vs Xero COGS split.',
    areas: [2, 4],
    result: 'pending',
  },
  {
    id: 'E2',
    check: 'Any purchase orders in the window not in AUD.',
    areas: [2, 6],
    result: 'pending',
  },
  {
    id: 'E3',
    check: 'Do POs carry landed costs, and what share of stock value do they represent?',
    areas: [2, 6],
    result: 'pending',
  },
  {
    id: 'E4',
    check: 'Sales lines since 1 July 2025 with missing or zero COGS, and which of the four Cin7 conditions is unmet.',
    areas: [4],
    result: 'pending',
  },
  {
    id: 'E5',
    check: 'Cin7 inventory asset and monthly COGS against the same figures in Xero.',
    areas: [8],
    result: 'pending',
  },
  {
    id: 'E6',
    check: 'Anything in Cin7 that marks a line as warranty.',
    areas: [3, 4],
    result: 'pending',
  },
  {
    id: 'E7',
    check: 'Whether workshop labour (non-stock) lines carry a populated cost in Cin7.',
    areas: [4],
    result: 'pending',
  },
  {
    id: 'E8',
    check: 'Whether Branches (12) and Warehouses / Cin7 branches (12) are the same 12 records.',
    areas: [1],
    result: 'pending',
  },
] as const;

export const PHASE2_SOURCE_MATRIX = [
  { area: 1, cin7: 'Omni /v1/Stock StockOnHand (complete walk)', optix: 'cin7_stock_levels.stock_on_hand' },
  { area: 2, cin7: 'Cin7 per-product cost × SOH (FIFO/Batch/Serial/Non-Stock)', optix: 'SOH × last Cin7 unit cost' },
  { area: 3, cin7: 'Cin7 invoices — Shopify, counter, phone/email, workshop', optix: 'invoices from 1 July 2025' },
  { area: 4, cin7: 'Cin7 period / invoice / line COGS', optix: 'Invoice lines × Cin7 cost basis' },
  { area: 5, cin7: 'Cin7 AR/AP control totals', optix: 'Cin7-linked invoice outstanding + supplier POs' },
  { area: 6, cin7: 'Cin7 purchase orders and goods receipts', optix: 'purchase_orders + goods_receipts' },
  { area: 7, cin7: 'Cin7 inventory movements', optix: 'stock_movements' },
  { area: 8, cin7: 'Cin7 inventory asset + monthly COGS journal', optix: 'Signed Area 2 / 4 vs Xero mapping' },
] as const;
