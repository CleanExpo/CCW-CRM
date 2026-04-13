"""Predefined Agent Cards for all CCW-ERP agents.

One AgentCard instance per agent. Use load_all_cards() to retrieve the full
registry as a dict keyed by agent_id.
"""

from src.ai.protocol.models import (
    AgentCard,
    DelegationRule,
    EscalationTrigger,
    EscalationTriggerType,
    PermissionTier,
)

# ─── Supervisor (Orchestrator) ────────────────────────────────────────────────

SUPERVISOR_CARD = AgentCard(
    agent_id="supervisor",
    name="Supervisor Agent",
    version="1.0.0",
    description="Orchestrates the multi-agent system — routes tasks to appropriate specialised agents and coordinates their results.",
    capabilities=["orchestration", "routing", "coordination"],
    boundaries=[
        "Cannot execute tasks directly — delegates to specialised agents",
        "Cannot modify locked system files",
        "Requires human approval for destructive operations",
    ],
    inputs={"task": "str", "context": "dict"},
    outputs={"result": "dict", "agent_used": "str", "confidence": "float"},
    delegation_rules=[
        DelegationRule(capability="*", allowed_delegates=[], max_chain_depth=3),
    ],
    permission_tier=PermissionTier.ADMIN,
    max_concurrent=10,
    timeout_seconds=300,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.4,
            description="Escalate when routing confidence is below 40%",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.TIMEOUT,
            threshold=240.0,
            description="Escalate if no delegate responds within 240 s",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CAPABILITY_MISSING,
            description="Escalate when no agent can handle the requested capability",
        ),
    ],
)

# ─── Pricing Agent ────────────────────────────────────────────────────────────

PRICING_CARD = AgentCard(
    agent_id="pricing_agent",
    name="Pricing Agent",
    version="1.0.0",
    description="Calculates optimal pricing, analyses costs, and computes margin recommendations.",
    capabilities=["pricing", "cost_analysis", "price_optimization", "margin_calculation"],
    boundaries=[
        "Cannot create or delete product records",
        "Cannot process payments",
        "Read-only access to competitor pricing data",
    ],
    inputs={"product_id": "str", "context": "dict"},
    outputs={"price": "float", "margin": "float", "reasoning": "str"},
    delegation_rules=[
        DelegationRule(
            capability="cost_analysis",
            allowed_delegates=["search_agent"],
            max_chain_depth=2,
        ),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=5,
    timeout_seconds=60,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.5,
            description="Escalate when pricing confidence is below 50%",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="Escalate when price change exceeds approved thresholds",
        ),
    ],
)

# ─── Procurement Agent ────────────────────────────────────────────────────────

PROCUREMENT_CARD = AgentCard(
    agent_id="procurement_agent",
    name="Procurement Agent",
    version="1.0.0",
    description="Manages inventory levels and generates procurement recommendations including supplier selection and reorder calculations.",
    capabilities=[
        "procurement",
        "inventory_management",
        "supplier_recommendation",
        "inventory_replenishment",
        "reorder_calculation",
    ],
    boundaries=[
        "Cannot finalise purchase orders without human approval",
        "Cannot modify supplier pricing contracts",
        "Recommendations only — no direct purchasing authority",
    ],
    inputs={"product_ids": "list[str]", "context": "dict"},
    outputs={"recommendations": "list[dict]", "reorder_points": "dict"},
    delegation_rules=[
        DelegationRule(
            capability="inventory_management",
            allowed_delegates=["inventory_forecasting_agent"],
            requires_approval=False,
            max_chain_depth=2,
        ),
    ],
    permission_tier=PermissionTier.ELEVATED,
    max_concurrent=3,
    timeout_seconds=120,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="Escalate when recommended order value exceeds approval threshold",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.5,
            description="Escalate when supplier recommendation confidence is below 50%",
        ),
    ],
)

# ─── Task Executor Agent ──────────────────────────────────────────────────────

TASK_EXECUTOR_CARD = AgentCard(
    agent_id="task_executor",
    name="Task Executor Agent",
    version="1.0.0",
    description="Executes tasks with mandatory user confirmation — acts as the write gate for all state-changing operations.",
    capabilities=[
        "task_execution",
        "action_execution",
        "user_confirmation",
        "write_operations",
    ],
    boundaries=[
        "All write operations require explicit user confirmation",
        "Cannot bypass confirmation for any destructive action",
        "Cannot self-verify task outcomes",
    ],
    inputs={"task": "str", "action": "dict", "context": "dict"},
    outputs={"status": "str", "result": "dict", "confirmed_by": "str"},
    delegation_rules=[
        DelegationRule(capability="task_execution", allowed_delegates=[], requires_approval=False, max_chain_depth=1),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=3,
    timeout_seconds=60,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="Always escalate to human for confirmation before executing",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.TIMEOUT,
            threshold=30.0,
            description="Escalate if user confirmation is not received within 30 s",
        ),
    ],
)

