/**
 * React Query hooks for Customers
 *
 * Provides optimized data fetching, caching, and mutations for customers.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  customersApi,
  type Customer,
  type CustomerCreate,
  type CustomerUpdate,
  type CustomerListParams,
} from "@/lib/api/customers";
import { customerKeys } from "@/lib/query/query-keys";
import { useToast } from "@/hooks/use-toast";

/**
 * Fetch customers list with pagination and filters
 */
export function useCustomers(params: CustomerListParams = {}) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => customersApi.list(params),
    staleTime: 5 * 60 * 1000, // 5 minutes (customers change less frequently)
  });
}

/**
 * Fetch single customer by ID
 */
export function useCustomer(id: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customersApi.get(id),
    enabled: enabled && !!id,
  });
}

/**
 * Create new customer mutation
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CustomerCreate) => customersApi.create(data),
    onSuccess: (newCustomer) => {
      // Invalidate all customer lists to refetch
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });

      // Set the new customer in cache
      queryClient.setQueryData(customerKeys.detail(newCustomer.id), newCustomer);

      toast({
        title: "Success",
        description: `Customer "${newCustomer.company_name}" created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update customer mutation
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerUpdate }) =>
      customersApi.update(id, data),
    onSuccess: (updatedCustomer) => {
      // Invalidate all customer lists
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });

      // Update the specific customer in cache
      queryClient.setQueryData(customerKeys.detail(updatedCustomer.id), updatedCustomer);

      toast({
        title: "Success",
        description: `Customer "${updatedCustomer.company_name}" updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete customer mutation
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: (_, id) => {
      // Invalidate all customer lists
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });

      // Remove the customer from cache
      queryClient.removeQueries({ queryKey: customerKeys.detail(id) });

      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });
}

/**
 * Prefetch customers list (for optimization)
 */
export function usePrefetchCustomers() {
  const queryClient = useQueryClient();

  return (params: CustomerListParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: customerKeys.list(params),
      queryFn: () => customersApi.list(params),
    });
  };
}
