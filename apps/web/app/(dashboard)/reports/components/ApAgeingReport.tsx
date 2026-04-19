'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApBucketSummary {
  count: number;
  amount: number;
}

interface ApSupplierRow {
  supplier_id: string;
  company_name: string;
  payment_terms: string | null;
  '0-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
  total: number;
  open_po_count: number;
}

interface ApAgeingResponse {
  as_of: string;
  buckets: Record<'0-30' | '31-60' | '61-90' | '90+', ApBucketSummary>;
  total_liability: number;
  suppliers: ApSupplierRow[];
}

const BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;

function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ApAgeingReport() {
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ApAgeingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/analytics/ap-ageing?as_of=${encodeURIComponent(asOf)}`;
        const result = await apiClient.get<ApAgeingResponse>(url);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load AP ageing report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [asOf]);

  const maxBucketAmount = useMemo(() => {
    if (!data) return 0;
    return Math.max(...BUCKETS.map((b) => data.buckets[b].amount), 1);
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>AP Ageing</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Supplier liability bucketed by age since the PO was placed. Totals in AUD.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="as-of">As of</Label>
              <Input
                id="as-of"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
          {error && <p className="text-destructive text-sm">{error}</p>}
          {data && (
            <>
              <p className="mb-4 text-sm">
                <span className="text-muted-foreground">Total open liability: </span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatAUD(data.total_liability)}
                </span>
              </p>

              {/* Bar-chart-lite — no external dep. Each bucket gets a horizontal bar. */}
              <div className="mb-6 space-y-2">
                {BUCKETS.map((bucket) => {
                  const info = data.buckets[bucket];
                  const widthPct = maxBucketAmount
                    ? Math.round((info.amount / maxBucketAmount) * 100)
                    : 0;
                  return (
                    <div key={bucket} className="flex items-center gap-3">
                      <span className="w-14 text-xs font-medium">{bucket}</span>
                      <div className="bg-muted relative h-5 flex-1 overflow-hidden rounded">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${widthPct}%` }}
                          aria-label={`${bucket} bucket: ${formatAUD(info.amount)}`}
                        />
                      </div>
                      <span className="w-32 text-right font-mono text-xs tabular-nums">
                        {formatAUD(info.amount)}
                      </span>
                      <span className="text-muted-foreground w-16 text-right text-xs tabular-nums">
                        {info.count} PO{info.count === 1 ? '' : 's'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Terms</TableHead>
                    {BUCKETS.map((b) => (
                      <TableHead key={b} className="text-right tabular-nums">
                        {b}
                      </TableHead>
                    ))}
                    <TableHead className="text-right tabular-nums">Total</TableHead>
                    <TableHead className="text-right tabular-nums">Open POs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.suppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground text-center">
                        No open supplier liability.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.suppliers.map((row) => (
                    <TableRow key={row.supplier_id}>
                      <TableCell className="font-medium">{row.company_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.payment_terms ?? '—'}
                      </TableCell>
                      {BUCKETS.map((b) => (
                        <TableCell key={b} className="text-right font-mono tabular-nums">
                          {row[b] > 0 ? formatAUD(row[b]) : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono font-semibold tabular-nums">
                        {formatAUD(row.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.open_po_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
