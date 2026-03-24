'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';

interface Invoice {
  invoice_id: string;
  invoice_number: string;
  order_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  gst: number;
  total: number;
  paid_at: string | null;
  payment_method: string | null;
}

interface InvoicesResponse {
  total: number;
  total_outstanding: number;
  invoices: Invoice[];
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    icon: React.ReactNode;
  }
> = {
  paid: { label: 'Paid', variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
  outstanding: {
    label: 'Outstanding',
    variant: 'destructive',
    icon: <AlertCircle className="h-3 w-3" />,
  },
  overdue: { label: 'Overdue', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
};

export default function PortalInvoicesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<InvoicesResponse>('/api/portal/invoices');
        setData(res);
      } catch {
        /* demo fallback */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleDownload(invoice: Invoice) {
    toast({
      title: 'Download started',
      description: `${invoice.invoice_number} PDF is being prepared.`,
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>;
  }

  const outstanding = data?.invoices.filter((i) => i.status !== 'paid') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="mt-0.5 text-sm text-slate-500">{data?.total ?? 0} invoices on your account</p>
      </div>

      {/* Outstanding banner */}
      {outstanding.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-sm text-red-800">
            <p className="font-medium">
              ${data!.total_outstanding.toLocaleString('en-AU', { minimumFractionDigits: 2 })}{' '}
              outstanding
            </p>
            <p className="text-xs text-red-700">
              {outstanding.length} invoice{outstanding.length > 1 ? 's' : ''} awaiting payment.
              Contact CCW to pay via EFT or credit card.
            </p>
          </div>
        </div>
      )}

      {/* Invoice table */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Invoice #', 'Order #', 'Date', 'Due Date', 'Total (inc. GST)', 'Status', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {(data?.invoices ?? []).map((inv) => {
              const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.outstanding;
              return (
                <tr key={inv.invoice_id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.order_number}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(inv.invoice_date).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(inv.due_date).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    ${inv.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    <div className="text-xs text-slate-400">
                      GST: ${inv.gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={cfg.variant} className="flex w-fit items-center gap-1">
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                    {inv.paid_at && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {new Date(inv.paid_at).toLocaleDateString('en-AU')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(inv)}
                      className="gap-1 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(data?.invoices ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-500">No invoices found</p>
          </div>
        )}
      </div>
    </div>
  );
}
