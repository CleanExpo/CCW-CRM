'use client';

import { useState, useEffect, memo } from 'react';
import { ArrowRight, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import {
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
  DashboardWidgetLoading,
} from '@/components/dashboard/dashboard-widget-primitives';

interface TransferSuggestion {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  from_location: string;
  to_location: string;
  suggested_quantity: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  current_stock_from: number;
  current_stock_to: number;
  projected_stock_from: number;
  projected_stock_to: number;
  estimated_cost: number;
  potential_revenue_impact: number;
}

interface TransferSuggestionsData {
  suggestions: TransferSuggestion[];
  total_potential_revenue: number;
  total_estimated_cost: number;
}

const priorityRing: Record<string, string> = {
  high: 'border-red-500/35 ring-red-500/15',
  medium: 'border-amber-500/35 ring-amber-500/15',
  low: 'border-sky-500/35 ring-sky-500/15',
};

export const TransferSuggestionsWidget = memo(function TransferSuggestionsWidget() {
  const [data, setData] = useState<TransferSuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransferSuggestions() {
      try {
        setLoading(true);
        const response = await apiClient.get<TransferSuggestionsData>(
          '/api/inventory/transfer-suggestions'
        );
        setData(response);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load transfer suggestions');
      } finally {
        setLoading(false);
      }
    }

    void fetchTransferSuggestions();
  }, []);

  const formatLocation = (location: string) => location.charAt(0).toUpperCase() + location.slice(1);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(value);

  if (loading) {
    return <DashboardWidgetLoading title="Transfer suggestions" subtitle="Evaluating stock positions…" />;
  }

  if (error) {
    return (
      <div>
        <DashboardWidgetHeader title="Transfer suggestions" />
        <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const hasSuggestions = data && data.suggestions.length > 0;

  return (
    <div className="flex h-full flex-col">
      <DashboardWidgetHeader
        title="Transfer suggestions"
        description={
          hasSuggestions
            ? `${data!.suggestions.length} recommended move${data!.suggestions.length > 1 ? 's' : ''} to rebalance stock.`
            : 'Optimise multi-branch inventory based on demand signals.'
        }
        action={
          hasSuggestions ? (
            <Button asChild variant="outline" size="sm" className="border-white/15 text-zinc-200 hover:bg-white/10">
              <Link href="/inventory/transfers">View transfers</Link>
            </Button>
          ) : null
        }
      />

      {!hasSuggestions ? (
        <DashboardWidgetEmpty
          icon={CheckCircle2}
          title="Stock looks balanced"
          description="When the optimiser finds meaningful branch skew, suggested transfers with cost and revenue impact will appear here."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-zinc-900/50 to-indigo-500/10 p-4 ring-1 ring-sky-500/15">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-sky-200/90 uppercase">Potential revenue</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-white">
                  {formatCurrency(data!.total_potential_revenue)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Est. transfer cost</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-zinc-200">
                  {formatCurrency(data!.total_estimated_cost)}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Net benefit</span>
                <span className="font-bold text-emerald-300 tabular-nums">
                  {formatCurrency(data!.total_potential_revenue - data!.total_estimated_cost)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data!.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`rounded-xl border bg-zinc-900/40 p-4 ring-1 ${priorityRing[suggestion.priority] ?? 'border-white/10 ring-white/[0.04]'}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-300">{suggestion.product_sku}</span>
                      <Badge
                        variant="outline"
                        className={
                          suggestion.priority === 'high'
                            ? 'border-red-400/40 text-red-200'
                            : suggestion.priority === 'medium'
                              ? 'border-amber-400/40 text-amber-200'
                              : 'border-sky-400/40 text-sky-200'
                        }
                      >
                        {suggestion.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-zinc-100">{suggestion.product_name}</p>
                  </div>
                </div>

                <div className="my-3 flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="min-w-0 flex-1 text-center">
                    <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">From</p>
                    <p className="text-sm font-semibold text-zinc-100">{formatLocation(suggestion.from_location)}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                      {suggestion.current_stock_from} → {suggestion.projected_stock_from}
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="h-5 w-5 text-sky-400" />
                    <Badge className="border-0 bg-sky-600/90 text-white">{suggestion.suggested_quantity} units</Badge>
                  </div>

                  <div className="min-w-0 flex-1 text-center">
                    <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">To</p>
                    <p className="text-sm font-semibold text-zinc-100">{formatLocation(suggestion.to_location)}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                      {suggestion.current_stock_to} → {suggestion.projected_stock_to}
                    </p>
                  </div>
                </div>

                <div className="mb-3 flex items-start gap-2 text-sm text-zinc-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90" />
                  <p>{suggestion.reason}</p>
                </div>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>
                    Cost:{' '}
                    <span className="font-semibold text-zinc-200">{formatCurrency(suggestion.estimated_cost)}</span>
                  </span>
                  <span>
                    Revenue impact:{' '}
                    <span className="font-semibold text-emerald-300">
                      {formatCurrency(suggestion.potential_revenue_impact)}
                    </span>
                  </span>
                </div>

                <Button asChild size="sm" className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 text-white">
                  <Link
                    href={`/inventory/transfers/create?product=${suggestion.product_id}&from=${suggestion.from_location}&to=${suggestion.to_location}&quantity=${suggestion.suggested_quantity}`}
                  >
                    Create transfer
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
