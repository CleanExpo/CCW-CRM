"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteForm } from "./components/QuoteForm";
import { DeleteQuoteDialog } from "./components/DeleteQuoteDialog";
import { ConvertToOrderDialog } from "./components/ConvertToOrderDialog";
import { Pencil, Trash2, Plus, ArrowRight, Copy, Sparkles, Wand2 } from "lucide-react";
// PHASE C: Quote Copilot Chat
import { QuoteCopilotChat } from "@/components/ai/QuoteCopilotChat";
import { useToast } from "@/hooks/use-toast";
import { Quote } from "./types";
import { DataTable } from "@/components/ui/data-table";
import { createQuoteColumns } from "./columns";
import { format, formatDistanceToNow } from "date-fns"; // PHASE 4: Add timestamp display

interface PaginatedResponse {
  items: Quote[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending: "outline",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  expired: "secondary",
};

export default function QuotesPage() {
  const router = useRouter();
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
      const response = await apiClient.get<PaginatedResponse>(
        "/api/quotes?page=1&page_size=50"
      );
      setQuotes(response.items);
      setTotal(response.total);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load quotes";
      console.error("Failed to load quotes:", error);
      toast({
        variant: "destructive",
        title: "Error",
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
      const message =
        error instanceof Error ? error.message : "Failed to load quote details";
      console.error("Failed to load quote details:", error);
      toast({
        variant: "destructive",
        title: "Error",
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
        status: "draft", // Reset to draft
        notes: fullQuote.notes ? `Copy of ${fullQuote.quote_number}\n\n${fullQuote.notes}` : `Copy of ${fullQuote.quote_number}`,
      };
      setSelectedQuote(quoteCopy as Quote);
      setFormOpen(true);
      toast({
        title: "Quote Duplicated",
        description: "Review and modify the copy before saving",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to duplicate quote";
      toast({
        variant: "destructive",
        title: "Error",
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
  const handleCopilotQuoteCreated = (quoteData: any) => {
    // Pre-fill the quote form with copilot data
    setSelectedQuote(quoteData as Quote);
    setFormOpen(true);
    toast({
      title: "Quote Ready",
      description: "Copilot has prepared your quote. Review and save to finalize.",
    });
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  const columns = createQuoteColumns({
    onEdit: handleEditQuote,
    onDelete: handleDeleteQuote,
    onDuplicate: handleDuplicateQuote,
    onConvertToOrder: handleConvertToOrder,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">Manage customer quotations</p>
        </div>
        <div className="flex gap-2">
          {/* PHASE C: Quote Copilot Button */}
          <Button variant="outline" onClick={() => setCopilotOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Copilot
          </Button>
          {/* AI Quote Generator Button */}
          <Button variant="outline" onClick={() => router.push("/dashboard/quotes/ai-generate" as any)}>
            <Wand2 className="mr-2 h-4 w-4" />
            Generate with AI
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
                  <span className="ml-2 text-xs text-muted-foreground">
                    • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={quotes}
            loading={loading}
            emptyMessage="No quotes found"
            emptyDescription="Create your first quote to get started."
            emptyAction={
              <Button onClick={handleAddQuote}>
                <Plus className="mr-2 h-4 w-4" />
                Create Quote
              </Button>
            }
          />
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
  );
}
