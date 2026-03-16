/**
 * Query Key Factory
 *
 * Centralized query key management for React Query.
 * Prevents key conflicts and makes cache invalidation easier.
 */

import type { ProductListParams } from "@/lib/api/products";
import type { OrderListParams } from "@/lib/api/orders";
import type { CustomerListParams } from "@/lib/api/customers";
import type { QuoteListParams } from "@/lib/api/quotes";

/**
 * Products query keys
 */
export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (params: ProductListParams) => [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

/**
 * Customers query keys
 */
export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

/**
 * Orders query keys
 */
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (params: OrderListParams) => [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  activity: (id: string) => [...orderKeys.detail(id), "activity"] as const,
};

/**
 * Quotes query keys
 */
export const quoteKeys = {
  all: ["quotes"] as const,
  lists: () => [...quoteKeys.all, "list"] as const,
  list: (params: QuoteListParams) => [...quoteKeys.lists(), params] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
};

/**
 * Analytics/Dashboard query keys
 */
export const analyticsKeys = {
  all: ["analytics"] as const,
  metrics: () => [...analyticsKeys.all, "metrics"] as const,
  charts: () => [...analyticsKeys.all, "charts"] as const,
  overview: () => [...analyticsKeys.all, "overview"] as const,
};

/**
 * User query keys
 */
export const userKeys = {
  all: ["user"] as const,
  profile: () => [...userKeys.all, "profile"] as const,
  preferences: () => [...userKeys.all, "preferences"] as const,
};
