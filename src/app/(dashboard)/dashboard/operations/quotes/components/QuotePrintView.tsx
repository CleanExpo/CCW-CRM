'use client';

import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils/calculations';
import { Quote, QuoteItem } from '../types';

interface QuotePrintViewProps {
  quote: Quote;
}

export function QuotePrintView({ quote }: QuotePrintViewProps) {
  const items: QuoteItem[] = quote.items || quote.quote_items || [];
  const subtotal = Number(quote.total) / 1.1;
  const tax = Number(quote.total) - subtotal;

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
                <p>ABN: 94 086 503 317</p>
                <p>Phone: 1800 686 869</p>
                <p>Email: sales@ccwarehouse.com.au</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold">QUOTATION</h2>
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="font-semibold">Quote #:</span> {quote.quote_number}
                </p>
                <p>
                  <span className="font-semibold">Date:</span>{' '}
                  {(() => {
                    const raw = quote.quote_date ?? quote.created_at;
                    return raw ? format(new Date(raw), 'dd MMMM yyyy') : '—';
                  })()}
                </p>
                <p>
                  <span className="font-semibold">Valid Until:</span>{' '}
                  {quote.valid_until
                    ? format(new Date(quote.valid_until), 'dd MMMM yyyy')
                    : '—'}
                </p>
                <p>
                  <span className="font-semibold">Status:</span>{' '}
                  <span className="capitalize">{quote.status}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-8">
          <h3 className="text-muted-foreground mb-2 text-sm font-semibold">QUOTE FOR</h3>
          <div className="text-sm">
            <p className="text-lg font-semibold">{quote.customer_name || 'Customer'}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="py-3 text-left text-sm font-semibold">ITEM</th>
                <th className="py-3 text-center text-sm font-semibold">QTY</th>
                <th className="py-3 text-right text-sm font-semibold">UNIT PRICE</th>
                <th className="py-3 text-right text-sm font-semibold">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id || index} className="border-b border-gray-200">
                  <td className="py-3 text-sm">{item.product_name || item.product_id}</td>
                  <td className="py-3 text-center text-sm">{item.quantity}</td>
                  <td className="py-3 text-right text-sm">
                    {formatCurrency(Number(item.unit_price))}
                  </td>
                  <td className="py-3 text-right text-sm font-medium">
                    {formatCurrency(Number(item.line_total))}
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
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span>GST (10%):</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-300 py-3 text-lg font-bold">
              <span>TOTAL:</span>
              <span>{formatCurrency(Number(quote.total))}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="mb-8">
            <h3 className="text-muted-foreground mb-2 text-sm font-semibold">NOTES</h3>
            <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Validity Notice */}
        <div className="mb-8 border-l-4 border-blue-500 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            <strong>Important:</strong> This quotation is valid until{' '}
            {format(new Date(quote.valid_until ?? ''), 'dd MMMM yyyy')}. Prices and availability are
            subject to change after this date.
          </p>
        </div>

        {/* Terms & Conditions */}
        <div className="mt-8 border-t-2 border-gray-200 pt-6">
          <h3 className="mb-3 text-sm font-semibold">TERMS & CONDITIONS</h3>
          <div className="text-muted-foreground space-y-2 text-xs">
            <p>
              <strong>Acceptance:</strong> This quote must be accepted in writing within the
              validity period shown above.
            </p>
            <p>
              <strong>Payment Terms:</strong> 50% deposit required on acceptance. Balance due on
              delivery or as otherwise agreed.
            </p>
            <p>
              <strong>Delivery:</strong> Delivery times are estimates and may vary depending on
              stock availability and location.
            </p>
            <p>
              <strong>Pricing:</strong> All prices are in Australian Dollars (AUD) and include GST
              unless otherwise stated.
            </p>
            <p>
              <strong>Variations:</strong> Any changes to the quoted items may affect pricing and
              delivery times.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-muted-foreground mt-8 border-t border-gray-200 pt-6 text-center text-xs">
          <p>Thank you for considering CCW Online for your equipment needs!</p>
          <p className="mt-1">CCW Online | ABN 94 086 503 317 | www.ccwonline.com.au</p>
        </div>
      </div>
    </div>
  );
}
