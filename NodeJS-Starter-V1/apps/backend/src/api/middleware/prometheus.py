"""
Prometheus Metrics Middleware for FastAPI

This middleware exposes application metrics for Prometheus scraping:
- HTTP request count by method, path, and status
- HTTP request latency histograms
- Active requests gauge
- Database connection pool metrics
- Redis metrics
- Celery task metrics
- WebSocket connection metrics
- Business metrics (orders, revenue, etc.)
"""

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.routing import Match
import time
from typing import Callable

# ============================================
# HTTP Metrics
# ============================================

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'path', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'path']
)

http_requests_in_progress = Gauge(
    'http_requests_in_progress',
    'Current HTTP requests in progress',
    ['method', 'path']
)

# ============================================
# Database Metrics
# ============================================

db_pool_connections_total = Gauge(
    'db_pool_connections_total',
    'Total database connection pool size'
)

db_pool_connections_used = Gauge(
    'db_pool_connections_used',
    'Currently used database connections'
)

db_pool_connections_available = Gauge(
    'db_pool_connections_available',
    'Available database connections'
)

db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query execution time',
    ['query_type']
)

# ============================================
# Redis Metrics
# ============================================

redis_connections_total = Gauge(
    'redis_connections_total',
    'Total Redis connections'
)

redis_commands_total = Counter(
    'redis_commands_total',
    'Total Redis commands executed',
    ['command']
)

redis_command_duration_seconds = Histogram(
    'redis_command_duration_seconds',
    'Redis command execution time',
    ['command']
)

# ============================================
# Celery Metrics
# ============================================

celery_tasks_total = Counter(
    'celery_tasks_total',
    'Total Celery tasks',
    ['task_name', 'status']
)

celery_task_duration_seconds = Histogram(
    'celery_task_duration_seconds',
    'Celery task execution time',
    ['task_name']
)

celery_queue_length = Gauge(
    'celery_queue_length',
    'Number of tasks in Celery queue',
    ['queue']
)

celery_workers_total = Gauge(
    'celery_workers_total',
    'Number of active Celery workers'
)

# ============================================
# WebSocket Metrics
# ============================================

websocket_connections_active = Gauge(
    'websocket_connections_active',
    'Currently active WebSocket connections'
)

websocket_connections_total = Counter(
    'websocket_connections_total',
    'Total WebSocket connections',
    ['event']  # connect, disconnect
)

websocket_messages_total = Counter(
    'websocket_messages_total',
    'Total WebSocket messages',
    ['direction']  # inbound, outbound
)

# ============================================
# Business Metrics
# ============================================

business_orders_created_total = Counter(
    'business_orders_created_total',
    'Total orders created'
)

business_orders_fulfilled_total = Counter(
    'business_orders_fulfilled_total',
    'Total orders fulfilled'
)

business_revenue_total = Counter(
    'business_revenue_total',
    'Total revenue (in cents to avoid floating point)',
    ['currency']
)

business_quotes_created_total = Counter(
    'business_quotes_created_total',
    'Total quotes created'
)

business_quotes_converted_total = Counter(
    'business_quotes_converted_total',
    'Total quotes converted to orders'
)

business_backorders_created_total = Counter(
    'business_backorders_created_total',
    'Total backorders created'
)

business_backorders_fulfilled_total = Counter(
    'business_backorders_fulfilled_total',
    'Total backorders fulfilled'
)

business_inventory_movements_total = Counter(
    'business_inventory_movements_total',
    'Total inventory movements',
    ['movement_type']  # adjustment, transfer, allocation
)

business_customer_satisfaction_score = Gauge(
    'business_customer_satisfaction_score',
    'Customer satisfaction score (0-5)'
)

# ============================================
# AI Agent Metrics
# ============================================

agent_decisions_total = Counter(
    'agent_decisions_total',
    'Total AI agent decisions',
    ['agent_name', 'decision_type']
)

agent_decisions_auto_executed_total = Counter(
    'agent_decisions_auto_executed_total',
    'Total auto-executed agent decisions',
    ['agent_name']
)

agent_decisions_overridden_total = Counter(
    'agent_decisions_overridden_total',
    'Total human-overridden agent decisions',
    ['agent_name']
)

agent_decisions_successful_total = Counter(
    'agent_decisions_successful_total',
    'Total successful agent decisions',
    ['agent_name']
)

agent_decision_duration_seconds = Histogram(
    'agent_decision_duration_seconds',
    'AI agent decision latency',
    ['agent_name']
)

