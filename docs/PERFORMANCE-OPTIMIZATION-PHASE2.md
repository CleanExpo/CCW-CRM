# Performance Optimization Phase 2: Query Optimization & Caching

## Overview

This document summarizes the performance optimizations implemented in Phase 2 of the CCW-Online ERP performance improvement initiative. Phase 1 (database indexing) achieved a 48% improvement. Phase 2 focuses on N+1 query elimination and Redis caching.

## Optimizations Implemented

### 1. N+1 Query Elimination

#### Dashboard Inventory Status (`/api/dashboard/charts/inventory`)

**Before:**
- 1 query to get unique warehouses
- 3 queries per warehouse (in_stock, low_stock, out_of_stock)
- Total: `1 + (3 * N)` queries where N = number of warehouses
- With 5 warehouses: 16 queries

**After:**
- Single query with conditional aggregation using `CASE` expressions
- Total: 1 query

**Code Change:**
```python
# Single optimized query with conditional aggregation
result = await db.execute(
    select(
        Product.warehouse_location,
        func.count(case((Product.stock > 10, Product.id))).label("in_stock"),
        func.count(case(((Product.stock > 0) & (Product.stock <= 10), Product.id))).label("low_stock"),
        func.count(case((Product.stock == 0, Product.id))).label("out_of_stock"),
    )
    .where(Product.is_active)
    .where(Product.warehouse_location.isnot(None))
    .group_by(Product.warehouse_location)
)
```

**Expected Improvement:** 90-95% reduction in database round-trips for this endpoint.

#### Dashboard Revenue Chart (`/api/dashboard/charts/revenue`)

**Before:**
- 6 separate queries (one per month)
- Each query aggregated revenue for a specific month

**After:**
- Single query using `date_trunc('month', ...)` with GROUP BY
- Returns all monthly data in one round-trip

**Expected Improvement:** 83% reduction in database queries (6 queries -> 1 query).

### 2. Redis Caching Implementation

#### Cached Endpoints and TTLs

| Endpoint | TTL | Cache Key Prefix | Rationale |
|----------|-----|------------------|-----------|
| `/api/dashboard/metrics` | 60s | `dashboard_metrics` | Core metrics, needs freshness |
| `/api/dashboard/charts/revenue` | 300s | `dashboard_revenue` | Historical data, stable |
| `/api/dashboard/charts/categories` | 300s | `dashboard_categories` | Aggregate data, stable |
| `/api/dashboard/charts/top-products` | 300s | `dashboard_top_products` | Aggregate data, stable |
| `/api/dashboard/charts/inventory` | 120s | `dashboard_inventory` | Inventory changes frequently |
| `/api/dashboard/activity` | 30s | `dashboard_activity` | Activity feed, needs freshness |
| `/api/dashboard/order-status-breakdown` | 60s | `dashboard_order_status` | Order status changes often |
| `/api/dashboard/quote-conversion` | 120s | `dashboard_quote_conversion` | Quote metrics |
| `/api/dashboard/revenue-by-location` | 300s | `dashboard_revenue_location` | Historical data |
| `/api/products` (list) | 300s | `api_products_list` | Product catalog |
| `/api/customers` (list) | 300s | `api_customers_list` | Customer directory |
| `/api/demo/products` | 300s | `products` | Demo product list |
| `/api/demo/customers` | 300s | `customers` | Demo customer list |

### 3. Cache Invalidation Strategy

#### Automatic Invalidation on Writes

**Product Changes (create/update/delete):**
- `products:*`
- `api_products_list:*`
- `dashboard_inventory:*`
- `dashboard_top_products:*`

**Customer Changes (create/update/delete):**
- `customers:*`
- `api_customers_list:*`
- `dashboard_metrics:*`
- `dashboard_activity:*`

