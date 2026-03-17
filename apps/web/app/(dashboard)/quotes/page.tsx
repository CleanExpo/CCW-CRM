'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QuoteForm } from './components/QuoteForm';
import { DeleteQuoteDialog } from './components/DeleteQuoteDialog';
import { ConvertToOrderDialog } from './components/ConvertToOrderDialog';
import { Pencil, Trash2, Plus, ArrowRight, Copy, Sparkles, Download, FileText } from 'lucide-react';
import { exportQuotesToCSV, exportQuotesToPDF } from '@/lib/utils/csv-export';
// PHASE C: Quote Copilot Chat
import { QuoteCopilotChat } from '@/components/ai/QuoteCopilotChat';
import { useToast } from '@/hooks/use-toast';
import { Quote } from './types';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { format, formatDistanceToNow } from 'date-fns'; // PHASE 4: Add timestamp display
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { EmptyState } from '@/components/ui/empty-state';

interface PaginatedResponse {
  items: Quote[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  pending: 'outline',
  sent: 'default',
  accepted: 'default',
  rejected: 'destructive',
  expired: 'secondary',
};

export default function QuotesPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // PHASE 4: Last updated timestamp
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false); // PHASE C: Copilot dialog state
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>('/api/quotes?page=1&page_size=50');
      setQuotes(response.items);
      setTotal(response.total);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load quotes';
      console.error('Failed to load quotes:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setQuotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setLastUpdated(new Date()); // PHASE 4: Track last update time
    }
  }, [toast]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const handleAddQuote = () => {
    setSelectedQuote(null);
    setFormOpen(true);
  };

  const handleEditQuote = async (quote: Quote) => {
    // Fetch full quote details including line items
    try {
      const fullQuote = await apiClient.get<Quote>(`/api/quotes/${quote.id}`);
      setSelectedQuote(fullQuote);
      setFormOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load quote details';
      console.error('Failed to load quote details:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  // PHASE 4: Duplicate quote - quickly create copy with same items
  const handleDuplicateQuote = async (quote: Quote) => {
    try {
      const fullQuote = await apiClient.get<Quote>(`/api/quotes/${quote.id}`);
      // Create a copy without id (will be treated as new quote)
      const quoteCopy = {
        ...fullQuote,
        id: undefined, // Remove id to create new quote
        quote_number: undefined, // Will be auto-generated
        status: 'draft', // Reset to draft
        notes: fullQuote.notes
          ? `Copy of ${fullQuote.quote_number}\n\n${fullQuote.notes}`
          : `Copy of ${fullQuote.quote_number}`,
      };
      setSelectedQuote(quoteCopy as unknown as Quote);
      setFormOpen(true);
      toast({
        title: 'Quote Duplicated',
        description: 'Review and modify the copy before saving',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate quote';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
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

  // PHASE C: Handle quote created from Copilot
  const handleCopilotQuoteCreated = (quoteData: Record<string, unknown>) => {
    // Pre-fill the quote form with copilot data
    setSelectedQuote(quoteData as unknown as Quote);
    setFormOpen(true);
    toast({
      title: 'Quote Ready',
      description: 'Copilot has prepared your quote. Review and save to finalize.',
    });
  };

  const handleExport = () => {
    exportQuotesToCSV(quotes as unknown as Record<string, unknown>[]);
    toast({
      title: 'Export Successful',
      description: `Exported ${quotes.length} quotes to CSV`,
    });
  };

  const handleExportPDF = () => {
    exportQuotesToPDF(quotes as unknown as Record<string, unknown>[]);
    toast({ title: 'PDF Export', description: 'Print dialog opening…' });
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment Quotes</h1>
            <p className="text-muted-foreground">Manage customer quotations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPDF} disabled={quotes.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={quotes.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {/* PHASE C: Quote Copilot Button */}
            <Button variant="outline" onClick={() => setCopilotOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Copilot
            </Button>
            <Button onClick={handleAddQuote}>
              <Plus className="mr-2 h-4 w-4" />
              Create Quote
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Quotations</CardTitle>
                <CardDescription>
                  {total} quotes in system
                  {lastUpdated && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                    </span>
                  )}
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
              <EmptyState
                icon={FileText}
                title="No quotes yet"
                description="Create your first quote to get started."
                action={{
                  label: 'Create Quote',
                  onClick: handleAddQuote,
                }}
              />
            ) : (
              <ResponsiveTable
                data={quotes}
                keyExtractor={(quote) => quote.id}
                columns={[
                  {
                    key: 'quote_number',
                    label: 'Quote #',
                    className: 'font-mono text-sm font-medium',
                    render: (quote) => quote.quote_number,
                  },
                  {
                    key: 'customer',
                    label: 'Customer',
                    render: (quote) => quote.customer_name,
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (quote) => {
                      const expired = isExpired(quote.valid_until ?? null);
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={statusColors[quote.status] || 'outline'}
                            className="capitalize"
                          >
                            {quote.status}
                          </Badge>
                          {expired && quote.status !== 'expired' && (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    key: 'items',
                    label: 'Items',
                    hideOnMobile: true,
                    render: (quote) => quote.item_count,
                  },
                  {
                    key: 'total',
                    label: 'Total',
                    className: 'font-semibold',
                    render: (quote) => `$${quote.total}`,
                  },
                  {
                    key: 'quote_date',
                    label: 'Quote Date',
                    className: 'text-sm text-muted-foreground',
                    hideOnMobile: true,
                    render: (quote) => format(new Date(quote.quote_date), 'MMM dd, yyyy'),
                  },
                  {
                    key: 'valid_until',
                    label: 'Valid Until',
                    hideOnMobile: true,
                    render: (quote) => {
                      const expired = isExpired(quote.valid_until ?? null);
                      return (
                        <span
                          className={`text-sm ${expired ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                        >
                          {quote.valid_until
                            ? format(new Date(quote.valid_until), 'MMM dd, yyyy')
                            : 'N/A'}
                        </span>
                      );
                    },
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    className: 'text-right',
                    mobileLabel: '',
                    render: (quote) => (
                      <div className="flex flex-wrap justify-end gap-2">
                        {quote.status.toLowerCase() === 'accepted' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConvertToOrder(quote);
                            }}
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
                            handleDuplicateQuote(quote);
                          }}
                          title="Duplicate Quote"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuote(quote);
                          }}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
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

        {/* PHASE C: Quote Copilot Chat */}
        <QuoteCopilotChat
          open={copilotOpen}
          onOpenChange={setCopilotOpen}
          onQuoteCreated={handleCopilotQuoteCreated}
        />
      </div>
    </ErrorBoundary>
  );
}
