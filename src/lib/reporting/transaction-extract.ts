export type ExtractInvoiceLine = {
  kind: 'invoice_line';
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  branch_name: string | null;
  product_id: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  invoice_date: string;
  /** JSON only, not in the CSV. Lets a reader drop draft and cancelled invoices. */
  invoice_status?: string;
};

/** Invoices per extract page. Read `invoice_next_page` until it is null for the full history. */
export const INVOICE_PAGE_SIZE = 2000;

export type ExtractStockMovement = {
  kind: 'stock_movement';
  movement_id: string;
  sku: string;
  branch_name: string;
  quantity: number;
  movement_type: string;
  source_type: string;
  source_id: string;
  occurred_at: string;
};

export type ReportingExtract = {
  generated_at: string;
  /** Which page of invoices this is (1-based), and the next one, or null on the last page. */
  invoice_page?: number;
  invoice_next_page?: number | null;
  invoice_lines: ExtractInvoiceLine[];
  stock_movements: ExtractStockMovement[];
};

export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toReportingCsv(extract: ReportingExtract): string {
  const header = [
    'kind',
    'id',
    'ref',
    'branch_name',
    'sku',
    'quantity',
    'unit_price',
    'line_total',
    'occurred_at',
  ];
  const rows = [
    ...extract.invoice_lines.map((row) =>
      [
        row.kind,
        row.invoice_id,
        row.invoice_number,
        row.branch_name ?? '',
        row.sku ?? '',
        String(row.quantity),
        String(row.unit_price),
        String(row.line_total),
        row.invoice_date,
      ]
        .map(csvCell)
        .join(',')
    ),
    ...extract.stock_movements.map((row) =>
      [
        row.kind,
        row.movement_id,
        `${row.source_type}:${row.source_id}`,
        row.branch_name,
        row.sku,
        String(row.quantity),
        '',
        '',
        row.occurred_at,
      ]
        .map(csvCell)
        .join(',')
    ),
  ];
  return [header.join(','), ...rows].join('\n');
}
