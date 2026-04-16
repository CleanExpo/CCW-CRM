# Plan: Agents Protocol v1.0 — Installation into CCW-ERP-CRM

## Objective

Install the comprehensive Agents Protocol v1.0 as the operational constitution governing how all AI agents communicate, delegate, escalate, handle errors, manage permissions, and coordinate within the existing multi-agent system.

## Current System Analysis

The system already has solid foundations:

- **BaseAgent** (base_agent.py) — abstract class with execute/stream/health_check/metrics
- **AgentRegistry** (agent_registry.py) — singleton, capability-based discovery, health monitoring
- **SupervisorAgent** (supervisor_agent.py) — LangGraph task routing with weighted scoring
- **13+ specialized agents** — pricing, procurement, forecasting, anomaly, reconciliation, etc.
- **ProjectOrchestrator** — multi-phase execution with dependency resolution
- **AutonomousLoop** — continuous background task execution
- **RiskAssessor** — safety gates for protected files
- **EventBus** — pub/sub for application events

**What's missing** (protocol gaps):

1. No structured Agent Card manifest
2. No inter-agent message format standard
3. No formal delegation protocol (5 requirements)
4. No escalation protocol with triggers/chain
5. No handoff protocol with state preservation
6. No permission enforcement layer (agents can call any tool)
7. No error classification/retry policy
8. No quality verification mandate with confidence scoring
9. No context budget management
10. No structured agent logging/observability
11. No protocol compliance tracking

## Implementation Strategy

**Principle**: Enhance the existing system — don't replace it. The protocol modules wrap around and extend what's already there. All changes are additive.

## Files to Create

### Phase A: Protocol Core (Pydantic models + pure functions)

- [ ] `apps/backend/src/ai/protocol/__init__.py` — Package exports
- [ ] `apps/backend/src/ai/protocol/agent_card.py` — AgentCard model (Section 1)
- [ ] `apps/backend/src/ai/protocol/messages.py` — Structured message types (Section 2)
- [ ] `apps/backend/src/ai/protocol/delegation.py` — Delegation protocol with 5 requirements (Section 3)
- [ ] `apps/backend/src/ai/protocol/escalation.py` — Escalation triggers, chain, format (Section 4)
- [ ] `apps/backend/src/ai/protocol/handoff.py` — Handoff types and format (Section 5)
- [ ] `apps/backend/src/ai/protocol/permissions.py` — Permission tiers, enforcement, blocklist (Section 6)
- [ ] `apps/backend/src/ai/protocol/errors.py` — Error classification, retry policy (Section 7)
- [ ] `apps/backend/src/ai/protocol/quality.py` — Verification mandate, confidence scoring (Section 8)
- [ ] `apps/backend/src/ai/protocol/context.py` — Context budget, memory hierarchy (Section 9)
- [ ] `apps/backend/src/ai/protocol/logging.py` — Structured agent logging (Section 10)
- [ ] `apps/backend/src/ai/protocol/coordination.py` — Duplicate prevention, conflict resolution, parallel rules (Section 11)
- [ ] `apps/backend/src/ai/protocol/human_loop.py` — Human-in-the-loop gates (Section 12)
- [ ] `apps/backend/src/ai/protocol/compliance.py` — Protocol compliance checking (Section 13)

### Phase B: Integration Layer

- [ ] `apps/backend/src/ai/protocol/protocol_engine.py` — Central ProtocolEngine that ties all modules together, middleware for agent execution
- [ ] `apps/backend/src/api/routes/ai/agent_protocol.py` — 8 API endpoints for protocol operations

### Phase C: Enhance Existing System

- [ ] Modify `apps/backend/src/ai/base_agent.py` — Add protocol-aware execution wrapper, agent_card property
- [ ] Modify `apps/backend/src/ai/orchestration/agent_registry.py` — Add protocol compliance tracking, Agent Card storage
- [ ] Modify `apps/backend/src/ai/orchestration/supervisor_agent.py` — Use delegation protocol for routing, escalation triggers

### Phase D: Agent Card Definitions + Tests

