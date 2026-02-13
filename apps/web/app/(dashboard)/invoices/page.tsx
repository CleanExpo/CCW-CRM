"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchState } from "@/lib/hooks/use-search-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Eye, DollarSign, FileText, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, InvoiceSummary } from "@/lib/types/invoices";
import { invoicesApi } from "@/lib/api/invoices";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { format } from "date-fns";
import { InvoiceStatusBadge } from "./components/InvoiceStatusBadge";
import { RecordPaymentDialog } from "./components/RecordPaymentDialog";
import { InvoiceForm } from "./components/InvoiceForm";
import { DeleteInvoiceDialog } from "./components/DeleteInvoiceDialog";

export default function InvoicesPage() {
  const router = useRouter();
  const { toast} = useToast();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { state: searchState, updateField } = useSearchState({
    key: "invoices-list",
    defaultState: { page: 1, pageSize: 50 },
  });

  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setPage = (value: number) => updateField("page", value);
  const setPageSize = (value: number) => updateField("pageSize", value);

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
      const message = error instanceof Error ? error.message : "Failed to load invoices";
      console.error("Failed to load invoices:", error);
      toast({
        variant: "destructive",
        title: "Error",
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
      const message = error instanceof Error ? error.message : "Failed to load invoice";
      toast({
        variant: "destructive",
        title: "Error",
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
      key: "invoice_number",
      label: "Invoice #",
      render: (invoice: InvoiceSummary) => (
        <span className="font-mono font-semibold text-primary">
          {invoice.invoice_number}
        </span>
      ),
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (invoice: InvoiceSummary) => (
        <span className="font-medium">{invoice.customer_name || "—"}</span>
      ),
    },
    {
      key: "invoice_date",
      label: "Invoice Date",
      render: (invoice: InvoiceSummary) => format(new Date(invoice.invoice_date), "MMM d, yyyy"),
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (invoice: InvoiceSummary) => format(new Date(invoice.due_date), "MMM d, yyyy"),
    },
    {
      key: "status",
      label: "Status",
      render: (invoice: InvoiceSummary) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      key: "total",
      label: "Total",
      align: "right" as const,
      render: (invoice: InvoiceSummary) => (
        <span className="font-semibold">
          ${typeof invoice.total === "string" ? invoice.total : invoice.total.toFixed(2)}
        </span>
      ),
    },
    {
      key: "amount_due",
      label: "Amount Due",
      align: "right" as const,
      render: (invoice: InvoiceSummary) => {
        const amountDue = typeof invoice.amount_due === "string"
          ? parseFloat(invoice.amount_due)
          : invoice.amount_due;

        return (
          <span className={amountDue > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
            ${amountDue.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (invoice: InvoiceSummary) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewInvoice(invoice)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditInvoice(invoice)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRecordPayment(invoice)}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Payment
              </Button>
            </>
          )}
          {(invoice.status === "draft" || invoice.status === "cancelled") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteInvoice(invoice)}
            >
              <Trash2 className="h-4 w-4 mr-1 text-destructive" />
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  const getSummaryStats = () => {
    const totalRevenue = invoices.reduce((sum, inv) => {
      const total = typeof inv.total === "string" ? parseFloat(inv.total) : inv.total;
      return sum + total;
    }, 0);

    const totalOutstanding = invoices.reduce((sum, inv) => {
      const amountDue = typeof inv.amount_due === "string" ? parseFloat(inv.amount_due) : inv.amount_due;
      return sum + amountDue;
    }, 0);

    const paidCount = invoices.filter(inv => inv.status === "paid").length;
    const overdueCount = invoices.filter(inv => inv.status === "overdue").length;

    return { totalRevenue, totalOutstanding, paidCount, overdueCount };
  };

  const stats = getSummaryStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Manage customer invoices and payments
          </p>
        </div>
        <Button onClick={handleCreateInvoice}>
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.paidCount} paid, {stats.overdueCount} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From all invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${stats.totalOutstanding.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount due
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {total > 0 ? ((stats.paidCount / total) * 100).toFixed(0) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.paidCount} of {total} paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Last updated: {format(lastUpdated, "h:mm:ss a")}
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
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating your first invoice
              </p>
              <Button className="mt-4" onClick={handleCreateInvoice}>
                <Plus className="h-4 w-4 mr-2" />
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
  );
}
