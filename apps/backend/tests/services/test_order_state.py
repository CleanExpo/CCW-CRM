"""Tests for order state machine service (GAP-027)."""
from datetime import UTC, datetime

import pytest

from src.services.order_state import (
    can_transition,
    get_next_states,
    get_state_lifecycle,
    is_terminal_state,
    validate_transition,
)


class TestCanTransition:
    """Test state transition validation."""

    def test_draft_to_pending(self):
        """Test valid transition from draft to pending."""
        assert can_transition("draft", "pending") is True

    def test_pending_to_confirmed(self):
        """Test valid transition from pending to confirmed."""
        assert can_transition("pending", "confirmed") is True

    def test_confirmed_to_processing(self):
        """Test valid transition from confirmed to processing."""
        assert can_transition("confirmed", "processing") is True

    def test_processing_to_shipped(self):
        """Test valid transition from processing to shipped."""
        assert can_transition("processing", "shipped") is True

    def test_shipped_to_delivered(self):
        """Test valid transition from shipped to delivered."""
        assert can_transition("shipped", "delivered") is True

    def test_invalid_draft_to_shipped(self):
        """Test invalid transition (skipping states)."""
        assert can_transition("draft", "shipped") is False

    def test_invalid_delivered_to_pending(self):
        """Test invalid backwards transition."""
        assert can_transition("delivered", "pending") is False

    def test_cancel_from_draft(self):
        """Test can cancel from draft state."""
        assert can_transition("draft", "cancelled") is True

    def test_cancel_from_pending(self):
        """Test can cancel from pending state."""
        assert can_transition("pending", "cancelled") is True

    def test_cancel_from_processing(self):
        """Test can cancel from processing state."""
        assert can_transition("processing", "cancelled") is True

    def test_cancel_from_shipped(self):
        """Test can cancel from shipped state."""
        assert can_transition("shipped", "cancelled") is True

    def test_cannot_cancel_from_delivered(self):
        """Test cannot cancel from delivered (terminal) state."""
        assert can_transition("delivered", "cancelled") is False

    def test_case_insensitive(self):
        """Test state names are case-insensitive."""
        assert can_transition("DRAFT", "PENDING") is True
        assert can_transition("Draft", "Pending") is True


class TestGetNextStates:
    """Test getting allowed next states."""

    def test_draft_next_states(self):
        """Test next states from draft."""
        next_states = get_next_states("draft")
        assert "pending" in next_states
        assert "cancelled" in next_states
        assert len(next_states) == 2

    def test_pending_next_states(self):
        """Test next states from pending."""
        next_states = get_next_states("pending")
        assert "confirmed" in next_states
        assert "cancelled" in next_states

    def test_delivered_no_next_states(self):
        """Test delivered is terminal (no next states)."""
        next_states = get_next_states("delivered")
        assert len(next_states) == 0

    def test_cancelled_no_next_states(self):
        """Test cancelled is terminal (no next states)."""
        next_states = get_next_states("cancelled")
        assert len(next_states) == 0


class TestValidateTransition:
    """Test transition validation with result object."""

    def test_valid_transition_success(self):
        """Test successful transition validation."""
        result = validate_transition("draft", "pending", "Customer approved")

        assert result.success is True
        assert result.old_state == "draft"
        assert result.new_state == "pending"
        assert result.reason == "Customer approved"
        assert result.error is None

    def test_invalid_transition_failure(self):
        """Test failed transition validation."""
        result = validate_transition("draft", "shipped", "Trying to skip states")

        assert result.success is False
        assert result.old_state == "draft"
        assert result.new_state == "draft"  # Stays in current state
        assert result.error is not None
        assert "Invalid transition" in result.error

    def test_transition_includes_timestamp(self):
        """Test transition result includes timestamp."""
        before = datetime.now(UTC)
        result = validate_transition("draft", "pending", "Test")
        after = datetime.now(UTC)

        assert before <= result.timestamp <= after

    def test_error_message_shows_allowed_states(self):
        """Test error message includes allowed next states."""
        result = validate_transition("draft", "delivered", "Invalid")

        assert result.success is False
        assert "Allowed next states" in result.error
        assert "pending" in result.error or "cancelled" in result.error


class TestGetStateLifecycle:
    """Test state lifecycle map."""

    def test_lifecycle_has_all_states(self):
        """Test lifecycle includes all order states."""
        lifecycle = get_state_lifecycle()

        expected_states = ["draft", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]
        for state in expected_states:
            assert state in lifecycle

    def test_draft_not_terminal(self):
        """Test draft is not terminal."""
        lifecycle = get_state_lifecycle()
        assert lifecycle["draft"]["is_terminal"] is False

    def test_delivered_is_terminal(self):
        """Test delivered is terminal."""
        lifecycle = get_state_lifecycle()
        assert lifecycle["delivered"]["is_terminal"] is True

    def test_cancelled_is_terminal(self):
        """Test cancelled is terminal."""
        lifecycle = get_state_lifecycle()
        assert lifecycle["cancelled"]["is_terminal"] is True

    def test_each_state_has_description(self):
        """Test each state has a description."""
        lifecycle = get_state_lifecycle()

        for state, info in lifecycle.items():
            assert "description" in info
            assert len(info["description"]) > 0


class TestIsTerminalState:
    """Test terminal state checking."""

    def test_delivered_is_terminal(self):
        """Test delivered state is terminal."""
        assert is_terminal_state("delivered") is True

    def test_cancelled_is_terminal(self):
        """Test cancelled state is terminal."""
        assert is_terminal_state("cancelled") is True

    def test_draft_not_terminal(self):
        """Test draft state is not terminal."""
        assert is_terminal_state("draft") is False

    def test_processing_not_terminal(self):
        """Test processing state is not terminal."""
        assert is_terminal_state("processing") is False

    def test_case_insensitive(self):
        """Test terminal check is case-insensitive."""
        assert is_terminal_state("DELIVERED") is True
        assert is_terminal_state("Cancelled") is True
