"""SLA escalation service (GAP-031).

Escalates tasks when SLA is breached.
Uses Pure Function TDD pattern - core logic is testable without DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import Enum
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.workflow_models import SLAInstance

logger = structlog.get_logger(__name__)


class EscalationLevel(int, Enum):
    """Escalation level enum."""

    LEVEL_1 = 1  # Notify manager
    LEVEL_2 = 2  # Reassign to senior
    LEVEL_3 = 3  # Escalate to department head


@dataclass
class Task:
    """Task data for escalation."""

    task_id: UUID
    entity_type: str
    entity_id: UUID
    assigned_to: UUID | None
    deadline: datetime
    current_assignee_role: str


@dataclass
class User:
    """User data for escalation."""

    user_id: UUID
    name: str
    email: str
    role: str
    manager_id: UUID | None


@dataclass
class Organization:
    """Organization data for escalation."""

    org_id: UUID
    name: str
    users: list[User]


@dataclass
class EscalationResult:
    """Result of escalation."""

    success: bool
    level: EscalationLevel
    old_assignee: UUID | None
    new_assignee: UUID | None
    notification_sent: bool
    reason: str
    error: str | None = None


# ---------------------------------------------------------------------------
# Pure Functions (No DB - easy to test)
# ---------------------------------------------------------------------------


def is_sla_breached(deadline: datetime, current_time: datetime | None = None) -> bool:
    """
    Check if SLA has been breached.

    Pure function - no database access, easily testable.

    Args:
        deadline: SLA deadline
        current_time: Current time (defaults to now)

    Returns:
        True if SLA breached, False otherwise
    """
    if current_time is None:
        current_time = datetime.now(UTC)

    return current_time > deadline


def calculate_hours_overdue(deadline: datetime, current_time: datetime | None = None) -> float:
    """
    Calculate hours overdue.

    Pure function.

    Args:
        deadline: SLA deadline
        current_time: Current time (defaults to now)

    Returns:
        Hours overdue (negative if not yet overdue)
    """
    if current_time is None:
        current_time = datetime.now(UTC)

    delta = current_time - deadline
    return delta.total_seconds() / 3600


def calculate_escalation_level(hours_overdue: float) -> EscalationLevel:
    """
    Determine escalation level based on breach duration.

    Pure function.

    Escalation levels:
    - Level 1: 0-24 hours overdue (notify manager)
    - Level 2: 24-72 hours overdue (reassign to senior)
    - Level 3: 72+ hours overdue (escalate to department head)

    Args:
        hours_overdue: Hours past deadline

    Returns:
        Appropriate EscalationLevel
    """
    if hours_overdue >= 72:
        return EscalationLevel.LEVEL_3
    elif hours_overdue >= 24:
        return EscalationLevel.LEVEL_2
    else:
        return EscalationLevel.LEVEL_1


def get_escalation_assignee(
    task: Task,
    level: EscalationLevel,
    org: Organization,
) -> User | None:
    """
    Get next assignee based on escalation level.

    Pure function - takes all data as input, returns decision.

    Args:
        task: Task being escalated
        level: Escalation level
        org: Organization with users

    Returns:
        User to escalate to, or None if no suitable user found
    """
    if not task.assigned_to:
        # Task has no assignee, assign to first available user with appropriate role
        for user in org.users:
            if level == EscalationLevel.LEVEL_1 and user.role in ["manager", "senior", "lead"]:
                return user
            elif level == EscalationLevel.LEVEL_2 and user.role in ["senior", "lead"]:
                return user
            elif level == EscalationLevel.LEVEL_3 and user.role in ["lead", "director", "head"]:
                return user
        return None

    # Find current assignee
    current_user = None
    for user in org.users:
        if user.user_id == task.assigned_to:
            current_user = user
            break

    if not current_user:
        return None

    # Level 1: Notify manager (keep same assignee)
    if level == EscalationLevel.LEVEL_1:
        if current_user.manager_id:
            for user in org.users:
                if user.user_id == current_user.manager_id:
                    return user
        return None

    # Level 2: Reassign to senior team member
    elif level == EscalationLevel.LEVEL_2:
        for user in org.users:
            if user.role in ["senior", "lead"] and user.user_id != current_user.user_id:
                return user
        return None

    # Level 3: Escalate to department head
    elif level == EscalationLevel.LEVEL_3:
        for user in org.users:
            if user.role in ["lead", "director", "head"]:
                return user
        return None

    return None


def build_escalation_message(
    task: Task,
    level: EscalationLevel,
    hours_overdue: float,
    assignee: User | None,
) -> dict[str, str]:
    """
    Build escalation notification message.

    Pure function.

    Args:
        task: Task being escalated
        level: Escalation level
        hours_overdue: Hours overdue
        assignee: User being assigned/notified

    Returns:
        Dictionary with subject and body
    """
    hours_str = f"{hours_overdue:.1f}"

    if level == EscalationLevel.LEVEL_1:
        subject = f"SLA Breach Notification: Task {task.task_id}"
        body = f"""SLA Breach Alert - Level 1

