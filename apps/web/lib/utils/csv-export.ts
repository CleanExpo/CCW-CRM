/**
 * CSV Export Utilities
 * Provides functions to export data to CSV format
 */

/**
 * Convert an array of objects to CSV format
 */
export function convertToCSV(data: Record<string, unknown>[], headers: string[]): string {
  if (data.length === 0) return '';

  // Create header row
  const headerRow = headers.join(',');

  // Create data rows
  const dataRows = data.map((item) => {
    return headers
      .map((header) => {
        const value = item[header];
        // Handle values that contain commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Export products to CSV
 */
export function exportProductsToCSV(products: Record<string, unknown>[]): void {
  const headers = [
    'sku',
    'name',
    'category',
    'price',
    'cost',
    'stock',
    'warehouse_location',
    'is_active',
  ];

  const data = products.map((product) => ({
    sku: product.sku,
    name: product.name,
    category: product.category,
    price: product.price,
    cost: product.cost || '',
    stock: product.stock,
    warehouse_location: product.warehouse_location || '',
    is_active: product.is_active ? 'Yes' : 'No',
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `products-export-${timestamp}.csv`);
}

/**
 * Export customers to CSV
 */
export function exportCustomersToCSV(customers: Record<string, unknown>[]): void {
  const headers = [
    'customer_number',
    'company_name',
    'contact_name',
    'email',
    'phone',
    'address',
    'city',
    'state',
    'postal_code',
    'country',
    'is_active',
  ];

  const data = customers.map((customer) => ({
    customer_number: customer.customer_number,
    company_name: customer.company_name,
    contact_name: customer.contact_name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    address: customer.address || '',
    city: customer.city || '',
    state: customer.state || '',
    postal_code: customer.postal_code || customer.postcode || '',
    country: customer.country || 'Australia',
    is_active: customer.is_active ? 'Yes' : 'No',
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `customers-export-${timestamp}.csv`);
}

/**
 * Export orders to CSV
 */
export function exportOrdersToCSV(orders: any[]): void {
  const headers = [
    'order_number',
    'customer_name',
    'order_date',
    'status',
    'total',
    'item_count',
    'notes',
  ];

  const data = orders.map((order) => ({
    order_number: order.order_number,
    customer_name: order.customer_name || '',
    order_date: new Date(order.order_date).toLocaleDateString(),
    status: order.status,
    total: order.total,
    item_count: order.item_count || order.items?.length || 0,
    notes: order.notes || '',
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `orders-export-${timestamp}.csv`);
}

/**
 * Generic PDF export via browser print window.
 * Opens a formatted print window and triggers window.print().
 * No additional npm dependencies required.
 */
export function exportToPDF(
  data: Record<string, unknown>[],
  title: string,
  filename: string,
  columns: { key: string; label: string; format?: (v: unknown) => string }[]
): void {
  const timestamp = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rows = data
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => {
            const val = row[col.key];
            const display = col.format ? col.format(val) : val == null ? '' : String(val);
            return `<td>${display}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #111; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
    .header h1 { font-size: 20px; font-weight: 700; }
    .header .meta { text-align: right; font-size: 10px; color: #555; }
    .branding { font-size: 13px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #d1d5db; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 24px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="branding">CCW Online — Equipment ERP</div>
      <h1>${title}</h1>
    </div>
    <div class="meta">
      <div>Exported: ${timestamp}</div>
      <div>${data.length} record${data.length !== 1 ? 's' : ''}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>${columns.map((c) => `<th>${c.label}</th>`).join('')}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">CCW Online Equipment ERP — Confidential</div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

/**
 * Export orders to PDF (browser print)
 */
export function exportOrdersToPDF(orders: any[]): void {
  const columns = [
    { key: 'order_number', label: 'Order #' },
    { key: 'customer_name', label: 'Customer' },
    {
      key: 'order_date',
      label: 'Date',
      format: (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-AU') : ''),
    },
    { key: 'status', label: 'Status', format: (v: unknown) => String(v ?? '').toUpperCase() },
    {
      key: 'total',
      label: 'Total (AUD)',
      format: (v: unknown) =>
        v != null
          ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(v))
          : '',
    },
    { key: 'notes', label: 'Notes' },
  ];

  const data = orders.map((o) => ({
    order_number: o.order_number,
    customer_name: o.customer_name || '',
    order_date: o.order_date,
    status: o.status,
    total: o.total,
    notes: o.notes || '',
  }));

  const timestamp = new Date().toISOString().split('T')[0];
  exportToPDF(data, 'Orders Report', `orders-${timestamp}.pdf`, columns);
}

/**
 * Export quotes to PDF (browser print)
 */
export function exportQuotesToPDF(quotes: any[]): void {
  const columns = [
    { key: 'quote_number', label: 'Quote #' },
    { key: 'customer_name', label: 'Customer' },
    {
      key: 'quote_date',
      label: 'Date',
      format: (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-AU') : ''),
    },
    {
      key: 'valid_until',
      label: 'Valid Until',
      format: (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-AU') : ''),
    },
    { key: 'status', label: 'Status', format: (v: unknown) => String(v ?? '').toUpperCase() },
    {
      key: 'total',
      label: 'Total (AUD)',
      format: (v: unknown) =>
        v != null
          ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(v))
          : '',
    },
    { key: 'notes', label: 'Notes' },
  ];

  const data = quotes.map((q) => ({
    quote_number: q.quote_number,
    customer_name: q.customer_name || '',
    quote_date: q.quote_date,
    valid_until: q.valid_until,
    status: q.status,
    total: q.total,
    notes: q.notes || '',
  }));

  const timestamp = new Date().toISOString().split('T')[0];
  exportToPDF(data, 'Quotes Report', `quotes-${timestamp}.pdf`, columns);
}

/**
 * Export quotes to CSV
 */
export function exportQuotesToCSV(quotes: any[]): void {
  const headers = [
    'quote_number',
    'customer_name',
    'quote_date',
    'valid_until',
    'status',
    'total',
    'item_count',
    'notes',
  ];

  const data = quotes.map((quote) => ({
    quote_number: quote.quote_number,
    customer_name: quote.customer_name || '',
    quote_date: new Date(quote.quote_date).toLocaleDateString(),
    valid_until: new Date(quote.valid_until).toLocaleDateString(),
    status: quote.status,
    total: quote.total,
    item_count: quote.item_count || quote.items?.length || 0,
    notes: quote.notes || '',
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `quotes-export-${timestamp}.csv`);
}
