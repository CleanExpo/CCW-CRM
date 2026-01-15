"""
Prometheus Metrics Collection.

Tracks key metrics for:
- Integration health (request counts, durations, errors)
- Agent execution (counts, durations, success rates)
- Event bus (events published/processed)
- Cache performance (hit/miss rates)
- Database connections
"""

import logging
from functools import lru_cache
from typing import Any

from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

logger = logging.getLogger(__name__)


class MetricsCollector:
    """
    Centralized metrics collection using Prometheus.

    Exposes metrics at /metrics endpoint for scraping by Prometheus.
    """

    def __init__(self) -> None:
        """Initialize Prometheus metrics."""
        # Integration Metrics
        self.integration_requests_total = Counter(
            "integration_requests_total",
            "Total number of integration API requests",
            ["integration", "endpoint", "status"],
        )

        self.integration_request_duration = Histogram(
            "integration_request_duration_seconds",
            "Integration API request duration in seconds",
            ["integration", "endpoint"],
            buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0),
        )

        self.integration_errors_total = Counter(
            "integration_errors_total",
            "Total number of integration errors",
            ["integration", "error_type"],
        )

        self.integration_circuit_breaker_state = Gauge(
            "integration_circuit_breaker_state",
            "Circuit breaker state (0=closed, 1=open, 2=half_open)",
            ["integration"],
        )

        # Sync Operation Metrics
        self.sync_operations_total = Counter(
            "sync_operations_total",
            "Total number of sync operations",
            ["source", "destination", "status"],
        )

        self.sync_operation_duration = Histogram(
            "sync_operation_duration_seconds",
            "Sync operation duration in seconds",
            ["source", "destination"],
            buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
        )

        self.sync_records_processed = Counter(
            "sync_records_processed_total",
            "Total number of records processed in sync operations",
            ["source", "destination", "record_type"],
        )

        # Agent Execution Metrics
        self.agent_executions_total = Counter(
            "agent_executions_total",
            "Total number of agent executions",
            ["agent_name", "status"],
        )

        self.agent_execution_duration = Histogram(
            "agent_execution_duration_seconds",
            "Agent execution duration in seconds",
            ["agent_name"],
            buckets=(0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0),
        )

        self.agent_tasks_completed = Counter(
            "agent_tasks_completed_total",
            "Total number of tasks completed by agents",
            ["agent_name", "task_type"],
        )

        self.agent_approvals_required = Counter(
            "agent_approvals_required_total",
            "Total number of agent actions requiring approval",
            ["agent_name", "approval_type"],
        )

        # Event Bus Metrics
        self.events_published_total = Counter(
            "events_published_total",
            "Total number of events published",
            ["event_type", "source"],
        )

        self.events_processed_total = Counter(
            "events_processed_total",
            "Total number of events processed",
            ["event_type", "handler"],
        )

        self.event_processing_duration = Histogram(
            "event_processing_duration_seconds",
            "Event processing duration in seconds",
            ["event_type", "handler"],
            buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.0),
        )

        self.event_processing_errors = Counter(
            "event_processing_errors_total",
            "Total number of event processing errors",
            ["event_type", "handler", "error_type"],
        )

        # Cache Metrics
        self.cache_hits_total = Counter(
            "cache_hits_total",
            "Total number of cache hits",
            ["data_type"],
        )

        self.cache_misses_total = Counter(
            "cache_misses_total",
            "Total number of cache misses",
            ["data_type"],
        )

        self.cache_operations_duration = Histogram(
            "cache_operations_duration_seconds",
            "Cache operation duration in seconds",
            ["operation", "data_type"],
            buckets=(0.001, 0.005, 0.01, 0.05, 0.1, 0.5),
        )

        # Database Metrics
        self.db_connections_active = Gauge(
            "db_connections_active",
            "Number of active database connections",
        )

        self.db_connections_idle = Gauge(
            "db_connections_idle",
            "Number of idle database connections",
        )

        self.db_query_duration = Histogram(
            "db_query_duration_seconds",
            "Database query duration in seconds",
            ["operation", "table"],
            buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0),
        )

        # Alert Metrics
        self.alerts_created_total = Counter(
            "alerts_created_total",
            "Total number of alerts created",
            ["alert_type", "severity"],
        )

        self.alerts_pending = Gauge(
            "alerts_pending",
            "Number of pending alerts by severity",
            ["severity"],
        )

        # Background Job Metrics
        self.celery_tasks_total = Counter(
            "celery_tasks_total",
            "Total number of Celery tasks",
            ["task_name", "status"],
        )

        self.celery_task_duration = Histogram(
            "celery_task_duration_seconds",
            "Celery task duration in seconds",
            ["task_name"],
            buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0),
        )

        logger.info("Prometheus metrics collector initialized")

    def record_integration_request(
        self,
        integration: str,
        endpoint: str,
        status: str,
        duration: float,
    ) -> None:
        """Record an integration API request."""
        self.integration_requests_total.labels(
            integration=integration,
            endpoint=endpoint,
            status=status,
        ).inc()
        self.integration_request_duration.labels(
            integration=integration,
            endpoint=endpoint,
        ).observe(duration)

    def record_integration_error(
        self,
        integration: str,
        error_type: str,
    ) -> None:
        """Record an integration error."""
        self.integration_errors_total.labels(
            integration=integration,
            error_type=error_type,
        ).inc()

    def set_circuit_breaker_state(
        self,
        integration: str,
        state: int,  # 0=closed, 1=open, 2=half_open
    ) -> None:
        """Set circuit breaker state."""
        self.integration_circuit_breaker_state.labels(
            integration=integration
        ).set(state)

    def record_sync_operation(
        self,
        source: str,
        destination: str,
        status: str,
        duration: float,
        records_count: int = 0,
        record_type: str = "unknown",
    ) -> None:
        """Record a sync operation."""
        self.sync_operations_total.labels(
            source=source,
            destination=destination,
            status=status,
        ).inc()
        self.sync_operation_duration.labels(
            source=source,
            destination=destination,
        ).observe(duration)
        if records_count > 0:
            self.sync_records_processed.labels(
                source=source,
                destination=destination,
                record_type=record_type,
            ).inc(records_count)

    def record_agent_execution(
        self,
        agent_name: str,
        status: str,
        duration: float,
    ) -> None:
        """Record an agent execution."""
        self.agent_executions_total.labels(
            agent_name=agent_name,
            status=status,
        ).inc()
        self.agent_execution_duration.labels(
            agent_name=agent_name
        ).observe(duration)

    def record_agent_task(
        self,
        agent_name: str,
        task_type: str,
    ) -> None:
        """Record a completed agent task."""
        self.agent_tasks_completed.labels(
            agent_name=agent_name,
            task_type=task_type,
        ).inc()

    def record_agent_approval(
        self,
        agent_name: str,
        approval_type: str,
    ) -> None:
        """Record an agent action requiring approval."""
        self.agent_approvals_required.labels(
            agent_name=agent_name,
            approval_type=approval_type,
        ).inc()

    def record_event_published(
        self,
        event_type: str,
        source: str,
    ) -> None:
        """Record an event published."""
        self.events_published_total.labels(
            event_type=event_type,
            source=source,
        ).inc()

    def record_event_processed(
        self,
        event_type: str,
        handler: str,
        duration: float,
    ) -> None:
        """Record an event processed."""
        self.events_processed_total.labels(
            event_type=event_type,
            handler=handler,
        ).inc()
        self.event_processing_duration.labels(
            event_type=event_type,
            handler=handler,
        ).observe(duration)

    def record_event_error(
        self,
        event_type: str,
        handler: str,
        error_type: str,
    ) -> None:
        """Record an event processing error."""
        self.event_processing_errors.labels(
            event_type=event_type,
            handler=handler,
            error_type=error_type,
        ).inc()

    def record_cache_hit(self, data_type: str) -> None:
        """Record a cache hit."""
        self.cache_hits_total.labels(data_type=data_type).inc()

    def record_cache_miss(self, data_type: str) -> None:
        """Record a cache miss."""
        self.cache_misses_total.labels(data_type=data_type).inc()

    def record_cache_operation(
        self,
        operation: str,
        data_type: str,
        duration: float,
    ) -> None:
        """Record a cache operation."""
        self.cache_operations_duration.labels(
            operation=operation,
            data_type=data_type,
        ).observe(duration)

    def set_db_connections(self, active: int, idle: int) -> None:
        """Set database connection counts."""
        self.db_connections_active.set(active)
        self.db_connections_idle.set(idle)

    def record_db_query(
        self,
        operation: str,
        table: str,
        duration: float,
    ) -> None:
        """Record a database query."""
        self.db_query_duration.labels(
            operation=operation,
            table=table,
        ).observe(duration)

    def record_alert_created(
        self,
        alert_type: str,
        severity: str,
    ) -> None:
        """Record an alert created."""
        self.alerts_created_total.labels(
            alert_type=alert_type,
            severity=severity,
        ).inc()

    def set_pending_alerts(self, severity: str, count: int) -> None:
        """Set pending alerts count for a severity level."""
        self.alerts_pending.labels(severity=severity).set(count)

    def record_celery_task(
        self,
        task_name: str,
        status: str,
        duration: float,
    ) -> None:
        """Record a Celery task execution."""
        self.celery_tasks_total.labels(
            task_name=task_name,
            status=status,
        ).inc()
        self.celery_task_duration.labels(
            task_name=task_name
        ).observe(duration)

    def generate_metrics(self) -> bytes:
        """Generate Prometheus metrics for /metrics endpoint."""
        return generate_latest()


# Global metrics collector instance
@lru_cache
def get_metrics_collector() -> MetricsCollector:
    """Get or create the global metrics collector instance."""
    return MetricsCollector()