**Order Changes (create/update/delete/status change):**
- `dashboard_metrics:*`
- `dashboard_revenue:*`
- `dashboard_order_status:*`
- `dashboard_activity:*`
- `dashboard_categories:*`
- `dashboard_top_products:*`
- `dashboard_revenue_location:*`

**Quote Changes (create/update/delete/convert):**
- `dashboard_metrics:*`
- `dashboard_quote_conversion:*`
- `dashboard_activity:*`

## Files Modified

1. `apps/backend/src/api/routes/demo_dashboard.py`
   - Added `@cached` decorators to all dashboard endpoints
   - Optimized `get_inventory_status()` - eliminated N+1 pattern
   - Optimized `get_revenue_chart()` - single query with date grouping

2. `apps/backend/src/api/routes/products.py`
   - Added `@cached` decorator to list endpoint
   - Enhanced cache invalidation to include dashboard caches

3. `apps/backend/src/api/routes/customers.py`
   - Added `@cached` decorator to list endpoint
   - Enhanced cache invalidation to include dashboard caches

4. `apps/backend/src/api/routes/orders.py`
   - Added `invalidate_order_caches()` helper function
   - Added cache invalidation after create, update, delete, and status changes

5. `apps/backend/src/api/routes/quotes.py`
   - Added `invalidate_quote_caches()` helper function
   - Added cache invalidation after create, update, delete, and convert operations

## Expected Performance Improvements

### Database Query Reduction

| Endpoint | Before | After | Reduction |
|----------|--------|-------|-----------|
| Inventory Status | 16 queries | 1 query | 94% |
| Revenue Chart | 6 queries | 1 query | 83% |
| All Dashboard | ~30 queries | ~10 queries | 67% |

### Response Time Improvements (with caching)

| Scenario | Before | After (Cache Hit) | Improvement |
|----------|--------|-------------------|-------------|
| Dashboard Load | ~500ms | ~20ms | 96% |
| Product List | ~200ms | ~10ms | 95% |
| Customer List | ~150ms | ~10ms | 93% |

### Cache Hit Rates (Expected)

- Dashboard endpoints: 80-90% hit rate (with 30-300s TTLs)
- List endpoints: 70-80% hit rate (with 300s TTLs)

## Configuration

### Redis Settings (in `apps/backend/src/config/settings.py`)

```python
# Redis Cache
redis_host: str = Field(default="localhost", description="Redis host")
redis_port: int = Field(default=6379, description="Redis port")
redis_db: int = Field(default=0, description="Redis database number")
cache_enabled: bool = Field(default=True, description="Enable Redis caching")
cache_ttl: int = Field(default=300, description="Default cache TTL in seconds (5 minutes)")
```

### Prerequisites

1. Redis server running on localhost:6379 (or configured host)
2. `cache_enabled=True` in settings

## Monitoring

### Cache Statistics

The cache logs hit/miss information:
```
INFO: Cache HIT: dashboard_metrics
INFO: Cache MISS: dashboard_metrics:abc123
```

### Verifying Cache Invalidation

After any write operation, you should see:
```
INFO: Invalidated cache: dashboard_metrics:* (3 keys deleted)
```

## Rollback Instructions

If issues arise:

1. **Disable Caching Temporarily:**
   Set `CACHE_ENABLED=false` in environment variables

2. **Revert N+1 Fixes:**
   The original query patterns are preserved in git history

## Next Steps (Phase 3)

1. Add response compression (gzip/brotli)
2. Implement query result pagination limits
3. Add database query timeout configurations
4. Consider read replicas for heavy read endpoints
5. Implement background cache warming for cold starts

## Summary

Phase 2 optimizations target two key performance bottlenecks:

1. **N+1 Query Pattern**: Eliminated in dashboard endpoints, reducing database round-trips by 60-95%
2. **Redundant Queries**: Redis caching prevents repeated identical queries, with intelligent cache invalidation on writes

Combined with Phase 1 database indexing (48% improvement), these optimizations should bring average response times well under 1 second for most endpoints.
