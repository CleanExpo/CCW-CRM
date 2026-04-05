"""
Prometheus Metrics Endpoint.

Exposes application and business metrics in Prometheus format for scraping.
"""

import os

from fastapi import APIRouter, Header, HTTPException, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

router = APIRouter(tags=["Monitoring"])


def _verify_metrics_token(authorization: str | None) -> None:
    """Verify bearer token for /metrics endpoint. Skips check in dev (no token configured)."""
    metrics_token = os.getenv("METRICS_TOKEN")
    if not metrics_token:
        # Development mode — allow unauthenticated access
        return
    if authorization != f"Bearer {metrics_token}":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing metrics token",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get("/metrics")
async def metrics_endpoint(authorization: str | None = Header(None)) -> Response:
    """
    Prometheus metrics endpoint.

    Returns all registered metrics in Prometheus exposition format.
    This endpoint should be configured in your Prometheus scrape config:

    ```yaml
    scrape_configs:
      - job_name: 'ccw-erp-backend'
        static_configs:
          - targets: ['localhost:8000']
        metrics_path: '/metrics'
        scrape_interval: 15s
    ```

    **Response Format:** Prometheus text format
    **Authentication:** None (public endpoint for Prometheus scraper)

    **Metrics Exposed:**
    - Business metrics (orders, quotes, revenue, etc.)
    - System health (database, cache, API performance)
    - AI metrics (agent performance, token usage)
    - Autonomous development metrics (risk assessments, auto-merges, rollbacks)
    - Integration metrics (Xero, Shopify, payment processors)

    **Example Output:**
    ```
    # HELP orders_created_total Total number of orders created
    # TYPE orders_created_total counter
    orders_created_total{location="warehouse",status="confirmed"} 42.0

    # HELP risk_assessments_total Total risk assessments performed
    # TYPE risk_assessments_total counter
    risk_assessments_total{risk_level="LOW"} 15.0
    ```
    """
    _verify_metrics_token(authorization)

    # Generate latest metrics in Prometheus format
    metrics_data = generate_latest()

    return Response(
        content=metrics_data,
        media_type=CONTENT_TYPE_LATEST,
    )
