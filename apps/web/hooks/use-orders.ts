/**
 * React Query hooks for Orders
 *
 * Provides optimized data fetching, caching, and mutations for orders.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ordersApi,
  type Order,
  type OrderCreate,
  type OrderUpdate,
  type OrderListParams,
  type OrderStatus,
} from "@/lib/api/orders";
import { orderKeys } from "@/lib/query/query-keys";
import { useToast } from "@/hooks/use-toast";

/**
 * Fetch orders list with pagination and filters
 */
export function useOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => ordersApi.list(params),
    staleTime: 1 * 60 * 1000, // 1 minute (orders change very frequently)
  });
}

/**
 * Fetch single order by ID
 */
export function useOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.get(id),
    enabled: enabled && !!id,
  });
}

/**
 * Fetch order activity/history
 */
export function useOrderActivity(id: string, enabled = true) {
  return useQuery({
    queryKey: orderKeys.activity(id),
    queryFn: () => ordersApi.getActivity(id),
    enabled: enabled && !!id,
    staleTime: 30 * 1000, // 30 seconds (activity should be relatively fresh)
  });
}

/**
 * Create new order mutation
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: OrderCreate) => ordersApi.create(data),
    onSuccess: (newOrder) => {
      // Invalidate all order lists to refetch
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });

      // Set the new order in cache
      queryClient.setQueryData(orderKeys.detail(newOrder.id), newOrder);

      toast({
        title: "Success",
        description: `Order ${newOrder.order_number} created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update order mutation
 */
export function useUpdateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrderUpdate }) =>
      ordersApi.update(id, data),
    onSuccess: (updatedOrder) => {
      // Invalidate all order lists
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });

      // Update the specific order in cache
      queryClient.setQueryData(orderKeys.detail(updatedOrder.id), updatedOrder);

      toast({
        title: "Success",
        description: `Order ${updatedOrder.order_number} updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update order status mutation
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: (updatedOrder) => {
      // Invalidate all order lists
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });

      // Update the specific order in cache
      queryClient.setQueryData(orderKeys.detail(updatedOrder.id), updatedOrder);

      toast({
        title: "Success",
        description: `Order status updated to ${updatedOrder.status}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete order mutation
 */
export function useDeleteOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => ordersApi.delete(id),
    onSuccess: (_, id) => {
      // Invalidate all order lists
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });

      // Remove the order from cache
      queryClient.removeQueries({ queryKey: orderKeys.detail(id) });

      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    },
  });
}

/**
 * Prefetch orders list (for optimization)
 */
export function usePrefetchOrders() {
  const queryClient = useQueryClient();

  return (params: OrderListParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: orderKeys.list(params),
      queryFn: () => ordersApi.list(params),
    });
  };
}
