'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { format, subMonths, startOfQuarter, endOfQuarter } from 'date-fns';

interface BASReport {
  period: string | null;
  date_from: string | null;
  date_to: string | null;
  label_1a_gst_collected: string;
  label_1b_gst_credits: string;
  label_net_gst_payable: string;
  taxable_sales: string;
  export_sales: string;
  total_sales_incl_gst: string;
  invoice_count: number;
  note: string;
}

function formatAUD(value: string): string {
  const num = parseFloat(value);
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(num);
}

function generatePeriodOptions() {
  const options: { label: string; value: string }[] = [];
  const now = new Date();

  // Last 8 months
  for (let i = 0; i < 8; i++) {
    const d = subMonths(now, i);
    options.push({
      label: format(d, 'MMMM yyyy'),
      value: format(d, 'yyyy-MM'),
    });
  }

  // Last 4 quarters
  for (let i = 0; i < 4; i++) {
    const d = subMonths(now, i * 3);
    const qStart = startOfQuarter(d);
    const quarter = Math.floor(qStart.getMonth() / 3) + 1;
    options.push({
      label: `Q${quarter} ${qStart.getFullYear()}`,
      value: `${qStart.getFullYear()}-Q${quarter}`,
    });
  }

  return options;
}

export default function BASReportPage() {
  const { toast } = useToast();
  const [report, setReport] = useState<BASReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<string>('');

  const periodOptions = generatePeriodOptions();

  const loadReport = useCallback(
    async (selectedPeriod: string) => {
      if (!selectedPeriod) return;
      setLoading(true);
      try {
        const data = await apiClient.get<BASReport>(
          `/api/invoices/reports/bas?period=${encodeURIComponent(selectedPeriod)}`
        );
        setReport(data);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load BAS report',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (period) loadReport(period);
  }, [period, loadReport]);

  function downloadCSV() {
    if (!report) return;
    const rows = [
      ['BAS Period', report.period ?? report.date_from ?? ''],
      ['Date From', report.date_from ?? ''],
      ['Date To', report.date_to ?? ''],
      [''],
      ['BAS Label', 'Amount (AUD)'],
      ['1A — GST Collected', report.label_1a_gst_collected],
      ['1B — GST Credits (Input Tax)', report.label_1b_gst_credits],
      ['Net GST Payable', report.label_net_gst_payable],
      [''],
      ['Taxable Sales (excl. GST)', report.taxable_sales],
      ['Export Sales', report.export_sales],
      ['Total Sales (incl. GST)', report.total_sales_incl_gst],
      ['Invoice Count', String(report.invoice_count)],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BAS-${report.period ?? 'custom'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GST / BAS Report</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Australian Business Activity Statement — GST summary for your BAS lodgement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select period…" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => period && loadReport(period)}
            disabled={loading || !period}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={downloadCSV} disabled={!report}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!period && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="text-muted-foreground mb-4 h-12 w-12" />
            <p className="text-muted-foreground">
              Select a period above to generate your BAS report
            </p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Period badge */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Period:</span>
            <Badge variant="outline">
              {report.date_from} → {report.date_to}
            </Badge>
            <Badge variant="secondary">{report.invoice_count} invoices</Badge>
          </div>

          {/* BAS fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-primary/20 border-2">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold tracking-wider uppercase">
                  Label 1A
                </CardDescription>
                <CardTitle className="text-lg">GST Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatAUD(report.label_1a_gst_collected)}</p>
                <p className="text-muted-foreground mt-1 text-xs">GST charged on taxable sales</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold tracking-wider uppercase">
                  Label 1B
                </CardDescription>
                <CardTitle className="text-lg">GST Credits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatAUD(report.label_1b_gst_credits)}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Input tax credits — enter manually
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-600/20 bg-green-50/30 dark:bg-green-950/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold tracking-wider uppercase">
                  Net GST Payable
                </CardDescription>
                <CardTitle className="text-lg">1A minus 1B</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {formatAUD(report.label_net_gst_payable)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">Payable to the ATO</p>
              </CardContent>
            </Card>
          </div>

          {/* Supporting figures */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supporting Figures</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-xs tracking-wider uppercase">
                    Taxable Sales
                  </p>
                  <p className="mt-1 text-xl font-semibold">{formatAUD(report.taxable_sales)}</p>
                  <p className="text-muted-foreground text-xs">Excl. GST</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs tracking-wider uppercase">
                    Export Sales
                  </p>
                  <p className="mt-1 text-xl font-semibold">{formatAUD(report.export_sales)}</p>
                  <p className="text-muted-foreground text-xs">Zero-rated</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs tracking-wider uppercase">
                    Total Sales
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatAUD(report.total_sales_incl_gst)}
                  </p>
                  <p className="text-muted-foreground text-xs">Incl. GST</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs tracking-wider uppercase">
                    Invoice Count
                  </p>
                  <p className="mt-1 text-xl font-semibold">{report.invoice_count}</p>
                  <p className="text-muted-foreground text-xs">In period</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">{report.note}</p>
          </div>
        </>
      )}
    </div>
  );
}
