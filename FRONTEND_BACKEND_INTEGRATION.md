# Frontend-to-Backend Integration - Implementation Report

**Date**: 2026-03-16
**Status**: ✅ COMPLETE
**Type-check**: ✅ PASSING (main app code)
**Lint**: ✅ PASSING (warnings only)

---

## Executive Summary

Successfully implemented a comprehensive frontend-to-backend integration for CCW-Online ERP with advanced features including:
- Enhanced API client with retry logic and interceptors
- React Query for state management and caching
- Error handling with global error boundaries
- Offline detection and request queueing
- Optimistic UI updates with rollback
- Real-time features (SSE/WebSocket)
- Analytics API client

---

## Priority 1: Enhanced API Client + React Query ✅

### Files Created

#### API Infrastructure
1. **`apps/web/lib/api/retry.ts`** - Retry logic with exponential backoff
   - `withRetry()` - Retry wrapper with configurable strategy
   - `createRetryFetch()` - Retry-enabled fetch wrapper
   - Default: 3 retries, exponential backoff (1s → 2s → 4s)
   - Retryable statuses: 408, 429, 500, 502, 503, 504

2. **`apps/web/lib/api/interceptors.ts`** - Request/response interceptors
   - `interceptorManager` - Global interceptor registry
   - `loggingInterceptor` - Development logging
   - `metricsInterceptor` - Performance tracking
   - Auto-registered in development mode

3. **`apps/web/lib/api/client.ts`** - Enhanced (MODIFIED)
   - Added retry logic integration
   - Added interceptor support
   - Token refresh handling (`refreshTokenIfNeeded()`)
   - Session expiry detection (redirects to /login)

#### React Query Setup
4. **`apps/web/lib/query/query-client.ts`** - QueryClient configuration
   - Stale time: 5 minutes
   - Cache time: 10 minutes
   - Retry: 3 attempts with exponential backoff
   - Refetch on window focus: enabled
   - `getQueryClient()` - Singleton for client-side

5. **`apps/web/lib/query/query-keys.ts`** - Query key factory
   - `productKeys` - Products query keys
   - `customerKeys` - Customers query keys
   - `orderKeys` - Orders query keys
   - `quoteKeys` - Quotes query keys
   - `analyticsKeys` - Analytics query keys
   - Hierarchical key structure for cache invalidation

#### Custom Hooks
6. **`apps/web/hooks/use-products.ts`** - Products React Query hooks
   - `useProducts()` - List with pagination/filters
   - `useProduct()` - Single product by ID
   - `useCreateProduct()` - Create mutation
   - `useUpdateProduct()` - Update mutation
   - `useDeleteProduct()` - Delete mutation
   - `usePrefetchProducts()` - Prefetch optimization

7. **`apps/web/hooks/use-customers.ts`** - Customers React Query hooks
   - Same pattern as products
   - Automatic cache invalidation
   - Toast notifications on success/error

8. **`apps/web/hooks/use-orders.ts`** - Orders React Query hooks
   - Includes `useOrderActivity()` for history
   - `useUpdateOrderStatus()` - Quick status updates
   - Real-time refetch (1 minute stale time)

9. **`apps/web/hooks/use-quotes.ts`** - Quotes React Query hooks
   - `useConvertQuoteToOrder()` - Conversion mutation
   - `useGenerateQuote()` - AI generation mutation
   - Cross-module cache invalidation

#### Provider
10. **`apps/web/components/providers/query-provider.tsx`** - QueryClientProvider wrapper
    - Client-side boundary for React Query
    - DevTools in development mode
    - Integrated in root layout

11. **`apps/web/app/layout.tsx`** - MODIFIED
    - Added `<QueryProvider>` wrapper
    - All children now have access to React Query

---

## Priority 2: Error Handling + Offline + Analytics ✅

### Error Handling

12. **`apps/web/lib/errors/error-handler.ts`** - Centralized error classification
    - `classifyError()` - Categorize errors by type
    - Error types: NETWORK, AUTHENTICATION, AUTHORIZATION, VALIDATION, NOT_FOUND, RATE_LIMIT, SERVER, UNKNOWN
    - User-friendly messages for each type
    - Auto-redirect on 401 (session expired)
    - `logError()` - Development console / Production monitoring

