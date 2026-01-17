"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trackTelemetry } from "@/lib/telemetry";
import { formatCurrency } from "@/lib/utils/calculations";
import { convertToCSV, downloadCSV } from "@/lib/utils/csv-export";

interface DemoOrder {
  id: string;
  orderNumber: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerAccount: string;
  customerEmail: string;
  customerPhone: string;
  lineItems: Array<{
    title: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export default function ShowroomInvoicePage() {
  const router = useRouter();
  const [order, setOrder] = useState<DemoOrder | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("ccw_showroom_order");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as DemoOrder;
      setOrder(parsed);
      void trackTelemetry({
        name: "showroom_invoice_viewed",
        metadata: { orderNumber: parsed.orderNumber },
      });
    } catch {
      setOrder(null);
    }
  }, []);

  if (!order) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">No invoice found</p>
            <p className="text-sm text-muted-foreground">
              Create an order in the showroom to generate an invoice preview.
            </p>
            <Button onClick={() => router.push("/portal/showroom")}>
              Back to showroom
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoiceDate = new Date(order.createdAt);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 14);
  const handleExportCsv = () => {
    const headers = [
      "invoice_number",
      "order_number",
      "customer_name",
      "sku",
      "description",
      "quantity",
      "unit_price",
      "line_total",
      "discount",
      "shipping",
      "tax",
      "total",
    ];
    const data = order.lineItems.map((item) => ({
      invoice_number: order.invoiceNumber,
      order_number: order.orderNumber,
      customer_name: order.customerName,
      sku: item.sku,
      description: item.title,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      discount: order.discount,
      shipping: order.shipping,
      tax: order.tax,
      total: order.total,
    }));
    const csv = convertToCSV(data, headers);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `invoice-${order.invoiceNumber}-${timestamp}.csv`);
  };

  return (
    <>
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

      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="no-print mb-6 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/portal/showroom")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to showroom
          </Button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Invoice preview
            </p>
            <h1 className="text-2xl font-semibold">{order.invoiceNumber}</h1>
          </div>
          <Badge variant="outline">Preview</Badge>
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>

        <div className="invoice-print rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">CCW Equipment</h2>
              <p className="text-sm text-muted-foreground">Cleaning & Restoration Supplies</p>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Unit 5, 123 Industry Road</p>
                <p>Brisbane QLD 4000</p>
                <p>ABN: 72 645 912 233</p>
                <p>accounts@ccwonline.com.au</p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Invoice #</span>{" "}
                {order.invoiceNumber}
              </p>
              <p>
                <span className="font-semibold text-foreground">Order #</span>{" "}
                {order.orderNumber}
              </p>
              <p>
                <span className="font-semibold text-foreground">Invoice date</span>{" "}
                {invoiceDate.toLocaleDateString("en-AU")}
              </p>
              <p>
                <span className="font-semibold text-foreground">Due date</span>{" "}
                {dueDate.toLocaleDateString("en-AU")}
              </p>
            </div>
          </div>

          <div className="grid gap-6 py-6 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Bill to
              </p>
              <p className="text-lg font-semibold text-foreground">{order.customerName}</p>
              <p className="text-sm text-muted-foreground">{order.customerAccount}</p>
            </div>
            <div className="text-sm text-muted-foreground md:text-right">
              <p>{order.customerEmail}</p>
              <p>{order.customerPhone}</p>
            </div>
          </div>

          <Separator />

          <div className="py-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit</th>
                  <th className="py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((item, index) => (
                  <tr key={`${item.sku}-${index}`} className="border-b">
                    <td className="py-3">
                      <div className="font-medium text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground">SKU {item.sku}</div>
                    </td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 text-right font-medium text-foreground">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{formatCurrency(order.shipping)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>GST (10%)</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            Payment terms: Net 14. Please reference {order.invoiceNumber} on remittance.
          </div>
        </div>
      </div>
    </>
  );
}