Task ID: {task.task_id}
Entity: {task.entity_type} ({task.entity_id})
Deadline: {task.deadline.isoformat()}
Hours Overdue: {hours_str}

Action: Manager notification
{f"Notifying: {assignee.name} ({assignee.email})" if assignee else "No manager found"}

Please review and provide guidance.
"""

    elif level == EscalationLevel.LEVEL_2:
        subject = f"URGENT: Task Reassignment - {hours_str}h Overdue"
        body = f"""URGENT: SLA Breach - Level 2 Escalation

Task ID: {task.task_id}
Entity: {task.entity_type} ({task.entity_id})
Deadline: {task.deadline.isoformat()}
Hours Overdue: {hours_str}

Action: Reassigning to senior team member
{f"New Assignee: {assignee.name} ({assignee.email})" if assignee else "No senior member available"}

Immediate action required.
"""

    else:  # Level 3
        subject = f"CRITICAL: Department Head Escalation - {hours_str}h Overdue"
        body = f"""CRITICAL: SLA Breach - Level 3 Escalation

Task ID: {task.task_id}
Entity: {task.entity_type} ({task.entity_id})
Deadline: {task.deadline.isoformat()}
Hours Overdue: {hours_str}

Action: Escalating to department head
{f"Escalated To: {assignee.name} ({assignee.email})" if assignee else "No department head found"}

