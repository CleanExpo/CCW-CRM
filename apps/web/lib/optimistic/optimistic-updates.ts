/**
 * Optimistic UI Updates
 *
 * Provides helpers for optimistic updates with automatic rollback on failure.
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * Optimistic update context for rollback
 */
export interface OptimisticContext<T> {
  previousData?: T;
  queryKey: unknown[];
}

/**
 * Create optimistic update mutation options
 */
export function createOptimisticUpdate<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData
) {
  return {
    // Before mutation runs
    onMutate: async (variables: TVariables): Promise<OptimisticContext<TData>> => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData<TData>(queryKey, (old) => updateFn(old, variables));

      // Return context with previous data for rollback
      return { previousData, queryKey };
    },

    // If mutation fails, rollback
    onError: (error: any, variables: TVariables, context?: OptimisticContext<TData>) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Optimistically add item to a list
 */
export function optimisticAdd<TItem>(
  oldData: TItem[] | undefined,
  newItem: TItem
): TItem[] {
  if (!oldData) return [newItem];
  return [...oldData, newItem];
}

/**
 * Optimistically update item in a list
 */
export function optimisticUpdate<TItem extends { id: string }>(
  oldData: TItem[] | undefined,
  id: string,
  updatedFields: Partial<TItem>
): TItem[] {
  if (!oldData) return [];
  return oldData.map((item) =>
    item.id === id ? { ...item, ...updatedFields } : item
  );
}

/**
 * Optimistically remove item from a list
 */
export function optimisticRemove<TItem extends { id: string }>(
  oldData: TItem[] | undefined,
  id: string
): TItem[] {
  if (!oldData) return [];
  return oldData.filter((item) => item.id !== id);
}

/**
 * Optimistically update paginated data
 */
export function optimisticUpdatePaginated<TItem extends { id: string }>(
  oldData: { items: TItem[]; total: number } | undefined,
  id: string,
  updatedFields: Partial<TItem>
): { items: TItem[]; total: number } {
  if (!oldData) return { items: [], total: 0 };

  return {
    ...oldData,
    items: oldData.items.map((item) =>
      item.id === id ? { ...item, ...updatedFields } : item
    ),
  };
}

/**
 * Optimistically remove from paginated data
 */
export function optimisticRemovePaginated<TItem extends { id: string }>(
  oldData: { items: TItem[]; total: number } | undefined,
  id: string
): { items: TItem[]; total: number } {
  if (!oldData) return { items: [], total: 0 };

  return {
    items: oldData.items.filter((item) => item.id !== id),
    total: Math.max(0, oldData.total - 1),
  };
}