# ─── Search Agent ─────────────────────────────────────────────────────────────

SEARCH_CARD = AgentCard(
    agent_id="search_agent",
    name="Search Agent",
    version="1.0.0",
    description="Orchestrates intelligent product and entity search using semantic embeddings, keyword matching, and multi-language support.",
    capabilities=[
        "semantic_search",
        "product_search",
        "keyword_search",
        "hybrid_search",
        "multi_language_search",
        "search_analytics",
    ],
    boundaries=[
        "Read-only — cannot create, update, or delete records",
        "Cannot execute actions on search results",
    ],
    inputs={"query": "str", "filters": "dict", "limit": "int"},
    outputs={"results": "list[dict]", "total": "int", "took_ms": "float"},
    delegation_rules=[
        DelegationRule(capability="semantic_search", allowed_delegates=[], requires_approval=False, max_chain_depth=1),
    ],
    permission_tier=PermissionTier.READ_ONLY,
    max_concurrent=10,
    timeout_seconds=30,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.4,
            description="Escalate when search confidence is below 40%",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.ERROR_THRESHOLD,
            threshold=3.0,
            description="Escalate after 3 consecutive search failures",
        ),
    ],
)

# ─── Inventory Forecasting Agent ──────────────────────────────────────────────

INVENTORY_FORECASTING_CARD = AgentCard(
    agent_id="inventory_forecasting_agent",
    name="Inventory Forecasting Agent",
    version="1.0.0",
    description="Predicts inventory needs using historical sales data, seasonal pattern detection, and safety stock calculations.",
    capabilities=[
        "inventory_forecasting",
        "demand_prediction",
        "reorder_recommendations",
        "seasonal_pattern_detection",
        "safety_stock_calculation",
    ],
    boundaries=[
        "Suggestions only — cannot trigger reorders directly",
        "Read-only access to sales and inventory data",
    ],
    inputs={"product_ids": "list[str]", "lookback_days": "int", "context": "dict"},
    outputs={"forecasts": "list[dict]", "recommendations": "list[dict]"},
    delegation_rules=[
        DelegationRule(capability="inventory_forecasting", allowed_delegates=[], requires_approval=False, max_chain_depth=1),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=5,
    timeout_seconds=120,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.4,
            description="Escalate when forecast confidence is below 40%",
        ),
    ],
)

# ─── Anomaly Detection Agent ──────────────────────────────────────────────────

ANOMALY_DETECTION_CARD = AgentCard(
    agent_id="anomaly_detection_agent",
    name="Anomaly Detection Agent",
    version="1.0.0",
    description="Detects unusual patterns and outliers in business data using statistical analysis (z-scores, standard deviation) and ML models.",
    capabilities=[
        "anomaly_detection",
        "statistical_analysis",
        "outlier_detection",
        "fraud_detection",
    ],
    boundaries=[
        "Read-only — cannot modify data or trigger remediation",
        "Cannot make fraud determinations autonomously — alerts only",
    ],
    inputs={"dataset": "dict", "threshold": "float", "context": "dict"},
    outputs={"anomalies": "list[dict]", "severity": "str", "confidence": "float"},
    delegation_rules=[
        DelegationRule(capability="anomaly_detection", allowed_delegates=[], requires_approval=False, max_chain_depth=1),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=5,
    timeout_seconds=60,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="Escalate when high-severity anomaly or potential fraud is detected",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.4,
            description="Escalate when anomaly detection confidence is below 40%",
        ),
    ],
)

# ─── Testing Agent ────────────────────────────────────────────────────────────

TESTING_CARD = AgentCard(
    agent_id="testing_agent",
    name="Testing Agent",
    version="1.0.0",
    description="Generates and executes unit and integration tests for code validation, and analyses coverage and failures.",
    capabilities=[
        "test_generation",
        "unit_tests",
        "integration_tests",
        "test_execution",
        "coverage_analysis",
        "failure_analysis",
    ],
    boundaries=[
        "Cannot deploy code to production",
        "Cannot approve PRs or merge branches",
        "Test execution is sandboxed",
    ],
    inputs={"code": "str", "target_module": "str", "context": "dict"},
    outputs={"tests": "list[str]", "coverage": "float", "failures": "list[dict]"},
    delegation_rules=[
        DelegationRule(
            capability="test_execution",
            allowed_delegates=["development_agent"],
            max_chain_depth=2,
        ),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=3,
    timeout_seconds=180,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.4,
            description="Escalate when test coverage confidence is below 40%",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.ERROR_THRESHOLD,
            threshold=5.0,
            description="Escalate after 5 test failures in a single run",
        ),
    ],
)

