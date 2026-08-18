'use client';

import {
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
  DashboardWidgetLoading,
} from '@/components/dashboard/dashboard-widget-primitives';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';
import { DollarSign, MapPin, TrendingUp } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

interface LocationRevenue {
  location: string;
  revenue: number;
  percentage: number;
  order_count: number;
  average_order_value: number;
  growth_percentage: number | null;
}

interface RevenueByLocationData {
  locations: LocationRevenue[];
  total_revenue: number;
  period: string;
}

const locationAccent: Record<string, string> = {
  brisbane: 'from-sky-500 to-cyan-400',
  sydney: 'from-violet-500 to-indigo-400',
  melbourne: 'from-amber-500 to-orange-400',
  default: 'from-zinc-400 to-zinc-500',
};

function barGradient(location: string): string {
  const key = location.toLowerCase();
  return locationAccent[key] ?? locationAccent.default;
}

export const RevenueByLocationWidget = memo(function RevenueByLocationWidget() {
  const [data, setData] = useState<RevenueByLocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRevenueByLocation() {
      try {
        setLoading(true);
        const response = await apiClient.get<RevenueByLocationData>(
          '/api/dashboard/revenue-by-location'
        );
        setData(response);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load revenue by location data');
      } finally {
        setLoading(false);
      }
    }

    void fetchRevenueByLocation();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatLocation = (location: string) => location.charAt(0).toUpperCase() + location.slice(1);

  if (loading) {
    return <DashboardWidgetLoading title="Revenue by location" subtitle="Aggregating branches…" />;
  }

  if (error) {
    return (
      <div>
        <DashboardWidgetHeader title="Revenue by location" />
        <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const hasRevenue = data && data.total_revenue > 0;

  return (
    <div className="flex h-full flex-col">
      <DashboardWidgetHeader
        title="Revenue by location"
        description={
          data?.period
            ? `${data.period}${hasRevenue ? ` · ${formatCurrency(data.total_revenue)} total` : ''}`
            : 'Share of revenue by branch or region.'
        }
      />

      {!hasRevenue ? (
        <DashboardWidgetEmpty
          icon={DollarSign}
          title="No location revenue yet"
          description="Delivered orders with location attribution will populate this view."
        />
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-zinc-900/40 to-indigo-500/10 p-4 ring-1 ring-sky-500/15">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-sky-200/90 uppercase">
                  Total revenue
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-white tabular-nums">
                  {formatCurrency(data!.total_revenue)}
                </p>
              </div>
              <DollarSign className="h-10 w-10 shrink-0 text-sky-300/50" aria-hidden />
            </div>
          </div>

          <div className="space-y-5">
            {data!.locations.map((location) => (
              <div key={location.location} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-zinc-500" />
                    <span className="font-semibold text-zinc-100">
                      {formatLocation(location.location)}
                    </span>
                    {location.growth_percentage !== null && (
                      <Badge
                        variant="outline"
                        className={
                          location.growth_percentage >= 0
                            ? 'border-emerald-500/35 text-emerald-200'
                            : 'border-red-500/35 text-red-200'
                        }
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        {location.growth_percentage >= 0 ? '+' : ''}
                        {location.growth_percentage.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white tabular-nums">
                      {formatCurrency(location.revenue)}
                    </p>
                    <p className="text-xs text-zinc-500">{location.percentage.toFixed(1)}% share</p>
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/[0.06]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barGradient(location.location)}`}
                    style={{ width: `${Math.min(100, location.percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-zinc-900/40 px-3 py-2 text-sm">
                  <div>
                    <p className="text-xs text-zinc-500">Orders</p>
                    <p className="font-semibold text-zinc-100 tabular-nums">
                      {location.order_count}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Avg order</p>
                    <p className="font-semibold text-zinc-100 tabular-nums">
                      {formatCurrency(location.average_order_value)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data!.locations.length > 0 && (
            <div className="border-t border-white/[0.08] pt-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="font-medium text-zinc-400">Top performer:</span>
                <span className="font-semibold text-emerald-300">
                  {formatLocation(
                    data!.locations.reduce((prev, current) =>
                      prev.revenue > current.revenue ? prev : current
                    ).location
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
