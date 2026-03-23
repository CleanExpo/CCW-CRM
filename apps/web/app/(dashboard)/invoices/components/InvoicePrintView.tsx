'use client';

import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils/calculations';
import type { Invoice } from '@/lib/types/invoices';

interface InvoicePrintViewProps {
  invoice: Invoice;
}

export function InvoicePrintView({ invoice }: InvoicePrintViewProps) {
  const items = invoice.items || [];

  return (
    <div className="print-view">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-view,
          .print-view * {
            visibility: visible;
          }
          .print-view {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>

      {/* Print Content */}
      <div className="mx-auto max-w-4xl bg-white p-8 print:p-0">
        {/* Company Header */}
        <div className="border-primary mb-6 border-b-2 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-primary text-3xl font-bold">CCW Online</h1>
              <p className="text-muted-foreground mt-1 text-sm">Equipment Supplier & Distributor</p>
              <div className="mt-4 text-sm">
                <p>123 Equipment Street</p>
                <p>Brisbane QLD 4000, Australia</p>
                <p>ABN: 12 345 678 901</p>
                <p>Phone: +61 7 3000 0000</p>
                <p>Email: sales@ccwonline.com.au</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold">INVOICE</h2>
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="font-semibold">Invoice #:</span> {invoice.invoice_number}
                </p>
                <p>
                  <span className="font-semibold">Invoice Date:</span>{' '}
                  {format(new Date(invoice.invoice_date), 'dd MMMM yyyy')}
                </p>
                <p>
                  <span className="font-semibold">Due Date:</span>{' '}
                  {format(new Date(invoice.due_date), 'dd MMMM yyyy')}
                </p>
                <p>
                  <span className="font-semibold">Status:</span>{' '}
                  <span className="capitalize">{invoice.status}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-8">
          <h3 className="text-muted-foreground mb-2 text-sm font-semibold">BILL TO</h3>
          <div className="text-sm">
            <p className="text-lg font-semibold">{invoice.customer_name || 'Customer'}</p>
            {invoice.customer_email && (
              <p className="text-muted-foreground">{invoice.customer_email}</p>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="py-3 text-left text-sm font-semibold">DESCRIPTION</th>
                <th className="py-3 text-center text-sm font-semibold">QTY</th>
                <th className="py-3 text-right text-sm font-semibold">UNIT PRICE</th>
                <th className="py-3 text-right text-sm font-semibold">TAX</th>
                <th className="py-3 text-right text-sm font-semibold">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id || index} className="border-b border-gray-200">
                  <td className="py-3 text-sm">
                    <p className="font-medium">
                      {item.description || item.product_name || item.product_id}
                    </p>
                    {item.product_sku && (
                      <p className="text-muted-foreground text-xs">SKU: {item.product_sku}</p>
                    )}
                  </td>
                  <td className="py-3 text-center text-sm">{item.quantity}</td>
                  <td className="py-3 text-right text-sm">
                    {formatCurrency(Number(item.unit_price))}
                  </td>
                  <td className="py-3 text-right text-sm">
                    {Number(item.tax_rate) > 0 ? `${Number(item.tax_rate).toFixed(0)}%` : '—'}
                  </td>
                  <td className="py-3 text-right text-sm font-medium">
                    {formatCurrency(Number(item.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mb-8 flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-2 text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span>Tax:</span>
              <span>{formatCurrency(Number(invoice.tax_total))}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-300 py-3 text-lg font-bold">
              <span>TOTAL:</span>
              <span>{formatCurrency(Number(invoice.total))}</span>
            </div>
            {Number(invoice.amount_paid) > 0 && (
              <>
                <div className="flex justify-between py-2 text-sm text-green-700">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(Number(invoice.amount_paid))}</span>
                </div>
                <div className="flex justify-between border-t-2 border-gray-300 py-3 text-lg font-bold">
                  <span>AMOUNT DUE:</span>
                  <span>{formatCurrency(Number(invoice.amount_due))}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mb-8">
            <h3 className="text-muted-foreground mb-2 text-sm font-semibold">NOTES</h3>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Payment Terms & Footer */}
        <div className="mt-8 border-t-2 border-gray-200 pt-6">
          <h3 className="mb-3 text-sm font-semibold">PAYMENT TERMS</h3>
          <div className="text-muted-foreground space-y-2 text-xs">
            <p>
              <strong>Payment Due:</strong> Payment is due by{' '}
              {format(new Date(invoice.due_date), 'dd MMMM yyyy')}. Late payments may incur interest
              charges.
            </p>
            <p>
              <strong>Bank Transfer:</strong> Please include the invoice number as your payment
              reference.
            </p>
            <p>
              <strong>Queries:</strong> For invoice queries, please contact us at
              sales@ccwonline.com.au or +61 7 3000 0000.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-muted-foreground mt-8 border-t border-gray-200 pt-6 text-center text-xs">
          <p>Thank you for your business!</p>
          <p className="mt-1">CCW Online | ABN 12 345 678 901 | www.ccwonline.com.au</p>
        </div>
      </div>
    </div>
  );
}