agent_decision_confidence = Gauge(
    'agent_decision_confidence',
    'AI agent decision confidence score',
    ['agent_name']
)

# ============================================
# Prometheus Middleware
# ============================================

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP metrics for Prometheus."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics endpoint itself
        if request.url.path == "/metrics":
            return await call_next(request)

        # Get route path template (e.g., /api/products/{id} instead of /api/products/123)
        route_path = request.url.path
        for route in request.app.routes:
            match, _ = route.matches(request.scope)
            if match == Match.FULL:
                route_path = route.path
                break

        method = request.method

        # Increment in-progress gauge
        http_requests_in_progress.labels(method=method, path=route_path).inc()

        # Record start time
        start_time = time.time()

        try:
            # Process request
            response = await call_next(request)
            status = response.status_code
        except Exception as e:
            # Record error
            status = 500
            raise
        finally:
            # Record metrics
            duration = time.time() - start_time

            # Decrement in-progress gauge
            http_requests_in_progress.labels(method=method, path=route_path).dec()

            # Increment request counter
            http_requests_total.labels(
                method=method,
                path=route_path,
                status=status
            ).inc()

            # Record request duration
            http_request_duration_seconds.labels(
                method=method,
                path=route_path
            ).observe(duration)

        return response


# ============================================
# Metrics Endpoint
# ============================================

async def metrics_endpoint(request: Request):
    """Expose Prometheus metrics."""
    from starlette.responses import Response

    # Generate Prometheus metrics
    metrics_output = generate_latest()

    return Response(
        content=metrics_output,
        media_type=CONTENT_TYPE_LATEST
    )


# ============================================
# Helper Functions for Recording Metrics
# ============================================

def record_db_query(query_type: str, duration: float):
    """Record database query metrics."""
    db_query_duration_seconds.labels(query_type=query_type).observe(duration)


def record_redis_command(command: str, duration: float):
    """Record Redis command metrics."""
    redis_commands_total.labels(command=command).inc()
    redis_command_duration_seconds.labels(command=command).observe(duration)


def record_celery_task(task_name: str, status: str, duration: float = None):
    """Record Celery task metrics."""
    celery_tasks_total.labels(task_name=task_name, status=status).inc()
    if duration is not None:
        celery_task_duration_seconds.labels(task_name=task_name).observe(duration)


def record_websocket_event(event: str, direction: str = None):
    """Record WebSocket metrics."""
    if event in ['connect', 'disconnect']:
        websocket_connections_total.labels(event=event).inc()
        if event == 'connect':
            websocket_connections_active.inc()
        elif event == 'disconnect':
            websocket_connections_active.dec()
    elif direction:
        websocket_messages_total.labels(direction=direction).inc()


def record_business_metric(metric_type: str, value: float = 1, **labels):
    """Record business metrics."""
    metric_map = {
        'order_created': business_orders_created_total,
        'order_fulfilled': business_orders_fulfilled_total,
        'quote_created': business_quotes_created_total,
        'quote_converted': business_quotes_converted_total,
        'backorder_created': business_backorders_created_total,
        'backorder_fulfilled': business_backorders_fulfilled_total,
    }

    if metric_type in metric_map:
        if labels:
            metric_map[metric_type].labels(**labels).inc(value)
        else:
            metric_map[metric_type].inc(value)
    elif metric_type == 'revenue':
        currency = labels.get('currency', 'USD')
        business_revenue_total.labels(currency=currency).inc(value)
    elif metric_type == 'inventory_movement':
        movement_type = labels.get('movement_type', 'unknown')
        business_inventory_movements_total.labels(movement_type=movement_type).inc(value)
    elif metric_type == 'satisfaction_score':
        business_customer_satisfaction_score.set(value)


def record_agent_decision(
    agent_name: str,
    decision_type: str,
    duration: float,
    confidence: float,
    auto_executed: bool = False,
    overridden: bool = False,
    successful: bool = True
):
    """Record AI agent decision metrics."""
    agent_decisions_total.labels(
        agent_name=agent_name,
        decision_type=decision_type
    ).inc()

    agent_decision_duration_seconds.labels(agent_name=agent_name).observe(duration)
    agent_decision_confidence.labels(agent_name=agent_name).set(confidence)

    if auto_executed:
        agent_decisions_auto_executed_total.labels(agent_name=agent_name).inc()

    if overridden:
        agent_decisions_overridden_total.labels(agent_name=agent_name).inc()

    if successful:
        agent_decisions_successful_total.labels(agent_name=agent_name).inc()