# ─── Development Agent ────────────────────────────────────────────────────────

DEVELOPMENT_CARD = AgentCard(
    agent_id="development_agent",
    name="Development Agent",
    version="1.0.0",
    description="Generates production-quality code following project patterns and conventions — APIs, models, services, and components.",
    capabilities=[
        "code_generation",
        "api_endpoints",
        "database_models",
        "services",
        "components",
        "pattern_following",
    ],
    boundaries=[
        "Cannot deploy to production environments",
        "Cannot push to protected branches without review",
        "All generated code requires independent test verification",
    ],
    inputs={"specification": "str", "context": "dict", "existing_code": "str"},
    outputs={"code": "str", "files": "list[str]", "tests": "list[str]"},
    delegation_rules=[
        DelegationRule(
            capability="api_endpoints",
            allowed_delegates=["testing_agent"],
            max_chain_depth=2,
        ),
        DelegationRule(
            capability="database_models",
            allowed_delegates=["testing_agent"],
            max_chain_depth=2,
        ),
    ],
    permission_tier=PermissionTier.ELEVATED,
    max_concurrent=3,
    timeout_seconds=300,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="Escalate when generated code touches locked or sensitive files",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.5,
            description="Escalate when code generation confidence is below 50%",
        ),
    ],
)

# ─── Document Parser Agent ────────────────────────────────────────────────────

DOCUMENT_PARSER_CARD = AgentCard(
    agent_id="document_parser_agent",
    name="Document Parser Agent",
    version="1.0.0",
    description="Parses emails and documents to extract structured order data using NLP and pattern matching.",
    capabilities=[
        "document_parsing",
        "email_parsing",
        "pdf_parsing",
        "nlp_extraction",
        "product_matching",
    ],
    boundaries=[
        "Read-only — cannot create orders autonomously",
        "Extracted data requires human review before saving",
        "Cannot access attachments outside the upload directory",
    ],
    inputs={"document": "str", "document_type": "str", "context": "dict"},
    outputs={"extracted": "dict", "confidence": "float", "matched_products": "list[dict]"},
    delegation_rules=[
        DelegationRule(
            capability="product_matching",
            allowed_delegates=["search_agent"],
            max_chain_depth=2,
        ),
    ],
    permission_tier=PermissionTier.READ_ONLY,
    max_concurrent=5,
    timeout_seconds=60,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.6,
            description="Escalate when extraction confidence is below 60%",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="Always requires human review before order creation",
        ),
    ],
)

# ─── Form Autofill Agent ──────────────────────────────────────────────────────

FORM_AUTOFILL_CARD = AgentCard(
    agent_id="form_autofill_agent",
    name="Form Autofill Agent",
    version="1.0.0",
    description="Provides intelligent form auto-fill suggestions based on historical customer data and pattern detection.",
    capabilities=[
        "form_autofill",
        "customer_history",
        "pattern_detection",
        "duplicate_detection",
    ],
    boundaries=[
        "Suggestions only — cannot submit forms on behalf of users",
        "Cannot access data outside the current user's permission scope",
    ],
    inputs={"form_context": "dict", "customer_id": "str"},
    outputs={"suggestions": "dict", "confidence": "float", "duplicates": "list[dict]"},
    delegation_rules=[
        DelegationRule(
            capability="customer_history",
            allowed_delegates=["search_agent"],
            max_chain_depth=2,
        ),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=10,
    timeout_seconds=15,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.5,
            description="Escalate when autofill confidence is below 50%",
        ),
    ],
)

# ─── Reconciliation Agent ─────────────────────────────────────────────────────

