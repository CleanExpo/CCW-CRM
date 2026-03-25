'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { convertToCSV, downloadCSV } from '@/lib/utils/csv-export';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils/calculations';
import type { Order, OrderItem } from '../../types';

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const orderData = await apiClient.get<Order>(`/api/orders/${orderId}`);
      setOrder(orderData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load order';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      router.push('/orders');
    } finally {
      setLoading(false);
    }
  }, [orderId, router, toast]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handlePrint = () => {
    window.print();
  };
  const handleExportCsv = () => {
    if (!order) return;
    const invoiceNumber = order.order_number.replace('ORD-', 'INV-');
    const headers = [
      'invoice_number',
      'order_number',
      'customer_name',
      'description',
      'quantity',
      'unit_price',
      'line_total',
      'tax',
      'total',
    ];
    const items: OrderItem[] = order.items || order.order_items || [];
    const subtotal = Number(order.total) / 1.1;
    const tax = Number(order.total) - subtotal;
    const data = items.map((item) => ({
      invoice_number: invoiceNumber,
      order_number: order.order_number,
      customer_name: order.customer_name || '',
      description: item.product_name || item.product_id,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
      tax,
      total: Number(order.total),
    }));
    const csv = convertToCSV(data, headers);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `invoice-${invoiceNumber}-${timestamp}.csv`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const items: OrderItem[] = order.items || order.order_items || [];
  const subtotal = Number(order.total) / 1.1;
  const tax = Number(order.total) - subtotal;

  // Generate invoice number from order number
  const invoiceNumber = order.order_number.replace('ORD-', 'INV-');
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-print,
          .invoice-print * {
            visibility: visible;
          }
          .invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>

      {/* Header Actions */}
      <div className="no-print mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Invoice</h1>
          <p className="text-muted-foreground">{invoiceNumber}</p>
        </div>
        <Button variant="outline" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* Invoice Content */}
      <div className="invoice-print mx-auto max-w-4xl rounded-lg border bg-white p-8 print:border-0 print:p-0">
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
                <p>Email: accounts@ccwonline.com.au</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-red-600">INVOICE</h2>
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="font-semibold">Invoice #:</span> {invoiceNumber}
                </p>
                <p>
                  <span className="font-semibold">Order #:</span> {order.order_number}
                </p>
                <p>
                  <span className="font-semibold">Invoice Date:</span>{' '}
                  {format(invoiceDate, 'dd MMMM yyyy')}
                </p>
                <p>
                  <span className="font-semibold">Due Date:</span> {format(dueDate, 'dd MMMM yyyy')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-8">
          <h3 className="text-muted-foreground mb-2 text-sm font-semibold">INVOICE TO</h3>
          <div className="text-sm">
            <p className="text-lg font-semibold">{order.customer_name || 'Customer'}</p>
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
              <span>AMOUNT DUE:</span>
              <span className="text-red-600">{formatCurrency(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="mb-8 border-l-4 border-blue-500 bg-blue-50 p-4">
          <h3 className="mb-2 text-sm font-semibold">PAYMENT INSTRUCTIONS</h3>
          <div className="space-y-1 text-xs">
            <p>
              <strong>Bank:</strong> Commonwealth Bank of Australia
            </p>
            <p>
              <strong>Account Name:</strong> CCW Online Pty Ltd
            </p>
            <p>
              <strong>BSB:</strong> 063-000
            </p>
            <p>
              <strong>Account Number:</strong> 1234 5678
            </p>
            <p>
              <strong>Reference:</strong> {invoiceNumber}
            </p>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mb-8">
            <h3 className="text-muted-foreground mb-2 text-sm font-semibold">NOTES</h3>
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        <div className="mt-8 border-t-2 border-gray-200 pt-6">
          <h3 className="mb-3 text-sm font-semibold">PAYMENT TERMS & CONDITIONS</h3>
          <div className="text-muted-foreground space-y-2 text-xs">
            <p>
              <strong>Payment Due:</strong> Payment is due within 30 days of the invoice date.
              Interest may be charged on overdue accounts at a rate of 2% per month.
            </p>
            <p>
              <strong>Payment Methods:</strong> We accept payment by bank transfer, credit card, or
              cheque. Please include the invoice number as a reference.
            </p>
            <p>
              <strong>Queries:</strong> If you have any questions about this invoice, please contact
              our accounts department at accounts@ccwonline.com.au or call +61 7 3000 0000.
            </p>
            <p>
              <strong>Late Payment:</strong> Failure to pay by the due date may result in suspension
              of credit facilities and legal action to recover outstanding amounts.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-muted-foreground mt-8 border-t border-gray-200 pt-6 text-center text-xs">
          <p>Thank you for your business!</p>
          <p className="mt-1">CCW Online | ABN 12 345 678 901 | www.ccwonline.com.au</p>
        </div>
      </div>
    </>
  );
}
