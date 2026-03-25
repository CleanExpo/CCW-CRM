'use client';

import { useEffect, useState } from 'react';
import { Package, Truck, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';

interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  unit_price: number;
}

interface Order {
  order_id: string;
  order_number: string;
  date: string;
  status: string;
  total: number;
  items: OrderItem[];
  tracking_number: string | null;
  estimated_delivery: string;
  delivered_at: string | null;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    icon: React.ReactNode;
  }
> = {
  processing: {
    label: 'Processing',
    variant: 'default',
    icon: <RefreshCw className="h-3 w-3" />,
  },
  shipped: {
    label: 'Shipped',
    variant: 'default',
    icon: <Truck className="h-3 w-3" />,
  },
  delivered: {
    label: 'Delivered',
    variant: 'secondary',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  pending: {
    label: 'Pending',
    variant: 'outline',
    icon: <Clock className="h-3 w-3" />,
  },
};

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<{ orders: Order[] }>('/api/portal/orders');
        setOrders(res.orders);
      } catch {
        /* demo fallback — orders stay empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">Loading orders…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Order History</h1>
        <p className="mt-0.5 text-sm text-slate-500">{orders.length} orders on your account</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-4 h-12 w-12 text-slate-300" />
            <p className="font-medium text-slate-700">No orders yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            const isExpanded = expanded === order.order_id;
            return (
              <Card key={order.order_id} className="overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => setExpanded(isExpanded ? null : order.order_id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">
                            {order.order_number}
                          </CardTitle>
                          <p className="text-xs text-slate-500">
                            {new Date(order.date).toLocaleDateString('en-AU')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">
                          ${order.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                        <Badge variant={cfg.variant} className="flex items-center gap-1">
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
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
                            {['SKU', 'Product', 'Qty', 'Unit Price', 'Total'].map((h) => (
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
                          {order.items.map((item) => (
                            <tr key={item.sku} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs text-slate-600">
                                {item.sku}
                              </td>
                              <td className="px-3 py-2">{item.name}</td>
                              <td className="px-3 py-2">{item.qty}</td>
                              <td className="px-3 py-2">
                                $
                                {item.unit_price.toLocaleString('en-AU', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-3 py-2">
                                $
                                {(item.qty * item.unit_price).toLocaleString('en-AU', {
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
                      {order.tracking_number && (
                        <div>
                          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                            Tracking
                          </p>
                          <p className="font-mono text-slate-700">{order.tracking_number}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                          {order.delivered_at ? 'Delivered' : 'Estimated Delivery'}
                        </p>
                        <p className="text-slate-700">
                          {new Date(
                            order.delivered_at ?? order.estimated_delivery
                          ).toLocaleDateString('en-AU')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
