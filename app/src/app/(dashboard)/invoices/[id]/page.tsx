'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { invoicesApi } from '@/lib/api/invoices';
import type { Invoice } from '@/lib/types/invoices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { InvoiceForm } from '../components/InvoiceForm';
import { DeleteInvoiceDialog } from '../components/DeleteInvoiceDialog';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';
import { InvoicePrintView } from '../components/InvoicePrintView';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Edit,
  Trash2,
  DollarSign,
  Send,
  FileDown,
  FileText,
  Calendar,
  User,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoicesApi.get(invoiceId);
      setInvoice(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load invoice';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      // Redirect back to invoices list if invoice not found
      router.push('/invoices');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, toast, router]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleBack = () => {
    router.push('/invoices');
  };

  const handleEdit = () => {
    setFormDialogOpen(true);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleRecordPayment = () => {
    setPaymentDialogOpen(true);
  };

  const handleSendInvoice = async () => {
    try {
      await invoicesApi.send(invoiceId);
      toast({
        title: 'Invoice Sent',
        description: 'Invoice has been sent to the customer',
      });
      loadInvoice(); // Reload to get updated status
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send invoice',
      });
    }
  };

  const handleDownloadPDF = () => {
    setShowPrintView(true);
    // Allow the print view to render before triggering the print dialog
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleFormSuccess = () => {
    loadInvoice();
    setFormDialogOpen(false);
  };

  const handleDeleteSuccess = () => {
    toast({
      title: 'Invoice Deleted',
      description: 'Invoice has been deleted successfully',
    });
    router.push('/invoices');
  };

  const handlePaymentRecorded = () => {
    loadInvoice();
    setPaymentDialogOpen(false);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="text-muted-foreground h-12 w-12" />
        <h3 className="mt-4 text-lg font-semibold">Invoice not found</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          The invoice you're looking for doesn't exist.
        </p>
        <Button className="mt-4" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoice {invoice.invoice_number}</h1>
            <p className="text-muted-foreground">
              Created {format(new Date(invoice.created_at), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <>
            <Button variant="default" onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" onClick={handleRecordPayment}>
              <DollarSign className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
            {invoice.status === 'draft' && (
              <Button variant="outline" onClick={handleSendInvoice}>
                <Send className="mr-2 h-4 w-4" />
                Send Invoice
              </Button>
            )}
          </>
        )}
        <Button variant="outline" onClick={handleDownloadPDF}>
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
        {(invoice.status === 'draft' || invoice.status === 'cancelled') && (
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Invoice Details */}
        <div className="space-y-6 md:col-span-2">
          {/* Customer & Dates Card */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">Customer</span>
                </div>
                <p className="text-lg font-semibold">{invoice.customer_name || '—'}</p>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Invoice Date</span>
                </div>
                <p className="text-lg">{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</p>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Due Date</span>
                </div>
                <p className="text-lg font-semibold">
                  {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Card */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>
                {invoice.items?.length || 0} item{invoice.items?.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoice.items && invoice.items.length > 0 ? (
                <div className="space-y-3">
                  {invoice.items.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="hover:bg-accent/50 flex items-start justify-between rounded-lg border p-4 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">{item.description}</p>
                        <div className="text-muted-foreground flex gap-4 text-sm">
                          <span>Qty: {item.quantity}</span>
                          <span>×</span>
                          <span>{formatCurrency(item.unit_price)}</span>
                          {item.tax_rate && (
                            <>
                              <span>|</span>
                              <span>
                                Tax:{' '}
                                {typeof item.tax_rate === 'string'
                                  ? item.tax_rate
                                  : item.tax_rate.toFixed(2)}
                                %
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-lg font-bold">{formatCurrency(item.total || 0)}</p>
                        {item.tax_amount && parseFloat(item.tax_amount.toString()) > 0 && (
                          <p className="text-muted-foreground text-xs">
                            +{formatCurrency(item.tax_amount)} tax
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-8 text-center">No line items</div>
              )}
            </CardContent>
          </Card>

          {/* Notes Card (if notes exist) */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Financial Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(invoice.tax_total)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(invoice.amount_paid)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Amount Due</span>
                  <span
                    className={
                      parseFloat(invoice.amount_due.toString()) > 0
                        ? 'text-destructive'
                        : 'text-green-600'
                    }
                  >
                    {formatCurrency(invoice.amount_due)}
                  </span>
                </div>
              </div>

              {/* Payment Status Indicator */}
              <div className="border-t pt-4">
                {parseFloat(invoice.amount_due.toString()) === 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="h-2 w-2 rounded-full bg-green-600" />
                    <span className="text-sm font-medium">Fully Paid</span>
                  </div>
                ) : parseFloat(invoice.amount_paid.toString()) > 0 ? (
                  <div className="flex items-center gap-2 text-orange-600">
                    <div className="h-2 w-2 rounded-full bg-orange-600" />
                    <span className="text-sm font-medium">Partially Paid</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex items-center gap-2">
                    <div className="bg-muted-foreground h-2 w-2 rounded-full" />
                    <span className="text-sm font-medium">Unpaid</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium">
                  {format(new Date(invoice.updated_at), 'MMM d, yyyy')}
                </span>
              </div>
              {invoice.order_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-mono text-xs">{invoice.order_id}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <InvoiceForm
        invoice={invoice}
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSuccess={handleFormSuccess}
      />
      <DeleteInvoiceDialog
        invoice={invoice}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />
      <RecordPaymentDialog
        invoice={invoice}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Print View — hidden on screen, visible when printing */}
      {showPrintView && <InvoicePrintView invoice={invoice} />}
    </div>
  );
}