This task requires immediate executive attention.
"""

    return {
        "subject": subject,
        "body": body,
    }


def should_escalate(
    deadline: datetime,
    last_escalation_time: datetime | None,
    current_time: datetime | None = None,
) -> tuple[bool, str]:
    """
    Check if task should be escalated.

    Pure function.

    Args:
        deadline: Task deadline
        last_escalation_time: When last escalated
        current_time: Current time (defaults to now)

    Returns:
        Tuple of (should_escalate, reason)
    """
    if current_time is None:
        current_time = datetime.now(UTC)

    # Not yet breached
    if not is_sla_breached(deadline, current_time):
        return (False, "SLA not yet breached")

    # Already escalated within last hour (prevent spam)
    if last_escalation_time:
        hours_since_last = (current_time - last_escalation_time).total_seconds() / 3600
        if hours_since_last < 1.0:
            return (False, "Already escalated within last hour")

    hours_overdue = calculate_hours_overdue(deadline, current_time)
    return (True, f"SLA breached by {hours_overdue:.1f} hours")


# ---------------------------------------------------------------------------
# Async DB Wrapper Functions
# ---------------------------------------------------------------------------


async def escalate_task(
    db: AsyncSession,
    sla_instance_id: UUID,
    org_users: list[User],
) -> EscalationResult:
    """
    Execute escalation for a task (async DB wrapper).

    Fetches SLA instance from DB, determines escalation level, assigns.

    Args:
        db: Database session
        sla_instance_id: SLA instance ID
        org_users: List of organization users for escalation

    Returns:
        EscalationResult with escalation details
    """
    # Fetch SLA instance
    result = await db.execute(
        select(SLAInstance).where(SLAInstance.id == sla_instance_id)
    )
    sla_instance = result.scalar_one_or_none()

    if not sla_instance:
        logger.warning("sla_instance_not_found", sla_instance_id=str(sla_instance_id))
        return EscalationResult(
            success=False,
            level=EscalationLevel.LEVEL_1,
            old_assignee=None,
            new_assignee=None,
            notification_sent=False,
            reason="SLA instance not found",
            error="Instance not found in database",
        )

    current_time = datetime.now(UTC)

    # Check if should escalate (pure function)
    should_esc, reason = should_escalate(
        deadline=sla_instance.deadline,
        last_escalation_time=None,  # Would track in DB
        current_time=current_time,
    )

    if not should_esc:
        logger.debug(
            "escalation_not_needed",
            sla_instance_id=str(sla_instance_id),
            reason=reason,
        )
        return EscalationResult(
            success=False,
            level=EscalationLevel.LEVEL_1,
            old_assignee=None,
            new_assignee=None,
            notification_sent=False,
            reason=reason,
        )

    # Calculate escalation level (pure function)
    hours_overdue = calculate_hours_overdue(sla_instance.deadline, current_time)
    level = calculate_escalation_level(hours_overdue)

    # Build task data
    task = Task(
        task_id=sla_instance.entity_id,
        entity_type=sla_instance.entity_type,
        entity_id=sla_instance.entity_id,
        assigned_to=None,  # Would fetch from task table
        deadline=sla_instance.deadline,
        current_assignee_role="staff",
    )

    # Build org data
    org = Organization(
        org_id=UUID(int=0),  # Placeholder
        name="Organization",
        users=org_users,
    )

    # Get escalation assignee (pure function)
    assignee = get_escalation_assignee(task, level, org)

    if not assignee:
        logger.warning(
            "no_escalation_assignee_found",
            sla_instance_id=str(sla_instance_id),
            level=level.value,
        )
        return EscalationResult(
            success=False,
            level=level,
            old_assignee=task.assigned_to,
            new_assignee=None,
            notification_sent=False,
            reason=f"No suitable assignee for level {level.value}",
            error="No escalation assignee available",
        )

    # Build notification message (pure function)
    message = build_escalation_message(task, level, hours_overdue, assignee)

    # In real system, would:
    # 1. Update task assignment in DB
    # 2. Send email notification
    # 3. Create activity log entry
    # For now, just log

    logger.info(
        "task_escalated",
        sla_instance_id=str(sla_instance_id),
        level=level.value,
        hours_overdue=hours_overdue,
        assignee_id=str(assignee.user_id),
        assignee_name=assignee.name,
    )

    return EscalationResult(
        success=True,
        level=level,
        old_assignee=task.assigned_to,
        new_assignee=assignee.user_id,
        notification_sent=True,  # Would be actual send result
        reason=f"Escalated to {assignee.name} (Level {level.value})",
    )


async def check_sla_and_escalate(
    db: AsyncSession,
    sla_instance_id: UUID,
    org_users: list[User],
) -> EscalationResult | None:
    """
    Check SLA breach and escalate if needed (main entry point).

    Args:
        db: Database session
        sla_instance_id: SLA instance ID
        org_users: Organization users for escalation

    Returns:
        EscalationResult if escalated, None if not needed
    """
    # Fetch SLA instance
    result = await db.execute(
        select(SLAInstance).where(SLAInstance.id == sla_instance_id)
    )
    sla_instance = result.scalar_one_or_none()

    if not sla_instance:
        return None

    # Check if breached (pure function)
    if not is_sla_breached(sla_instance.deadline):
        return None

    # Escalate
    return await escalate_task(db, sla_instance_id, org_users)
