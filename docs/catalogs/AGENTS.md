# Agents Catalog — CCW ERP/CRM AI System

# Last Updated: 2026-03-17

# Total Agents: 23 (+ 2 Generators = 25 total)

# Source: apps/backend/src/ai/

# Pattern: BaseAgent (abstract base class with agent_id, capabilities, execute(), can_handle())

---

## Agent Entries

### Core Agents (apps/backend/src/ai/agents/)

### AGENT-001: Chat Assistant

- **File**: `apps/backend/src/ai/agents/chat_assistant.py`
- **State File**: `apps/backend/src/ai/agents/chat_state.py`
- **Domain**: Customer Interaction / Chat
- **API Route**: /api/ai/chat (ROUTE-060)
- **Skills**: Conversation management, context retention, multi-turn dialogue
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-002: Content Generator

- **File**: `apps/backend/src/ai/agents/content_generator.py`
- **State File**: `apps/backend/src/ai/agents/content_state.py`
- **Domain**: Content / AI Generation
- **API Route**: /api/ai/generate (ROUTE-062)
- **Skills**: Quote generation, email drafting, product descriptions, summaries
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-003: Insights Agent

- **File**: `apps/backend/src/ai/agents/insights_agent.py`
- **State File**: `apps/backend/src/ai/agents/insights_state.py`
- **Domain**: Analytics / Business Intelligence
- **API Route**: /api/ai/insights (ROUTE-061)
- **Skills**: Business trend analysis, sales insights, anomaly surfacing
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-004: Risk Assessor

- **File**: `apps/backend/src/ai/agents/risk_assessor.py`
- **Domain**: Risk Management / Governance
- **API Route**: /api/ai/protocol (ROUTE-071)
- **Skills**: Risk scoring, approval gate evaluation, confidence thresholding
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-005: Rollback Agent

- **File**: `apps/backend/src/ai/agents/rollback_agent.py`
- **Domain**: Autonomous Development / Safety
- **API Route**: /api/autonomous (ROUTE-065)
- **Skills**: Code rollback, deployment reversal, change detection
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### Specialized Agents (apps/backend/src/ai/agents/specialized/)

### AGENT-006: Anomaly Detection Agent

- **File**: `apps/backend/src/ai/agents/specialized/anomaly_detection_agent.py`
- **Domain**: Monitoring / Analytics
- **API Route**: /api/ai/anomaly (ROUTE-066)
- **Skills**: Statistical anomaly detection, threshold alerts, time-series analysis
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-007: Cin7 Anomaly Agent

- **File**: `apps/backend/src/ai/agents/specialized/cin7_anomaly_agent.py`
- **Domain**: Integration / Cin7 / Monitoring
- **API Route**: /api/ai/cin7/anomaly (ROUTE-079)
- **Skills**: Cin7 sync anomaly detection, inventory discrepancy detection, drift monitoring
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-008: Cin7 Forecasting Agent

- **File**: `apps/backend/src/ai/agents/specialized/cin7_forecasting_agent.py`
- **Domain**: Inventory / Forecasting / Cin7
- **API Route**: /api/ai/cin7/forecast (ROUTE-078)
- **Skills**: Demand forecasting from Cin7 data, stock level predictions, reorder point calculation
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-009: Cin7 Shadow Agent

- **File**: `apps/backend/src/ai/agents/specialized/cin7_shadow_agent.py`
- **Domain**: Integration / Cin7 / Gap Analysis
- **API Route**: /api/ai/cin7-shadow (ROUTE-080)
- **Skills**: Shadow sync gap analysis, auto-resolution, data reconciliation
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-010: Development Agent

- **File**: `apps/backend/src/ai/agents/specialized/development_agent.py`
- **Domain**: Autonomous Development
- **API Route**: /api/autonomous (ROUTE-065)
- **Skills**: Code generation, test writing, PR creation, self-improvement
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-011: Document Parser Agent

- **File**: `apps/backend/src/ai/agents/specialized/document_parser_agent.py`
- **Domain**: Documents / AI
- **API Route**: /api/ai/documents/parse (ROUTE-069)
- **Skills**: PDF parsing, invoice extraction, structured data extraction from documents
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-012: Form Autofill Agent

- **File**: `apps/backend/src/ai/agents/specialized/form_autofill_agent.py`
- **Domain**: Forms / AI Assistance
- **API Route**: /api/ai/forms/autofill (ROUTE-070)
- **Skills**: Field prediction, customer data pre-population, form completion from context
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-013: Inventory Forecasting Agent

- **File**: `apps/backend/src/ai/agents/specialized/inventory_forecasting_agent.py`
- **Domain**: Inventory / AI Forecasting
- **API Route**: /api/ai/inventory/forecast (ROUTE-067)
- **Skills**: Multi-SKU demand forecasting, seasonal analysis, safety stock calculation
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-014: Marketing Agent

- **File**: `apps/backend/src/ai/agents/specialized/marketing_agent.py`
- **Domain**: Marketing / Content / Campaigns
- **API Route**: /api/ai/marketing (ROUTE-081)
- **Skills**: Campaign generation, audience analysis, content marketing
- **Status**: Active (UNI-857)
- **Last Verified**: 2026-03-17

### AGENT-015: Pricing Agent

- **File**: `apps/backend/src/ai/agents/specialized/pricing_agent.py`
- **State File**: `apps/backend/src/ai/agents/specialized/pricing_state.py`
- **Domain**: Pricing / Revenue
- **API Route**: /api/ai/specialized/pricing (ROUTE-075)
- **Skills**: Dynamic pricing, margin optimization, competitor price analysis
- **Status**: Active (initialized on startup in main.py)
- **Last Verified**: 2026-03-17

