"""SLA tracking and breach detection service."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.workflow_models import SLAInstance, SLARule

logger = structlog.get_logger(__name__)


class SLAService:
    """Service for creating SLA instances and detecting deadline breaches."""

    async def create_sla_instance(
        self,
        rule_id: str,
        entity_type: str,
        entity_id: str,
        db: AsyncSession,
    ) -> SLAInstance | None:
        """
        Create a new SLAInstance for an entity tied to an active SLARule.

        Returns None if the rule is not found or not active.
        """
        result = await db.execute(
            select(SLARule).where(
                SLARule.id == uuid.UUID(rule_id),
                SLARule.is_active == True,  # noqa: E712
            )
        )
        rule = result.scalar_one_or_none()
        if not rule:
            logger.warning(
                "sla_rule_not_found",
                rule_id=rule_id,
                entity_type=entity_type,
                entity_id=entity_id,
            )
            return None

        instance = SLAInstance(
            sla_rule_id=rule.id,
            entity_id=uuid.UUID(entity_id),
            entity_type=entity_type,
            deadline=datetime.now(UTC) + timedelta(hours=rule.sla_hours),
        )
        db.add(instance)
        await db.commit()
        await db.refresh(instance)
        logger.info(
            "sla_instance_created",
            instance_id=str(instance.id),
            rule_id=rule_id,
            entity_type=entity_type,
            entity_id=entity_id,
            deadline=instance.deadline.isoformat(),
        )
        return instance

    async def check_sla_breaches(self, db: AsyncSession) -> int:
        """
        Scan for unbreached SLAInstances whose deadline has passed.

        For each breached instance:
        - Marks breached=True
        - If breach_notified=False, fires "sla_breached" workflow trigger
          and marks breach_notified=True

        Returns count of newly breached instances.
        """
        now = datetime.now(UTC)
        result = await db.execute(
            select(SLAInstance).where(
                SLAInstance.deadline < now,
                SLAInstance.breached == False,  # noqa: E712
            )
        )
        instances = result.scalars().all()

        count = 0
        for instance in instances:
            instance.breached = True

            if not instance.breach_notified:
                instance.breach_notified = True
                try:
                    from src.services.workflow_service import get_workflow_service

                    wf = get_workflow_service()
                    await wf.evaluate_trigger(
                        event="sla_breached",
                        entity_type=instance.entity_type,
                        entity_id=str(instance.entity_id),
                        entity_data={"sla_rule_id": str(instance.sla_rule_id)},
                        db=db,
                    )
                    logger.info(
                        "sla_breach_escalated",
                        instance_id=str(instance.id),
                        entity_type=instance.entity_type,
                        entity_id=str(instance.entity_id),
                    )
                except Exception as e:
                    logger.warning(
                        "sla_escalation_failed",
                        instance_id=str(instance.id),
                        error=str(e),
                    )

            count += 1

        await db.commit()
        logger.info("sla_breach_check_complete", newly_breached=count)
        return count

    async def get_active_slas(
        self,
        entity_id: str,
        db: AsyncSession,
    ) -> list[SLAInstance]:
        """
        Return all non-breached SLA instances for a given entity.

        Useful for displaying active deadlines in the UI.
        """
        result = await db.execute(
            select(SLAInstance).where(
                SLAInstance.entity_id == uuid.UUID(entity_id),
                SLAInstance.breached == False,  # noqa: E712
            )
        )
        return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_sla_service: SLAService | None = None


def get_sla_service() -> SLAService:
    """Get or create the SLAService singleton."""
    global _sla_service
    if _sla_service is None:
        _sla_service = SLAService()
    return _sla_service
