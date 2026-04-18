'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer } from 'lucide-react';
import { warehouseApi, type PickListResponse } from '@/lib/api/warehouse';
import { useToast } from '@/hooks/use-toast';

export default function PickListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [pickList, setPickList] = useState<PickListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPickList() {
      try {
        const data = await warehouseApi.getPickList(id);
        setPickList(data);
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load pick list',
        });
      } finally {
        setIsLoading(false);
      }
    }
    void fetchPickList();
  }, [id, toast]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!pickList) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Pick list not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/warehouse">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Warehouse
          </Link>
        </Button>
      </div>
    );
  }

  const createdAt = new Date(pickList.created_at).toLocaleString();

  return (
    <>
      {/* Print-only header (hidden on screen) */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { max-width: 100% !important; padding: 0 !important; }
          body { font-size: 12pt; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
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

        {/* Pick list header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pickList.pick_list_number}</h1>
            <p className="text-muted-foreground text-sm">
              Generated {createdAt} &middot; {pickList.total_lines} line
              {pickList.total_lines !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pickList.customer_names.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle>Pick List Summary</CardTitle>
            <CardDescription>
              {pickList.order_ids.length} order
              {pickList.order_ids.length !== 1 ? 's' : ''} &middot;{' '}
              {pickList.customer_names.join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Pick List #</span>
                <p className="font-mono font-semibold">{pickList.pick_list_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Orders</span>
                <p className="font-semibold">{pickList.order_ids.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Lines</span>
                <p className="font-semibold">{pickList.total_lines}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line items table */}
        <Card>
          <CardHeader>
            <CardTitle>Items to Pick</CardTitle>
            <CardDescription>Sorted by bin location for efficient picking.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-semibold">Order #</th>
                    <th className="py-2 text-left font-semibold">SKU</th>
                    <th className="py-2 text-left font-semibold">Description</th>
                    <th className="py-2 text-center font-semibold">Bin Location</th>
                    <th className="py-2 text-right font-semibold">Qty Ordered</th>
                    <th className="py-2 text-right font-semibold no-print">Qty Picked</th>
                    <th className="py-2 text-center font-semibold no-print">Picked?</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pickList.line_items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/40">
                      <td className="py-2 font-mono text-xs">{item.order_number}</td>
                      <td className="py-2 font-mono text-xs font-semibold">{item.sku}</td>
                      <td className="py-2">{item.description}</td>
                      <td className="py-2 text-center">
                        {item.bin_location ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.bin_location}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold">{item.qty_ordered}</td>
                      {/* Screen-only: editable picked qty field + checkbox */}
                      <td className="py-2 text-right no-print">
                        <span className="text-muted-foreground">{item.qty_picked}</span>
                      </td>
                      <td className="py-2 text-center no-print">
                        <input
                          type="checkbox"
                          aria-label={`Mark ${item.sku} as picked`}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Print footer */}
        <div className="text-muted-foreground border-t pt-4 text-xs">
          <p>
            Pick list {pickList.pick_list_number} &middot; Generated {createdAt} &middot; CCW ERP
          </p>
          <p className="mt-1">
            Please sign and return to warehouse supervisor upon completion.
          </p>
        </div>
      </div>
    </>
  );
}
