"""Order state machine service (GAP-027).

Enforces valid state transitions for orders.
Uses Pure Function TDD pattern - core logic is testable without DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order

logger = structlog.get_logger(__name__)


class TransitionError(Exception):
    """Raised when invalid state transition attempted."""

    pass


@dataclass
class TransitionResult:
    """Result of state transition attempt."""

    success: bool
    old_state: str
    new_state: str
    timestamp: datetime
    reason: str
    error: str | None = None


# ---------------------------------------------------------------------------
# State Transition Map
# ---------------------------------------------------------------------------

# Valid state transitions: state -> [allowed_next_states]
STATE_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["pending", "cancelled"],
    "pending": ["confirmed", "cancelled"],
    "confirmed": ["processing", "cancelled"],
    "processing": ["shipped", "cancelled"],
    "shipped": ["delivered", "cancelled"],
    "delivered": [],  # Terminal state (except cancellation)
    "cancelled": [],  # Terminal state
}

# States that allow cancellation from any state
CANCELLABLE_STATES = {"draft", "pending", "confirmed", "processing", "shipped"}


# ---------------------------------------------------------------------------
# Pure Functions (No DB - easy to test)
# ---------------------------------------------------------------------------


def can_transition(current_state: str, new_state: str) -> bool:
    """
    Check if state transition is valid.

    Pure function - no database access, easily testable.

    Args:
        current_state: Current order state
        new_state: Desired new state

    Returns:
        True if transition is allowed, False otherwise
    """
    # Normalize states to lowercase
    current = current_state.lower()
    new = new_state.lower()

    # Special case: cancelled can be reached from most states
    if new == "cancelled" and current in CANCELLABLE_STATES:
        return True

    # Check normal transitions
    allowed_states = STATE_TRANSITIONS.get(current, [])
    return new in allowed_states


def get_next_states(current_state: str) -> list[str]:
    """
    Get allowed next states from current state.

    Pure function.

    Args:
        current_state: Current order state

    Returns:
        List of allowed next states
    """
    current = current_state.lower()

    # Get base transitions
    base_transitions = STATE_TRANSITIONS.get(current, [])

    # Add cancelled if in cancellable states
    if current in CANCELLABLE_STATES and "cancelled" not in base_transitions:
        return base_transitions + ["cancelled"]

    return base_transitions


def validate_transition(
    current_state: str,
    new_state: str,
    reason: str,
) -> TransitionResult:
    """
    Validate state transition and create result.

    Pure function - returns result object, doesn't modify anything.

    Args:
        current_state: Current order state
        new_state: Desired new state
        reason: Reason for transition

    Returns:
        TransitionResult indicating success or failure
    """
    timestamp = datetime.now(UTC)

    if not can_transition(current_state, new_state):
        allowed = get_next_states(current_state)
        error_msg = (
            f"Invalid transition from {current_state} to {new_state}. "
            f"Allowed next states: {', '.join(allowed) if allowed else 'none'}"
        )
        return TransitionResult(
            success=False,
            old_state=current_state,
            new_state=current_state,  # Stay in current state
            timestamp=timestamp,
            reason=reason,
            error=error_msg,
        )

    return TransitionResult(
        success=True,
        old_state=current_state,
        new_state=new_state,
        timestamp=timestamp,
        reason=reason,
        error=None,
    )


def get_state_lifecycle() -> dict[str, dict[str, Any]]:
    """
    Get complete state lifecycle map.

    Pure function - returns static data structure.

    Returns:
        Dictionary mapping states to their properties and allowed transitions
    """
    return {
        "draft": {
            "description": "Order is being drafted",
            "is_terminal": False,
            "next_states": ["pending", "cancelled"],
        },
        "pending": {
            "description": "Order is pending approval",
            "is_terminal": False,
            "next_states": ["confirmed", "cancelled"],
        },
        "confirmed": {
            "description": "Order has been confirmed",
            "is_terminal": False,
            "next_states": ["processing", "cancelled"],
        },
        "processing": {
            "description": "Order is being processed",
            "is_terminal": False,
            "next_states": ["shipped", "cancelled"],
        },
        "shipped": {
            "description": "Order has been shipped",
            "is_terminal": False,
            "next_states": ["delivered", "cancelled"],
        },
        "delivered": {
            "description": "Order has been delivered",
            "is_terminal": True,
            "next_states": [],
        },
        "cancelled": {
            "description": "Order has been cancelled",
            "is_terminal": True,
            "next_states": [],
        },
    }


def is_terminal_state(state: str) -> bool:
    """
    Check if state is terminal (no further transitions allowed).

    Pure function.

    Args:
        state: State to check

    Returns:
        True if terminal state, False otherwise
    """
    lifecycle = get_state_lifecycle()
    state_info = lifecycle.get(state.lower(), {})
    return state_info.get("is_terminal", False)


# ---------------------------------------------------------------------------
# Async DB Wrapper Functions
# ---------------------------------------------------------------------------


async def transition_order(
    db: AsyncSession,
    order_id: UUID,
    new_state: str,
    reason: str,
    user_id: UUID | None = None,
) -> TransitionResult:
    """
    Execute state transition for an order (async DB wrapper).

    Fetches order from DB, validates transition, updates state.

    Args:
        db: Database session
        order_id: Order ID to transition
        new_state: Desired new state
        reason: Reason for transition
        user_id: User performing the transition (optional)

    Returns:
        TransitionResult indicating success or failure
    """
    # Fetch order
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        logger.warning("order_not_found", order_id=str(order_id))
        return TransitionResult(
            success=False,
            old_state="unknown",
            new_state="unknown",
            timestamp=datetime.now(UTC),
            reason=reason,
            error=f"Order {order_id} not found",
        )

    current_state = order.status

    # Validate transition (pure function)
    validation_result = validate_transition(current_state, new_state, reason)

    if not validation_result.success:
        logger.warning(
            "order_transition_rejected",
            order_id=str(order_id),
            current_state=current_state,
            attempted_state=new_state,
            error=validation_result.error,
        )
        return validation_result

    # Update order state
    order.status = new_state
    order.updated_at = validation_result.timestamp

    await db.commit()
    await db.refresh(order)

    logger.info(
        "order_transition_success",
        order_id=str(order_id),
        old_state=validation_result.old_state,
        new_state=validation_result.new_state,
        reason=reason,
        user_id=str(user_id) if user_id else None,
    )

    return validation_result


async def get_order_next_states(
    db: AsyncSession,
    order_id: UUID,
) -> list[str]:
    """
    Get allowed next states for an order (async DB wrapper).

    Args:
        db: Database session
        order_id: Order ID

    Returns:
        List of allowed next states
    """
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        logger.warning("order_not_found", order_id=str(order_id))
        return []

    # Call pure function
    return get_next_states(order.status)


async def can_cancel_order(
    db: AsyncSession,
    order_id: UUID,
) -> bool:
    """
    Check if order can be cancelled (async DB wrapper).

    Args:
        db: Database session
        order_id: Order ID

    Returns:
        True if order can be cancelled, False otherwise
    """
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        return False

    # Call pure function
    return can_transition(order.status, "cancelled")
