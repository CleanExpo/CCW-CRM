'use client';

import { useState, useEffect, memo } from 'react';
import { AlertTriangle, TrendingDown, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MultiLocationStockCell,
  type StockByLocation,
} from '@/components/inventory/MultiLocationStockCell';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import {
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
  DashboardWidgetLoading,
} from '@/components/dashboard/dashboard-widget-primitives';

interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stock_by_location: StockByLocation[];
  total_available: number;
  min_available: number;
}

interface StockHealthData {
  critical: LowStockProduct[];
  low: LowStockProduct[];
  warning: LowStockProduct[];
}

export const StockHealthWidget = memo(function StockHealthWidget() {
  const [stockHealth, setStockHealth] = useState<StockHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStockHealth() {
      try {
        setLoading(true);
        const response = await apiClient.get<StockHealthData>(
          '/api/inventory/stock-health?threshold=20'
        );
        setStockHealth(response);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load stock health data');
      } finally {
        setLoading(false);
      }
    }

    void fetchStockHealth();
  }, []);

  if (loading) {
    return (
      <div className="p-1">
        <DashboardWidgetLoading title="Stock health" subtitle="Checking locations and thresholds…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-1">
        <DashboardWidgetHeader title="Stock health" description="Could not load inventory signals." />
        <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const totalIssues =
    (stockHealth?.critical.length || 0) +
    (stockHealth?.low.length || 0) +
    (stockHealth?.warning.length || 0);

  return (
    <div className="flex h-full flex-col">
      <DashboardWidgetHeader
        title="Stock health"
        description={
          totalIssues === 0
            ? 'No SKUs are currently below your configured threshold.'
            : `${totalIssues} product${totalIssues > 1 ? 's' : ''} need attention across locations.`
        }
        action={
          <Button asChild variant="outline" size="sm" className="border-white/15 text-zinc-200 hover:bg-white/10">
            <Link href="/products">View products</Link>
          </Button>
        }
      />

      {totalIssues === 0 ? (
        <DashboardWidgetEmpty
          icon={ShieldCheck}
          title="Inventory looks healthy"
          description="When items drop below threshold, they will surface here with branch-level detail so you can reorder or transfer quickly."
        />
      ) : (
        <div className="space-y-6">
          {stockHealth && stockHealth.critical.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h4 className="text-sm font-semibold tracking-wide text-red-200 uppercase">
                  Critical — out of stock ({stockHealth.critical.length})
                </h4>
              </div>
              <div className="space-y-3">
                {stockHealth.critical.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/25 p-3 ring-1 ring-red-500/15"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400">{product.sku}</span>
                        <Badge variant="destructive" className="text-[10px]">
                          Out of stock
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{product.name}</p>
                      <div className="mt-2">
                        <MultiLocationStockCell
                          productId={product.id}
                          locations={product.stock_by_location}
                        />
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/procurement?reorder=${product.id}`}>Reorder</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stockHealth && stockHealth.low.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-400" />
                <h4 className="text-sm font-semibold tracking-wide text-amber-200 uppercase">
                  Low stock ({stockHealth.low.length})
                </h4>
              </div>
              <div className="space-y-3">
                {stockHealth.low.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 ring-1 ring-amber-500/10"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400">{product.sku}</span>
                        <Badge
                          variant="secondary"
                          className="border border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-100"
                        >
                          Low
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{product.name}</p>
                      <div className="mt-2">
                        <MultiLocationStockCell
                          productId={product.id}
                          locations={product.stock_by_location}
                        />
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0 border-white/15">
                      <Link href={`/procurement?reorder=${product.id}`}>Reorder</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stockHealth && stockHealth.warning.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <h4 className="text-sm font-semibold tracking-wide text-orange-200 uppercase">
                  Location imbalance ({stockHealth.warning.length})
                </h4>
              </div>
              <div className="space-y-3">
                {stockHealth.warning.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-orange-500/25 bg-orange-950/20 p-3 ring-1 ring-orange-500/10"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400">{product.sku}</span>
                        <Badge variant="outline" className="border-orange-400/40 text-[10px] text-orange-100">
                          Transfer
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{product.name}</p>
                      <div className="mt-2">
                        <MultiLocationStockCell
                          productId={product.id}
                          locations={product.stock_by_location}
                        />
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0 border-white/15">
                      <Link href={`/inventory/transfers?product=${product.id}`}>Transfer</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
