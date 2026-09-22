export type InvoiceExportRow = {
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  status: string;
  total: number;
};

export function invoicesToCsv(rows: InvoiceExportRow[]): string {
  const header = 'invoice_number,customer_name,invoice_date,status,total';
  const lines = rows.map((r) =>
    [r.invoice_number, r.customer_name, r.invoice_date, r.status, String(r.total)]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(',')
  );
  return [header, ...lines].join('\n');
}