- [ ] `apps/backend/src/ai/protocol/cards/` — Predefined Agent Cards for all 13+ agents
- [ ] `apps/backend/tests/integration/run_protocol_tests.py` — Standalone test runner
- [ ] Modify `apps/backend/src/ai/orchestration/__init__.py` — Export protocol components
- [ ] Modify `apps/backend/src/api/main.py` — Register protocol router

## Detailed Steps

### Phase A: Protocol Core

**Step 1: agent_card.py** — Section 1 of protocol

```python
class AgentCard(BaseModel):
    id: str  # unique-lowercase-hyphenated
    name: str
    type: AgentType  # orchestrator|worker|evaluator|router|hybrid
    version: str = "1.0.0"
    capabilities: list[str]
    boundaries: list[str]  # What it CANNOT do
    inputs: AgentInputSpec
    outputs: AgentOutputSpec
    permissions: AgentPermissions
    delegation: DelegationSpec
    model_tier: ModelTier  # opus|sonnet|haiku|configurable
    max_turns: int
    max_tokens: int | None = None
    protocol_version: str = "1.0.0"
```

**Step 2: messages.py** — Section 2

```python
class AgentMessage(BaseModel):
    id: str
    timestamp: datetime
    from_agent: str
    to_agent: str
    type: MessageType  # task|result|status|escalation|error|query

class TaskMessage(AgentMessage):
    objective: str
    output_format: str
    tools_guidance: list[str]
    boundaries: list[str]
    effort_level: EffortLevel
    priority: Priority
    context: dict[str, Any]

class ResultMessage(AgentMessage):
    status: ResultStatus  # complete|partial|failed|needs_input
    output: dict[str, Any]
    confidence: float  # 0.0-1.0
    issues: list[str]
    suggestions: list[str]
```

**Step 3: delegation.py** — Section 3

- `DelegationRequest` with all 5 requirements (objective, output_format, tools_guidance, boundaries, effort_level)
- `validate_delegation()` — ensures all 5 fields present
- `EffortLevel` enum with tool call limits and subagent limits
- Anti-pattern detection (vague, over-delegation, duplicate, unbounded)

**Step 4: escalation.py** — Section 4

- `EscalationTrigger` enum (10 triggers from the table)
- `EscalationMessage` with context, artifacts
- `EscalationChain` — worker → orchestrator → lead → human
- `should_escalate()` — pure function checking triggers

**Step 5: handoff.py** — Section 5

- `HandoffType` enum (routing, completion, capability, context, scheduled)
- `HandoffMessage` with state, remaining, preserve/discard
- `ContextHandoff` — special case for context window limits

**Step 6: permissions.py** — Section 6

- `PermissionTier` enum (read_only, standard, elevated, system, administrative)
- `PermissionCheck` — validates agent action against AgentCard
- `DANGEROUS_OPERATIONS` blocklist
- `check_permission()` — pure function returns allow/deny

**Step 7: errors.py** — Section 7

- `ErrorCategory` enum (transient, permanent, configuration)
- `ErrorReport` model with sanitized context
- `RetryPolicy` with exponential backoff (2s, 4s, 8s, max 4 attempts)
- `classify_error()` — pure function
- `should_retry()` — pure function

**Step 8: quality.py** — Section 8

- `VerificationMethod` enum (self_review, rules_based, test_execution, etc.)
- `ConfidenceScore` with action recommendations
- `QualityReport` model
- `assess_confidence()` — maps score to action (deliver, flag, escalate)

**Step 9: context.py** — Section 9

- `ContextBudget` model with memory hierarchy tiers
- `MemoryTier` enum (working, session, project, organizational)
- `estimate_context_usage()` — heuristic for context consumption
- `should_compact_context()` — decision function

**Step 10: logging.py** — Section 10

- `AgentLogEntry` model (timestamp, agent_id, event_type, detail)
- `AgentEventType` enum (task_received, tool_call, delegation, escalation, handoff, error, output, permission_check)
- `AgentLogger` class wrapping structlog with protocol format
- `LogLevel` enum (error, warn, info, debug)

**Step 11: coordination.py** — Section 11

- `DuplicateWorkDetector` — tracks claimed topics, conflict detection
- `ConflictResolution` model
- `ParallelExecutionRules` — max 5 parallel, distinct facets, budget per agent
- `resolve_conflict()` — pure function

**Step 12: human_loop.py** — Section 12

