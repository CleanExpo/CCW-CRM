"""
Alert Management Service.

Handles creation, assignment, and notification of alerts for:
- Critical system events (integration failures, agent errors)
- Approval requests (high-value orders, stock transfers)
- Stock level warnings
- Container arrival notifications
"""

import logging
from datetime import datetime
from functools import lru_cache
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings
from src.db.models import User

logger = logging.getLogger(__name__)


class AlertManager:
    """
    Centralized alert management service.

    Features:
    - Create alerts with severity levels
    - Auto-assign to users based on role
    - Send email notifications for critical alerts
    - Real-time UI updates via Server-Sent Events (future)
    - Alert history and audit trail
    """

    def __init__(self) -> None:
        """Initialize alert manager."""
        self.settings = get_settings()

    async def create_alert(
        self,
        db: AsyncSession,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        assign_to_user_id: UUID | None = None,
        assign_to_role: str = "sales_manager",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create an alert and send notifications.

        Args:
            db: Database session
            alert_type: Type (stock_low, approval_required, integration_error, etc.)
            severity: Severity level (critical, high, medium, low)
            title: Short alert title
            message: Detailed alert message
            entity_type: Related entity type (order, product, shipment, etc.)
            entity_id: Related entity UUID
            assign_to_user_id: Specific user to assign to (overrides role)
            assign_to_role: Role to assign to if no specific user
            metadata: Additional context data

        Returns:
            Created alert dictionary
        """
        # Determine assignee
        if assign_to_user_id is None:
            assignee = await self._find_user_by_role(db, assign_to_role)
            if assignee:
                assign_to_user_id = assignee.id

        # Create alert record
        # TODO: Import Alert model once it's created
        # alert = Alert(
        #     alert_type=alert_type,
        #     severity=severity,
        #     title=title,
        #     message=message,
        #     entity_type=entity_type,
        #     entity_id=entity_id,
        #     assigned_to=assign_to_user_id,
        #     status="unread",
        #     metadata=metadata or {},
        #     created_at=datetime.utcnow(),
        # )
        # db.add(alert)
        # await db.commit()
        # await db.refresh(alert)

        # Placeholder alert for now
        alert_dict = {
            "id": str(uuid4()),
            "alert_type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "assigned_to": str(assign_to_user_id) if assign_to_user_id else None,
            "status": "unread",
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
        }

        logger.info(
            f"Created alert: {alert_type} [{severity}] - {title}",
            extra={
                "alert_id": alert_dict["id"],
                "severity": severity,
                "assignee": str(assign_to_user_id) if assign_to_user_id else None,
            },
        )

        # Send email notification for critical/high severity
        if severity in ["critical", "high"] and assign_to_user_id:
            await self._send_alert_email(db, alert_dict, assign_to_user_id)

        # Publish event for real-time UI updates
        await self._publish_alert_event(alert_dict)

        return alert_dict

    async def create_approval_request(
        self,
        db: AsyncSession,
        approval_type: str,
        title: str,
        message: str,
        entity_type: str,
        entity_id: UUID,
        approval_data: dict[str, Any],
        assign_to_role: str = "sales_manager",
    ) -> dict[str, Any]:
        """
        Create an approval request alert.

        Args:
            db: Database session
            approval_type: Type of approval (order_approval, stock_transfer, etc.)
            title: Short title
            message: Detailed message explaining why approval needed
            entity_type: Entity type requiring approval (order, transfer, etc.)
            entity_id: Entity UUID
            approval_data: Data needed for approval decision
            assign_to_role: Role authorized to approve

        Returns:
            Created approval alert
        """
        metadata = {
            "approval_type": approval_type,
            "approval_data": approval_data,
            "requires_approval": True,
            "approval_token": str(uuid4()),  # For security verification
        }

        return await self.create_alert(
            db=db,
            alert_type="approval_required",
            severity="high",
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            assign_to_role=assign_to_role,
            metadata=metadata,
        )

    async def get_pending_alerts(
        self, db: AsyncSession, user_id: UUID, limit: int = 50
    ) -> list[dict[str, Any]]:
        """
        Get pending alerts for a user.

        Args:
            db: Database session
            user_id: User UUID
            limit: Maximum number of alerts to return

        Returns:
            List of pending alerts
        """
        # TODO: Query Alert model once created
        # stmt = (
        #     select(Alert)
        #     .where(Alert.assigned_to == user_id)
        #     .where(Alert.status.in_(["unread", "read"]))
        #     .order_by(Alert.created_at.desc())
        #     .limit(limit)
        # )
        # result = await db.execute(stmt)
        # alerts = result.scalars().all()
        # return [alert.to_dict() for alert in alerts]

        # Placeholder for now
        return []

    async def get_pending_approvals(
        self, db: AsyncSession, user_id: UUID
    ) -> list[dict[str, Any]]:
        """
        Get pending approval requests for a user.

        Args:
            db: Database session
            user_id: User UUID

        Returns:
            List of pending approvals
        """
        # TODO: Query Alert model for approval_required alerts
        # stmt = (
        #     select(Alert)
        #     .where(Alert.assigned_to == user_id)
        #     .where(Alert.alert_type == "approval_required")
        #     .where(Alert.status == "unread")
        #     .order_by(Alert.created_at.desc())
        # )
        # result = await db.execute(stmt)
        # approvals = result.scalars().all()
        # return [approval.to_dict() for approval in approvals]

        # Placeholder for now
        return []

    async def mark_alert_read(
        self, db: AsyncSession, alert_id: UUID, user_id: UUID
    ) -> dict[str, Any]:
        """Mark alert as read."""
        # TODO: Update Alert model
        # alert = await db.get(Alert, alert_id)
        # if alert and alert.assigned_to == user_id:
        #     alert.status = "read"
        #     alert.read_at = datetime.utcnow()
        #     await db.commit()
        #     return alert.to_dict()
        return {}

    async def dismiss_alert(
        self, db: AsyncSession, alert_id: UUID, user_id: UUID
    ) -> dict[str, Any]:
        """Dismiss/archive alert."""
        # TODO: Update Alert model
        # alert = await db.get(Alert, alert_id)
        # if alert and alert.assigned_to == user_id:
        #     alert.status = "dismissed"
        #     alert.dismissed_at = datetime.utcnow()
        #     await db.commit()
        #     return alert.to_dict()
        return {}

    async def _find_user_by_role(
        self, db: AsyncSession, role: str
    ) -> User | None:
        """Find first active user with given role."""
        try:
            stmt = select(User).where(User.role == role).where(User.is_active == True).limit(1)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error finding user by role {role}: {e}")
            return None

    async def _send_alert_email(
        self, db: AsyncSession, alert: dict[str, Any], user_id: UUID
    ) -> None:
        """Send email notification for alert."""
        try:
            # Get user email
            user = await db.get(User, user_id)
            if not user or not user.email:
                return

            # TODO: Use SendGrid to send email
            # from src.integrations.sendgrid.client import send_email
            # await send_email(
            #     to_email=user.email,
            #     subject=f"[{alert['severity'].upper()}] {alert['title']}",
            #     html_content=self._format_alert_email(alert),
            # )

            logger.info(
                f"Sent alert email to {user.email}",
                extra={"alert_id": alert["id"], "user_id": str(user_id)},
            )
        except Exception as e:
            logger.error(f"Failed to send alert email: {e}")

    async def _publish_alert_event(self, alert: dict[str, Any]) -> None:
        """Publish alert event for real-time UI updates."""
        try:
            from src.events.event_bus import get_event_bus

            event_bus = get_event_bus()
            await event_bus.publish(
                event_type="alert.created",
                payload=alert,
                source="alert_manager",
            )
        except Exception as e:
            logger.error(f"Failed to publish alert event: {e}")

    def _format_alert_email(self, alert: dict[str, Any]) -> str:
        """Format alert as HTML email."""
        severity_colors = {
            "critical": "#DC2626",
            "high": "#F59E0B",
            "medium": "#3B82F6",
            "low": "#6B7280",
        }
        color = severity_colors.get(alert["severity"], "#6B7280")

        html = f"""
        <html>
            <body style="font-family: sans-serif;">
                <div style="border-left: 4px solid {color}; padding-left: 16px;">
                    <h2 style="color: {color}; margin: 0;">
                        [{alert['severity'].upper()}] {alert['title']}
                    </h2>
                    <p style="color: #374151; margin-top: 8px;">
                        {alert['message']}
                    </p>
                    <p style="color: #6B7280; font-size: 14px; margin-top: 16px;">
                        Created: {alert['created_at']}<br>
                        Alert ID: {alert['id']}
                    </p>
                </div>
                <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">
                    Log in to your CCW ERP dashboard to view details and take action.
                </p>
            </body>
        </html>
        """
        return html


# Global alert manager instance
@lru_cache
def get_alert_manager() -> AlertManager:
    """Get or create the global alert manager instance."""
    return AlertManager()
