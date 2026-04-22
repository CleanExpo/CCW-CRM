'use client';

import { useState, useEffect, memo } from 'react';
import { FileText, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
  DashboardWidgetLoading,
} from '@/components/dashboard/dashboard-widget-primitives';

interface QuoteConversionData {
  total_quotes: number;
  accepted: number;
  rejected: number;
  pending: number;
  expired: number;
  conversion_rate: number;
  average_quote_value: number;
  total_converted_revenue: number;
}

export const QuoteConversionWidget = memo(function QuoteConversionWidget() {
  const [data, setData] = useState<QuoteConversionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuoteConversion() {
      try {
        setLoading(true);
        const response = await apiClient.get<QuoteConversionData>('/api/dashboard/quote-conversion');
        setData(response);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load quote conversion data');
      } finally {
        setLoading(false);
      }
    }

    void fetchQuoteConversion();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  if (loading) {
    return <DashboardWidgetLoading title="Quote conversion" subtitle="Loading funnel…" />;
  }

  if (error) {
    return (
      <div>
        <DashboardWidgetHeader title="Quote conversion" />
        <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const hasQuotes = data && data.total_quotes > 0;

  return (
    <div className="flex h-full flex-col">
      <DashboardWidgetHeader
        title="Quote conversion"
        description={
          hasQuotes ? `${data!.total_quotes} quotes in scope for conversion metrics.` : 'Quote funnel health.'
        }
        action={
          <Button asChild variant="outline" size="sm" className="border-white/15 text-zinc-200 hover:bg-white/10">
            <Link href="/quotes">Open quotes</Link>
          </Button>
        }
      />

      {!hasQuotes ? (
        <DashboardWidgetEmpty
          icon={FileText}
          title="No quotes to analyse yet"
          description="Create and send quotes from the Quotes workspace. Conversion rate and status mix will display here once data exists."
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">Conversion rate</span>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  data!.conversion_rate >= 40 ? 'text-emerald-300' : 'text-sky-300'
                }`}
              >
                {data!.conversion_rate.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(100, data!.conversion_rate)} className="h-2.5 bg-white/10" />
            <p className="text-xs text-zinc-500">
              {data!.accepted} of {data!.total_quotes} quotes converted to orders
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-sky-500/20 bg-sky-950/25 p-3 ring-1 ring-sky-500/10">
              <p className="text-xs font-medium text-sky-200/90">Avg quote value</p>
              <p className="mt-1 text-lg font-bold text-white tabular-nums">
                {formatCurrency(data!.average_quote_value)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/25 p-3 ring-1 ring-emerald-500/10">
              <p className="text-xs font-medium text-emerald-200/90">Converted revenue</p>
              <p className="mt-1 text-lg font-bold text-white tabular-nums">
                {formatCurrency(data!.total_converted_revenue)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Status mix</p>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-zinc-200">Accepted</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-200">
                {data!.accepted}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-zinc-200">Pending</span>
              </div>
              <Badge variant="outline" className="border-amber-500/30 text-amber-200">
                {data!.pending}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-zinc-200">Rejected</span>
              </div>
              <Badge variant="outline" className="border-red-500/30 text-red-200">
                {data!.rejected}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" />
                <span className="text-sm text-zinc-200">Expired</span>
              </div>
              <Badge variant="outline" className="border-white/15 text-zinc-300">
                {data!.expired}
              </Badge>
            </div>
          </div>

          {data!.conversion_rate >= 50 && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3 ring-1 ring-emerald-500/10">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-100">Strong conversion</p>
                <p className="text-xs leading-relaxed text-emerald-200/80">
                  Your quote-to-order rate is healthy compared to typical wholesale ranges.
                </p>
              </div>
            </div>
          )}

          {data!.pending > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 ring-1 ring-amber-500/10">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-100">Follow up pending quotes</p>
                <p className="text-xs leading-relaxed text-amber-200/80">
                  {data!.pending} quote{data!.pending > 1 ? 's are' : ' is'} awaiting customer response.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
