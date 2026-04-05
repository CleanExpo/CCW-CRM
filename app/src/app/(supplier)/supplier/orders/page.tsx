'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Calendar, CheckCircle, Clock, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';

interface POLineItem {
  sku: string;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

interface PurchaseOrder {
  po_id: string;
  po_number: string;
  status: string;
  issued_date: string;
  required_by: string;
  confirmed_delivery_date: string | null;
  total: number;
  line_items: POLineItem[];
  notes: string;
  delivery_doc_uploaded: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  pending_confirmation: { label: 'Awaiting Confirmation', variant: 'destructive' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'secondary' },
};

export default function SupplierOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<{ purchase_orders: PurchaseOrder[] }>(
          '/api/supplier-portal/purchase-orders'
        );
        setOrders(res.purchase_orders);
      } catch {
        /* demo fallback */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleConfirm(poId: string, poNumber: string) {
    if (!deliveryDate) {
      toast({
        title: 'Required',
        description: 'Please select a delivery date.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await apiClient.put(`/api/supplier-portal/purchase-orders/${poId}/confirm`, {
        confirmed_delivery_date: deliveryDate,
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.po_id === poId
            ? { ...o, status: 'confirmed', confirmed_delivery_date: deliveryDate }
            : o
        )
      );
      setConfirming(null);
      setDeliveryDate('');
      toast({
        title: 'Delivery confirmed',
        description: `${poNumber} — confirmed for ${new Date(deliveryDate).toLocaleDateString('en-AU')}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
        <p className="mt-0.5 text-sm text-slate-500">{orders.length} purchase orders from CCW</p>
      </div>

      <div className="space-y-3">
        {orders.map((po) => {
          const cfg = STATUS_CONFIG[po.status] ?? STATUS_CONFIG.pending_confirmation;
          const isExpanded = expanded === po.po_id;
          const isConfirming = confirming === po.po_id;

          return (
            <Card
              key={po.po_id}
              className={po.status === 'pending_confirmation' ? 'border-amber-200' : ''}
            >
              <button
                className="w-full text-left"
                onClick={() => {
                  if (!isConfirming) setExpanded(isExpanded ? null : po.po_id);
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${po.status === 'pending_confirmation' ? 'bg-amber-50' : 'bg-slate-100'}`}
                      >
                        <ShoppingCart
                          className={`h-4 w-4 ${po.status === 'pending_confirmation' ? 'text-amber-600' : 'text-slate-600'}`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{po.po_number}</CardTitle>
                        <p className="text-xs text-slate-500">
                          Issued {new Date(po.issued_date).toLocaleDateString('en-AU')} · Required
                          by {new Date(po.required_by).toLocaleDateString('en-AU')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        ${po.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="space-y-4 border-t pt-4">
                  {/* Line items */}
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['SKU', 'Description', 'Qty', 'Unit Price', 'Total'].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {po.line_items.map((item) => (
                          <tr key={item.sku} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">{item.qty}</td>
                            <td className="px-3 py-2">
                              $
                              {item.unit_price.toLocaleString('en-AU', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              $
                              {item.line_total.toLocaleString('en-AU', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Delivery info */}
                  <div className="flex flex-wrap gap-6 text-sm">
                    {po.confirmed_delivery_date && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                            Confirmed Delivery
                          </p>
                          <p>{new Date(po.confirmed_delivery_date).toLocaleDateString('en-AU')}</p>
                        </div>
                      </div>
                    )}
                    {po.notes && (
                      <div>
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                          Notes
                        </p>
                        <p className="text-slate-600">{po.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm delivery form */}
                  {po.status === 'pending_confirmation' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      {!isConfirming ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-amber-800">
                            <Clock className="h-4 w-4" />
                            <p>Please confirm your delivery date for this order.</p>
                          </div>
                          <Button size="sm" onClick={() => setConfirming(po.po_id)}>
                            <Calendar className="mr-2 h-3.5 w-3.5" />
                            Confirm Date
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Label htmlFor={`date-${po.po_id}`}>Your confirmed delivery date</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`date-${po.po_id}`}
                              type="date"
                              value={deliveryDate}
                              onChange={(e) => setDeliveryDate(e.target.value)}
                              className="flex-1"
                            />
                            <Button onClick={() => handleConfirm(po.po_id, po.po_number)}>
                              Confirm
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setConfirming(null);
                                setDeliveryDate('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {po.status === 'delivered' && !po.delivery_doc_uploaded && (
                    <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Package className="h-4 w-4" />
                        <p>Upload delivery documentation (POD)</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Upload
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {orders.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingCart className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-slate-500">No purchase orders</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
