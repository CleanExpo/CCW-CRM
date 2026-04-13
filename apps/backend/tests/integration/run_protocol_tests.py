#!/usr/bin/env python3
"""Agents Protocol v1.0 - Standalone Test Runner.

Tests all pure functions, models, and API endpoint definitions
without requiring database or external service connections.

Usage:
    python apps/backend/tests/integration/run_protocol_tests.py
"""

import ast
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Ensure project root is on sys.path
project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project_root))

passed = 0
failed = 0


def check(condition: bool, label: str) -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {label}")
    else:
        failed += 1
        print(f"  [FAIL] {label}")


# ===========================================================================
# SECTION 1: Protocol Models
# ===========================================================================
print("\n" + "=" * 70)
print("AGENTS PROTOCOL v1.0 - Model Tests")
print("=" * 70)

from src.ai.protocol.models import (  # noqa: E402
    AgentCard,
    AgentMessage,
    ConfidenceScore,
    DelegationRequest,
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

# --- AgentCard ---
print("\n--- AgentCard ---")
card = AgentCard(
    agent_id="test-agent",
    name="Test Agent",
    version="1.0.0",
    description="A test agent",
    capabilities=["test", "validation"],
    boundaries=["cannot delete data"],
    inputs={"query": "Search query string"},
    outputs={"result": "Search results"},
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=5,
    timeout_seconds=60,
)
check(card.agent_id == "test-agent", "AgentCard agent_id set correctly")
check(card.name == "Test Agent", "AgentCard name set correctly")
check(len(card.capabilities) == 2, "AgentCard has 2 capabilities")
check(len(card.boundaries) == 1, "AgentCard has 1 boundary")
check(card.permission_tier == PermissionTier.STANDARD, "AgentCard permission tier is STANDARD")
check(card.max_concurrent == 5, "AgentCard max_concurrent is 5")

# --- AgentMessage ---
print("\n--- AgentMessage ---")
msg = AgentMessage(
    sender_id="agent-a",
    recipient_id="agent-b",
    message_type=MessageType.REQUEST,
    payload={"task": "analyze data"},
    priority=Priority.HIGH,
    ttl_seconds=300,
)
check(len(msg.message_id) > 0, "AgentMessage has auto-generated message_id")
check(len(msg.correlation_id) > 0, "AgentMessage has auto-generated correlation_id")
check(msg.sender_id == "agent-a", "AgentMessage sender_id correct")
check(msg.recipient_id == "agent-b", "AgentMessage recipient_id correct")
check(msg.message_type == MessageType.REQUEST, "AgentMessage type is REQUEST")
check(msg.priority == Priority.HIGH, "AgentMessage priority is HIGH")

# --- DelegationRequest ---
print("\n--- DelegationRequest ---")
delegation = DelegationRequest(
    delegator_id="supervisor",
    delegate_id="pricing_agent",
    task="analyze pricing",
    required_capabilities=["pricing"],
    timeout_seconds=60,
    chain=["supervisor"],
)
check(delegation.delegator_id == "supervisor", "DelegationRequest delegator_id correct")
check(delegation.delegate_id == "pricing_agent", "DelegationRequest delegate_id correct")
check(len(delegation.required_capabilities) == 1, "DelegationRequest has 1 required capability")
check(len(delegation.chain) == 1, "DelegationRequest chain has 1 entry")

# --- PermissionTier ---
print("\n--- PermissionTier ---")
check(PermissionTier.READ_ONLY.value == "read_only", "PermissionTier READ_ONLY value")
check(PermissionTier.STANDARD.value == "standard", "PermissionTier STANDARD value")
check(PermissionTier.ELEVATED.value == "elevated", "PermissionTier ELEVATED value")
check(PermissionTier.ADMIN.value == "admin", "PermissionTier ADMIN value")

# --- ErrorClassification ---
print("\n--- ErrorClassification ---")
err = ErrorClassification(
    error_type=ErrorType.TRANSIENT,
    severity=Severity.MEDIUM,
    retryable=True,
    max_retries=3,
    backoff_strategy="exponential",
    message="Connection reset",
)
check(err.error_type == ErrorType.TRANSIENT, "ErrorClassification type is TRANSIENT")
check(err.retryable is True, "ErrorClassification is retryable")
check(err.max_retries == 3, "ErrorClassification max_retries is 3")
check(err.backoff_strategy == "exponential", "ErrorClassification backoff is exponential")

# --- ConfidenceScore ---
print("\n--- ConfidenceScore ---")
conf = ConfidenceScore(score=0.85, reasoning="all good", factors={"speed": 0.9, "health": 0.8})
check(conf.score == 0.85, "ConfidenceScore score is 0.85")
check(conf.reasoning == "all good", "ConfidenceScore reasoning set")
check(len(conf.factors) == 2, "ConfidenceScore has 2 factors")
check(0.0 <= conf.score <= 1.0, "ConfidenceScore within bounds")

# --- HandoffPackage ---
print("\n--- HandoffPackage ---")
handoff = HandoffPackage(
    source_agent_id="agent-a",
    target_agent_id="agent-b",
    task_summary="Continue pricing analysis",
    context={"product_id": "123"},
    progress={"step": 3, "total_steps": 5},
    artifacts=["partial_result_1"],
    reason="Agent A at capacity",
)
check(handoff.source_agent_id == "agent-a", "HandoffPackage source correct")
check(handoff.target_agent_id == "agent-b", "HandoffPackage target correct")
check(len(handoff.artifacts) == 1, "HandoffPackage has 1 artifact")
check(handoff.reason == "Agent A at capacity", "HandoffPackage reason set")

# --- ProtocolVersion ---
print("\n--- ProtocolVersion ---")
version = ProtocolVersion.current()
check(str(version) == "1.0.0", "ProtocolVersion current is 1.0.0")
check(version.major == 1 and version.minor == 0 and version.patch == 0, "ProtocolVersion components")


# ===========================================================================
# SECTION 2: Governor Pure Functions
# ===========================================================================
print("\n" + "=" * 70)
print("AGENTS PROTOCOL v1.0 - Governor Pure Function Tests")
print("=" * 70)

from src.ai.protocol.governor import (  # noqa: E402
    calculate_confidence,
    classify_error,
    detect_delegation_loop,
    should_escalate,
    validate_delegation,
    validate_permissions,
)

# --- validate_delegation ---
print("\n--- validate_delegation ---")

sender_card = AgentCard(
    agent_id="supervisor",
    name="Supervisor",
    capabilities=["orchestration", "delegation"],
    permission_tier=PermissionTier.ADMIN,
)
recipient_card = AgentCard(
    agent_id="pricing_agent",
    name="Pricing Agent",
    capabilities=["pricing", "cost_analysis"],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=5,
)

# Valid delegation
valid_req = DelegationRequest(
    delegator_id="supervisor",
    delegate_id="pricing_agent",
    task="analyze pricing",
    required_capabilities=["pricing"],
    timeout_seconds=60,
    chain=[],
)
is_valid, errors = validate_delegation(valid_req, sender_card, recipient_card)
check(is_valid is True, "Valid delegation passes")
check(len(errors) == 0, "No errors for valid delegation")

# Missing capability
bad_req = DelegationRequest(
    delegator_id="supervisor",
    delegate_id="pricing_agent",
    task="manage inventory",
    required_capabilities=["inventory_management"],
    timeout_seconds=60,
    chain=[],
)
is_valid2, errors2 = validate_delegation(bad_req, sender_card, recipient_card)
check(is_valid2 is False, "Delegation rejected for missing capability")
check(any("missing" in e.lower() for e in errors2), "Error mentions missing capability")

# Circular delegation
loop_req = DelegationRequest(
    delegator_id="supervisor",
    delegate_id="pricing_agent",
    task="analyze",
    required_capabilities=["pricing"],
    timeout_seconds=60,
    chain=["supervisor", "pricing_agent"],  # pricing_agent already in chain
)
is_valid3, errors3 = validate_delegation(loop_req, sender_card, recipient_card)
check(is_valid3 is False, "Circular delegation detected")
check(any("circular" in e.lower() for e in errors3), "Error mentions circular delegation")

# READ_ONLY sender cannot delegate
readonly_sender = AgentCard(
    agent_id="reader",
    name="Reader",
    capabilities=["read"],
    permission_tier=PermissionTier.READ_ONLY,
)
ro_req = DelegationRequest(
    delegator_id="reader",
    delegate_id="pricing_agent",
    task="delegate",
    required_capabilities=["pricing"],
    timeout_seconds=60,
    chain=[],
)
is_valid4, errors4 = validate_delegation(ro_req, readonly_sender, recipient_card)
check(is_valid4 is False, "READ_ONLY agent cannot delegate")
check(any("insufficient" in e.lower() or "permission" in e.lower() for e in errors4), "Error mentions permissions")

# --- classify_error ---
print("\n--- classify_error ---")
err_timeout = classify_error(TimeoutError("operation timed out"))
check(err_timeout.error_type == ErrorType.TIMEOUT, "TimeoutError -> TIMEOUT type")
check(err_timeout.retryable is True, "TimeoutError is retryable")

err_perm = classify_error(PermissionError("access denied"))
check(err_perm.error_type == ErrorType.PERMISSION, "PermissionError -> PERMISSION type")
check(err_perm.retryable is False, "PermissionError is not retryable")

err_val = classify_error(ValueError("invalid input"))
check(err_val.error_type == ErrorType.DATA_QUALITY, "ValueError -> DATA_QUALITY type")
check(err_val.severity == Severity.LOW, "ValueError severity is LOW")

err_conn = classify_error(ConnectionError("connection reset"))
check(err_conn.error_type == ErrorType.TRANSIENT, "ConnectionError -> TRANSIENT type")
check(err_conn.retryable is True, "ConnectionError is retryable")

# --- should_escalate ---
print("\n--- should_escalate ---")
high_conf = ConfidenceScore(score=0.9, reasoning="good", factors={})
low_conf = ConfidenceScore(score=0.2, reasoning="bad", factors={})

triggers = [
    EscalationTrigger(
        trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
        threshold=0.5,
        description="Low confidence",
    ),
]

esc_no, desc_no = should_escalate(high_conf, triggers)
check(esc_no is False, "High confidence does not trigger escalation")
check(desc_no is None, "No escalation description for high confidence")

esc_yes, desc_yes = should_escalate(low_conf, triggers)
check(esc_yes is True, "Low confidence triggers escalation")
check(desc_yes is not None and "low confidence" in desc_yes.lower(), "Escalation description present")

# --- calculate_confidence ---
print("\n--- calculate_confidence ---")
good_result = {"data": [1, 2, 3], "status": "ok"}
conf_good = calculate_confidence(good_result, 500, 1.0, expected_time_ms=1000)
check(conf_good.score >= 0.7, f"Good confidence score ({conf_good.score:.2f} >= 0.7)")
check("nominal" in conf_good.reasoning, "Good confidence reasoning is nominal")

error_result = {"error": "something failed"}
conf_bad = calculate_confidence(error_result, 5000, 0.3, expected_time_ms=1000)
check(conf_bad.score < 0.5, f"Bad confidence score ({conf_bad.score:.2f} < 0.5)")

slow_result = {"data": "ok"}
conf_slow = calculate_confidence(slow_result, 30000, 0.8, expected_time_ms=5000)
check(conf_slow.factors.get("execution_time", 1.0) < 0.5, "Slow execution reduces time factor")

# With expected keys
conf_complete = calculate_confidence(
    {"name": "x", "price": 10}, 500, 1.0,
    expected_time_ms=1000, expected_keys=["name", "price", "stock"]
)
check(0.5 < conf_complete.factors.get("completeness", 0) < 1.0, "Partial completeness scored")

conf_empty = calculate_confidence(
    {}, 500, 1.0, expected_time_ms=1000, expected_keys=["name", "price"]
)
check(conf_empty.factors.get("completeness", 1.0) == 0.0, "Empty result = 0 completeness")

# --- validate_permissions ---
print("\n--- validate_permissions ---")
admin_card = AgentCard(
    agent_id="admin", name="Admin", permission_tier=PermissionTier.ADMIN
)
standard_card = AgentCard(
    agent_id="std", name="Standard", permission_tier=PermissionTier.STANDARD
)
readonly_card = AgentCard(
    agent_id="ro", name="ReadOnly", permission_tier=PermissionTier.READ_ONLY
)

check(validate_permissions(admin_card, "delete") is True, "ADMIN can delete")
check(validate_permissions(admin_card, "read") is True, "ADMIN can read")
check(validate_permissions(standard_card, "read") is True, "STANDARD can read")
check(validate_permissions(standard_card, "delegate") is True, "STANDARD can delegate")
check(validate_permissions(standard_card, "delete") is False, "STANDARD cannot delete")
check(validate_permissions(readonly_card, "create") is False, "READ_ONLY cannot create")

# --- detect_delegation_loop ---
print("\n--- detect_delegation_loop ---")
check(detect_delegation_loop(["a", "b"], "c") is False, "No loop when delegate not in chain")
check(detect_delegation_loop(["a", "b", "c"], "b") is True, "Loop detected when delegate in chain")
check(detect_delegation_loop([], "a") is False, "Empty chain = no loop")
check(detect_delegation_loop(["x"], "x") is True, "Single-element chain loop detected")


# ===========================================================================
# SECTION 3: Message Bus Pure Functions
# ===========================================================================
print("\n" + "=" * 70)
print("AGENTS PROTOCOL v1.0 - Message Bus Tests")
print("=" * 70)

from src.ai.protocol.message_bus import create_message, create_response, is_expired  # noqa: E402

# --- create_message ---
print("\n--- create_message ---")
msg1 = create_message("a", "b", MessageType.REQUEST, {"key": "val"})
check(msg1.sender_id == "a", "create_message sender correct")
check(msg1.recipient_id == "b", "create_message recipient correct")
check(msg1.message_type == MessageType.REQUEST, "create_message type correct")
check(msg1.payload == {"key": "val"}, "create_message payload correct")

# --- create_response ---
print("\n--- create_response ---")
resp = create_response(msg1, {"result": "done"})
check(resp.correlation_id == msg1.correlation_id, "Response preserves correlation_id")
check(resp.sender_id == msg1.recipient_id, "Response swaps sender/recipient")
check(resp.message_type == MessageType.RESPONSE, "Response type is RESPONSE")

# --- is_expired ---
print("\n--- is_expired ---")
fresh_msg = AgentMessage(
    sender_id="a",
    recipient_id="b",
    message_type=MessageType.REQUEST,
    payload={},
    ttl_seconds=3600,  # 1 hour
)
check(is_expired(fresh_msg) is False, "Fresh message is not expired")

expired_msg = AgentMessage(
    sender_id="a",
    recipient_id="b",
    message_type=MessageType.REQUEST,
    payload={},
    timestamp=datetime.now(UTC) - timedelta(hours=2),
    ttl_seconds=60,  # 1 minute TTL, 2 hours ago
)
check(is_expired(expired_msg) is True, "Old message is expired")


# ===========================================================================
# SECTION 4: Error Handler Pure Functions
# ===========================================================================
print("\n" + "=" * 70)
print("AGENTS PROTOCOL v1.0 - Error Handler Tests")
print("=" * 70)

from src.ai.protocol.error_handler import (  # noqa: E402
    calculate_backoff,
    classify_exception,
    should_retry,
)

# --- classify_exception ---
print("\n--- classify_exception ---")
cls_val = classify_exception(ValueError("bad input"))
check(cls_val.error_type == ErrorType.DATA_QUALITY, "ValueError -> DATA_QUALITY")
check(cls_val.retryable is False, "ValueError not retryable")

cls_timeout = classify_exception(TimeoutError("timed out"))
check(cls_timeout.error_type == ErrorType.TIMEOUT, "TimeoutError -> TIMEOUT")
check(cls_timeout.retryable is True, "TimeoutError is retryable")

cls_perm = classify_exception(PermissionError("denied"))
check(cls_perm.error_type == ErrorType.PERMISSION, "PermissionError -> PERMISSION")
check(cls_perm.severity == Severity.HIGH, "PermissionError severity is HIGH")

cls_conn = classify_exception(ConnectionRefusedError("refused"))
check(cls_conn.error_type == ErrorType.TRANSIENT, "ConnectionRefusedError -> TRANSIENT")
check(cls_conn.retryable is True, "ConnectionRefusedError is retryable")

cls_key = classify_exception(KeyError("missing"))
check(cls_key.error_type == ErrorType.DATA_QUALITY, "KeyError -> DATA_QUALITY")

cls_runtime = classify_exception(RuntimeError("unexpected"))
check(cls_runtime.error_type == ErrorType.PERMANENT, "RuntimeError -> PERMANENT")

# --- should_retry ---
print("\n--- should_retry ---")
retryable = ErrorClassification(
    error_type=ErrorType.TRANSIENT,
    severity=Severity.MEDIUM,
    retryable=True,
    max_retries=3,
    backoff_strategy="exponential",
    message="test",
)
check(should_retry(retryable, 0) is True, "Attempt 0 of 3 -> retry")
check(should_retry(retryable, 2) is True, "Attempt 2 of 3 -> retry")
check(should_retry(retryable, 3) is False, "Attempt 3 of 3 -> no more retries")

non_retryable = ErrorClassification(
    error_type=ErrorType.PERMANENT,
    severity=Severity.MEDIUM,
    retryable=False,
    max_retries=0,
    backoff_strategy="none",
    message="test",
)
check(should_retry(non_retryable, 0) is False, "Non-retryable -> never retry")

# --- calculate_backoff ---
print("\n--- calculate_backoff ---")
check(calculate_backoff("none", 0) == 0.0, "none strategy -> 0.0")
check(calculate_backoff("linear", 2, base_delay=1.0) == 3.0, "linear: 1.0 * (2+1) = 3.0")
check(calculate_backoff("exponential", 3, base_delay=1.0) == 8.0, "exponential: 1.0 * 2^3 = 8.0")


# ===========================================================================
# SECTION 5: Confidence Pure Functions
# ===========================================================================
print("\n" + "=" * 70)
print("AGENTS PROTOCOL v1.0 - Confidence Scoring Tests")
print("=" * 70)

from src.ai.protocol.confidence import (  # noqa: E402
    aggregate_confidence,
    score_from_completeness,
    score_from_execution,
    score_from_health,
)

# --- score_from_execution ---
print("\n--- score_from_execution ---")
check(score_from_execution(500, 1000) == 1.0, "Fast execution -> 1.0")
check(score_from_execution(1500, 1000) < 1.0, "Slightly slow execution < 1.0")
check(score_from_execution(5000, 1000) == 0.1, "Very slow execution -> 0.1")

# --- score_from_health ---
print("\n--- score_from_health ---")
check(score_from_health(1.0) == 1.0, "Healthy agent -> 1.0")
check(score_from_health(0.3) == 0.3, "Degraded agent -> 0.3")

# --- score_from_completeness ---
print("\n--- score_from_completeness ---")
check(
    score_from_completeness({"a": 1, "b": 2, "c": 3}, ["a", "b", "c"]) == 1.0,
    "Complete result -> 1.0",
)
check(
    score_from_completeness({"a": 1}, ["a", "b", "c"]) < 1.0,
    "Partial result < 1.0",
)
check(
    score_from_completeness({}, ["a", "b"]) == 0.0,
    "Empty result -> 0.0",
)

# --- aggregate_confidence ---
print("\n--- aggregate_confidence ---")
agg_equal = aggregate_confidence({"speed": 0.9, "health": 0.8, "completeness": 1.0})
check(agg_equal.score > 0.8, f"Equal weight aggregate ({agg_equal.score:.2f}) > 0.8")

agg_weighted = aggregate_confidence(
    {"speed": 1.0, "health": 0.0},
    weights={"speed": 0.3, "health": 0.7},
)
check(agg_weighted.score < 0.5, f"Weighted aggregate ({agg_weighted.score:.2f}) < 0.5 (health=0 weighted 70%)")

agg_empty = aggregate_confidence({})
check(agg_empty.score == 0.0, "Empty factors -> 0.0")


# ===========================================================================
# SECTION 6: AST Endpoint Verification
# ===========================================================================
print("\n" + "=" * 70)
print("AGENTS PROTOCOL v1.0 - API Endpoint Verification (AST)")
print("=" * 70)

protocol_route_file = project_root / "src" / "api" / "routes" / "ai" / "protocol.py"
with open(protocol_route_file) as f:
    tree = ast.parse(f.read(), filename=str(protocol_route_file))

# Find all decorated functions
endpoints_found: dict[str, str] = {}
for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                method = decorator.func.attr  # get, post, etc.
                if decorator.args and isinstance(decorator.args[0], ast.Constant):
                    path = decorator.args[0].value
                    endpoints_found[f"{method.upper()} {path}"] = node.name

print(f"\nFound {len(endpoints_found)} endpoints:")
for ep, fn in sorted(endpoints_found.items()):
    print(f"  {ep} -> {fn}")

check("GET /version" in endpoints_found, "GET /version endpoint exists")
check("GET /agents" in endpoints_found, "GET /agents endpoint exists")
check("GET /agents/{agent_id}" in endpoints_found, "GET /agents/{agent_id} endpoint exists")
check("POST /validate-delegation" in endpoints_found, "POST /validate-delegation endpoint exists")
check("GET /health" in endpoints_found, "GET /health endpoint exists")
check("GET /audit-log" in endpoints_found, "GET /audit-log endpoint exists")


# ===========================================================================
# SUMMARY
# ===========================================================================
print("\n" + "=" * 70)
total = passed + failed
print(f"PROTOCOL TESTS: {passed} passed, {failed} failed, {total} total")
print("=" * 70)

if failed > 0:
    print("\n[FAIL] SOME TESTS FAILED")
    sys.exit(1)
else:
    print("\n[OK] ALL PROTOCOL TESTS PASSED")
    sys.exit(0)
