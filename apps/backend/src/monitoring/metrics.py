"""Custom business metrics for Prometheus.

This module defines application-specific metrics that track business KPIs
and operational health beyond standard HTTP metrics.
"""

from prometheus_client import Counter, Gauge, Histogram

# ============================================================
# ORDER METRICS
# ============================================================

orders_created = Counter(
    "orders_created_total",
    "Total number of orders created",
    ["status", "location"],
)

orders_revenue = Counter(
    "orders_revenue_total",
    "Total revenue from orders (AUD)",
    ["location"],
)

orders_processing_time = Histogram(
    "orders_processing_seconds",
    "Time spent processing orders (creation to confirmation)",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

# ============================================================
# POS METRICS
# ============================================================

pos_transactions = Counter(
    "pos_transactions_total",
    "Total POS transactions",
    ["payment_method", "location", "status"],
)

pos_reconciliation_rate = Gauge(
    "pos_reconciliation_rate",
    "POS transaction reconciliation rate (0.0-1.0)",
)

pos_transaction_amount = Counter(
    "pos_transaction_amount_total",
    "Total POS transaction amount (AUD)",
    ["payment_method", "location"],
)

# ============================================================
# QUOTE METRICS
# ============================================================

quotes_created = Counter(
    "quotes_created_total",
    "Total quotes created",
    ["status"],
)

quotes_converted = Counter(
    "quotes_converted_total",
    "Quotes converted to orders",
)

quotes_conversion_time = Histogram(
    "quotes_conversion_seconds",
    "Time from quote creation to order conversion",
    buckets=[3600, 86400, 172800, 604800, 2592000],  # 1h, 1d, 2d, 7d, 30d
)

# ============================================================
# DATABASE METRICS
# ============================================================

db_pool_size = Gauge(
    "db_pool_size",
    "Database connection pool size",
)

db_pool_active_connections = Gauge(
    "db_pool_active_connections",
    "Active database connections",
)

db_pool_idle_connections = Gauge(
    "db_pool_idle_connections",
    "Idle database connections",
)

db_query_duration = Histogram(
    "db_query_duration_seconds",
    "Database query execution time",
    ["operation"],
    buckets=[0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0],
)

# ============================================================
# CACHE METRICS
# ============================================================

cache_hits = Counter(
    "cache_hits",
    "Cache hits",
    ["key_pattern"],
)

cache_misses = Counter(
    "cache_misses",
    "Cache misses",
    ["key_pattern"],
)

cache_set_operations = Counter(
    "cache_set_operations",
    "Cache set operations",
    ["key_pattern"],
)

# ============================================================
# AI METRICS
# ============================================================

ai_requests = Counter(
    "ai_requests_total",
    "AI API requests",
    ["agent", "status"],
)

ai_response_time = Histogram(
    "ai_response_seconds",
    "AI response time",
    ["agent"],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0],
)

ai_tokens_used = Counter(
    "ai_tokens_used_total",
    "AI tokens consumed",
    ["agent", "model"],
)

# ============================================================
# CUSTOMER METRICS
# ============================================================

customers_created = Counter(
    "customers_created_total",
    "Total customers created",
)

customer_activity = Counter(
    "customer_activity_total",
    "Customer activity events",
    ["activity_type"],  # login, order, quote, etc.
)

# ============================================================
# PRODUCT METRICS
# ============================================================

products_created = Counter(
    "products_created_total",
    "Total products created",
    ["category"],
)

products_out_of_stock = Gauge(
    "products_out_of_stock",
    "Number of products out of stock",
)

# ============================================================
# INVENTORY METRICS
# ============================================================

stock_adjustments = Counter(
    "stock_adjustments_total",
    "Stock adjustment operations",
    ["location", "adjustment_type"],
)

stock_transfers = Counter(
    "stock_transfers_total",
    "Stock transfers between locations",
    ["from_location", "to_location"],
)

# ============================================================
# INTEGRATION METRICS
# ============================================================

xero_api_calls = Counter(
    "xero_api_calls_total",
    "Xero API calls",
    ["operation", "status"],
)

shopify_api_calls = Counter(
    "shopify_api_calls_total",
    "Shopify API calls",
    ["operation", "status"],
)

shopify_sync_duration = Histogram(
    "shopify_sync_duration_seconds",
    "Shopify sync operation duration",
    ["sync_type"],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0],
)

# ============================================================
# BACKGROUND JOB METRICS
# ============================================================

background_jobs_started = Counter(
    "background_jobs_started_total",
    "Background jobs started",
    ["job_type"],
)

background_jobs_completed = Counter(
    "background_jobs_completed_total",
    "Background jobs completed",
    ["job_type", "status"],
)

background_job_duration = Histogram(
    "background_job_duration_seconds",
    "Background job execution time",
    ["job_type"],
    buckets=[1.0, 10.0, 60.0, 300.0, 600.0, 1800.0],
)
