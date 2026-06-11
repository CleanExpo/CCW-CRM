'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, DollarSign, RefreshCw, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

type AgeingBuckets = {
  current: number;
  '1-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
  total: number;
};

type CustomerAgeingRow = {
  customerId: string;
  companyName: string;
  email: string | null;
  creditLimitAUD: number | null;
  buckets: AgeingBuckets;
};

type AgeingResponse = {
  as_of: string;
  rows: CustomerAgeingRow[];
};

function fmt(amount: number) {
  return amount > 0 ? `$${amount.toFixed(2)}` : '—';
}

function BucketCell({ amount }: { amount: number }) {
  if (amount <= 0) return <span className="text-muted-foreground">—</span>;
  return <span className="font-mono font-semibold text-destructive">{fmt(amount)}</span>;
}

function CreditBadge({ outstanding, limit }: { outstanding: number; limit: number | null }) {
  if (limit == null) return <span className="text-muted-foreground text-xs">No limit</span>;
  const pct = limit > 0 ? (outstanding / limit) * 100 : 100;
  const variant = pct >= 100 ? 'destructive' : pct >= 80 ? 'secondary' : 'outline';
  return (
    <Badge variant={variant} className="text-xs">
      {pct.toFixed(0)}% of ${limit.toFixed(0)}
    </Badge>
  );
}

export default function DebtorsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AgeingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invoices/ageing', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Failed to load debtor ageing',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];

  const totals = rows.reduce<AgeingBuckets>(
    (acc, r) => {
      for (const k of Object.keys(acc) as (keyof AgeingBuckets)[]) {
        acc[k] += r.buckets[k];
      }
      return acc;
    },
    { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 }
  );

  const columns = [
    {
      key: 'companyName',
      label: 'Customer',
      render: (row: CustomerAgeingRow) => (
        <div>
          <p className="font-medium">{row.companyName}</p>
          {row.email && <p className="text-muted-foreground text-xs">{row.email}</p>}
        </div>
      ),
    },
    {
      key: 'current',
      label: 'Current',
      align: 'right' as const,
      render: (row: CustomerAgeingRow) => <BucketCell amount={row.buckets.current} />,
    },
    {
      key: '1-30',
      label: '1–30 days',
      align: 'right' as const,
      render: (row: CustomerAgeingRow) => <BucketCell amount={row.buckets['1-30']} />,
    },
    {
      key: '31-60',
      label: '31–60 days',
      align: 'right' as const,
      render: (row: CustomerAgeingRow) => <BucketCell amount={row.buckets['31-60']} />,
    },
    {
      key: '61-90',
      label: '61–90 days',
      align: 'right' as const,
      render: (row: CustomerAgeingRow) => <BucketCell amount={row.buckets['61-90']} />,
    },
    {
      key: '90+',
      label: '90+ days',
      align: 'right' as const,
      render: (row: CustomerAgeingRow) => (
        <span className={row.buckets['90+'] > 0 ? 'font-mono font-bold text-destructive' : ''}>
          {row.buckets['90+'] > 0 ? fmt(row.buckets['90+']) : '—'}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total Outstanding',
      align: 'right' as const,
      render: (row: CustomerAgeingRow) => (
        <span className="font-mono font-bold">{fmt(row.buckets.total)}</span>
      ),
    },
    {
      key: 'credit',
      label: 'Credit Usage',
      align: 'right' as const,
      render: (row: CustomerAgeingRow) => (
        <CreditBadge outstanding={row.buckets.total} limit={row.creditLimitAUD} />
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Debtor Ageing Ledger</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Outstanding balances by customer, bucketed by days past due.
              {data?.as_of && (
                <> As of <span className="font-medium">{format(new Date(data.as_of), 'dd MMM yyyy')}</span>.</>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers With Debt</CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : rows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {loading ? '—' : fmt(totals.total)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">30–60 Days</CardTitle>
              <AlertTriangle className="text-amber-500 h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : fmt(totals['31-60'])}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">90+ Days Critical</CardTitle>
              <AlertTriangle className="text-destructive h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-destructive text-2xl font-bold">
                {loading ? '—' : fmt(totals['90+'])}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ageing table */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Ageing Detail</CardTitle>
            <CardDescription>
              Current = not yet due. 1–30 / 31–60 / 61–90 / 90+ = days past due.
              EOM-30 terms: due date = end of invoice month + 30 days (AU standard).
              Credit usage shows outstanding vs. credit limit where set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center">
                <DollarSign className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">No outstanding debts</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  All customer invoices are current or fully paid.
                </p>
              </div>
            ) : (
              <ResponsiveTable
                data={rows}
                columns={columns}
                keyExtractor={(row) => row.customerId}
              />
            )}

            {/* Totals footer */}
            {!loading && rows.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="grid grid-cols-7 gap-2 text-sm font-semibold">
                  <span>Totals</span>
                  <span className="text-right font-mono">{fmt(totals.current)}</span>
                  <span className="text-right font-mono">{fmt(totals['1-30'])}</span>
                  <span className="text-right font-mono">{fmt(totals['31-60'])}</span>
                  <span className="text-right font-mono">{fmt(totals['61-90'])}</span>
                  <span className="text-right font-mono text-destructive">{fmt(totals['90+'])}</span>
                  <span className="text-right font-mono font-bold">{fmt(totals.total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