RECONCILIATION_CARD = AgentCard(
    agent_id="reconciliation_agent",
    name="Reconciliation Agent",
    version="1.0.0",
    description="AI-powered bank feed reconciliation using fuzzy matching and pattern learning to suggest POS transaction matches.",
    capabilities=[
        "bank_feed_reconciliation",
        "fuzzy_matching",
        "pattern_learning",
        "confidence_scoring",
        "transaction_matching",
    ],
    boundaries=[
        "Cannot finalise reconciliation without human confirmation",
        "Read-only access to bank feed data",
        "Cannot modify transaction records directly",
    ],
    inputs={"bank_feed_id": "str", "date_range": "dict", "context": "dict"},
    outputs={"matches": "list[dict]", "unmatched": "list[dict]", "confidence_scores": "dict"},
    delegation_rules=[
        DelegationRule(capability="bank_feed_reconciliation", allowed_delegates=[], requires_approval=False, max_chain_depth=1),
    ],
    permission_tier=PermissionTier.ELEVATED,
    max_concurrent=3,
    timeout_seconds=180,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.6,
            description="Escalate when match confidence is below 60%",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="All reconciliation matches require human confirmation",
        ),
    ],
)

# ─── Cin7 Forecasting Agent ───────────────────────────────────────────────────

CIN7_FORECASTING_CARD = AgentCard(
    agent_id="cin7_forecasting_agent",
    name="Cin7 Forecasting Agent",
    version="1.0.0",
    description="Forecasts demand for Cin7-synced products using sync history to predict demand trends, reorder points, and seasonal patterns.",
    capabilities=[
        "cin7_forecasting",
        "sync_demand_prediction",
        "cin7_reorder_recommendations",
    ],
    boundaries=[
        "Read-only access to Cin7 sync data",
        "Cannot trigger Cin7 sync operations",
        "Recommendations only — no direct purchasing authority",
    ],
    inputs={"product_ids": "list[str]", "lookback_days": "int", "context": "dict"},
    outputs={"forecasts": "list[dict]", "reorder_points": "dict"},
    delegation_rules=[
        DelegationRule(capability="cin7_forecasting", allowed_delegates=[], requires_approval=False, max_chain_depth=1),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=5,
    timeout_seconds=60,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.CONFIDENCE_LOW,
            threshold=0.4,
            description="Escalate when Cin7 forecast confidence is below 40%",
        ),
    ],
)

# ─── Cin7 Anomaly Agent ───────────────────────────────────────────────────────

CIN7_ANOMALY_CARD = AgentCard(
    agent_id="cin7_anomaly_agent",
    name="Cin7 Anomaly Agent",
    version="1.0.0",
    description="Detects anomalies in Cin7 sync data — sync frequency spikes, price drift, stock mismatches, and mapping coverage gaps.",
    capabilities=[
        "cin7_anomaly_detection",
        "sync_failure_detection",
        "cin7_data_quality",
    ],
    boundaries=[
        "Read-only access to Cin7 sync logs and mappings",
        "Cannot trigger remediation actions autonomously",
        "Alerts only — human action required to resolve issues",
    ],
    inputs={"sync_window_hours": "int", "context": "dict"},
    outputs={"anomalies": "list[dict]", "severity": "str", "recommendations": "list[str]"},
    delegation_rules=[
        DelegationRule(capability="cin7_anomaly_detection", allowed_delegates=[], requires_approval=False, max_chain_depth=1),
    ],
    permission_tier=PermissionTier.STANDARD,
    max_concurrent=5,
    timeout_seconds=60,
    escalation_triggers=[
        EscalationTrigger(
            trigger_type=EscalationTriggerType.HUMAN_REQUIRED,
            description="Escalate when critical Cin7 sync failure is detected",
        ),
        EscalationTrigger(
            trigger_type=EscalationTriggerType.ERROR_THRESHOLD,
            threshold=3.0,
            description="Escalate after 3 consecutive sync anomalies",
        ),
    ],
)

# ─── Registry ─────────────────────────────────────────────────────────────────

ALL_CARDS: dict[str, AgentCard] = {
    "supervisor": SUPERVISOR_CARD,
    "pricing_agent": PRICING_CARD,
    "procurement_agent": PROCUREMENT_CARD,
    "task_executor": TASK_EXECUTOR_CARD,
    "search_agent": SEARCH_CARD,
    "inventory_forecasting_agent": INVENTORY_FORECASTING_CARD,
    "anomaly_detection_agent": ANOMALY_DETECTION_CARD,
    "testing_agent": TESTING_CARD,
    "development_agent": DEVELOPMENT_CARD,
    "document_parser_agent": DOCUMENT_PARSER_CARD,
    "form_autofill_agent": FORM_AUTOFILL_CARD,
    "reconciliation_agent": RECONCILIATION_CARD,
    "cin7_forecasting_agent": CIN7_FORECASTING_CARD,
    "cin7_anomaly_agent": CIN7_ANOMALY_CARD,
}


def load_all_cards() -> dict[str, AgentCard]:
    """Return all predefined agent cards keyed by agent_id."""
    return dict(ALL_CARDS)
