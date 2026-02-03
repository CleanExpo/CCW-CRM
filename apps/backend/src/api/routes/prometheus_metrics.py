"""
Prometheus Metrics Endpoint.

Exposes application and business metrics in Prometheus format for scraping.
"""

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

router = APIRouter(tags=["Monitoring"])


@router.get("/metrics")
async def metrics_endpoint() -> Response:
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
    # Generate latest metrics in Prometheus format
    metrics_data = generate_latest()

    return Response(
        content=metrics_data,
        media_type=CONTENT_TYPE_LATEST,
    )
