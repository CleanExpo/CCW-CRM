"""Agents Protocol v1.0 — Agent Message Bus.

Structured message routing between agents with correlation tracking,
TTL enforcement, priority queuing, and dead-letter handling.

Pure functions handle message creation/validation.
AgentMessageBus class manages routing state.
"""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Any

import structlog

from .models import AgentMessage, MessageType, Priority

logger = structlog.get_logger(__name__)


# ─── Pure Functions ──────────────────────────────────────────────────────


def create_message(
    sender_id: str,
    recipient_id: str,
    message_type: MessageType,
    payload: dict[str, Any],
    *,
    correlation_id: str | None = None,
    priority: Priority = Priority.NORMAL,
    ttl_seconds: int | None = None,
) -> AgentMessage:
    """Create a new structured agent message."""
    msg = AgentMessage(
        sender_id=sender_id,
        recipient_id=recipient_id,
        message_type=message_type,
        payload=payload,
        priority=priority,
        ttl_seconds=ttl_seconds,
    )
    if correlation_id:
        msg.correlation_id = correlation_id
    return msg


def create_response(
    original: AgentMessage,
    payload: dict[str, Any],
    *,
    priority: Priority | None = None,
) -> AgentMessage:
    """Create a response message that preserves the correlation chain.

    Swaps sender/recipient and reuses the original correlation_id.
    """
    return AgentMessage(
        sender_id=original.recipient_id,
        recipient_id=original.sender_id,
        message_type=MessageType.RESPONSE,
        payload=payload,
        correlation_id=original.correlation_id,
        priority=priority or original.priority,
    )


def is_expired(message: AgentMessage) -> bool:
    """Check if a message has exceeded its TTL.

    Messages with no TTL (ttl_seconds=None) never expire.
    """
    if message.ttl_seconds is None:
        return False

    elapsed = (datetime.now(UTC) - message.timestamp).total_seconds()
    return elapsed > message.ttl_seconds


# ─── Priority Ordering ──────────────────────────────────────────────────

_PRIORITY_ORDER: dict[Priority, int] = {
    Priority.CRITICAL: 0,
    Priority.HIGH: 1,
    Priority.NORMAL: 2,
    Priority.LOW: 3,
}


# ─── AgentMessageBus Class ──────────────────────────────────────────────


class AgentMessageBus:
    """Structured message routing between agents.

    Features:
    - Correlation ID tracking (groups related messages)
    - Message TTL enforcement
    - Priority ordering (critical > high > normal > low)
    - Dead letter queue for undeliverable messages
    """

    _instance: AgentMessageBus | None = None

    def __new__(cls) -> AgentMessageBus:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return

        # Per-agent message queues
        self._queues: dict[str, deque[AgentMessage]] = defaultdict(deque)
        # Correlation tracking: correlation_id → list of message_ids
        self._correlations: dict[str, list[str]] = defaultdict(list)
        # Dead letter queue
        self._dead_letters: deque[AgentMessage] = deque(maxlen=1000)
        # Counters
        self._messages_sent = 0
        self._messages_delivered = 0
        self._messages_expired = 0

        self._initialized = True
        logger.info("Agent message bus initialized")

    def send(self, message: AgentMessage) -> bool:
        """Send a message to the recipient's queue.

        Returns False if the message is expired or undeliverable.
        """
        # Check TTL
        if is_expired(message):
            self._dead_letters.append(message)
            self._messages_expired += 1
            logger.warning(
                "Message expired before delivery",
                message_id=message.message_id,
                sender=message.sender_id,
                recipient=message.recipient_id,
            )
            return False

        # Track correlation
        self._correlations[message.correlation_id].append(message.message_id)

        # Enqueue (priority insertion)
        queue = self._queues[message.recipient_id]
        queue.append(message)

        self._messages_sent += 1

        logger.debug(
            "Message sent",
            message_id=message.message_id,
            sender=message.sender_id,
            recipient=message.recipient_id,
            priority=message.priority.value,
        )
        return True

    def receive(self, agent_id: str) -> AgentMessage | None:
        """Receive the next message for an agent (highest priority first).

        Skips expired messages (moves them to dead letters).
        Returns None if no messages available.
        """
        queue = self._queues.get(agent_id)
        if not queue:
            return None

        # Sort by priority, take highest
        sorted_msgs = sorted(queue, key=lambda m: _PRIORITY_ORDER.get(m.priority, 2))

        for msg in sorted_msgs:
            if is_expired(msg):
                queue.remove(msg)
                self._dead_letters.append(msg)
                self._messages_expired += 1
                continue

            queue.remove(msg)
            self._messages_delivered += 1
            return msg

        return None

    def get_correlation_chain(self, correlation_id: str) -> list[str]:
        """Get all message IDs in a correlation chain."""
        return self._correlations.get(correlation_id, [])

    def get_statistics(self) -> dict[str, Any]:
        """Get message bus statistics."""
        return {
            "messages_sent": self._messages_sent,
            "messages_delivered": self._messages_delivered,
            "messages_expired": self._messages_expired,
            "dead_letters": len(self._dead_letters),
            "active_queues": sum(1 for q in self._queues.values() if q),
            "active_correlations": len(self._correlations),
        }


# ─── Singleton ───────────────────────────────────────────────────────────

_message_bus: AgentMessageBus | None = None


def get_message_bus() -> AgentMessageBus:
    """Get the global message bus singleton."""
    global _message_bus
    if _message_bus is None:
        _message_bus = AgentMessageBus()
    return _message_bus
