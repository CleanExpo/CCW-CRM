# Plan: Agents Protocol v1.0

## Objective

Install the Agents Protocol v1.0 as the operational constitution governing agent communication, delegation, escalation, permissions, and coordination. All changes are additive — existing agent behaviour is preserved.

## Existing Foundations

- `BaseAgent` — abstract class: execute / stream / health_check / metrics
- `AgentRegistry` — singleton, capability-based discovery, health monitoring
- `SupervisorAgent` — LangGraph task routing with weighted scoring
- `ProjectOrchestrator` — multi-phase execution with dependency resolution
- `AutonomousLoop` — continuous background task execution
- `RiskAssessor` — safety gates for protected files
- `EventBus` — pub/sub for application events
- 13+ specialised agents (pricing, procurement, forecasting, anomaly, reconciliation, etc.)

## Protocol Gaps

1. No Agent Card manifest
2. No inter-agent message format standard
3. No formal delegation protocol (5 requirements)
4. No escalation chain (triggers + chain)
5. No handoff protocol with state preservation
6. No permission enforcement layer
7. No error classification / retry policy
8. No confidence scoring / quality verification mandate
9. No context budget management
10. No structured agent logging / observability
11. No protocol compliance tracking

---

## Phase A — Protocol Core (`apps/backend/src/ai/protocol/`)

- [ ] `__init__.py` — package exports
- [ ] `agent_card.py` — AgentCard model (id, name, type, capabilities, boundaries, permissions, model_tier, max_turns)
- [ ] `messages.py` — AgentMessage, TaskMessage, ResultMessage (type, objective, output_format, confidence)
- [ ] `delegation.py` — DelegationRequest, validate_delegation(), EffortLevel enum, anti-pattern detection
- [ ] `escalation.py` — EscalationTrigger (10 triggers), EscalationMessage, EscalationChain, should_escalate()
- [ ] `handoff.py` — HandoffType enum (5 types), HandoffMessage with state/preserve/discard
- [ ] `permissions.py` — PermissionTier enum, check_permission(), DANGEROUS_OPERATIONS blocklist
- [ ] `errors.py` — ErrorCategory enum, ErrorReport, RetryPolicy (2s/4s/8s, max 4 attempts), classify_error(), should_retry()
- [ ] `quality.py` — VerificationMethod enum, ConfidenceScore, QualityReport, assess_confidence()
- [ ] `context.py` — ContextBudget, MemoryTier enum (4 tiers), estimate_context_usage(), should_compact_context()
- [ ] `logging.py` — AgentLogEntry, AgentEventType enum (8 events), AgentLogger wrapping structlog
- [ ] `coordination.py` — DuplicateWorkDetector, ConflictResolution, ParallelExecutionRules (max 5 parallel), resolve_conflict()
- [ ] `human_loop.py` — HumanInputTrigger enum (7 triggers), HumanInputRequest, requires_human_input()
- [ ] `compliance.py` — ComplianceLevel enum (bronze/silver/gold), ComplianceReport, check_agent_compliance()

## Phase B — Integration Layer

- [ ] `protocol_engine.py` — ProtocolEngine: execute_with_protocol, register_agent_card, validate_delegation, handle_escalation, handle_handoff, check_permission, get_protocol_status
- [ ] `apps/backend/src/api/routes/ai/agent_protocol.py` — 8 endpoints: GET status, GET agents, GET agents/{id}/card, GET agents/{id}/compliance, GET logs, POST delegate, POST escalate, GET health

## Phase C — Enhance Existing System

- [ ] `base_agent.py` — add agent_card property, protocol_execute() wrapper (validates permissions, logs, checks quality), get_confidence()
- [ ] `agent_registry.py` — add \_agent_cards storage, register_agent_card(), get_agent_card(), check_compliance() → ComplianceReport
- [ ] `supervisor_agent.py` — use DelegationRequest (5 requirements) for routing, add escalation trigger checks, log routing decisions

## Phase D — Agent Cards + Tests

- [ ] `apps/backend/src/ai/protocol/cards/` — Agent Cards for all 13+ agents (supervisor, pricing, procurement, task_executor, search, inventory_forecasting, anomaly_detection, testing, development, document_parser, form_autofill, reconciliation, cin7_forecasting, cin7_anomaly)
- [ ] `apps/backend/src/ai/orchestration/__init__.py` — export protocol components
- [ ] `apps/backend/src/api/main.py` — register protocol router
- [ ] `apps/backend/tests/integration/run_protocol_tests.py` — 100+ assertions covering: pure functions, Agent Card validation, delegation/escalation/handoff flows, permission enforcement, compliance checking

## Success Criteria

- [ ] All protocol models: Pydantic BaseModels
- [ ] Protocol engine enforces delegation, escalation, permissions
- [ ] All 13+ agents have registered Agent Cards
- [ ] 8 API endpoints operational
- [ ] Tests pass (100+ assertions)
- [ ] Existing agent functionality unbroken
- [ ] Compliance reporting at Bronze+

## Risks

- **Import chain**: Protocol modules must not import database/asyncpg at module level
- **Backward compat**: `execute()` calls must still work — protocol wraps, doesn't replace
- **Scope**: Implement core models first, enforcement second
- **Test isolation**: Mock BaseAgent same pattern as Phase 6
