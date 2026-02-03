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

# ============================================================
# AUTONOMOUS DEVELOPMENT METRICS (Phase 5)
# ============================================================

# Risk Assessment Metrics
risk_assessments_total = Counter(
    "risk_assessments_total",
    "Total risk assessments performed",
    ["risk_level"],  # LOW, MEDIUM, HIGH, CRITICAL
)

risk_assessment_duration = Histogram(
    "risk_assessment_duration_seconds",
    "Time spent performing risk assessment",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0],
)

approval_decisions_total = Counter(
    "approval_decisions_total",
    "Approval policy decisions",
    ["policy"],  # AUTO_MERGE, ONE_REVIEWER, TWO_REVIEWERS, SECURITY_AUDIT
)

# Auto-Merge Metrics
auto_merges_attempted = Counter(
    "auto_merges_attempted_total",
    "Auto-merge attempts",
    ["risk_level"],
)

auto_merges_successful = Counter(
    "auto_merges_successful_total",
    "Successful auto-merges",
    ["risk_level"],
)

auto_merges_failed = Counter(
    "auto_merges_failed_total",
    "Failed auto-merges",
    ["risk_level", "failure_reason"],
)

auto_merge_duration = Histogram(
    "auto_merge_duration_seconds",
    "Time from commit to successful merge",
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0],
)

# Rollback Metrics
rollbacks_triggered = Counter(
    "rollbacks_triggered_total",
    "Rollbacks triggered",
    ["trigger_reason"],  # test_failure, build_failure, runtime_error, manual
)

rollback_duration = Histogram(
    "rollback_duration_seconds",
    "Time to complete rollback",
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0],
)

rollbacks_successful = Counter(
    "rollbacks_successful_total",
    "Successful rollbacks",
)

rollbacks_failed = Counter(
    "rollbacks_failed_total",
    "Failed rollbacks requiring manual intervention",
)

# Circuit Breaker Metrics
circuit_breaker_state = Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)",
    ["component"],
)

circuit_breaker_opens = Counter(
    "circuit_breaker_opens_total",
    "Circuit breaker open events",
    ["component"],
)

circuit_breaker_closes = Counter(
    "circuit_breaker_closes_total",
    "Circuit breaker close events",
    ["component"],
)

# Test Execution Metrics
test_executions_total = Counter(
    "test_executions_total",
    "Test suite executions",
    ["suite"],  # unit, integration, e2e, security
)

test_failures_total = Counter(
    "test_failures_total",
    "Test failures",
    ["suite", "test_name"],
)

test_execution_duration = Histogram(
    "test_execution_duration_seconds",
    "Test suite execution time",
    ["suite"],
    buckets=[1.0, 10.0, 30.0, 60.0, 300.0, 600.0],
)

test_coverage_percentage = Gauge(
    "test_coverage_percentage",
    "Code coverage percentage",
    ["module"],
)

# Deployment Metrics
deployments_total = Counter(
    "deployments_total",
    "Total deployments",
    ["environment"],  # development, staging, production
)

deployment_duration = Histogram(
    "deployment_duration_seconds",
    "Time to complete deployment",
    ["environment"],
    buckets=[10.0, 30.0, 60.0, 300.0, 600.0, 1800.0],
)

deployment_failures_total = Counter(
    "deployment_failures_total",
    "Deployment failures",
    ["environment", "stage"],  # build, test, deploy
)

# Agent Performance Metrics
agent_task_execution_time = Histogram(
    "agent_task_execution_seconds",
    "Agent task execution time",
    ["agent_id", "task_type"],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0],
)

agent_task_success_total = Counter(
    "agent_task_success_total",
    "Successful agent task executions",
    ["agent_id", "task_type"],
)

agent_task_failure_total = Counter(
    "agent_task_failure_total",
    "Failed agent task executions",
    ["agent_id", "task_type", "error_type"],
)

agent_verification_required = Counter(
    "agent_verification_required_total",
    "Tasks requiring manual verification",
    ["agent_id", "verification_reason"],
)

# Code Quality Metrics
code_lines_changed = Histogram(
    "code_lines_changed",
    "Lines of code changed per commit",
    buckets=[10, 50, 100, 200, 500, 1000, 2000],
)

code_files_changed = Histogram(
    "code_files_changed",
    "Files changed per commit",
    buckets=[1, 3, 5, 10, 20, 50],
)

protected_files_modified = Counter(
    "protected_files_modified_total",
    "Protected files modified (requires elevated approval)",
    ["file_pattern"],
)

# System Health for Autonomous Operations
autonomous_system_errors = Counter(
    "autonomous_system_errors_total",
    "Errors in autonomous development system",
    ["component", "error_type"],
)
