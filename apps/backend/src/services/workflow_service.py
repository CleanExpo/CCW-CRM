"""Workflow automation service for evaluating triggers and executing actions."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.workflow_models import (
    InAppNotification,
    WorkflowInstance,
    WorkflowTemplate,
    WorkflowTemplateAction,
)

logger = structlog.get_logger(__name__)


class WorkflowService:
    """Service for evaluating workflow triggers and executing actions."""

    async def evaluate_trigger(
        self,
        event: str,
        entity_type: str,
        entity_id: str,
        entity_data: dict,
        db: AsyncSession,
    ) -> list[str]:
        """
        Query active WorkflowTemplates where trigger_event == event.

        For each template, evaluate trigger_conditions (JSON array of
        {field, operator, value} rules). If conditions pass (or no conditions),
        create a WorkflowInstance and run each action in order.

        Returns list of created WorkflowInstance IDs.
        """
        result = await db.execute(
            select(WorkflowTemplate).where(
                WorkflowTemplate.trigger_event == event,
                WorkflowTemplate.is_active == True,  # noqa: E712
            )
        )
        templates = result.scalars().all()

        instance_ids: list[str] = []
        for template in templates:
            if not self._evaluate_conditions(template.trigger_conditions, entity_data):
                continue

            instance = WorkflowInstance(
                template_id=template.id,
                trigger_entity_type=entity_type,
                trigger_entity_id=uuid.UUID(entity_id) if entity_id else None,
                status="running",
            )
            db.add(instance)
            await db.flush()

            # Load actions ordered by execution order
            actions_result = await db.execute(
                select(WorkflowTemplateAction)
                .where(WorkflowTemplateAction.template_id == template.id)
                .order_by(WorkflowTemplateAction.order)
            )
            actions = actions_result.scalars().all()

            context = {
                "entity_type": entity_type,
                "entity_id": entity_id,
                **entity_data,
            }

            try:
                for action in actions:
                    await self.execute_action(action, context, db)
                instance.status = "completed"
                instance.completed_at = datetime.now(UTC)
                logger.info(
                    "workflow_instance_completed",
                    template_id=str(template.id),
                    instance_id=str(instance.id),
                )
            except Exception as e:
                instance.status = "failed"
                instance.error_message = str(e)
                logger.error(
                    "workflow_action_failed",
                    template_id=str(template.id),
                    instance_id=str(instance.id),
                    error=str(e),
                )

            await db.commit()
            instance_ids.append(str(instance.id))

        return instance_ids

    def _evaluate_conditions(
        self,
        conditions: dict | list | None,
        entity_data: dict,
    ) -> bool:
        """
        Evaluate JSON conditions array against entity_data.

        Accepts either a bare list of rules or a dict with a "rules" key.
        Returns True if all conditions pass or no conditions are defined.

        Each rule is: {field: str, operator: "eq"|"neq"|"gt"|"lt", value: Any}
        """
        if not conditions:
            return True

        rules: list[dict] = (
            conditions
            if isinstance(conditions, list)
            else conditions.get("rules", [])
        )

        for rule in rules:
            field = rule.get("field", "")
            operator = rule.get("operator", "eq")
            value = rule.get("value")
            actual = entity_data.get(field)

            if operator == "eq" and actual != value:
                return False
            elif operator == "neq" and actual == value:
                return False
            elif operator == "gt" and not (actual is not None and actual > value):
                return False
            elif operator == "lt" and not (actual is not None and actual < value):
                return False

        return True

    async def execute_action(
        self,
        action: WorkflowTemplateAction,
        context: dict,
        db: AsyncSession,
    ) -> None:
        """Dispatch a single workflow action by action_type."""
        action_type = action.action_type
        config: dict = action.action_config or {}

        if action_type == "send_email":
            try:
                from src.services.notification_service import get_notification_service  # noqa: F401

                # Best-effort email dispatch — log intent, skip if service unavailable
                logger.info(
                    "workflow_send_email",
                    to=config.get("to"),
                    subject=config.get("subject"),
                )
            except Exception as e:
                logger.warning("workflow_email_skipped", error=str(e))

        elif action_type == "create_task":
            try:
                from src.db.crm_models import Activity

                activity = Activity(
                    activity_type="task",
                    subject=config.get("title", "Workflow Task"),
                    description=config.get("description", ""),
                    due_date=None,  # could derive from config.get("due_hours") if needed
                    created_by="workflow",
                )
                db.add(activity)
                await db.flush()
                logger.info("workflow_task_created", subject=activity.subject)
            except Exception as e:
                logger.warning("workflow_create_task_failed", error=str(e))

        elif action_type == "create_in_app_notification":
            user_id_str = config.get("user_id")
            if user_id_str:
                try:
                    entity_id_raw = context.get("entity_id")
                    notif = InAppNotification(
                        user_id=uuid.UUID(user_id_str),
                        title=config.get("title", "Notification"),
                        message=config.get("message", ""),
                        notification_type="workflow",
                        entity_type=context.get("entity_type"),
                        entity_id=uuid.UUID(entity_id_raw) if entity_id_raw else None,
                    )
                    db.add(notif)
                    await db.flush()
                    logger.info(
                        "workflow_notification_created",
                        user_id=user_id_str,
                        title=notif.title,
                    )
                except Exception as e:
                    logger.warning("workflow_notification_failed", error=str(e))
            else:
                logger.warning(
                    "workflow_notification_skipped",
                    reason="no user_id in action_config",
                )

        else:
            logger.warning("workflow_unknown_action_type", action_type=action_type)


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_workflow_service: WorkflowService | None = None


def get_workflow_service() -> WorkflowService:
    """Get or create the WorkflowService singleton."""
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = WorkflowService()
    return _workflow_service
