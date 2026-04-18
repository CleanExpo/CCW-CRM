'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, DollarSign, AlertTriangle, Clock, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface APAgeingBuckets {
  current_0_30: string;
  days_31_60: string;
  days_61_90: string;
  days_90_plus: string;
}

interface APAgeingSupplierRow {
  supplier_id: string;
  supplier_code: string;
  company_name: string;
  total_outstanding: string;
  current_0_30: string;
  days_31_60: string;
  days_61_90: string;
  days_90_plus: string;
  oldest_po_days: number;
  po_count: number;
}

interface APAgeingReport {
  as_of_date: string;
  total_outstanding: string;
  buckets: APAgeingBuckets;
  suppliers: APAgeingSupplierRow[];
  generated_at: string;
}

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num);
};

const bucketBadgeVariant = (
  days: string
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const n = parseFloat(days);
  if (n === 0) return 'secondary';
  if (n <= 500) return 'default'; // low risk
  return 'destructive'; // high value overdue
};

function BucketBar({ report }: { report: APAgeingReport }) {
  const total = parseFloat(report.total_outstanding) || 1;
  const segments = [
    {
      label: '0–30 days',
      value: parseFloat(report.buckets.current_0_30),
      color: 'bg-green-500',
    },
    {
      label: '31–60 days',
      value: parseFloat(report.buckets.days_31_60),
      color: 'bg-yellow-400',
    },
    {
      label: '61–90 days',
      value: parseFloat(report.buckets.days_61_90),
      color: 'bg-orange-500',
    },
    {
      label: '90+ days',
      value: parseFloat(report.buckets.days_90_plus),
      color: 'bg-red-600',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={seg.label}
              className={`${seg.color} h-full`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${formatCurrency(seg.value)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-sm ${seg.color}`} />
            {seg.label}: {formatCurrency(seg.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ApAgeingDashboard() {
  const { toast } = useToast();
  const [report, setReport] = useState<APAgeingReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<APAgeingReport>('/api/analytics/ap-ageing');
      setReport(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load AP ageing report';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!report) return null;

  const bucketCards = [
    {
      label: '0–30 Days (Current)',
      value: report.buckets.current_0_30,
      icon: DollarSign,
      color: 'text-green-600',
      desc: 'Within payment terms',
    },
    {
      label: '31–60 Days',
      value: report.buckets.days_31_60,
      icon: Clock,
      color: 'text-yellow-600',
      desc: 'Approaching overdue',
    },
    {
      label: '61–90 Days',
      value: report.buckets.days_61_90,
      icon: AlertTriangle,
      color: 'text-orange-600',
      desc: 'Overdue — action required',
    },
    {
      label: '90+ Days',
      value: report.buckets.days_90_plus,
      icon: AlertTriangle,
      color: 'text-red-600',
      desc: 'Seriously overdue',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            As of {new Date(report.as_of_date).toLocaleDateString('en-AU')} &middot;{' '}
            {report.suppliers.length} active supplier
            {report.suppliers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary bucket cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {bucketCards.map(({ label, value, icon: Icon, color, desc }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(value)}</div>
              <p className="text-muted-foreground mt-1 text-xs">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stacked bar chart */}
      {parseFloat(report.total_outstanding) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Total Outstanding: {formatCurrency(report.total_outstanding)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BucketBar report={report} />
          </CardContent>
        </Card>
      )}

      {/* Supplier table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Supplier Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.suppliers.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No outstanding AP balances found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium">Supplier</th>
                    <th className="pb-3 text-right font-medium">0–30d</th>
                    <th className="pb-3 text-right font-medium">31–60d</th>
                    <th className="pb-3 text-right font-medium">61–90d</th>
                    <th className="pb-3 text-right font-medium">90+d</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                    <th className="pb-3 text-right font-medium">Oldest (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.suppliers.map((row) => (
                    <tr key={row.supplier_id} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="font-medium">{row.company_name}</div>
                        <div className="text-muted-foreground text-xs">
                          {row.supplier_code} &middot; {row.po_count} PO
                          {row.po_count !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="py-3 text-right text-green-700">
                        {parseFloat(row.current_0_30) > 0
                          ? formatCurrency(row.current_0_30)
                          : '—'}
                      </td>
                      <td className="py-3 text-right text-yellow-700">
                        {parseFloat(row.days_31_60) > 0
                          ? formatCurrency(row.days_31_60)
                          : '—'}
                      </td>
                      <td className="py-3 text-right text-orange-700">
                        {parseFloat(row.days_61_90) > 0
                          ? formatCurrency(row.days_61_90)
                          : '—'}
                      </td>
                      <td className="py-3 text-right text-red-700">
                        {parseFloat(row.days_90_plus) > 0
                          ? formatCurrency(row.days_90_plus)
                          : '—'}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {formatCurrency(row.total_outstanding)}
                      </td>
                      <td className="py-3 text-right">
                        <Badge
                          variant={row.oldest_po_days > 90 ? 'destructive' : row.oldest_po_days > 60 ? 'default' : 'secondary'}
                        >
                          {row.oldest_po_days}d
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Generated {new Date(report.generated_at).toLocaleString('en-AU')} &middot; Based on
        active purchase orders (excludes draft &amp; cancelled). Verify against Xero AP Ageing
        for reconciliation.
      </p>
    </div>
  );
}
