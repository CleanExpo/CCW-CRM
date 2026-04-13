"""Integration tests for Agents Protocol v1.0.

Tests all pure-Python protocol modules:
  - models          (AgentCard, AgentMessage, DelegationRequest, etc.)
  - confidence      (score_from_execution, aggregate_confidence, etc.)
  - error_handler   (classify_exception, should_retry, calculate_backoff, etc.)
  - governor        (validate_delegation, validate_permissions, etc.)
  - message_bus     (create_message, create_response, is_expired, AgentMessageBus)
  - cards           (load_all_cards, registry integrity)

No DB or network I/O — all functions are pure Python.
Target: 100+ assertions passing.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

# ── Models ────────────────────────────────────────────────────────────────────

from src.ai.protocol.models import (
    AgentCard,
    AgentMessage,
    ConfidenceScore,
    DelegationRequest,
    DelegationRule,
    ErrorClassification,
    ErrorType,
    EscalationTrigger,
    EscalationTriggerType,
    HandoffPackage,
    MessageType,
    PermissionTier,
    Priority,
    ProtocolVersion,
    Severity,
)

# ── Confidence ────────────────────────────────────────────────────────────────

from src.ai.protocol.confidence import (
    aggregate_confidence,
    score_from_completeness,
    score_from_execution,
    score_from_health,
)

# ── Error Handler ─────────────────────────────────────────────────────────────

from src.ai.protocol.error_handler import (
    calculate_backoff,
    classify_exception,
    format_error_response,
    should_retry,
)

# ── Governor ──────────────────────────────────────────────────────────────────

from src.ai.protocol.governor import (
    build_handoff_package,
    detect_delegation_loop,
    should_escalate,
    validate_delegation,
    validate_permissions,
)

# ── Message Bus ───────────────────────────────────────────────────────────────

from src.ai.protocol.message_bus import (
    AgentMessageBus,
    create_message,
    create_response,
    is_expired,
)

# ── Cards ─────────────────────────────────────────────────────────────────────

from src.ai.protocol.cards import load_all_cards


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture(autouse=True)
def reset_message_bus():
    """Reset the AgentMessageBus singleton before every test."""
    AgentMessageBus._instance = None
    yield
    AgentMessageBus._instance = None


def _make_card(
    agent_id: str = "agent-a",
    permission_tier: PermissionTier = PermissionTier.STANDARD,
    capabilities: list[str] | None = None,
    timeout_seconds: int = 120,
) -> AgentCard:
    return AgentCard(
        agent_id=agent_id,
        name=f"Agent {agent_id}",
        capabilities=capabilities or ["task_a"],
        permission_tier=permission_tier,
        timeout_seconds=timeout_seconds,
        delegation_rules=[DelegationRule(capability="task_a")],
        escalation_triggers=[
            EscalationTrigger(
                trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
                threshold=0.4,
            )
        ],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Section 1: Models
# ═══════════════════════════════════════════════════════════════════════════════


class TestAgentCard:
    def test_instantiates_with_required_fields(self):
        card = AgentCard(agent_id="test-agent", name="Test Agent")
        assert card.agent_id == "test-agent"
        assert card.name == "Test Agent"

    def test_default_version(self):
        card = AgentCard(agent_id="x", name="X")
        assert card.version == "1.0.0"

    def test_default_permission_tier(self):
        card = AgentCard(agent_id="x", name="X")
        assert card.permission_tier == PermissionTier.STANDARD

    def test_default_capabilities_empty(self):
        card = AgentCard(agent_id="x", name="X")
        assert card.capabilities == []

    def test_default_max_concurrent(self):
        card = AgentCard(agent_id="x", name="X")
        assert card.max_concurrent == 5

    def test_default_timeout(self):
        card = AgentCard(agent_id="x", name="X")
        assert card.timeout_seconds == 120

    def test_can_set_capabilities(self):
        card = AgentCard(agent_id="x", name="X", capabilities=["search", "read"])
        assert "search" in card.capabilities
        assert "read" in card.capabilities


class TestAgentMessage:
    def test_auto_generates_message_id(self):
        msg = AgentMessage(
            sender_id="a", recipient_id="b", message_type=MessageType.REQUEST
        )
        assert msg.message_id is not None
        assert len(msg.message_id) > 0

    def test_auto_generates_correlation_id(self):
        msg = AgentMessage(
            sender_id="a", recipient_id="b", message_type=MessageType.REQUEST
        )
        assert msg.correlation_id is not None
        assert len(msg.correlation_id) > 0

    def test_two_messages_have_different_ids(self):
        m1 = AgentMessage(
            sender_id="a", recipient_id="b", message_type=MessageType.REQUEST
        )
        m2 = AgentMessage(
            sender_id="a", recipient_id="b", message_type=MessageType.REQUEST
        )
        assert m1.message_id != m2.message_id
        assert m1.correlation_id != m2.correlation_id

    def test_default_priority_normal(self):
        msg = AgentMessage(
            sender_id="a", recipient_id="b", message_type=MessageType.REQUEST
        )
        assert msg.priority == Priority.NORMAL

    def test_ttl_defaults_none(self):
        msg = AgentMessage(
            sender_id="a", recipient_id="b", message_type=MessageType.REQUEST
        )
        assert msg.ttl_seconds is None

    def test_payload_defaults_empty(self):
        msg = AgentMessage(
            sender_id="a", recipient_id="b", message_type=MessageType.REQUEST
        )
        assert msg.payload == {}


class TestDelegationRequest:
    def test_defaults(self):
        req = DelegationRequest(
            delegator_id="a", delegate_id="b", task="do something"
        )
        assert req.timeout_seconds == 120
        assert req.fallback_agent_id is None
        assert req.chain == []
        assert req.required_capabilities == []
        assert req.context == {}


class TestHandoffPackage:
    def test_stores_source_target_reason(self):
        pkg = HandoffPackage(
            source_agent_id="agent-a",
            target_agent_id="agent-b",
            task_summary="Hand off the task",
            reason="escalation required",
        )
        assert pkg.source_agent_id == "agent-a"
        assert pkg.target_agent_id == "agent-b"
        assert pkg.reason == "escalation required"

    def test_timestamp_auto_set(self):
        before = datetime.now(UTC)
        pkg = HandoffPackage(
            source_agent_id="a",
            target_agent_id="b",
            task_summary="t",
        )
        after = datetime.now(UTC)
        assert before <= pkg.timestamp <= after


class TestErrorClassification:
    def test_retryable_variant(self):
        ec = ErrorClassification(
            error_type=ErrorType.TIMEOUT,
            retryable=True,
            max_retries=3,
            message="timed out",
        )
        assert ec.retryable is True
        assert ec.max_retries == 3

    def test_non_retryable_variant(self):
        ec = ErrorClassification(
            error_type=ErrorType.PERMISSION,
            retryable=False,
            max_retries=0,
            message="no permission",
        )
        assert ec.retryable is False
        assert ec.max_retries == 0

    def test_default_severity(self):
        ec = ErrorClassification(
            error_type=ErrorType.PERMANENT,
            message="fail",
        )
        assert ec.severity == Severity.MEDIUM


class TestConfidenceScore:
    def test_valid_score_zero(self):
        cs = ConfidenceScore(score=0.0)
        assert cs.score == 0.0

    def test_valid_score_one(self):
        cs = ConfidenceScore(score=1.0)
        assert cs.score == 1.0

    def test_valid_score_midpoint(self):
        cs = ConfidenceScore(score=0.5)
        assert cs.score == 0.5

    def test_score_below_zero_rejected(self):
        with pytest.raises(ValidationError):
            ConfidenceScore(score=-0.1)

    def test_score_above_one_rejected(self):
        with pytest.raises(ValidationError):
            ConfidenceScore(score=1.1)


class TestProtocolVersion:
    def test_current_returns_1_0_0(self):
        v = ProtocolVersion.current()
        assert v.major == 1
        assert v.minor == 0
        assert v.patch == 0

    def test_str_representation(self):
        v = ProtocolVersion.current()
        assert str(v) == "1.0.0"


# ═══════════════════════════════════════════════════════════════════════════════
# Section 2: Confidence
# ═══════════════════════════════════════════════════════════════════════════════


class TestScoreFromExecution:
    def test_under_expected_returns_1(self):
        assert score_from_execution(500, 1000) == 1.0

    def test_at_expected_returns_1(self):
        assert score_from_execution(1000, 1000) == 1.0

    def test_at_3x_returns_floor(self):
        assert score_from_execution(3000, 1000) == 0.1

    def test_at_2x_midpoint(self):
        # ratio=2.0 → 1.0 - (2.0-1.0)*0.45 = 0.55
        result = score_from_execution(2000, 1000)
        assert abs(result - 0.55) < 0.001

    def test_beyond_3x_still_floors(self):
        assert score_from_execution(5000, 1000) == 0.1

    def test_zero_expected_returns_1(self):
        # Edge: expected_time_ms=0 → guard returns 1.0
        assert score_from_execution(999, 0) == 1.0


class TestScoreFromHealth:
    def test_normal_passthrough(self):
        assert score_from_health(0.8) == 0.8

    def test_clamp_above_1(self):
        assert score_from_health(1.5) == 1.0

    def test_clamp_below_0(self):
        assert score_from_health(-0.1) == 0.0

    def test_boundary_zero(self):
        assert score_from_health(0.0) == 0.0

    def test_boundary_one(self):
        assert score_from_health(1.0) == 1.0


class TestScoreFromCompleteness:
    def test_empty_expected_keys_returns_1(self):
        assert score_from_completeness({}, []) == 1.0

    def test_all_keys_present(self):
        assert score_from_completeness({"a": 1, "b": 2}, ["a", "b"]) == 1.0

    def test_half_keys_present(self):
        assert score_from_completeness({"a": 1}, ["a", "b"]) == 0.5

    def test_no_keys_present(self):
        assert score_from_completeness({}, ["a", "b"]) == 0.0

    def test_extra_keys_ignored(self):
        # Extra key "c" not in expected — doesn't change score
        assert score_from_completeness({"a": 1, "c": 3}, ["a", "b"]) == 0.5


class TestAggregateConfidence:
    def test_simple_average(self):
        result = aggregate_confidence({"a": 0.8, "b": 0.6})
        assert abs(result.score - 0.7) < 0.001

    def test_empty_factors_returns_zero(self):
        result = aggregate_confidence({})
        assert result.score == 0.0

    def test_weighted_single_factor(self):
        result = aggregate_confidence({"a": 0.8}, weights={"a": 2.0})
        assert abs(result.score - 0.8) < 0.001

    def test_returns_confidence_score_model(self):
        result = aggregate_confidence({"x": 0.5})
        assert isinstance(result, ConfidenceScore)

    def test_reasoning_high_confidence(self):
        result = aggregate_confidence({"a": 0.9, "b": 0.9})
        assert result.reasoning == "high confidence"

    def test_reasoning_moderate_confidence(self):
        result = aggregate_confidence({"a": 0.6, "b": 0.6})
        assert result.reasoning == "moderate confidence"

    def test_reasoning_low_confidence(self):
        result = aggregate_confidence({"a": 0.1, "b": 0.2})
        assert result.reasoning == "low confidence"

    def test_factors_stored_on_result(self):
        factors = {"x": 0.7, "y": 0.3}
        result = aggregate_confidence(factors)
        assert result.factors == factors


# ═══════════════════════════════════════════════════════════════════════════════
# Section 3: Error Handler
# ═══════════════════════════════════════════════════════════════════════════════


class TestClassifyException:
    def test_timeout_error(self):
        ec = classify_exception(TimeoutError())
        assert ec.error_type == ErrorType.TIMEOUT
        assert ec.retryable is True

    def test_permission_error(self):
        ec = classify_exception(PermissionError())
        assert ec.error_type == ErrorType.PERMISSION
        assert ec.retryable is False

    def test_value_error(self):
        ec = classify_exception(ValueError("bad data"))
        assert ec.error_type == ErrorType.DATA_QUALITY

    def test_connection_error(self):
        ec = classify_exception(ConnectionError())
        assert ec.error_type == ErrorType.TRANSIENT

    def test_runtime_error_permanent(self):
        ec = classify_exception(RuntimeError("unexpected"))
        assert ec.error_type == ErrorType.PERMANENT

    def test_type_error_data_quality(self):
        ec = classify_exception(TypeError())
        assert ec.error_type == ErrorType.DATA_QUALITY

    def test_memory_error_capacity(self):
        ec = classify_exception(MemoryError())
        assert ec.error_type == ErrorType.CAPACITY


class TestShouldRetry:
    def _retryable_3(self) -> ErrorClassification:
        return ErrorClassification(
            error_type=ErrorType.TIMEOUT,
            retryable=True,
            max_retries=3,
            message="timeout",
        )

    def _non_retryable(self) -> ErrorClassification:
        return ErrorClassification(
            error_type=ErrorType.PERMISSION,
            retryable=False,
            max_retries=0,
            message="denied",
        )

    def test_attempt_0_retryable(self):
        assert should_retry(self._retryable_3(), 0) is True

    def test_attempt_2_retryable(self):
        assert should_retry(self._retryable_3(), 2) is True

    def test_attempt_3_exhausted(self):
        assert should_retry(self._retryable_3(), 3) is False

    def test_attempt_0_non_retryable(self):
        assert should_retry(self._non_retryable(), 0) is False


class TestCalculateBackoff:
    def test_none_strategy_always_zero(self):
        assert calculate_backoff("none", 0) == 0.0
        assert calculate_backoff("none", 5) == 0.0

    def test_linear_attempt_0(self):
        assert calculate_backoff("linear", 0, 2.0) == 2.0

    def test_linear_attempt_2(self):
        # base * (attempt+1) = 2.0 * 3 = 6.0
        assert calculate_backoff("linear", 2, 2.0) == 6.0

    def test_exponential_attempt_0(self):
        # base * 2^0 = 1.0
        assert calculate_backoff("exponential", 0, 1.0) == 1.0

    def test_exponential_attempt_3(self):
        # base * 2^3 = 8.0
        assert calculate_backoff("exponential", 3, 1.0) == 8.0

    def test_unknown_strategy_returns_zero(self):
        assert calculate_backoff("quadratic", 2, 1.0) == 0.0


class TestFormatErrorResponse:
    def test_contains_required_keys(self):
        ec = ErrorClassification(
            error_type=ErrorType.TIMEOUT,
            retryable=True,
            max_retries=3,
            message="timed out",
        )
        resp = format_error_response(ec, "agent-1")
        assert resp["error"] is True
        assert "error_type" in resp
        assert "severity" in resp
        assert "message" in resp
        assert "retryable" in resp
        assert "max_retries" in resp
        assert "backoff_strategy" in resp
        assert resp["agent_id"] == "agent-1"
        assert "timestamp" in resp

    def test_error_type_value_is_string(self):
        ec = ErrorClassification(
            error_type=ErrorType.PERMISSION,
            retryable=False,
            max_retries=0,
            message="denied",
        )
        resp = format_error_response(ec, "agent-x")
        assert isinstance(resp["error_type"], str)


# ═══════════════════════════════════════════════════════════════════════════════
# Section 4: Governor — pure functions
# ═══════════════════════════════════════════════════════════════════════════════


class TestValidateDelegation:
    def _request(
        self,
        delegator: str = "agent-a",
        delegate: str = "agent-b",
        capabilities: list[str] | None = None,
        chain: list[str] | None = None,
        timeout: int = 60,
    ) -> DelegationRequest:
        return DelegationRequest(
            delegator_id=delegator,
            delegate_id=delegate,
            task="test task",
            required_capabilities=capabilities or [],
            chain=chain or [],
            timeout_seconds=timeout,
        )

    def test_valid_delegation_returns_true_no_errors(self):
        sender = _make_card("agent-a", PermissionTier.STANDARD, ["task_a"])
        recipient = _make_card("agent-b", PermissionTier.STANDARD, ["task_a"])
        req = self._request(capabilities=["task_a"])
        is_valid, errors = validate_delegation(req, sender, recipient)
        assert is_valid is True
        assert errors == []

    def test_read_only_sender_rejected(self):
        sender = _make_card("agent-a", PermissionTier.READ_ONLY)
        recipient = _make_card("agent-b", PermissionTier.STANDARD, ["task_a"])
        req = self._request()
        is_valid, errors = validate_delegation(req, sender, recipient)
        assert is_valid is False
        assert any("permission" in e.lower() or "insufficient" in e.lower() for e in errors)

    def test_missing_capability_rejected(self):
        sender = _make_card("agent-a", PermissionTier.STANDARD)
        recipient = _make_card("agent-b", PermissionTier.STANDARD, ["task_b"])
        req = self._request(capabilities=["task_a"])  # recipient lacks task_a
        is_valid, errors = validate_delegation(req, sender, recipient)
        assert is_valid is False
        assert any("capability" in e.lower() for e in errors)

    def test_circular_delegation_detected(self):
        sender = _make_card("agent-a", PermissionTier.STANDARD)
        recipient = _make_card("agent-b", PermissionTier.STANDARD, ["task_a"])
        # delegate_id "agent-b" is already in the chain
        req = self._request(delegate="agent-b", chain=["agent-a", "agent-b"])
        is_valid, errors = validate_delegation(req, sender, recipient)
        assert is_valid is False
        assert any("circular" in e.lower() for e in errors)

    def test_timeout_exceeding_recipient_max_rejected(self):
        sender = _make_card("agent-a", PermissionTier.STANDARD, timeout_seconds=300)
        recipient = _make_card("agent-b", PermissionTier.STANDARD, timeout_seconds=30)
        req = self._request(timeout=200)  # exceeds recipient max of 30
        is_valid, errors = validate_delegation(req, sender, recipient)
        assert is_valid is False
        assert any("timeout" in e.lower() for e in errors)


class TestShouldEscalate:
    def _trigger_low(self, threshold: float = 0.5) -> EscalationTrigger:
        return EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=threshold,
            description="low confidence",
        )

    def test_escalates_on_low_confidence(self):
        cs = ConfidenceScore(score=0.3)
        trigger = self._trigger_low(0.5)
        escalate, desc = should_escalate(cs, [trigger])
        assert escalate is True
        assert desc is not None

    def test_no_escalation_on_high_confidence(self):
        cs = ConfidenceScore(score=0.8)
        trigger = self._trigger_low(0.5)
        escalate, desc = should_escalate(cs, [trigger])
        assert escalate is False
        assert desc is None

    def test_boundary_exactly_at_threshold_no_escalate(self):
        # score < threshold required; score==threshold should NOT escalate
        cs = ConfidenceScore(score=0.5)
        trigger = self._trigger_low(0.5)
        escalate, _ = should_escalate(cs, [trigger])
        assert escalate is False

    def test_empty_triggers_no_escalation(self):
        cs = ConfidenceScore(score=0.0)
        escalate, desc = should_escalate(cs, [])
        assert escalate is False
        assert desc is None


class TestValidatePermissions:
    def test_read_only_can_read(self):
        card = _make_card(permission_tier=PermissionTier.READ_ONLY)
        assert validate_permissions(card, "read") is True

    def test_read_only_cannot_create(self):
        card = _make_card(permission_tier=PermissionTier.READ_ONLY)
        assert validate_permissions(card, "create") is False

    def test_elevated_can_update(self):
        card = _make_card(permission_tier=PermissionTier.ELEVATED)
        assert validate_permissions(card, "update") is True

    def test_standard_cannot_delete(self):
        card = _make_card(permission_tier=PermissionTier.STANDARD)
        assert validate_permissions(card, "delete") is False

    def test_admin_can_delete(self):
        card = _make_card(permission_tier=PermissionTier.ADMIN)
        assert validate_permissions(card, "delete") is True

    def test_admin_can_configure(self):
        card = _make_card(permission_tier=PermissionTier.ADMIN)
        assert validate_permissions(card, "configure") is True

    def test_standard_can_execute(self):
        card = _make_card(permission_tier=PermissionTier.STANDARD)
        assert validate_permissions(card, "execute") is True


class TestDetectDelegationLoop:
    def test_loop_detected_when_in_chain(self):
        assert detect_delegation_loop(["a", "b"], "b") is True

    def test_no_loop_when_not_in_chain(self):
        assert detect_delegation_loop(["a", "b"], "c") is False

    def test_empty_chain_no_loop(self):
        assert detect_delegation_loop([], "a") is False


class TestBuildHandoffPackage:
    def test_returns_correct_handoff_package(self):
        pkg = build_handoff_package(
            source_id="agent-a",
            target_id="agent-b",
            task="process order",
            context={"order_id": "123"},
            progress={"step": "validation"},
            artifacts=["report.pdf"],
            reason="escalation",
        )
        assert isinstance(pkg, HandoffPackage)
        assert pkg.source_agent_id == "agent-a"
        assert pkg.target_agent_id == "agent-b"
        assert pkg.task_summary == "process order"
        assert pkg.context == {"order_id": "123"}
        assert pkg.progress == {"step": "validation"}
        assert "report.pdf" in pkg.artifacts
        assert pkg.reason == "escalation"

    def test_no_artifacts_defaults_empty(self):
        pkg = build_handoff_package(
            source_id="a",
            target_id="b",
            task="t",
            context={},
            progress={},
        )
        assert pkg.artifacts == []


# ═══════════════════════════════════════════════════════════════════════════════
# Section 5: Message Bus
# ═══════════════════════════════════════════════════════════════════════════════


class TestCreateMessage:
    def test_returns_agent_message(self):
        msg = create_message("a", "b", MessageType.REQUEST, {"data": 1})
        assert isinstance(msg, AgentMessage)

    def test_sender_recipient_set(self):
        msg = create_message("sender-x", "recipient-y", MessageType.REQUEST, {})
        assert msg.sender_id == "sender-x"
        assert msg.recipient_id == "recipient-y"

    def test_custom_correlation_id_respected(self):
        msg = create_message(
            "a", "b", MessageType.REQUEST, {}, correlation_id="custom-corr-123"
        )
        assert msg.correlation_id == "custom-corr-123"

    def test_priority_set(self):
        msg = create_message(
            "a", "b", MessageType.REQUEST, {}, priority=Priority.CRITICAL
        )
        assert msg.priority == Priority.CRITICAL

    def test_ttl_set(self):
        msg = create_message("a", "b", MessageType.REQUEST, {}, ttl_seconds=30)
        assert msg.ttl_seconds == 30


class TestCreateResponse:
    def test_swaps_sender_recipient(self):
        original = create_message("alice", "bob", MessageType.REQUEST, {})
        response = create_response(original, {"result": "ok"})
        assert response.sender_id == "bob"
        assert response.recipient_id == "alice"

    def test_preserves_correlation_id(self):
        original = create_message("a", "b", MessageType.REQUEST, {})
        response = create_response(original, {})
        assert response.correlation_id == original.correlation_id

    def test_response_message_type(self):
        original = create_message("a", "b", MessageType.REQUEST, {})
        response = create_response(original, {})
        assert response.message_type == MessageType.RESPONSE

    def test_inherits_priority(self):
        original = create_message(
            "a", "b", MessageType.REQUEST, {}, priority=Priority.HIGH
        )
        response = create_response(original, {})
        assert response.priority == Priority.HIGH


class TestIsExpired:
    def test_no_ttl_never_expires(self):
        msg = create_message("a", "b", MessageType.REQUEST, {})
        assert is_expired(msg) is False

    def test_fresh_message_not_expired(self):
        msg = create_message("a", "b", MessageType.REQUEST, {}, ttl_seconds=60)
        assert is_expired(msg) is False

    def test_pre_expired_message_is_expired(self):
        msg = AgentMessage(
            sender_id="a",
            recipient_id="b",
            message_type=MessageType.REQUEST,
            ttl_seconds=1,
            timestamp=datetime.now(UTC) - timedelta(seconds=5),
        )
        assert is_expired(msg) is True


class TestAgentMessageBusSingleton:
    def test_is_singleton(self):
        bus1 = AgentMessageBus()
        bus2 = AgentMessageBus()
        assert bus1 is bus2

    def test_reset_creates_new_instance(self):
        bus1 = AgentMessageBus()
        AgentMessageBus._instance = None
        bus2 = AgentMessageBus()
        assert bus1 is not bus2


class TestAgentMessageBusSendReceive:
    def test_send_returns_true_for_fresh_message(self):
        bus = AgentMessageBus()
        msg = create_message("a", "b", MessageType.REQUEST, {"x": 1})
        result = bus.send(msg)
        assert result is True

    def test_roundtrip_delivers_correct_message(self):
        bus = AgentMessageBus()
        msg = create_message("sender", "inbox", MessageType.REQUEST, {"key": "val"})
        bus.send(msg)
        received = bus.receive("inbox")
        assert received is not None
        assert received.message_id == msg.message_id
        assert received.payload == {"key": "val"}

    def test_receive_empty_queue_returns_none(self):
        bus = AgentMessageBus()
        assert bus.receive("no-such-agent") is None

    def test_priority_ordering_critical_before_normal(self):
        bus = AgentMessageBus()
        normal_msg = create_message(
            "a", "target", MessageType.REQUEST, {"p": "normal"}, priority=Priority.NORMAL
        )
        critical_msg = create_message(
            "a", "target", MessageType.REQUEST, {"p": "critical"}, priority=Priority.CRITICAL
        )
        bus.send(normal_msg)
        bus.send(critical_msg)

        first = bus.receive("target")
        assert first is not None
        assert first.priority == Priority.CRITICAL

    def test_expired_message_goes_to_dead_letters(self):
        bus = AgentMessageBus()
        expired_msg = AgentMessage(
            sender_id="a",
            recipient_id="b",
            message_type=MessageType.REQUEST,
            ttl_seconds=1,
            timestamp=datetime.now(UTC) - timedelta(seconds=5),
        )
        result = bus.send(expired_msg)
        assert result is False
        stats = bus.get_statistics()
        assert stats["dead_letters"] >= 1

    def test_statistics_track_sent_delivered(self):
        bus = AgentMessageBus()
        msg = create_message("a", "c", MessageType.REQUEST, {})
        bus.send(msg)
        bus.receive("c")
        stats = bus.get_statistics()
        assert stats["messages_sent"] == 1
        assert stats["messages_delivered"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Section 6: Agent Cards
# ═══════════════════════════════════════════════════════════════════════════════


class TestLoadAllCards:
    @pytest.fixture(autouse=True)
    def cards(self):
        self._cards = load_all_cards()

    def test_returns_14_entries(self):
        # 14 entries expected — see test_expected_agent_ids_present for the exact set
        assert len(self._cards) == 14

    def test_all_keys_are_strings(self):
        for key in self._cards:
            assert isinstance(key, str)

    def test_all_cards_are_agent_card_instances(self):
        for card in self._cards.values():
            assert isinstance(card, AgentCard)

    def test_no_two_cards_share_agent_id(self):
        agent_ids = [card.agent_id for card in self._cards.values()]
        assert len(agent_ids) == len(set(agent_ids))

    def test_all_cards_have_non_empty_capabilities(self):
        for agent_id, card in self._cards.items():
            assert len(card.capabilities) > 0, f"{agent_id} has empty capabilities"

    def test_all_cards_have_at_least_one_delegation_rule(self):
        for agent_id, card in self._cards.items():
            assert len(card.delegation_rules) >= 1, f"{agent_id} has no delegation rules"

    def test_all_cards_have_at_least_one_escalation_trigger(self):
        for agent_id, card in self._cards.items():
            assert len(card.escalation_triggers) >= 1, f"{agent_id} has no escalation triggers"

    def test_supervisor_has_admin_tier(self):
        assert self._cards["supervisor"].permission_tier == PermissionTier.ADMIN

    def test_search_agent_has_read_only_tier(self):
        assert self._cards["search_agent"].permission_tier == PermissionTier.READ_ONLY

    def test_expected_agent_ids_present(self):
        expected = {
            "supervisor",
            "pricing_agent",
            "procurement_agent",
            "task_executor",
            "search_agent",
            "inventory_forecasting_agent",
            "anomaly_detection_agent",
            "testing_agent",
            "development_agent",
            "document_parser_agent",
            "form_autofill_agent",
            "reconciliation_agent",
            "cin7_forecasting_agent",
            "cin7_anomaly_agent",
        }
        assert set(self._cards.keys()) == expected

    def test_most_cards_have_confidence_low_trigger(self):
        # 2 cards expected to lack CONFIDENCE_LOW trigger: task_executor and cin7_anomaly_agent
        cards_without = [
            agent_id
            for agent_id, card in self._cards.items()
            if not any(
                t.trigger_type == EscalationTriggerType.CONFIDENCE_LOW
                for t in card.escalation_triggers
            )
        ]
        assert len(cards_without) == 2
        assert set(cards_without) == {"task_executor", "cin7_anomaly_agent"}

    def test_supervisor_card_capabilities(self):
        sup = self._cards["supervisor"]
        assert "orchestration" in sup.capabilities
        assert "routing" in sup.capabilities

    def test_search_agent_boundaries_read_only(self):
        search = self._cards["search_agent"]
        assert any("read-only" in b.lower() or "cannot" in b.lower() for b in search.boundaries)