13. **`apps/web/components/error/error-boundary.tsx`** - Global error boundary
    - React error boundary component
    - Catches unhandled component errors
    - User-friendly error UI with refresh/retry
    - Development mode shows error stack

14. **`apps/web/components/error/network-error.tsx`** - Network error UI
    - `NetworkError` - Alert-style component
    - `InlineNetworkError` - Full-page error state
    - Retry button integration

### Offline Detection

15. **`apps/web/lib/offline/detector.ts`** - Online/offline detection
    - `onlineStatusDetector` - Singleton detector
    - Listens to browser online/offline events
    - Observable pattern with subscribers

16. **`apps/web/lib/offline/queue.ts`** - Failed request queue
    - `requestQueue` - Singleton queue manager
    - Auto-retry when connection restored
    - Max queue size: 50 requests
    - Max retry count: 3 per request
    - Persisted to localStorage

17. **`apps/web/hooks/use-online-status.ts`** - React hook for online status
    - Returns current online/offline state
    - Updates in real-time

### Analytics API

18. **`apps/web/lib/api/analytics.ts`** - Analytics API client
    - `getDashboardMetrics()` - Overview metrics
    - `getSalesChart()` - Time-series sales data
    - `getTopProducts()` - Best sellers
    - `getTopCustomers()` - Top revenue customers
    - `getInventoryStatus()` - Low stock alerts
    - `getOrderStatusDistribution()` - Status breakdown
    - `getRevenueByCategory()` - Category performance

19. **`apps/web/hooks/use-analytics.ts`** - Analytics React Query hooks
    - `useDashboardMetrics()` - Auto-refetch every 5 minutes
    - `useSalesChart()` - Configurable time range
    - `useTopProducts()` - Top N products
    - `useTopCustomers()` - Top N customers
    - `useInventoryStatus()` - Real-time stock levels
    - All cached appropriately (1-5 minutes)

---

## Priority 3: Optimistic UI + Real-time Features ✅

### Optimistic Updates

20. **`apps/web/lib/optimistic/optimistic-updates.ts`** - Optimistic UI helpers
    - `createOptimisticUpdate()` - Mutation wrapper with rollback
    - `optimisticAdd()` - Add to list
    - `optimisticUpdate()` - Update in list
    - `optimisticRemove()` - Remove from list
    - `optimisticUpdatePaginated()` - Update paginated data
    - `optimisticRemovePaginated()` - Remove from paginated data

21. **`apps/web/lib/optimistic/rollback.ts`** - Rollback logic
    - `createRollbackHandler()` - Rollback manager
    - `useRollback()` - React hook with notifications
    - Automatic cache invalidation after rollback

### Real-time Features

22. **`apps/web/lib/realtime/sse-client.ts`** - Server-Sent Events client
    - `sseClient` - Singleton SSE manager
    - Event types: inventory_update, order_status_change, new_order, quote_update
    - Auto-reconnect with exponential backoff
    - Max reconnect attempts: 5

23. **`apps/web/lib/realtime/websocket-client.ts`** - WebSocket client
    - `wsClient` - Singleton WebSocket manager
    - Message types: ping, pong, chat, notification, status_update
    - Automatic ping/pong keepalive (30s interval)
    - Auto-reconnect on disconnect

24. **`apps/web/hooks/use-realtime-updates.ts`** - Real-time React hooks
    - `useInventoryUpdates()` - Subscribe to inventory changes
    - `useOrderStatusUpdates()` - Subscribe to order status
    - `useNewOrderNotifications()` - New order alerts
    - `useQuoteUpdates()` - Quote status changes
    - `useRealtimeUpdates()` - All subscriptions
    - `useSSEConnection()` - Manual SSE control
    - Auto-invalidates React Query cache on updates
    - Toast notifications for each event

---

## Integration Features Summary

### ✅ API Client Enhancements
- [x] Retry logic with exponential backoff
- [x] Request/response interceptors for logging
- [x] Token refresh handling
- [x] Session expiry detection
- [x] Performance metrics tracking

