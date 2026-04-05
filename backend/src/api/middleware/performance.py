"""API performance tracking middleware."""

import time
from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)


class PerformanceMetrics:
    """Store and calculate API performance metrics."""

    def __init__(self, retention_hours: int = 1) -> None:
        """
        Initialize performance metrics storage.

        Args:
            retention_hours: How many hours of metrics to retain
        """
        self.retention_hours = retention_hours
        self._metrics: dict[str, list[dict]] = defaultdict(list)

    def record_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
    ) -> None:
        """
        Record a request metric.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: Request path
            status_code: HTTP status code
            duration_ms: Request duration in milliseconds
        """
        endpoint_key = f"{method} {path}"
        self._metrics[endpoint_key].append(
            {
                "timestamp": datetime.now(UTC),
                "status_code": status_code,
                "duration_ms": duration_ms,
            }
        )

        # Clean up old metrics
        self._cleanup_old_metrics(endpoint_key)

    def _cleanup_old_metrics(self, endpoint_key: str) -> None:
        """
        Remove metrics older than retention period.

        Args:
            endpoint_key: Endpoint identifier
        """
        cutoff = datetime.now(UTC) - timedelta(hours=self.retention_hours)
        self._metrics[endpoint_key] = [
            m for m in self._metrics[endpoint_key] if m["timestamp"] > cutoff
        ]

    def get_endpoint_stats(self, method: str, path: str) -> dict:
        """
        Get statistics for a specific endpoint.

        Args:
            method: HTTP method
            path: Request path

        Returns:
            Dictionary with endpoint statistics
        """
        endpoint_key = f"{method} {path}"
        metrics = self._metrics.get(endpoint_key, [])

        if not metrics:
            return {
                "endpoint": endpoint_key,
                "request_count": 0,
                "error_count": 0,
                "error_rate": 0.0,
                "avg_response_time_ms": 0.0,
                "p50_response_time_ms": 0.0,
                "p95_response_time_ms": 0.0,
                "p99_response_time_ms": 0.0,
            }

        durations = [m["duration_ms"] for m in metrics]
        durations.sort()

        error_count = sum(1 for m in metrics if m["status_code"] >= 400)
        total_count = len(metrics)

        return {
            "endpoint": endpoint_key,
            "request_count": total_count,
            "error_count": error_count,
            "error_rate": round((error_count / total_count) * 100, 2) if total_count > 0 else 0.0,
            "avg_response_time_ms": round(sum(durations) / len(durations), 2) if durations else 0.0,
            "p50_response_time_ms": self._percentile(durations, 0.50),
            "p95_response_time_ms": self._percentile(durations, 0.95),
            "p99_response_time_ms": self._percentile(durations, 0.99),
        }

    def get_all_endpoints(self) -> list[dict]:
        """
        Get statistics for all tracked endpoints.

        Returns:
            List of endpoint statistics
        """
        stats = []
        for endpoint_key in self._metrics.keys():
            method, path = endpoint_key.split(" ", 1)
            stats.append(self.get_endpoint_stats(method, path))

        # Sort by request count (descending)
        stats.sort(key=lambda x: x["request_count"], reverse=True)
        return stats

    def get_slowest_endpoints(self, limit: int = 10) -> list[dict]:
        """
        Get the slowest endpoints by p95 response time.

        Args:
            limit: Number of endpoints to return

        Returns:
            List of slowest endpoints
        """
        all_stats = self.get_all_endpoints()
        all_stats.sort(key=lambda x: x["p95_response_time_ms"], reverse=True)
        return all_stats[:limit]

    def get_error_endpoints(self, min_error_rate: float = 1.0) -> list[dict]:
        """
        Get endpoints with error rates above threshold.

        Args:
            min_error_rate: Minimum error rate percentage to include

        Returns:
            List of endpoints with high error rates
        """
        all_stats = self.get_all_endpoints()
        return [s for s in all_stats if s["error_rate"] >= min_error_rate]

    def get_overall_stats(self) -> dict:
        """
        Get overall API statistics.

        Returns:
            Dictionary with overall statistics
        """
        all_endpoints = self.get_all_endpoints()

        if not all_endpoints:
            return {
                "total_requests": 0,
                "total_errors": 0,
                "overall_error_rate": 0.0,
                "avg_response_time_ms": 0.0,
                "p95_response_time_ms": 0.0,
            }

        total_requests = sum(s["request_count"] for s in all_endpoints)
        total_errors = sum(s["error_count"] for s in all_endpoints)

        # Collect all durations for percentile calculation
        all_durations = []
        for metrics in self._metrics.values():
            all_durations.extend([m["duration_ms"] for m in metrics])

        all_durations.sort()

        return {
            "total_requests": total_requests,
            "total_errors": total_errors,
            "overall_error_rate": round((total_errors / total_requests) * 100, 2) if total_requests > 0 else 0.0,
            "avg_response_time_ms": round(sum(all_durations) / len(all_durations), 2) if all_durations else 0.0,
            "p95_response_time_ms": self._percentile(all_durations, 0.95),
            "unique_endpoints": len(all_endpoints),
        }

    @staticmethod
    def _percentile(sorted_values: list[float], percentile: float) -> float:
        """
        Calculate percentile from sorted values.

        Args:
            sorted_values: List of values (must be sorted)
            percentile: Percentile to calculate (0.0 to 1.0)

        Returns:
            Percentile value
        """
        if not sorted_values:
            return 0.0

        index = int(len(sorted_values) * percentile)
        if index >= len(sorted_values):
            index = len(sorted_values) - 1

        return round(sorted_values[index], 2)


class PerformanceMiddleware(BaseHTTPMiddleware):
    """Middleware to track API performance metrics."""

    def __init__(self, app, metrics: PerformanceMetrics | None = None) -> None:
        """
        Initialize performance middleware.

        Args:
            app: FastAPI application
            metrics: PerformanceMetrics instance (creates new if None)
        """
        super().__init__(app)
        self.metrics = metrics or PerformanceMetrics()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Track request/response performance.

        Args:
            request: HTTP request
            call_next: Next middleware/route handler

        Returns:
            HTTP response
        """
        # Skip performance tracking for health check and monitoring endpoints
        if request.url.path in ["/health", "/api/health"]:
            return await call_next(request)

        # Record start time
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Normalize path (remove UUIDs and IDs for better grouping)
        normalized_path = self._normalize_path(request.url.path)

        # Record metrics
        self.metrics.record_request(
            method=request.method,
            path=normalized_path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

        # Log slow requests
        if duration_ms > 2000:  # > 2 seconds
            logger.warning(
                "Slow request detected",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration_ms, 2),
                status_code=response.status_code,
            )

        return response

    @staticmethod
    def _normalize_path(path: str) -> str:
        """
        Normalize path by replacing UUIDs and numeric IDs with placeholders.

        Args:
            path: Original request path

        Returns:
            Normalized path
        """
        import re

        # Replace UUIDs
        path = re.sub(
            r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "/{id}",
            path,
            flags=re.IGNORECASE,
        )

        # Replace numeric IDs
        path = re.sub(r"/\d+", "/{id}", path)

        return path


# Global performance metrics instance
_performance_metrics: PerformanceMetrics | None = None


def get_performance_metrics() -> PerformanceMetrics:
    """
    Get the global performance metrics instance.

    Returns:
        The global PerformanceMetrics instance
    """
    global _performance_metrics
    if _performance_metrics is None:
        _performance_metrics = PerformanceMetrics()
        logger.info("Performance metrics initialized")
    return _performance_metrics
