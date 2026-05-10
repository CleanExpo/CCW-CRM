'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoicesApi } from '@/lib/api/invoices';
import type { RevenueSummary, TaxSummary } from '@/types/invoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, TrendingUp, DollarSign, AlertCircle, BarChart3 } from 'lucide-react';

export function FinancialReportTab() {
  const { toast } = useToast();

  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [tax, setTax] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const formatCurrency = (value: number) =>
    `$${Number(value)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const range =
        dateFrom || dateTo
          ? { ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) }
          : undefined;
      const [revenueData, taxData] = await Promise.all([
        invoicesApi.getRevenueSummary(range),
        invoicesApi.getTaxSummary(range),
      ]);
      setRevenue(revenueData);
      setTax(taxData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load reports';
      toast({
        variant: 'destructive',
        title: 'Error loading reports',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast, dateFrom, dateTo]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRefresh = () => {
    loadReports();
  };

  const collectionRate =
    revenue && revenue.total_revenue > 0
      ? ((revenue.total_revenue - revenue.total_outstanding) / revenue.total_revenue) * 100
      : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <TrendingUp className="text-primary h-5 w-5" />
          <CardTitle>Revenue Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {revenue ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1 rounded-lg border p-4">
                  <p className="text-muted-foreground flex items-center gap-1 text-sm">
                    <DollarSign className="h-3.5 w-3.5" />
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(revenue.total_revenue)}</p>
                  <p className="text-muted-foreground text-xs">
                    {revenue.invoice_count} invoice
                    {revenue.invoice_count !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border p-4">
                  <p className="text-muted-foreground flex items-center gap-1 text-sm">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Outstanding
                  </p>
                  <p className="text-destructive text-2xl font-bold">
                    {formatCurrency(revenue.total_outstanding)}
                  </p>
                  <p className="text-muted-foreground text-xs">Unpaid invoices</p>
                </div>

                <div className="space-y-1 rounded-lg border p-4">
                  <p className="text-muted-foreground flex items-center gap-1 text-sm">
                    <AlertCircle className="text-destructive h-3.5 w-3.5" />
                    Overdue
                  </p>
                  <p className="text-destructive text-2xl font-bold">
                    {formatCurrency(revenue.total_overdue)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {revenue.overdue_invoice_count} overdue invoice
                    {revenue.overdue_invoice_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Collection Rate Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Collection Rate</span>
                  <span className="text-muted-foreground">
                    {collectionRate.toFixed(1)}% — {revenue.paid_invoice_count} of{' '}
                    {revenue.invoice_count} invoices paid
                  </span>
                </div>
                <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(collectionRate, 100)}%` }}
                  />
                </div>
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>
                    Collected: {formatCurrency(revenue.total_revenue - revenue.total_outstanding)}
                  </span>
                  <span>Remaining: {formatCurrency(revenue.total_outstanding)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No revenue data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Tax Summary (BAS-Ready) */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BarChart3 className="text-primary h-5 w-5" />
          <CardTitle>Tax Summary — BAS Ready</CardTitle>
        </CardHeader>
        <CardContent>
          {tax ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b py-3">
                <span className="text-sm font-semibold">Total Tax Collected</span>
                <span className="text-xl font-bold">{formatCurrency(tax.total_tax_collected)}</span>
              </div>

              {tax.tax_by_rate && tax.tax_by_rate.length > 0 ? (
                <div className="space-y-1">
                  <div className="text-muted-foreground grid grid-cols-4 gap-4 border-b py-2 text-xs font-semibold uppercase">
                    <span>Tax Rate</span>
                    <span className="text-right">Taxable Amount</span>
                    <span className="text-right">Tax Collected</span>
                    <span className="text-right">Invoice Count</span>
                  </div>
                  {tax.tax_by_rate.map((row, index) => (
                    <div
                      key={index}
                      className="hover:bg-accent/50 grid grid-cols-4 gap-4 rounded border-b py-3 text-sm transition-colors last:border-0"
                    >
                      <span className="font-medium">{Number(row.tax_rate).toFixed(0)}% GST</span>
                      <span className="text-right">
                        {/* taxable_amount not in type — show dash if missing */}
                        {'taxable_amount' in row
                          ? formatCurrency((row as { taxable_amount: number }).taxable_amount)
                          : '—'}
                      </span>
                      <span className="text-right font-semibold">
                        {formatCurrency(row.total_tax)}
                      </span>
                      <span className="text-muted-foreground text-right">{row.invoice_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No tax breakdown data available.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No tax data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
