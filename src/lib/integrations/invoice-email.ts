import type { Invoice, InvoiceLineItem, Product } from '@prisma/client';

type InvoiceWithLines = Invoice & {
  customer?: { companyName: string; email: string | null } | null;
  items: Array<InvoiceLineItem & { product?: Product | null }>;
};

export function buildInvoiceEmailPayload(invoice: InvoiceWithLines): {
  subject: string;
  body_text: string;
} {
  const customerName = invoice.customer?.companyName ?? 'Customer';
  const lines = invoice.items
    .map((line) => {
      const label = line.product?.name ?? line.description ?? 'Item';
      return `  - ${label} x${line.quantity} @ ${formatMoney(line.unitPrice)} = ${formatMoney(line.lineTotal)}`;
    })
    .join('\n');

  const body_text = [
    `Hello ${customerName},`,
    '',
    `Please find invoice ${invoice.invoiceNumber} attached below for your records.`,
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
    `Amount due: ${formatMoney(invoice.total - invoice.amountPaid)}`,
    invoice.notes ? `\nNotes:\n${invoice.notes}` : '',
    '',
    'Thank you for your business.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: `Invoice ${invoice.invoiceNumber} from CCW`,
    body_text,
  };
}

function formatMoney(amount: number | { toString(): string }): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0] ?? '';
}
