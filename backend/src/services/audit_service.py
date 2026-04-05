"""
Audit service for recording entity-level change events.

Usage:
    await audit_service.log(
        db=db,
        entity_type="order",
        entity_id=str(order.id),
        action="create",
        user=current_user,  # dict from get_current_user, or None
        changes={"status": {"old": None, "new": "draft"}},
    )
"""
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.audit_models import AuditLog

logger = structlog.get_logger(__name__)


class AuditService:
    """Service for recording audit trail events."""

    async def log(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: str,
        action: str,
        user: dict | None = None,
        changes: dict | None = None,
        metadata: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        notes: str | None = None,
    ) -> AuditLog:
        """
        Record an audit event.

        Args:
            db: Database session
            entity_type: Entity type (e.g. "order", "quote", "invoice")
            entity_id: Entity UUID as string
            action: Action performed ("create", "update", "delete", "status_change")
            user: User dict from get_current_user (has "id", "email")
            changes: Dict of {field: {old: ..., new: ...}}
            metadata: Additional context dict
            ip_address: Request IP address
            user_agent: Request User-Agent header
            notes: Human-readable notes

        Returns:
            Created AuditLog record
        """
        try:
            entry = AuditLog(
                user_id=user.get("id") if user else None,
                user_email=user.get("email") if user else None,
                entity_type=entity_type,
                entity_id=entity_id,
                action=action,
                changes=changes,
                metadata_=metadata or {},
                ip_address=ip_address,
                user_agent=user_agent,
                notes=notes,
            )
            db.add(entry)
            await db.flush()  # Get ID without full commit
            logger.info(
                "audit_event_recorded",
                entity_type=entity_type,
                entity_id=entity_id,
                action=action,
                user_email=entry.user_email,
            )
            return entry
        except Exception as e:
            # Audit failures must never block the main operation
            logger.error(
                "audit_log_failed",
                entity_type=entity_type,
                entity_id=entity_id,
                action=action,
                error=str(e),
            )
            raise


# Global singleton
audit_service = AuditService()