### AGENT-016: Procurement Agent

- **File**: `apps/backend/src/ai/agents/specialized/procurement_agent.py`
- **State File**: `apps/backend/src/ai/agents/specialized/procurement_state.py`
- **Domain**: Procurement / Supply Chain
- **API Route**: /api/ai/specialized/procurement (ROUTE-075)
- **Skills**: PO generation, supplier evaluation, reorder optimization
- **Status**: Active (initialized on startup in main.py)
- **Last Verified**: 2026-03-17

### AGENT-017: Project Intelligence Agent

- **File**: `apps/backend/src/ai/agents/specialized/project_intelligence_agent.py`
- **Domain**: Codebase Auditing / Gap Analysis
- **API Route**: /api/ai/project-intelligence (ROUTE-083)
- **Skills**: Route scanning, page scanning, agent scanning, cross-referencing, PRD generation
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-018: Recommendation Agent

- **File**: `apps/backend/src/ai/agents/specialized/recommendation_agent.py`
- **Domain**: Recommendations / E-Commerce
- **API Route**: /api/recommendations (ROUTE-064)
- **Skills**: Collaborative filtering, content-based filtering, cross-sell/upsell
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-019: Reconciliation Agent

- **File**: `apps/backend/src/ai/agents/specialized/reconciliation_agent.py`
- **Domain**: Financial / POS Reconciliation
- **API Route**: /api/reconciliation (financial routes)
- **Skills**: Transaction matching, bank feed reconciliation, discrepancy resolution
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-020: Search Agent

- **File**: `apps/backend/src/ai/agents/specialized/search_agent.py`
- **Domain**: Search / AI
- **API Route**: /api/search (ROUTE-063)
- **Skills**: Semantic search, hybrid ranking, vector similarity (pgvector), query expansion
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-021: Staff Copilot Agent

- **File**: `apps/backend/src/ai/agents/specialized/staff_copilot_agent.py`
- **Domain**: Operational ERP/CRM Queries
- **API Route**: /api/ai/staff-copilot (ROUTE-082)
- **Skills**: Natural language ERP queries, operational assistance, data lookup
- **Status**: Active (UNI-857)
- **Last Verified**: 2026-03-17

### AGENT-022: Task Executor Agent

- **File**: `apps/backend/src/ai/agents/specialized/task_executor_agent.py`
- **State File**: `apps/backend/src/ai/agents/specialized/task_executor_state.py`
- **Domain**: Orchestration / Task Execution
- **API Route**: /api/ai/supervisor (ROUTE-072)
- **Skills**: Task decomposition, parallel execution, result aggregation
- **Status**: Active (initialized on startup in main.py)
- **Last Verified**: 2026-03-17

### AGENT-023: Testing Agent

- **File**: `apps/backend/src/ai/agents/specialized/testing_agent.py`
- **Domain**: Autonomous Development / QA
- **API Route**: /api/autonomous (ROUTE-065)
- **Skills**: Test generation, test execution, coverage analysis, regression detection
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### Generators (apps/backend/src/ai/generators/)

### AGENT-024: Email Generator

- **File**: `apps/backend/src/ai/generators/email_generator.py`
- **Domain**: Content / Email
- **BaseAgent**: No (generator utility class, not full agent)
- **API Route**: /api/ai/generate (ROUTE-062) — via Content Generator agent
- **Skills**: Templated email drafting, personalization, SendGrid formatting
- **Status**: Active
- **Last Verified**: 2026-03-17

### AGENT-025: Quote Generator

- **File**: `apps/backend/src/ai/generators/quote_generator.py`
- **Domain**: Orders / AI Generation
- **BaseAgent**: No (generator utility class)
- **API Route**: /api/ai/generate or /api/quotes/generate — via Content Generator
- **Skills**: AI-assisted quote line item generation, pricing suggestion, terms drafting
- **Status**: Active
- **Last Verified**: 2026-03-17

---

## Orchestration System

### Supervisor Agent

- **File**: `apps/backend/src/ai/orchestration/supervisor_agent.py`
- **State File**: `apps/backend/src/ai/orchestration/supervisor_state.py`
- **Domain**: Orchestration
- **Pattern**: Singleton via get_supervisor_agent()
- **Role**: Routes tasks to appropriate specialized agents, manages agent registry
- **Initialized On Startup**: Yes (main.py lifespan)
- **API Route**: ROUTE-072

### Health Monitor

- **File**: `apps/backend/src/ai/monitoring/health_monitor.py`
- **Domain**: Infrastructure / AI Health
- **Pattern**: Singleton via get_health_monitor()
- **Role**: Monitors all registered agent health, background task
- **Started On Startup**: Yes (main.py lifespan)

### Learning Engine

- **File**: `apps/backend/src/ai/learning/learning_engine.py`
- **Domain**: AI / Adaptive Learning
- **Pattern**: Singleton via get_learning_engine()
- **Role**: Loads and stores patterns from DB for agent improvement
- **Initialized On Startup**: Yes (main.py lifespan)

### Agent Registry

- **File**: `apps/backend/src/ai/orchestration/agent_registry.py`
- **Domain**: Infrastructure / Registration
- **Role**: Central registry of all agent instances

### Project Orchestrator

- **File**: `apps/backend/src/ai/orchestration/project_orchestrator.py`
- **Domain**: Autonomous Development
- **Role**: Coordinates multi-step development projects

### Autonomous Loop

- **File**: `apps/backend/src/ai/orchestration/autonomous_loop.py`
- **Domain**: Autonomous Development
- **Role**: Continuous autonomous execution loop
