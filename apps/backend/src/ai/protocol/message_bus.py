"""Agents Protocol v1.0 — Agent Message Bus.

Structured message routing between agents with correlation tracking,
TTL enforcement, priority queuing, and dead letter handling.

Section 2 (Communication) + Section 11 (Coordination).
"""

from collections import defaultdict
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import structlog

from .models import AgentMessage, MessageType, Priority

logger = structlog.get_logger(__name__)


# ─── Pure Functions ───────────────────────────────────────────────────────


def create_message(
    sender_id: str,
    recipient_id: str,
    msg_type: MessageType,
    payload: dict[str, Any],
    correlation_id: str | None = None,
    priority: Priority = Priority.NORMAL,
    ttl_seconds: int | None = None,
) -> AgentMessage:
    """Create a new structured agent message.

    Args:
        sender_id: ID of the sending agent
        recipient_id: ID of the receiving agent
        msg_type: Type of message (request, response, etc.)
        payload: Message payload data
        correlation_id: Optional correlation ID (auto-generated if None)
        priority: Message priority
        ttl_seconds: Time-to-live in seconds (None = no expiry)

    Returns:
        New AgentMessage instance
    """
    return AgentMessage(
        message_id=str(uuid4()),
        correlation_id=correlation_id or str(uuid4()),
        sender_id=sender_id,
        recipient_id=recipient_id,
        message_type=msg_type,
        payload=payload,
        timestamp=datetime.now(UTC),
        priority=priority,
        ttl_seconds=ttl_seconds,
    )


def create_response(
    original: AgentMessage,
    payload: dict[str, Any],
    priority: Priority | None = None,
) -> AgentMessage:
    """Create a response message to an original message.

    Preserves the correlation_id for request chain tracking.
    Swaps sender and recipient.

    Args:
        original: The original message being responded to
        payload: Response payload data
        priority: Override priority (defaults to original's priority)

    Returns:
        New response AgentMessage
    """
    return AgentMessage(
        message_id=str(uuid4()),
        correlation_id=original.correlation_id,  # Preserve correlation
        sender_id=original.recipient_id,  # Swap: original recipient is now sender
        recipient_id=original.sender_id,  # Swap: original sender receives response
        message_type=MessageType.RESPONSE,
        payload=payload,
        timestamp=datetime.now(UTC),
        priority=priority or original.priority,
        ttl_seconds=original.ttl_seconds,
    )


def is_expired(message: AgentMessage) -> bool:
    """Check if a message has expired based on its TTL.

    Args:
        message: The message to check

    Returns:
        True if the message has expired
    """
    if message.ttl_seconds is None:
        return False

    now = datetime.now(UTC)
    age_seconds = (now - message.timestamp).total_seconds()
    return age_seconds > message.ttl_seconds


# ─── Priority ordering ───────────────────────────────────────────────────

_PRIORITY_ORDER: dict[Priority, int] = {
    Priority.CRITICAL: 0,
    Priority.HIGH: 1,
    Priority.NORMAL: 2,
    Priority.LOW: 3,
}


# ─── Agent Message Bus Class ─────────────────────────────────────────────


class AgentMessageBus:
    """Structured message routing between agents.

    Features:
    - Priority queue (critical > high > normal > low)
    - Correlation ID tracking (groups related messages)
    - Message TTL enforcement
    - Dead letter queue for failed deliveries
    - Message history per correlation
    """

    def __init__(self) -> None:
        """Initialize the message bus."""
        self._queues: dict[str, list[AgentMessage]] = defaultdict(list)
        self._dead_letters: list[AgentMessage] = []
        self._correlation_index: dict[str, list[AgentMessage]] = defaultdict(list)
        self._total_messages: int = 0
        self._total_delivered: int = 0
        self._total_expired: int = 0
        self._max_dead_letters: int = 500
        logger.info("Agent message bus initialized")

    def send(self, message: AgentMessage) -> bool:
        """Send a message to the recipient's queue.

        Args:
            message: The message to send

        Returns:
            True if message was queued, False if expired
        """
        self._total_messages += 1

        # Check TTL
        if is_expired(message):
            self._dead_letters.append(message)
            self._total_expired += 1
            self._trim_dead_letters()
            logger.debug(
                "Message expired before delivery",
                message_id=message.message_id,
                recipient=message.recipient_id,
            )
            return False

        # Add to recipient's queue (sorted by priority)
        queue = self._queues[message.recipient_id]
        queue.append(message)
        queue.sort(key=lambda m: _PRIORITY_ORDER.get(m.priority, 2))

        # Index by correlation
        self._correlation_index[message.correlation_id].append(message)

        logger.debug(
            "Message queued",
            message_id=message.message_id,
            sender=message.sender_id,
            recipient=message.recipient_id,
            priority=message.priority.value,
        )
        return True

    def receive(self, agent_id: str) -> AgentMessage | None:
        """Receive the next message for an agent (highest priority first).

        Args:
            agent_id: The receiving agent's ID

        Returns:
            Next message or None if queue is empty
        """
        queue = self._queues.get(agent_id, [])

        while queue:
            message = queue.pop(0)

            # Check if expired
            if is_expired(message):
                self._dead_letters.append(message)
                self._total_expired += 1
                self._trim_dead_letters()
                continue

            self._total_delivered += 1
            return message

        return None

    def peek(self, agent_id: str) -> int:
        """Check how many messages are waiting for an agent.

        Args:
            agent_id: The agent to check

        Returns:
            Number of queued messages
        """
        return len(self._queues.get(agent_id, []))

    def get_correlation_chain(self, correlation_id: str) -> list[AgentMessage]:
        """Get all messages in a correlation chain.

        Args:
            correlation_id: The correlation ID to look up

        Returns:
            List of messages in chronological order
        """
        messages = self._correlation_index.get(correlation_id, [])
        return sorted(messages, key=lambda m: m.timestamp)

    def get_dead_letters(self, limit: int = 50) -> list[AgentMessage]:
        """Get recent dead letter messages.

        Args:
            limit: Maximum number to return

        Returns:
            Recent dead letter messages
        """
        return self._dead_letters[-limit:]

    def get_statistics(self) -> dict[str, Any]:
        """Get message bus statistics.

        Returns:
            Statistics dictionary
        """
        total_queued = sum(len(q) for q in self._queues.values())
        return {
            "total_messages_sent": self._total_messages,
            "total_delivered": self._total_delivered,
            "total_expired": self._total_expired,
            "total_queued": total_queued,
            "dead_letter_count": len(self._dead_letters),
            "active_queues": len(self._queues),
            "active_correlations": len(self._correlation_index),
        }

    def _trim_dead_letters(self) -> None:
        """Trim dead letter queue if too large."""
        if len(self._dead_letters) > self._max_dead_letters:
            self._dead_letters = self._dead_letters[-self._max_dead_letters:]


# ─── Singleton ────────────────────────────────────────────────────────────

_message_bus: AgentMessageBus | None = None


def get_message_bus() -> AgentMessageBus:
    """Get the global agent message bus instance.

    Returns:
        AgentMessageBus singleton
    """
    global _message_bus
    if _message_bus is None:
        _message_bus = AgentMessageBus()
    return _message_bus