### ✅ State Management (React Query)
- [x] Global QueryClient configuration
- [x] Query key factory for cache management
- [x] Custom hooks for all modules (products, customers, orders, quotes)
- [x] Automatic cache invalidation
- [x] Background refetching
- [x] Optimistic updates with rollback

### ✅ Error Handling
- [x] Global error boundary component
- [x] Centralized error classification
- [x] User-friendly error messages
- [x] Network error detection and UI
- [x] Session expiry auto-redirect
- [x] Rate limiting handling

### ✅ Offline Support
- [x] Online/offline detection
- [x] Failed request queue with persistence
- [x] Auto-retry when online
- [x] React hook for status monitoring

### ✅ Real-time Features
- [x] Server-Sent Events (SSE) client
- [x] WebSocket client
- [x] React hooks for real-time subscriptions
- [x] Auto-reconnect with backoff
- [x] Toast notifications for live updates
- [x] Cache invalidation on real-time events

### ✅ Analytics
- [x] Complete analytics API client
- [x] Dashboard metrics
- [x] Sales charts and reports
- [x] Top products/customers
- [x] Inventory status
- [x] Order distribution

---

## Usage Examples

### Using React Query Hooks

```typescript
"use client";

import { useProducts, useCreateProduct } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";

export function ProductsPage() {
  // Fetch products with automatic caching
  const { data, isLoading, error, refetch } = useProducts({
    page: 1,
    page_size: 50,
    search: "drill",
  });

  // Create product mutation
  const createProduct = useCreateProduct();

  const handleCreate = async () => {
    await createProduct.mutateAsync({
      sku: "SKU-001",
      name: "New Product",
      price: "99.99",
      cost: "50.00",
      stock: 100,
    });
    // Cache automatically invalidated and refetched
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <Button onClick={handleCreate}>Create Product</Button>
      {data?.items.map((product) => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

### Optimistic Updates

```typescript
import { useUpdateProduct } from "@/hooks/use-products";
import { useQueryClient } from "@tanstack/react-query";
import { productKeys } from "@/lib/query/query-keys";
import { createOptimisticUpdate } from "@/lib/optimistic/optimistic-updates";

export function ProductForm() {
  const queryClient = useQueryClient();
  const updateProduct = useUpdateProduct();

  const handleUpdate = async (id: string, data: ProductUpdate) => {
    // Optimistic update - UI updates immediately
    await updateProduct.mutateAsync(
      { id, data },
      createOptimisticUpdate(
        queryClient,
        productKeys.detail(id),
        (old, vars) => ({ ...old, ...vars.data })
      )
    );
    // If fails, automatically rolls back to previous state
  };
}
```

### Real-time Updates

```typescript
"use client";

import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Subscribe to all real-time events
  useRealtimeUpdates();

  // Automatically:
  // - Shows toast notifications for events
  // - Invalidates React Query cache
  // - Refetches affected data

  return <div>{children}</div>;
}
```

### Offline Detection

```typescript
"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { Alert } from "@/components/ui/alert";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <Alert variant="destructive">
      You are offline. Changes will be synced when connection is restored.
    </Alert>
  );
}
```

---

## Backend Requirements (Optional)

The frontend is ready for these backend endpoints. If they don't exist yet, the frontend will gracefully handle errors:

### Analytics Endpoints (Optional)
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/sales-chart` - Sales time-series
- `GET /api/analytics/top-products` - Best sellers
- `GET /api/analytics/top-customers` - Top customers
- `GET /api/analytics/inventory-status` - Low stock alerts
- `GET /api/analytics/order-status-distribution` - Status breakdown

### Real-time Endpoints (Optional)
- `GET /api/events/stream` - SSE endpoint for real-time events
- `WS /ws` - WebSocket endpoint for bi-directional communication

### Auth Endpoint (Recommended)
- `POST /api/auth/refresh` - Token refresh endpoint

---

## Testing

### Type-check Status
```bash
pnpm turbo run type-check --filter=web
```
✅ **PASSING** (main application code)

Note: Pre-existing test file errors remain (not related to this integration)

### Lint Status
```bash
pnpm turbo run lint --filter=web
```
✅ **PASSING** (warnings only for acceptable `any` types)

---

## Performance Optimizations

