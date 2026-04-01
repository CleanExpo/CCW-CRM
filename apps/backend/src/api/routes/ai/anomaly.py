"""Anomaly Detection API endpoints."""
from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.ai.agents.specialized import AnomalyDetectionAgent

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/anomaly", tags=["AI Anomaly Detection"])


# Request/Response Models
class AnomalyDetectionRequest(BaseModel):
    """Request for anomaly detection."""

    detection_type: str = Field(
        description="Type: order_amount, inventory, pricing, pos_failures"
    )
    order_id: str | None = Field(
        default=None,
        description="Order UUID (for order_amount detection)"
    )
    customer_id: str | None = Field(
        default=None,
        description="Customer UUID (for order_amount detection)"
    )
    amount: float | None = Field(
        default=None,
        description="Order amount (for order_amount detection)"
    )
    product_id: str | None = Field(
        default=None,
        description="Product UUID (for inventory/pricing detection)"
    )
    location: str | None = Field(
        default=None,
        description="Location code (for inventory/POS detection)"
    )
    terminal_id: str | None = Field(
        default=None,
        description="Terminal UUID (for POS detection)"
    )
    time_window_minutes: int | None = Field(
        default=10,
        ge=1,
        le=1440,
        description="Time window in minutes (for POS detection)"
    )


class AnomalyDetectionResponse(BaseModel):
    """Response from anomaly detection."""

    is_anomaly: bool = Field(
        description="Whether anomaly was detected"
    )
    severity: str = Field(
        description="Severity: low, medium, high, critical"
    )
    description: str = Field(
        description="Human-readable anomaly description"
    )
    recommended_action: str = Field(
        description="Recommended action to take"
    )
    confidence: float = Field(
        description="Confidence score (0-1)"
    )
    details: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context and statistics"
    )
    error: str | None = Field(
        default=None,
        description="Error message if detection failed"
    )


# Singleton agent instance
_anomaly_agent: AnomalyDetectionAgent | None = None


def get_anomaly_agent() -> AnomalyDetectionAgent:
    """Get or create anomaly detection agent singleton."""
    global _anomaly_agent
    if _anomaly_agent is None:
        _anomaly_agent = AnomalyDetectionAgent()
        logger.info("Anomaly detection agent initialized for API")
    return _anomaly_agent


@router.post("", response_model=AnomalyDetectionResponse)
async def detect_anomaly(
    request: AnomalyDetectionRequest,
) -> AnomalyDetectionResponse:
    """
    Detect anomalies in business data using statistical analysis.

    Supported detection types:

    **order_amount**: Detect unusual order amounts for customer
    - Requires: order_id OR (customer_id + amount)
    - Uses z-score analysis on customer's order history
    - Flags orders >3 standard deviations from mean

    **inventory**: Detect unexplained stock changes
    - Requires: product_id, optional location
    - Analyzes stock movements in last 24 hours
    - Flags large unexplained drops (>100 units)

    **pricing**: Detect pricing errors
    - Requires: product_id
    - Checks margin: flags if <0% (below cost) or >200%
    - Critical severity if selling below cost

    **pos_failures**: Detect POS payment failure spikes
    - Optional: location, terminal_id, time_window_minutes
    - Detects 5+ failures in 10 min or 10+ in 1 hour
    - Critical severity for system-wide issues

    Example Request (Order Amount):
    ```json
    {
      "detection_type": "order_amount",
      "order_id": "123e4567-e89b-12d3-a456-426614174000"
    }
    ```

    Example Response:
    ```json
    {
      "is_anomaly": true,
      "severity": "high",
      "description": "Order amount $50,000 is 10.2× standard deviations higher than customer average $500 (100× typical amount)",
      "recommended_action": "Verify with customer before processing - potential fraud or data entry error",
      "confidence": 0.92,
      "details": {
        "current_amount": 50000,
        "mean_amount": 500,
        "std_dev": 4850,
        "z_score": 10.2,
        "historical_orders": 10,
        "multiplier": 100
      }
    }
    ```
    """
    logger.info(
        "Anomaly detection requested",
        detection_type=request.detection_type,
        has_order_id=request.order_id is not None,
        has_product_id=request.product_id is not None,
    )

    try:
        # Build context from request
        context = {
            "detection_type": request.detection_type,
        }

        if request.order_id:
            context["order_id"] = request.order_id
        if request.customer_id:
            context["customer_id"] = request.customer_id
        if request.amount is not None:
            context["amount"] = request.amount
        if request.product_id:
            context["product_id"] = request.product_id
        if request.location:
            context["location"] = request.location
        if request.terminal_id:
            context["terminal_id"] = request.terminal_id
        if request.time_window_minutes:
            context["time_window_minutes"] = request.time_window_minutes

        # Execute agent
        agent = get_anomaly_agent()
        result = await agent.execute(
            task=f"Detect anomaly in {request.detection_type}",
            context=context
        )

        # Check for errors
        if result.get("error"):
            error_msg = result["error"]
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            if "invalid" in error_msg.lower() or "required" in error_msg.lower():
                raise HTTPException(status_code=400, detail=error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        logger.info(
            "Anomaly detection completed",
            detection_type=request.detection_type,
            is_anomaly=result.get("is_anomaly"),
            severity=result.get("severity"),
            confidence=result.get("confidence"),
        )

        return AnomalyDetectionResponse(
            is_anomaly=result.get("is_anomaly", False),
            severity=result.get("severity", "low"),
            description=result.get("description", ""),
            recommended_action=result.get("recommended_action", ""),
            confidence=result.get("confidence", 0.0),
            details=result.get("details", {}),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Anomaly detection failed",
            detection_type=request.detection_type,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Anomaly detection failed: {str(e)}",
        ) from e
