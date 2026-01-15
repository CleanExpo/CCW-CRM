"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteForm } from "./components/QuoteForm";
import { DeleteQuoteDialog } from "./components/DeleteQuoteDialog";
import { ConvertToOrderDialog } from "./components/ConvertToOrderDialog";
import { Pencil, Trash2, Plus, ArrowRight, FileText, Clock, CheckCircle, Send, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Quote } from "./types";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { format } from "date-fns";

interface PaginatedResponse {
  items: Quote[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const statusVariants: Record<string, "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "secondary"> = {
  draft: "secondary",
  pending: "pending",
  sent: "processing",
  accepted: "confirmed",
  rejected: "cancelled",
  expired: "secondary",
};

const statusIcons: Record<string, any> = {
  draft: FileText,
  pending: Clock,
  sent: Send,
  accepted: CheckCircle,
  rejected: XCircle,
  expired: AlertTriangle,
};

export default function QuotesPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  async function loadQuotes() {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        "/api/quotes?page=1&page_size=50"
      );
      setQuotes(response.items);
      setTotal(response.total);
    } catch (error: any) {
      console.error("Failed to load quotes:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load quotes",
      });
      setQuotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotes();
  }, []);

  const handleAddQuote = () => {
    setSelectedQuote(null);
    setFormOpen(true);
  };

  const handleEditQuote = async (quote: Quote) => {
    // Fetch full quote details including line items
    try {
      const fullQuote = await apiClient.get<any>(`/api/quotes/${quote.id}`);
      setSelectedQuote(fullQuote);
      setFormOpen(true);
    } catch (error: any) {
      console.error("Failed to load quote details:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load quote details",
      });
    }
  };

  const handleDeleteQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setDeleteDialogOpen(true);
  };

  const handleConvertToOrder = (quote: Quote) => {
    setSelectedQuote(quote);
    setConvertDialogOpen(true);
  };

  const handleSuccess = () => {
    loadQuotes();
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  const getDaysUntilExpiry = (validUntil: string | null) => {
    if (!validUntil) return null;
    const today = new Date();
    const expiryDate = new Date(validUntil);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Quotes
          </h1>
          <p className="text-muted-foreground">Manage customer quotations</p>
        </div>
        <Button onClick={handleAddQuote}>
          <Plus className="mr-2 h-4 w-4" />
          Create Quote
        </Button>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quotations</CardTitle>
              <CardDescription>
                {total} quotes in system
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !quotes || quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
                <FileText className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                No quotes found
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Get started by creating your first quote to send pricing proposals to customers.
              </p>
              <Button onClick={handleAddQuote} className="mt-6">
                <Plus className="mr-2 h-4 w-4" />
                Create Quote
              </Button>
            </div>
          ) : (
            <ResponsiveTable
              data={quotes}
              keyExtractor={(quote) => quote.id}
              columns={[
                {
                  key: "quote_number",
                  label: "Quote #",
                  className: "font-mono text-sm font-medium",
                  render: (quote) => quote.quote_number,
                },
                {
                  key: "customer",
                  label: "Customer",
                  render: (quote) => quote.customer_name,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (quote) => {
                    const expired = isExpired(quote.valid_until);
                    const StatusIcon = statusIcons[quote.status];
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={statusVariants[quote.status] || "secondary"} icon={StatusIcon} className="capitalize">
                          {quote.status}
                        </Badge>
                        {expired && quote.status !== "expired" && (
                          <Badge variant="cancelled" icon={AlertTriangle}>Expired</Badge>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: "items",
                  label: "Items",
                  hideOnMobile: true,
                  render: (quote) => quote.item_count,
                },
                {
                  key: "total",
                  label: "Total",
                  className: "font-semibold",
                  render: (quote) => `$${quote.total}`,
                },
                {
                  key: "quote_date",
                  label: "Quote Date",
                  className: "text-sm text-muted-foreground",
                  hideOnMobile: true,
                  render: (quote) => format(new Date(quote.quote_date), "MMM dd, yyyy"),
                },
                {
                  key: "valid_until",
                  label: "Valid Until",
                  hideOnMobile: true,
                  render: (quote) => {
                    if (!quote.valid_until) {
                      return <span className="text-sm text-muted-foreground">N/A</span>;
                    }

                    const daysUntil = getDaysUntilExpiry(quote.valid_until);
                    const expired = isExpired(quote.valid_until);

                    let colorClass = "text-muted-foreground";
                    let icon = null;

                    if (expired) {
                      colorClass = "text-error font-semibold";
                      icon = <AlertTriangle className="h-3 w-3 mr-1" />;
                    } else if (daysUntil !== null && daysUntil <= 3) {
                      colorClass = "text-warning font-semibold";
                      icon = <Clock className="h-3 w-3 mr-1" />;
                    }

                    return (
                      <div className="flex items-center">
                        {icon}
                        <span className={`text-sm ${colorClass}`}>
                          {format(new Date(quote.valid_until), "MMM dd, yyyy")}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  mobileLabel: "",
                  render: (quote) => (
                    <div className="flex justify-end gap-2 flex-wrap">
                      {quote.status.toLowerCase() === "accepted" && (
                        <Button
                          variant="gradient"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConvertToOrder(quote);
                          }}
                          className="shadow-md hover:shadow-lg hover:scale-105 transition-all"
                        >
                          <ArrowRight className="mr-1 h-3 w-3" />
                          Convert
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditQuote(quote);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuote(quote);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <QuoteForm
        quote={selectedQuote}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleSuccess}
      />

      <DeleteQuoteDialog
        quote={selectedQuote}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleSuccess}
      />

      <ConvertToOrderDialog
        quote={selectedQuote}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
