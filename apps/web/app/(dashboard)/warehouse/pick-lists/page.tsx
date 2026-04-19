'use client';

import { useState } from 'react';

import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ContributingOrder {
  order_id: string;
  order_number: string;
  customer_name: string;
  quantity: number;
}

interface PickListLine {
  location: string;
  product_id: string;
  sku: string;
  name: string;
  total_quantity: number;
  contributing_orders: ContributingOrder[];
}

interface OrderSummary {
  order_id: string;
  order_number: string;
  customer_name: string | null;
  status: string;
  fulfillment_location: string | null;
}

interface PickListResponse {
  generated_at: string;
  order_count: number;
  sku_count: number;
  total_units: number;
  units_by_location: Record<string, number>;
  lines: PickListLine[];
  orders: OrderSummary[];
}

export default function PickListsPage() {
  const [orderIdsRaw, setOrderIdsRaw] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PickListResponse | null>(null);

  async function handleGenerate() {
    setError(null);
    setData(null);
    const order_ids = orderIdsRaw
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean);

    if (order_ids.length === 0) {
      setError('Enter at least one order ID.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.post<PickListResponse>('/api/warehouse/pick-lists', {
        order_ids,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate pick list');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Generate Pick List</CardTitle>
          <p className="text-muted-foreground text-sm">
            Paste the order IDs (UUIDs) to include in this pick wave. The API returns a consolidated
            list grouped by warehouse location, then by SKU — each picker walks a zone once per
            wave.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="order-ids">Order IDs</Label>
            <Textarea
              id="order-ids"
              rows={4}
              value={orderIdsRaw}
              onChange={(e) => setOrderIdsRaw(e.target.value)}
              placeholder="Comma- or whitespace-separated UUIDs&#10;e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleGenerate} disabled={loading || !orderIdsRaw.trim()}>
              {loading ? 'Generating…' : 'Generate pick list'}
            </Button>
            {data && (
              <Button variant="outline" onClick={handlePrint}>
                Print
              </Button>
            )}
            {error && <span className="text-destructive self-center text-sm">{error}</span>}
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <CardTitle>Pick List</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Generated {new Date(data.generated_at).toLocaleString('en-AU')} —{' '}
                    {data.order_count} order{data.order_count === 1 ? '' : 's'}, {data.sku_count}{' '}
                    unique SKU{data.sku_count === 1 ? '' : 's'}, {data.total_units} unit
                    {data.total_units === 1 ? '' : 's'} total.
                  </p>
                </div>
                <div className="text-sm">
                  {Object.entries(data.units_by_location).map(([loc, qty]) => (
                    <span
                      key={loc}
                      className="bg-muted mr-2 inline-block rounded px-2 py-1 text-xs tabular-nums"
                    >
                      {loc}: <strong>{qty}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Location</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2">Product</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={`${line.location}-${line.product_id}`} className="border-b">
                      <td className="py-2 capitalize">{line.location}</td>
                      <td className="py-2 font-mono text-xs">{line.sku}</td>
                      <td className="py-2">{line.name}</td>
                      <td className="py-2 text-right font-mono font-semibold tabular-nums">
                        {line.total_quantity}
                      </td>
                      <td className="text-muted-foreground py-2 text-xs">
                        {line.contributing_orders
                          .map((o) => `${o.order_number} (${o.quantity})`)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Packing Slips</CardTitle>
              <p className="text-muted-foreground text-sm">
                After picking, open each order's packing slip for the pack bench.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {data.orders.map((o) => (
                  <li key={o.order_id} className="flex items-center gap-3">
                    <span className="font-mono text-xs">{o.order_number}</span>
                    <span className="text-muted-foreground">
                      {o.customer_name} — {o.fulfillment_location ?? 'unassigned'}
                    </span>
                    <a
                      className="text-primary ml-auto text-xs underline"
                      href={`/api/warehouse/packing-slips/${o.order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View packing slip JSON
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
