'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchState } from '@/hooks/use-search-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Eye,
  DollarSign,
  FileText,
  Edit,
  Trash2,
  BarChart3,
  Download,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import { exportInvoicesToCSV } from '@/lib/utils/csv-export';
import { useToast } from '@/hooks/use-toast';
import type { Invoice, InvoiceSummary } from '@/types/invoices';
import { invoicesApi } from '@/lib/api/invoices';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvoiceStatusBadge } from './components/InvoiceStatusBadge';
import { RecordPaymentDialog } from './components/RecordPaymentDialog';
import { InvoiceForm } from './components/InvoiceForm';
import { DeleteInvoiceDialog } from './components/DeleteInvoiceDialog';
import { FinancialReportTab } from './components/FinancialReportTab';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { state: searchState, updateField } = useSearchState({
    key: 'invoices-list',
    defaultState: { page: 1, pageSize: 50 },
  });

  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setPage = (value: number) => updateField('page', value);
  const setPageSize = (value: number) => updateField('pageSize', value);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSummary | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invoicesApi.list({
        page,
        page_size: pageSize,
      });

      setInvoices(response.data);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load invoices';
      console.error('Failed to load invoices:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [page, pageSize, toast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleViewInvoice = (invoice: InvoiceSummary) => {
    router.push(`/invoices/${invoice.id}`);
  };

  const handleRecordPayment = (invoice: InvoiceSummary) => {
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handlePaymentRecorded = () => {
    loadInvoices();
    setPaymentDialogOpen(false);
  };

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setFormDialogOpen(true);
  };

  const handleEditInvoice = async (invoice: InvoiceSummary) => {
    try {
      const fullInvoice = await invoicesApi.get(invoice.id);
      setEditingInvoice(fullInvoice);
      setFormDialogOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load invoice';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  const handleDeleteInvoice = (invoice: InvoiceSummary) => {
    setSelectedInvoice(invoice);
    setDeleteDialogOpen(true);
  };

  const handleFormSuccess = () => {
    loadInvoices();
    setFormDialogOpen(false);
    setEditingInvoice(null);
  };

  const handleDeleteSuccess = () => {
    loadInvoices();
    setDeleteDialogOpen(false);
    setSelectedInvoice(null);
  };

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (invoice: InvoiceSummary) => (
        <span className="text-primary font-mono font-semibold">{invoice.invoice_number}</span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (invoice: InvoiceSummary) => (
        <span className="font-medium">{invoice.customer_name || '—'}</span>
      ),
    },
    {
      key: 'invoice_date',
      label: 'Invoice Date',
      render: (invoice: InvoiceSummary) => format(new Date(invoice.invoice_date), 'MMM d, yyyy'),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (invoice: InvoiceSummary) => format(new Date(invoice.due_date), 'MMM d, yyyy'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (invoice: InvoiceSummary) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right' as const,
      render: (invoice: InvoiceSummary) => (
        <span className="font-semibold">
          ${typeof invoice.total === 'string' ? invoice.total : invoice.total.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'amount_due',
      label: 'Amount Due',
      align: 'right' as const,
      render: (invoice: InvoiceSummary) => {
        const amountDue =
          typeof invoice.amount_due === 'string'
            ? parseFloat(invoice.amount_due)
            : invoice.amount_due;

        return (
          <span
            className={amountDue > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}
          >
            ${amountDue.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right' as const,
      render: (invoice: InvoiceSummary) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)}>
            <Eye className="mr-1 h-4 w-4" />
            View
          </Button>
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleEditInvoice(invoice)}>
                <Edit className="mr-1 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRecordPayment(invoice)}>
                <DollarSign className="mr-1 h-4 w-4" />
                Payment
              </Button>
            </>
          )}
          {(invoice.status === 'draft' || invoice.status === 'cancelled') && (
            <Button variant="ghost" size="sm" onClick={() => handleDeleteInvoice(invoice)}>
              <Trash2 className="text-destructive mr-1 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  const getSummaryStats = () => {
    const totalRevenue = invoices.reduce((sum, inv) => {
      const total = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total;
      return sum + total;
    }, 0);

    const totalOutstanding = invoices.reduce((sum, inv) => {
      const amountDue =
        typeof inv.amount_due === 'string' ? parseFloat(inv.amount_due) : inv.amount_due;
      return sum + amountDue;
    }, 0);

    const paidCount = invoices.filter((inv) => inv.status === 'paid').length;
    const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length;

    return { totalRevenue, totalOutstanding, paidCount, overdueCount };
  };

  const stats = getSummaryStats();

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment Invoices</h1>
            <p className="text-muted-foreground">
              Manage cleaning equipment invoices and customer payments
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => exportInvoicesToCSV(invoices as unknown as Record<string, unknown>[])}
              disabled={invoices.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={handleCreateInvoice}>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </div>
        </div>

        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">
              <FileText className="mr-2 h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="reports">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="scan">
              <ScanLine className="mr-2 h-4 w-4" />
              Document Scan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                  <FileText className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{total}</div>
                  <p className="text-muted-foreground text-xs">
                    {stats.paidCount} paid, {stats.overdueCount} overdue
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
                  <p className="text-muted-foreground text-xs">From all equipment invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                  <DollarSign className="text-destructive h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-destructive text-2xl font-bold">
                    ${stats.totalOutstanding.toFixed(2)}
                  </div>
                  <p className="text-muted-foreground text-xs">Outstanding balance</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                  <FileText className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {total > 0 ? ((stats.paidCount / total) * 100).toFixed(0) : 0}%
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {stats.paidCount} of {total} paid
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Invoices Table */}
            <Card>
              <CardHeader>
                <CardTitle>Equipment Invoices</CardTitle>
                <CardDescription>
                  {lastUpdated && (
                    <span className="text-muted-foreground text-xs">
                      Last updated: {format(lastUpdated, 'h:mm:ss a')}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="text-muted-foreground mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No equipment invoices found</h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Create your first cleaning equipment invoice to get started
                    </p>
                    <Button className="mt-4" onClick={handleCreateInvoice}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Invoice
                    </Button>
                  </div>
                ) : (
                  <>
                    <ResponsiveTable
                      data={invoices}
                      columns={columns}
                      keyExtractor={(invoice) => invoice.id}
                    />
                    <div className="mt-4">
                      <PaginationControls
                        currentPage={page}
                        pageSize={pageSize}
                        totalItems={total}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <FinancialReportTab />
          </TabsContent>

          <TabsContent value="scan" className="mt-6">
            <InvoiceDocumentScan onInvoiceCreated={loadInvoices} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {selectedInvoice && (
          <>
            <RecordPaymentDialog
              invoice={selectedInvoice}
              open={paymentDialogOpen}
              onOpenChange={setPaymentDialogOpen}
              onPaymentRecorded={handlePaymentRecorded}
            />
            <DeleteInvoiceDialog
              invoice={selectedInvoice}
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onSuccess={handleDeleteSuccess}
            />
          </>
        )}

        {/* Create/Edit Invoice Form */}
        <InvoiceForm
          invoice={editingInvoice}
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          onSuccess={handleFormSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Scan — Claude Vision invoice extraction
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedInvoiceData {
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total?: number;
  }>;
  [key: string]: unknown;
}

function InvoiceDocumentScan({ onInvoiceCreated }: { onInvoiceCreated: () => void }) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedInvoiceData | null>(null);
  const [creating, setCreating] = useState(false);

  const handleExtract = async () => {
    if (!imageUrl.trim()) return;
    setExtracting(true);
    setExtracted(null);
    try {
      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.post<{ extracted_data: ExtractedInvoiceData }>(
        '/api/documents/extract-from-url',
        { image_url: imageUrl.trim(), document_type: 'invoice' }
      );
      setExtracted(result.extracted_data);
      toast({ title: 'Extraction Complete', description: 'Review the extracted data below.' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Extraction Failed',
        description: e instanceof Error ? e.message : 'Could not extract invoice data.',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!extracted) return;
    setCreating(true);
    try {
      const { apiClient } = await import('@/lib/api/client');
      await apiClient.post('/api/documents/create-from-url', {
        image_url: imageUrl.trim(),
        document_type: 'invoice',
      });
      toast({
        title: 'Draft Invoice Created',
        description: 'Check Invoices list for the new draft.',
      });
      setExtracted(null);
      setImageUrl('');
      onInvoiceCreated();
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Create Failed',
        description: e instanceof Error ? e.message : 'Could not create draft invoice.',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI Invoice Extraction
          </CardTitle>
          <CardDescription>
            Paste an image URL of a supplier invoice or handwritten PO. Claude Vision will extract
            vendor, dates, line items, and totals automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://... (image URL of invoice)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <Button onClick={handleExtract} disabled={extracting || !imageUrl.trim()}>
              <ScanLine className={`mr-2 h-4 w-4 ${extracting ? 'animate-pulse' : ''}`} />
              {extracting ? 'Extracting…' : 'Extract'}
            </Button>
          </div>

          {extracted && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Extracted Data</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {extracted.vendor_name && (
                  <>
                    <dt className="text-muted-foreground">Vendor</dt>
                    <dd>{extracted.vendor_name}</dd>
                  </>
                )}
                {extracted.invoice_number && (
                  <>
                    <dt className="text-muted-foreground">Invoice #</dt>
                    <dd>{extracted.invoice_number}</dd>
                  </>
                )}
                {extracted.invoice_date && (
                  <>
                    <dt className="text-muted-foreground">Date</dt>
                    <dd>{extracted.invoice_date}</dd>
                  </>
                )}
                {extracted.total_amount != null && (
                  <>
                    <dt className="text-muted-foreground">Total</dt>
                    <dd>${Number(extracted.total_amount).toFixed(2)}</dd>
                  </>
                )}
                {extracted.tax_amount != null && (
                  <>
                    <dt className="text-muted-foreground">GST</dt>
                    <dd>${Number(extracted.tax_amount).toFixed(2)}</dd>
                  </>
                )}
              </dl>
              {extracted.line_items && extracted.line_items.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                    Line Items ({extracted.line_items.length})
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {extracted.line_items.map((item, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span className="truncate">{item.description}</span>
                        <span className="text-muted-foreground shrink-0">
                          {item.quantity != null && `×${item.quantity} `}
                          {item.total != null && `$${Number(item.total).toFixed(2)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={handleCreateDraft} disabled={creating} className="w-full" size="sm">
                {creating ? 'Creating…' : 'Create Draft Invoice from Extraction'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
