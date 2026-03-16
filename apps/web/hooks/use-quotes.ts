/**
 * React Query hooks for Quotes
 *
 * Provides optimized data fetching, caching, and mutations for quotes.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  quotesApi,
  type Quote,
  type QuoteCreate,
  type QuoteUpdate,
  type QuoteListParams,
  type GenerateQuoteRequest,
} from "@/lib/api/quotes";
import { quoteKeys, orderKeys } from "@/lib/query/query-keys";
import { useToast } from "@/hooks/use-toast";

/**
 * Fetch quotes list with pagination and filters
 */
export function useQuotes(params: QuoteListParams = {}) {
  return useQuery({
    queryKey: quoteKeys.list(params),
    queryFn: () => quotesApi.list(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch single quote by ID
 */
export function useQuote(id: string, enabled = true) {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quotesApi.get(id),
    enabled: enabled && !!id,
  });
}

/**
 * Create new quote mutation
 */
export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: QuoteCreate) => quotesApi.create(data),
    onSuccess: (newQuote) => {
      // Invalidate all quote lists to refetch
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });

      // Set the new quote in cache
      queryClient.setQueryData(quoteKeys.detail(newQuote.id), newQuote);

      toast({
        title: "Success",
        description: `Quote ${newQuote.quote_number} created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quote",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update quote mutation
 */
export function useUpdateQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QuoteUpdate }) =>
      quotesApi.update(id, data),
    onSuccess: (updatedQuote) => {
      // Invalidate all quote lists
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });

      // Update the specific quote in cache
      queryClient.setQueryData(quoteKeys.detail(updatedQuote.id), updatedQuote);

      toast({
        title: "Success",
        description: `Quote ${updatedQuote.quote_number} updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update quote",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete quote mutation
 */
export function useDeleteQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => quotesApi.delete(id),
    onSuccess: (_, id) => {
      // Invalidate all quote lists
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });

      // Remove the quote from cache
      queryClient.removeQueries({ queryKey: quoteKeys.detail(id) });

      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete quote",
        variant: "destructive",
      });
    },
  });
}

/**
 * Convert quote to order mutation
 */
export function useConvertQuoteToOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (quoteId: string) => quotesApi.convertToOrder(quoteId),
    onSuccess: (result, quoteId) => {
      // Invalidate quote lists (quote status changed)
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });

      // Invalidate order lists (new order created)
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });

      toast({
        title: "Success",
        description: `Quote converted to Order ${result.order_number}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert quote to order",
        variant: "destructive",
      });
    },
  });
}

/**
 * Generate AI-powered quote mutation
 */
export function useGenerateQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: GenerateQuoteRequest) => quotesApi.generate(data),
    onSuccess: (newQuote) => {
      // Invalidate all quote lists
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });

      // Set the new quote in cache
      queryClient.setQueryData(quoteKeys.detail(newQuote.id), newQuote);

      toast({
        title: "Success",
        description: `AI-generated Quote ${newQuote.quote_number} created`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate quote",
        variant: "destructive",
      });
    },
  });
}

/**
 * Prefetch quotes list (for optimization)
 */
export function usePrefetchQuotes() {
  const queryClient = useQueryClient();

  return (params: QuoteListParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: quoteKeys.list(params),
      queryFn: () => quotesApi.list(params),
    });
  };
}
