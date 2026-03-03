# Agents Catalog — CCW ERP/CRM AI System

# Last Updated: 2026-03-03

# Total Agents: 21

# Source: apps/backend/src/ai/

# Pattern: BaseAgent (abstract base class with agent_id, capabilities, execute(), can_handle())

---

## Agent Entries

### Core Agents (apps/backend/src/ai/agents/)

### AGENT-001: Chat Assistant

- **File**: `apps/backend/src/ai/agents/chat_assistant.py`
- **Domain**: Customer Interaction / Chat
- **BaseAgent**: Yes (likely — follows convention)
- **State File**: `apps/backend/src/ai/agents/chat_state.py`
- **API Route**: /api/ai/chat (ROUTE-044)
- **Skills**: Conversation management, context retention, multi-turn dialogue
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-002: Content Generator

- **File**: `apps/backend/src/ai/agents/content_generator.py`
- **Domain**: Content / AI Generation
- **BaseAgent**: Yes (likely)
- **State File**: `apps/backend/src/ai/agents/content_state.py`
- **API Route**: /api/ai/generate (ROUTE-046)
- **Skills**: Quote generation, email drafting, product descriptions, summaries
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-003: Insights Agent

- **File**: `apps/backend/src/ai/agents/insights_agent.py`
- **Domain**: Analytics / Business Intelligence
- **BaseAgent**: Yes (likely)
- **State File**: `apps/backend/src/ai/agents/insights_state.py`
- **API Route**: /api/ai/insights (ROUTE-045)
- **Skills**: Business trend analysis, sales insights, anomaly surfacing
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-004: Risk Assessor

- **File**: `apps/backend/src/ai/agents/risk_assessor.py`
- **Domain**: Risk Management / Governance
- **BaseAgent**: Yes (likely)
- **State File**: None observed
- **API Route**: Likely /api/ai/protocol or supervisor (ROUTE-055/056)
- **Skills**: Risk scoring, approval gate evaluation, confidence thresholding
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-005: Rollback Agent

- **File**: `apps/backend/src/ai/agents/rollback_agent.py`
- **Domain**: Autonomous Development / Safety
- **BaseAgent**: Yes (likely)
- **State File**: None observed
- **API Route**: /api/autonomous (ROUTE-049)
- **Skills**: Code rollback, deployment reversal, change detection
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

---

### Specialized Agents (apps/backend/src/ai/agents/specialized/)

### AGENT-006: Anomaly Detection Agent

- **File**: `apps/backend/src/ai/agents/specialized/anomaly_detection_agent.py`
- **Domain**: Monitoring / Analytics
- **BaseAgent**: Yes (specialized agent pattern)
- **State File**: None observed
- **API Route**: /api/ai/anomaly (ROUTE-050)
- **Skills**: Statistical anomaly detection, threshold alerts, time-series analysis
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-007: Cin7 Anomaly Agent

- **File**: `apps/backend/src/ai/agents/specialized/cin7_anomaly_agent.py`
- **Domain**: Integration / Cin7 / Monitoring
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/ai/cin7/anomaly (ROUTE-062)
- **Skills**: Cin7 sync anomaly detection, inventory discrepancy detection, drift monitoring
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-008: Cin7 Forecasting Agent

- **File**: `apps/backend/src/ai/agents/specialized/cin7_forecasting_agent.py`
- **Domain**: Inventory / Forecasting / Cin7
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/ai/cin7/forecast (ROUTE-061)
- **Skills**: Demand forecasting from Cin7 data, stock level predictions, reorder point calculation
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-009: Development Agent

- **File**: `apps/backend/src/ai/agents/specialized/development_agent.py`
- **Domain**: Autonomous Development
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/autonomous (ROUTE-049)
- **Skills**: Code generation, test writing, PR creation, self-improvement
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-010: Document Parser Agent

- **File**: `apps/backend/src/ai/agents/specialized/document_parser_agent.py`
- **Domain**: Documents / AI
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/ai/documents/parse (ROUTE-053)
- **Skills**: PDF parsing, invoice extraction, structured data extraction from documents
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-011: Form Autofill Agent

- **File**: `apps/backend/src/ai/agents/specialized/form_autofill_agent.py`
- **Domain**: Forms / AI Assistance
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/ai/forms/autofill (ROUTE-054)
- **Skills**: Field prediction, customer data pre-population, form completion from context
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-012: Inventory Forecasting Agent

- **File**: `apps/backend/src/ai/agents/specialized/inventory_forecasting_agent.py`
- **Domain**: Inventory / AI Forecasting
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/ai/inventory/forecast (ROUTE-051)
- **Skills**: Multi-SKU demand forecasting, seasonal analysis, safety stock calculation
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-013: Pricing Agent

