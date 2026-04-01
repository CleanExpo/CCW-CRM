"""Alert management API endpoints for monitoring."""

from datetime import datetime, timedelta

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.pos_models import POSTransaction
from src.services.alert_manager import get_alert_manager
from src.services.sse_service import sse_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/monitoring/alerts", tags=["Monitoring - Alerts"])


# Request/Response Models
class AlertCreate(BaseModel):
    """Request model for creating an alert."""

    alert_type: str = Field(description="Type of alert")
    severity: str = Field(description="Severity level: info, warning, error, critical")
    title: str = Field(description="Alert title")
    message: str = Field(description="Alert message")
    metadata: dict | None = Field(default=None, description="Additional metadata")
    send_notification: bool = Field(default=True, description="Send email/Slack notification")


class AlertResponse(BaseModel):
    """Response model for alert."""

    id: int
    type: str
    severity: str
    title: str
    message: str
    metadata: dict
    created_at: str
    acknowledged: bool
    resolved: bool


class AlertListResponse(BaseModel):
    """Response model for alert list."""

    alerts: list[dict]
    total: int


@router.post("", response_model=dict)
async def create_alert(alert_data: AlertCreate) -> dict:
    """
    Create a new system alert.

    Args:
        alert_data: Alert creation data

    Returns:
        Created alert
    """
    try:
        alert_manager = get_alert_manager()

        alert = await alert_manager.create_alert(
            alert_type=alert_data.alert_type,
            severity=alert_data.severity,
            title=alert_data.title,
            message=alert_data.message,
            metadata=alert_data.metadata,
            send_notification=alert_data.send_notification,
        )

        logger.info("Alert created via API", alert_id=alert.get("id"))

        return alert

    except Exception as e:
        logger.error("Failed to create alert", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create alert: {str(e)}") from e


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    alert_type: str | None = Query(None, description="Filter by alert type"),
    severity: str | None = Query(None, description="Filter by severity"),
    acknowledged: bool | None = Query(None, description="Filter by acknowledged status"),
) -> AlertListResponse:
    """
    List all alerts with optional filtering.

    Args:
        alert_type: Filter by alert type
        severity: Filter by severity
        acknowledged: Filter by acknowledged status

    Returns:
        List of alerts
    """
    try:
        alert_manager = get_alert_manager()

        alerts = await alert_manager.get_alerts(
            alert_type=alert_type,
            severity=severity,
            acknowledged=acknowledged,
        )

        logger.info("Alerts listed", count=len(alerts))

        return AlertListResponse(alerts=alerts, total=len(alerts))

    except Exception as e:
        logger.error("Failed to list alerts", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list alerts: {str(e)}") from e


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int) -> dict:
    """
    Acknowledge an alert.

    Args:
        alert_id: Alert ID

    Returns:
        Success status
    """
    try:
        alert_manager = get_alert_manager()

        success = await alert_manager.acknowledge_alert(alert_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

        logger.info("Alert acknowledged", alert_id=alert_id)

        return {"success": True, "alert_id": alert_id, "message": "Alert acknowledged"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to acknowledge alert", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to acknowledge alert: {str(e)}") from e


@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: int) -> dict:
    """
    Resolve an alert.

    Args:
        alert_id: Alert ID

    Returns:
        Success status
    """
    try:
        alert_manager = get_alert_manager()

        success = await alert_manager.resolve_alert(alert_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

        logger.info("Alert resolved", alert_id=alert_id)

        return {"success": True, "alert_id": alert_id, "message": "Alert resolved"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to resolve alert", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}") from e


@router.delete("/clear-old")
async def clear_old_alerts(days: int = Query(30, ge=1, le=365)) -> dict:
    """
    Clear alerts older than specified days.

    Args:
        days: Number of days to keep (1-365)

    Returns:
        Number of alerts cleared
    """
    try:
        alert_manager = get_alert_manager()

        cleared_count = await alert_manager.clear_old_alerts(days=days)

        logger.info("Old alerts cleared", count=cleared_count, days=days)

        return {
            "success": True,
            "cleared_count": cleared_count,
            "days": days,
        }

    except Exception as e:
        logger.error("Failed to clear old alerts", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to clear old alerts: {str(e)}") from e


# PHASE 4: POS Failure Alerts
class POSFailureAlert(BaseModel):
    """POS failure alert data."""
    transaction_id: str
    transaction_number: str
    terminal_id: str | None
    location_code: str
    amount: float
    payment_method: str
    payment_status: str
    created_at: str
    time_ago: str


@router.get("/pos-failures")
async def get_pos_failures(
    db: AsyncSession = Depends(get_async_db),
    hours: int = Query(24, ge=1, le=168, description="Hours to look back (1-168)"),
) -> dict:
    """
    PHASE 4: Get POS transaction failures from the last N hours.

    Monitors payment_status='failed' transactions to catch payment processing issues,
    terminal failures, and network problems quickly.

    Args:
        hours: Hours to look back (default: 24, max: 168/1 week)

    Returns:
        List of failed transactions with alert count
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        # Query failed POS transactions
        query = (
            select(POSTransaction)
            .where(POSTransaction.payment_status == "failed")
            .where(POSTransaction.created_at >= cutoff_time)
            .order_by(POSTransaction.created_at.desc())
        )

        result = await db.execute(query)
        failed_transactions = result.scalars().all()

        # Format response
        failures = []
        for txn in failed_transactions:
            time_diff = datetime.utcnow() - txn.created_at
            hours_ago = int(time_diff.total_seconds() / 3600)
            minutes_ago = int((time_diff.total_seconds() % 3600) / 60)

            if hours_ago > 0:
                time_ago = f"{hours_ago}h ago"
            else:
                time_ago = f"{minutes_ago}m ago"

            failures.append({
                "transaction_id": str(txn.id),
                "transaction_number": txn.transaction_number,
                "terminal_id": str(txn.terminal_id) if txn.terminal_id else None,
                "location_code": txn.location_code,
                "amount": float(txn.amount),
                "payment_method": txn.payment_method,
                "payment_status": txn.payment_status,
                "created_at": txn.created_at.isoformat(),
                "time_ago": time_ago,
            })

        return {
            "success": True,
            "alert_count": len(failures),
            "failures": failures,
            "period_hours": hours,
        }

    except Exception as e:
        logger.error("Failed to get POS failures", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get POS failures: {str(e)}") from e


@router.get("/pos-failures/stream")
async def pos_failures_stream(request: Request):
    """
    PHASE 4: Real-time POS failure alerts via SSE.

    Frontend subscribes to receive instant notifications when POS payments fail.
    Allows proactive response to payment processing issues.

    Channel: "pos-failures"
    Events: failure_detected
    """
    return await sse_service.subscribe(request, "pos-failures", heartbeat_interval=30)