- `HumanInputTrigger` enum (7 triggers from the table)
- `HumanInputRequest` model with options and recommendation
- `HumanOverride` model
- `requires_human_input()` — pure function

**Step 13: compliance.py** — Section 13

- `ComplianceLevel` enum (bronze, silver, gold)
- `ComplianceReport` model
- `check_agent_compliance()` — validates Agent Card against protocol
- `get_compliance_level()` — determines which sections are implemented

### Phase B: Integration Layer

**Step 14: protocol_engine.py** — Central coordinator

```python
class ProtocolEngine:
    """Central engine that enforces the Agents Protocol across all agent operations."""

    def __init__(self, registry: AgentRegistry):
        self.registry = registry
        self.agent_cards: dict[str, AgentCard] = {}
        self.message_log: list[AgentLogEntry] = []
        self.escalation_chain: list[str] = []

    async def execute_with_protocol(self, agent_id, task, context) -> ResultMessage
    def register_agent_card(self, card: AgentCard) -> None
    def validate_delegation(self, from_agent, to_agent, request) -> bool
    async def handle_escalation(self, escalation: EscalationMessage) -> None
    async def handle_handoff(self, handoff: HandoffMessage) -> None
    def check_permission(self, agent_id, action, resource) -> bool
    def get_protocol_status(self) -> dict
```

**Step 15: agent_protocol.py** — API endpoints

- `GET /api/ai/protocol/status` — Protocol engine status, compliance overview
- `GET /api/ai/protocol/agents` — All registered Agent Cards
- `GET /api/ai/protocol/agents/{agent_id}/card` — Single Agent Card
- `GET /api/ai/protocol/agents/{agent_id}/compliance` — Compliance report for agent
- `GET /api/ai/protocol/logs` — Recent protocol log entries
- `POST /api/ai/protocol/delegate` — Trigger delegation (validated)
- `POST /api/ai/protocol/escalate` — Trigger escalation
- `GET /api/ai/protocol/health` — Protocol engine health

### Phase C: Enhance Existing System

**Step 16: Enhance BaseAgent**

- Add `agent_card: AgentCard | None` property
- Add `protocol_execute()` wrapper that validates permissions, logs, checks quality
- Add `get_confidence()` method for output confidence scoring
- Keep full backward compatibility — existing `execute()` still works

**Step 17: Enhance AgentRegistry**

- Add `_agent_cards: dict[str, AgentCard]` storage
- Add `register_agent_card()` / `get_agent_card()` methods
- Add `check_compliance()` → ComplianceReport
- Add protocol version tracking

**Step 18: Enhance SupervisorAgent**

- Use DelegationRequest (5 requirements) when routing to agents
- Add escalation trigger checks at each workflow node
- Log all routing decisions in protocol format

### Phase D: Agent Cards + Tests

**Step 19: Predefined Agent Cards** for all agents

- One YAML-like dict per agent, loaded at startup
- Covers: supervisor, pricing, procurement, task_executor, search, inventory_forecasting, anomaly_detection, testing, development, document_parser, form_autofill, reconciliation, cin7_forecasting, cin7_anomaly

**Step 20: Tests**

- Pure function tests for all protocol modules
- Agent Card validation tests
- Delegation/escalation/handoff flow tests
- Permission enforcement tests
- Compliance checking tests

## Success Criteria

- [ ] All protocol models defined as Pydantic BaseModels
- [ ] Protocol engine enforces delegation, escalation, permissions
- [ ] All 13+ agents have registered Agent Cards
- [ ] 8 API endpoints for protocol monitoring/management
- [ ] Tests pass (target: 100+ assertions)
- [ ] Existing agent functionality unbroken (backward compatible)
- [ ] Protocol compliance reporting at Bronze+ level

## Risks

- **Import chain**: Protocol modules must avoid importing database/asyncpg at module level
- **Backward compatibility**: Must not break existing `execute()` calls — protocol wraps, doesn't replace
- **Scope creep**: Protocol is comprehensive — implement core models first, enforcement later
- **Test isolation**: Same mock pattern as Phase 6 (mock BaseAgent for standalone tests)

## Breaking Changes

- None. All changes are additive. Existing agent behavior is preserved.
