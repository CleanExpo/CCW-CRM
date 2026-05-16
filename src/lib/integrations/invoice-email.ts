import type { Invoice, InvoiceLineItem, Product } from '@prisma/client';

type InvoiceWithLines = Invoice & {
  customer?: { companyName: string; email: string | null } | null;
  items: Array<InvoiceLineItem & { product?: Product | null }>;
};

export function buildInvoiceEmailPayload(invoice: InvoiceWithLines): {
  subject: string;
  body_text: string;
  body_html: string;
  dynamic_template_data: Record<string, unknown>;
} {
  const customerName = invoice.customer?.companyName ?? 'Customer';
  const lines = invoice.items
    .map((line) => {
      const label = line.product?.name ?? line.description ?? 'Item';
      return `  - ${label} x${line.quantity} @ ${formatMoney(line.unitPrice)} = ${formatMoney(line.lineTotal)}`;
    })
    .join('\n');

  const amountDue = invoice.total - invoice.amountPaid;

  const body_text = [
    `Hello ${customerName},`,
    '',
    `Please find invoice ${invoice.invoiceNumber} below for your records.`,
    '',
    `Invoice date: ${formatDate(invoice.invoiceDate)}`,
    `Due date: ${formatDate(invoice.dueDate)}`,
    '',
    'Line items:',
    lines || '  (no line items)',
    '',
    `Subtotal: ${formatMoney(invoice.subtotal)}`,
    `Tax: ${formatMoney(invoice.taxTotal)}`,
    `Total: ${formatMoney(invoice.total)}`,
    `Amount due: ${formatMoney(amountDue)}`,
    invoice.notes ? `\nNotes:\n${invoice.notes}` : '',
    '',
    'Thank you for your business.',
  ]
    .filter(Boolean)
    .join('\n');

  const body_html = [
    `<p>Hello ${escapeHtml(customerName)},</p>`,
    `<p>Please find invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> below.</p>`,
    `<p><strong>Invoice date:</strong> ${formatDate(invoice.invoiceDate)}<br/>`,
    `<strong>Due date:</strong> ${formatDate(invoice.dueDate)}</p>`,
    '<ul>',
    ...invoice.items.map((line) => {
      const label = line.product?.name ?? line.description ?? 'Item';
      return `<li>${escapeHtml(label)} x${line.quantity} — ${formatMoney(line.lineTotal)}</li>`;
    }),
    '</ul>',
    `<p><strong>Total:</strong> ${formatMoney(invoice.total)}<br/>`,
    `<strong>Amount due:</strong> ${formatMoney(amountDue)}</p>`,
    invoice.notes ? `<p><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>` : '',
    '<p>Thank you for your business.</p>',
  ].join('');

  return {
    subject: `Invoice ${invoice.invoiceNumber}`,
    body_text,
    body_html,
    dynamic_template_data: {
      customer_name: customerName,
      invoice_number: invoice.invoiceNumber,
      invoice_date: formatDate(invoice.invoiceDate),
      due_date: formatDate(invoice.dueDate),
      subtotal: invoice.subtotal,
      tax_total: invoice.taxTotal,
      total: invoice.total,
      amount_due: amountDue,
      line_items: invoice.items.map((line) => ({
        description: line.product?.name ?? line.description,
        quantity: line.quantity,
        line_total: line.lineTotal,
      })),
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount: number | { toString(): string }): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0] ?? '';
}