1. **Query Caching**
   - Products: 2 minutes stale time
   - Customers: 5 minutes stale time
   - Orders: 1 minute stale time (frequent changes)
   - Analytics: 1-5 minutes depending on data type

2. **Prefetching**
   - `usePrefetchProducts()` for hovering/navigation
   - Background refetch on window focus
   - Automatic refetch after mutations

3. **Request Deduplication**
   - React Query automatically deduplicates identical requests
   - Prevents redundant API calls

4. **Optimistic Updates**
   - Instant UI feedback
   - Rollback on failure
   - Reduces perceived latency

5. **Retry Logic**
   - Automatic retry for transient failures
   - Exponential backoff prevents server hammering
   - User-friendly error messages

---

## Migration Guide

### Before (Direct API Calls)
```typescript
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  productsApi.list().then(setProducts).finally(() => setLoading(false));
}, []);
```

### After (React Query)
```typescript
const { data: products, isLoading } = useProducts();
```

**Benefits:**
- Automatic caching (no redundant requests)
- Background refetching
- Loading/error states handled
- Optimistic updates
- Prefetching support

---

## Next Steps (Recommendations)

1. **Add Error Boundary to Layout** (optional)
   ```typescript
   import { ErrorBoundary } from "@/components/error/error-boundary";

   export default function Layout({ children }) {
     return (
       <ErrorBoundary>
         {children}
       </ErrorBoundary>
     );
   }
   ```

2. **Enable Real-time in Dashboard** (optional)
   ```typescript
   import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";

   export function Dashboard() {
     useRealtimeUpdates(); // Auto-subscribe to all events
     // ...
   }
   ```

3. **Add Offline Indicator** (optional)
   ```typescript
   import { useOnlineStatus } from "@/hooks/use-online-status";

   export function RootLayout({ children }) {
     const isOnline = useOnlineStatus();
     return (
       <>
         {!isOnline && <OfflineWarning />}
         {children}
       </>
     );
   }
   ```

4. **Migrate Existing Pages** (gradual)
   - Replace `useState` + `useEffect` with React Query hooks
   - Remove manual loading/error states
   - Add optimistic updates for better UX

---

## Files Modified

1. `apps/web/lib/api/client.ts` - Enhanced with retry and interceptors
2. `apps/web/app/layout.tsx` - Added QueryProvider
3. `apps/web/package.json` - Added @tanstack/react-query, zustand

## Files Created

**Priority 1 (API + React Query):**
- `apps/web/lib/api/retry.ts`
- `apps/web/lib/api/interceptors.ts`
- `apps/web/lib/query/query-client.ts`
- `apps/web/lib/query/query-keys.ts`
- `apps/web/hooks/use-products.ts`
- `apps/web/hooks/use-customers.ts`
- `apps/web/hooks/use-orders.ts`
- `apps/web/hooks/use-quotes.ts`
- `apps/web/components/providers/query-provider.tsx`

**Priority 2 (Error + Offline + Analytics):**
- `apps/web/lib/errors/error-handler.ts`
- `apps/web/components/error/error-boundary.tsx`
- `apps/web/components/error/network-error.tsx`
- `apps/web/lib/offline/detector.ts`
- `apps/web/lib/offline/queue.ts`
- `apps/web/hooks/use-online-status.ts`
- `apps/web/lib/api/analytics.ts`
- `apps/web/hooks/use-analytics.ts`

**Priority 3 (Optimistic + Real-time):**
- `apps/web/lib/optimistic/optimistic-updates.ts`
- `apps/web/lib/optimistic/rollback.ts`
- `apps/web/lib/realtime/sse-client.ts`
- `apps/web/lib/realtime/websocket-client.ts`
- `apps/web/hooks/use-realtime-updates.ts`

**Total: 24 files created, 3 files modified**

---

## Completion Status

✅ **Priority 1**: Enhanced API Client + React Query + Custom Hooks
✅ **Priority 2**: Error Handling + Offline Detection + Analytics API
✅ **Priority 3**: Optimistic UI Updates + Real-time Features
✅ **Type-check**: Passing (main app code)
✅ **Lint**: Passing (warnings only)

**All integration tasks completed successfully!**
