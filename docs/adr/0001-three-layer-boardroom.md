# ADR-0001: Adopt 3-Layer AI Boardroom Architecture

## Status
Accepted

## Context
CCW Cowork needed an autonomous business intelligence and execution system that could run boardroom-level analysis, generate actionable insights, and execute decisions without constant human intervention. The challenge was building an AI system that could handle complex, multi-stakeholder decisions while maintaining governance and audit trails.

## Decision
Adopt a 3-layer AI boardroom architecture:
- Layer 1 (Claude.ai Chat): Strategic ideation, high-level planning, and CEO-level decisions
- Layer 2 (Claude.ai Projects/Cowork): Persistent context, board member collaboration, document management
- Layer 3 (Claude Code): Autonomous execution, code generation, CRON jobs, data operations

Each layer has defined responsibilities and handoff protocols. The boardroom consists of 13 specialized board member agents (CEO, CFO, CTO, CMO, COO, CLO, CHRO, VP-Sales, VP-CX, VP-Product, Data-Scientist, Security-Architect, Witness).

## Consequences

**Easier**:
- Clear separation of concerns between strategic and operational AI
- Governance through the Witness agent (immutable audit trail)
- CRON execution provides genuine business value between human sessions
- 13 specialized agents provide domain expertise without context pollution

**Harder**:
- Context handoff between layers requires structured state management
- Session persistence and crash recovery must be built explicitly
- Cost management across 3 layers and 13 agents requires model routing
- Security surface area is larger with autonomous execution