- **File**: `apps/backend/src/ai/agents/specialized/pricing_agent.py`
- **Domain**: Pricing / Revenue
- **BaseAgent**: Yes
- **State File**: `apps/backend/src/ai/agents/specialized/pricing_state.py`
- **API Route**: /api/ai/specialized/pricing (ROUTE-059)
- **Skills**: Dynamic pricing, margin optimization, competitor price analysis
- **Status**: Active (initialized on startup in main.py)
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-014: Procurement Agent

- **File**: `apps/backend/src/ai/agents/specialized/procurement_agent.py`
- **Domain**: Procurement / Supply Chain
- **BaseAgent**: Yes
- **State File**: `apps/backend/src/ai/agents/specialized/procurement_state.py`
- **API Route**: /api/ai/specialized/procurement (ROUTE-059)
- **Skills**: PO generation, supplier evaluation, reorder optimization
- **Status**: Active (initialized on startup in main.py)
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-015: Recommendation Agent

- **File**: `apps/backend/src/ai/agents/specialized/recommendation_agent.py`
- **Domain**: Recommendations / E-Commerce
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/recommendations (ROUTE-048)
- **Skills**: Collaborative filtering, content-based filtering, cross-sell/upsell
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-016: Reconciliation Agent

- **File**: `apps/backend/src/ai/agents/specialized/reconciliation_agent.py`
- **Domain**: Financial / POS Reconciliation
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/reconciliation (financial routes)
- **Skills**: Transaction matching, bank feed reconciliation, discrepancy resolution
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-017: Search Agent

- **File**: `apps/backend/src/ai/agents/specialized/search_agent.py`
- **Domain**: Search / AI
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/search (ROUTE-047)
- **Skills**: Semantic search, hybrid ranking, vector similarity (pgvector), query expansion
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-018: Task Executor Agent

- **File**: `apps/backend/src/ai/agents/specialized/task_executor_agent.py`
- **Domain**: Orchestration / Task Execution
- **BaseAgent**: Yes
- **State File**: `apps/backend/src/ai/agents/specialized/task_executor_state.py`
- **API Route**: Supervisor / protocol routes (ROUTE-055/056)
- **Skills**: Task decomposition, parallel execution, result aggregation
- **Status**: Active (initialized on startup in main.py)
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

### AGENT-019: Testing Agent

- **File**: `apps/backend/src/ai/agents/specialized/testing_agent.py`
- **Domain**: Autonomous Development / QA
- **BaseAgent**: Yes
- **State File**: None observed
- **API Route**: /api/autonomous (ROUTE-049)
- **Skills**: Test generation, test execution, coverage analysis, regression detection
- **Status**: Active
- **1:10 Compliant**: Needs review
- **Last Verified**: 2026-03-03

---

### Generators (apps/backend/src/ai/generators/)

### AGENT-020: Email Generator

- **File**: `apps/backend/src/ai/generators/email_generator.py`
- **Domain**: Content / Email
- **BaseAgent**: No (generator utility class, not full agent)
- **State File**: None
- **API Route**: /api/ai/generate (ROUTE-046) — via Content Generator agent
- **Skills**: Templated email drafting, personalization, SendGrid formatting
- **Status**: Active
- **1:10 Compliant**: N/A (utility)
- **Last Verified**: 2026-03-03

### AGENT-021: Quote Generator

- **File**: `apps/backend/src/ai/generators/quote_generator.py`
- **Domain**: Orders / AI Generation
- **BaseAgent**: No (generator utility class)
- **State File**: None
- **API Route**: /api/ai/generate or /api/quotes/generate — via Content Generator
- **Skills**: AI-assisted quote line item generation, pricing suggestion, terms drafting
- **Status**: Active
- **1:10 Compliant**: N/A (utility)
- **Last Verified**: 2026-03-03

---

## Orchestration System

### Supervisor Agent

- **File**: `apps/backend/src/ai/orchestration/supervisor_agent.py`
- **Domain**: Orchestration
- **Pattern**: Singleton via get_supervisor_agent()
- **Role**: Routes tasks to appropriate specialized agents, manages agent registry
- **Initialized On Startup**: Yes (main.py lifespan)
- **API Route**: ROUTE-056

### Health Monitor

- **File**: `apps/backend/src/ai/monitoring/`
- **Domain**: Infrastructure / AI Health
- **Pattern**: Singleton via get_health_monitor()
- **Role**: Monitors all registered agent health, background task
- **Started On Startup**: Yes (main.py lifespan)

### Learning Engine

- **File**: `apps/backend/src/ai/learning/`
- **Domain**: AI / Adaptive Learning
- **Pattern**: Singleton via get_learning_engine()
- **Role**: Loads and stores patterns from DB for agent improvement
- **Initialized On Startup**: Yes (main.py lifespan)
