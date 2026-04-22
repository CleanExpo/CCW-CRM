'use client';

import { useState, useEffect, memo } from 'react';
import { ShoppingCart, Package, Truck, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import {
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
  DashboardWidgetLoading,
} from '@/components/dashboard/dashboard-widget-primitives';

interface OrderStatusCount {
  status: string;
  count: number;
  percentage: number;
}

interface OrderStatusBreakdown {
  total_active_orders: number;
  by_status: OrderStatusCount[];
}

const statusRowStyles: Record<string, string> = {
  pending: 'border-amber-500/25 bg-amber-950/20 hover:border-amber-400/35',
  confirmed: 'border-sky-500/25 bg-sky-950/20 hover:border-sky-400/35',
  processing: 'border-violet-500/25 bg-violet-950/25 hover:border-violet-400/35',
  shipped: 'border-orange-500/25 bg-orange-950/20 hover:border-orange-400/35',
  delivered: 'border-emerald-500/25 bg-emerald-950/20 hover:border-emerald-400/35',
  default: 'border-white/10 bg-zinc-900/40 hover:border-white/20',
};

export const OrderStatusBreakdownWidget = memo(function OrderStatusBreakdownWidget() {
  const [data, setData] = useState<OrderStatusBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrderStatus() {
      try {
        setLoading(true);
        const response = await apiClient.get<OrderStatusBreakdown>(
          '/api/dashboard/order-status-breakdown'
        );
        setData(response);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load order status data');
      } finally {
        setLoading(false);
      }
    }

    void fetchOrderStatus();
  }, []);

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    const cls = 'h-4 w-4 text-sky-300';
    if (s === 'confirmed' || s === 'pending') return <ShoppingCart className={cls} />;
    if (s === 'processing') return <Package className={cls} />;
    if (s === 'shipped') return <Truck className={cls} />;
    if (s === 'delivered') return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
    return <ShoppingCart className={cls} />;
  };

  const rowClass = (status: string) =>
    statusRowStyles[status.toLowerCase()] ?? statusRowStyles.default;

  if (loading) {
    return <DashboardWidgetLoading title="Order fulfilment" subtitle="Loading pipeline…" />;
  }

  if (error) {
    return (
      <div>
        <DashboardWidgetHeader title="Order fulfilment" />
        <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const hasOrders = data && data.total_active_orders > 0;

  return (
    <div className="flex h-full flex-col">
      <DashboardWidgetHeader
        title="Order fulfilment"
        description={
          hasOrders
            ? `${data!.total_active_orders} active order${data!.total_active_orders > 1 ? 's' : ''} in progress.`
            : 'Pipeline snapshot for in-flight orders (excludes delivered and cancelled).'
        }
      />

      {!hasOrders ? (
        <DashboardWidgetEmpty
          icon={ShoppingCart}
          title="No active orders"
          description="When new orders move out of delivered, they will appear here by status so you can balance warehouse and dispatch work."
        />
      ) : (
        <div className="space-y-2">
          {data!.by_status.map((statusData) => (
            <Link key={statusData.status} href={`/orders?status=${statusData.status}`} className="block">
              <div
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${rowClass(
                  statusData.status
                )}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10">
                    {getStatusIcon(statusData.status)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize text-zinc-100">{statusData.status}</p>
                    <p className="text-xs text-zinc-400">
                      {statusData.count} order{statusData.count > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="outline" className="border-white/15 font-semibold tabular-nums text-zinc-200">
                    {statusData.percentage.toFixed(0)}%
                  </Badge>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                      style={{ width: `${Math.min(100, statusData.percentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
