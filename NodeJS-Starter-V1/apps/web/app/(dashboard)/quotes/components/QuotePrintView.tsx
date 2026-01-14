"use client";

import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/calculations";

interface Quote {
  id: string;
  quote_number: string;
  customer_name?: string;
  quote_date: string;
  valid_until: string;
  status: string;
  total: number;
  notes?: string;
  items?: any[];
  quote_items?: any[];
}

interface QuotePrintViewProps {
  quote: Quote;
}

export function QuotePrintView({ quote }: QuotePrintViewProps) {
  const items = quote.items || quote.quote_items || [];
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
      <div className="max-w-4xl mx-auto bg-white p-8 print:p-0">
        {/* Company Header */}
        <div className="border-b-2 border-primary pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-primary">Equipment ERP</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Equipment Supplier & Distributor
              </p>
              <div className="mt-4 text-sm">
                <p>123 Equipment Street</p>
                <p>Brisbane QLD 4000, Australia</p>
                <p>ABN: 12 345 678 901</p>
                <p>Phone: +61 7 3000 0000</p>
                <p>Email: sales@equipmenterp.com.au</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold">QUOTATION</h2>
              <div className="mt-4 text-sm space-y-1">
                <p>
                  <span className="font-semibold">Quote #:</span> {quote.quote_number}
                </p>
                <p>
                  <span className="font-semibold">Date:</span>{" "}
                  {format(new Date(quote.quote_date), "dd MMMM yyyy")}
                </p>
                <p>
                  <span className="font-semibold">Valid Until:</span>{" "}
                  {format(new Date(quote.valid_until), "dd MMMM yyyy")}
                </p>
                <p>
                  <span className="font-semibold">Status:</span>{" "}
                  <span className="capitalize">{quote.status}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">QUOTE FOR</h3>
          <div className="text-sm">
            <p className="font-semibold text-lg">{quote.customer_name || "Customer"}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 text-sm font-semibold">ITEM</th>
                <th className="text-center py-3 text-sm font-semibold">QTY</th>
                <th className="text-right py-3 text-sm font-semibold">UNIT PRICE</th>
                <th className="text-right py-3 text-sm font-semibold">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => (
                <tr key={item.id || index} className="border-b border-gray-200">
                  <td className="py-3 text-sm">{item.product_name || item.product_id}</td>
                  <td className="py-3 text-sm text-center">{item.quantity}</td>
                  <td className="py-3 text-sm text-right">
                    {formatCurrency(Number(item.unit_price))}
                  </td>
                  <td className="py-3 text-sm text-right font-medium">
                    {formatCurrency(Number(item.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-2 text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span>GST (10%):</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-gray-300">
              <span>TOTAL:</span>
              <span>{formatCurrency(Number(quote.total))}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">NOTES</h3>
            <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Validity Notice */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
          <p className="text-sm text-blue-900">
            <strong>Important:</strong> This quotation is valid until{" "}
            {format(new Date(quote.valid_until), "dd MMMM yyyy")}. Prices and availability
            are subject to change after this date.
          </p>
        </div>

        {/* Terms & Conditions */}
        <div className="border-t-2 border-gray-200 pt-6 mt-8">
          <h3 className="text-sm font-semibold mb-3">TERMS & CONDITIONS</h3>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>
              <strong>Acceptance:</strong> This quote must be accepted in writing within the
              validity period shown above.
            </p>
            <p>
              <strong>Payment Terms:</strong> 50% deposit required on acceptance. Balance due
              on delivery or as otherwise agreed.
            </p>
            <p>
              <strong>Delivery:</strong> Delivery times are estimates and may vary depending
              on stock availability and location.
            </p>
            <p>
              <strong>Pricing:</strong> All prices are in Australian Dollars (AUD) and
              include GST unless otherwise stated.
            </p>
            <p>
              <strong>Variations:</strong> Any changes to the quoted items may affect pricing
              and delivery times.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-8 pt-6 border-t border-gray-200">
          <p>Thank you for considering Equipment ERP for your equipment needs!</p>
          <p className="mt-1">
            Equipment ERP | ABN 12 345 678 901 | www.equipmenterp.com.au
          </p>
        </div>
      </div>
    </div>
  );
}
