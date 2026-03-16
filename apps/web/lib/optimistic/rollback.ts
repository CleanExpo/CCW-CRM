/**
 * Rollback Logic
 *
 * Handles automatic rollback of optimistic updates when mutations fail.
 */

import { QueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

/**
 * Create rollback handler for mutations
 */
export function createRollbackHandler(queryClient: QueryClient) {
  return {
    /**
     * Rollback a single query to previous data
     */
    rollbackQuery: <T>(queryKey: unknown[], previousData: T | undefined) => {
      if (previousData !== undefined) {
        queryClient.setQueryData(queryKey, previousData);
      }
    },

    /**
     * Rollback multiple queries
     */
    rollbackQueries: (contexts: Array<{ queryKey: unknown[]; previousData: any }>) => {
      contexts.forEach(({ queryKey, previousData }) => {
        if (previousData !== undefined) {
          queryClient.setQueryData(queryKey, previousData);
        }
      });
    },

    /**
     * Invalidate queries after rollback to force refetch
     */
    invalidateAfterRollback: (queryKeys: unknown[][]) => {
      queryKeys.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
    },
  };
}

/**
 * Hook for rollback operations with toast notifications
 */
export function useRollback() {
  const { toast } = useToast();

  return {
    /**
     * Show rollback notification
     */
    notifyRollback: (message: string = "Changes reverted due to error") => {
      toast({
        title: "Changes Reverted",
        description: message,
        variant: "destructive",
      });
    },

    /**
     * Show optimistic success notification (temporary until confirmed)
     */
    notifyOptimistic: (message: string) => {
      toast({
        title: "Saving...",
        description: message,
      });
    },
  };
}
