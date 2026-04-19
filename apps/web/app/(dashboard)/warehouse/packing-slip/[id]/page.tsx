'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer } from 'lucide-react';
import { warehouseApi, type PackingSlipResponse } from '@/lib/api/warehouse';
import { useToast } from '@/hooks/use-toast';

export default function PackingSlipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [slip, setSlip] = useState<PackingSlipResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSlip() {
      try {
        const data = await warehouseApi.getPackingSlip(id);
        setSlip(data);
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load packing slip',
        });
      } finally {
        setIsLoading(false);
      }
    }
    void fetchSlip();
  }, [id, toast]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!slip) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Packing slip not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/warehouse">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Warehouse
          </Link>
        </Button>
      </div>
    );
  }

  const createdAt = new Date(slip.created_at).toLocaleString();

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { max-width: 100% !important; padding: 0 !important; }
          body { font-size: 12pt; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="space-y-6 print-full">
        {/* Screen-only nav */}
        <div className="no-print flex items-center justify-between gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/warehouse">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Warehouse
            </Link>
          </Button>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{slip.slip_number}</h1>
            <p className="text-muted-foreground text-sm">
              Generated {createdAt} &middot; {slip.total_orders} order
              {slip.total_orders !== 1 ? 's' : ''} &middot; {slip.total_items} item
              {slip.total_items !== 1 ? 's' : ''}
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            Packing Slip
          </Badge>
        </div>

        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle>Packing Slip Summary</CardTitle>
            <CardDescription>
              {slip.total_orders} order{slip.total_orders !== 1 ? 's' : ''} &middot;{' '}
              {slip.total_items} item{slip.total_items !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Slip #</span>
                <p className="font-mono font-semibold">{slip.slip_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Orders</span>
                <p className="font-semibold">{slip.total_orders}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Items</span>
                <p className="font-semibold">{slip.total_items}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-order sections */}
        {slip.orders.map((order, idx) => (
          <Card key={order.order_id} className={idx > 0 ? 'page-break' : ''}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-mono">{order.order_number}</CardTitle>
                  <CardDescription>
                    Order date:{' '}
                    {order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}
                  </CardDescription>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">
                    {order.customer.company_name}
                  </p>
                  {order.customer.contact_name && (
                    <p className="text-muted-foreground">{order.customer.contact_name}</p>
                  )}
                  {order.customer.address && (
                    <p className="text-muted-foreground text-xs">
                      {[
                        order.customer.address,
                        order.customer.city,
                        order.customer.state,
                        order.customer.postcode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {order.customer.email && (
                    <p className="text-muted-foreground text-xs">{order.customer.email}</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-semibold">SKU</th>
                      <th className="py-2 text-left font-semibold">Description</th>
                      <th className="py-2 text-right font-semibold">Qty</th>
                      <th className="py-2 text-right font-semibold">Unit Price</th>
                      <th className="py-2 text-right font-semibold">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.line_items.map((item, itemIdx) => (
                      <tr key={itemIdx} className="hover:bg-muted/40">
                        <td className="py-2 font-mono text-xs font-semibold">{item.sku}</td>
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right font-semibold">{item.qty}</td>
                        <td className="py-2 text-right">${Number(item.unit_price).toFixed(2)}</td>
                        <td className="py-2 text-right font-semibold">
                          ${Number(item.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Separator className="my-3" />
              <div className="flex justify-end">
                <div className="text-sm">
                  <span className="text-muted-foreground mr-4">Order Total</span>
                  <span className="text-lg font-bold">
                    ${Number(order.order_total).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Print footer */}
        <div className="text-muted-foreground border-t pt-4 text-xs">
          <p>
            Packing slip {slip.slip_number} &middot; Generated {createdAt} &middot; CCW ERP
          </p>
          <p className="mt-1">
            Please retain this packing slip as your record of contents.
          </p>
        </div>
      </div>
    </>
  );
}
