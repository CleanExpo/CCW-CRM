"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteForm } from "./components/QuoteForm";
import { DeleteQuoteDialog } from "./components/DeleteQuoteDialog";
import { ConvertToOrderDialog } from "./components/ConvertToOrderDialog";
import { Pencil, Trash2, Plus, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Quote } from "./types";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">Manage customer quotations</p>
        </div>
        <Button onClick={handleAddQuote}>
          <Plus className="mr-2 h-4 w-4" />
          Create Quote
        </Button>
      </div>

      <Card>
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No quotes found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first quote to get started.
              </p>
              <Button onClick={handleAddQuote} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Quote
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Quote Date</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => {
                  const expired = isExpired(quote.valid_until);
                  return (
                    <TableRow key={quote.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {quote.quote_number}
                      </TableCell>
                      <TableCell>{quote.customer_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusColors[quote.status] || "outline"}>
                            {quote.status}
                          </Badge>
                          {expired && quote.status !== "expired" && (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{quote.item_count}</TableCell>
                      <TableCell className="font-semibold">${quote.total}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(quote.quote_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className={`text-sm ${expired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {quote.valid_until
                          ? new Date(quote.valid_until).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {quote.status.toLowerCase() === "accepted" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleConvertToOrder(quote)}
                            >
                              <ArrowRight className="mr-1 h-3 w-3" />
                              Convert
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditQuote(quote)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQuote(quote)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
