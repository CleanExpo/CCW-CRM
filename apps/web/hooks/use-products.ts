/**
 * React Query hooks for Products
 *
 * Provides optimized data fetching, caching, and mutations for products.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  productsApi,
  type Product,
  type ProductCreate,
  type ProductUpdate,
  type ProductListParams,
} from "@/lib/api/products";
import { productKeys } from "@/lib/query/query-keys";
import { useToast } from "@/hooks/use-toast";

/**
 * Fetch products list with pagination and filters
 */
export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => productsApi.list(params),
    staleTime: 2 * 60 * 1000, // 2 minutes (products change frequently)
  });
}

/**
 * Fetch single product by ID
 */
export function useProduct(id: string, enabled = true) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.get(id),
    enabled: enabled && !!id,
  });
}

/**
 * Create new product mutation
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: ProductCreate) => productsApi.create(data),
    onSuccess: (newProduct) => {
      // Invalidate all product lists to refetch
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      // Optionally set the new product in cache
      queryClient.setQueryData(productKeys.detail(newProduct.id), newProduct);

      toast({
        title: "Success",
        description: `Product "${newProduct.name}" created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create product",
        variant: "destructive",
      });
    },
  });
}

/**
 * Update product mutation
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdate }) =>
      productsApi.update(id, data),
    onSuccess: (updatedProduct) => {
      // Invalidate all product lists
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      // Update the specific product in cache
      queryClient.setQueryData(productKeys.detail(updatedProduct.id), updatedProduct);

      toast({
        title: "Success",
        description: `Product "${updatedProduct.name}" updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });
}

/**
 * Delete product mutation
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: (_, id) => {
      // Invalidate all product lists
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      // Remove the product from cache
      queryClient.removeQueries({ queryKey: productKeys.detail(id) });

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    },
  });
}

/**
 * Prefetch products list (for optimization)
 */
export function usePrefetchProducts() {
  const queryClient = useQueryClient();

  return (params: ProductListParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: productKeys.list(params),
      queryFn: () => productsApi.list(params),
    });
  };
}
