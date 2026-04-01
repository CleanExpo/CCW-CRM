# Agent Autonomy API Documentation

## Overview

The Agent Autonomy API provides endpoints for configuring and managing autonomous AI agent behavior. This system allows agents to make decisions and execute actions automatically within configurable safety boundaries.

**Base URL:** `/api/autonomy`

---

## Core Concepts

### Autonomy Levels

Agents operate at one of three autonomy levels:

- **`advisory`** - Agent only provides recommendations, no auto-execution
- **`semi_autonomous`** - Agent auto-executes low-risk actions only, requires approval for medium/high-risk
- **`fully_autonomous`** - Agent auto-executes all actions within configured limits

### Risk Levels

Every agent decision is classified by risk:

- **`low`** - Data retrieval, analysis, reporting (minimal business impact)
- **`medium`** - Reorder suggestions under threshold, routine operations
- **`high`** - Large purchase orders, bulk operations, high-value transactions

### Decision Status

Decisions progress through statuses:

- **`pending_approval`** - Awaiting human approval
- **`approved`** - Approved by human, ready for execution
- **`auto_executed`** - Automatically executed without approval
- **`rejected`** - Rejected by human with reason
- **`expired`** - Approval window expired (24 hours)

---

## API Endpoints

### 1. List All Agents

**`GET /api/autonomy/agents`**

Retrieve all agents with their current autonomy configurations.

#### Response: 200 OK

```json
{
  "agents": [
    {
      "agent_id": "procurement_agent",
      "agent_name": "Procurement",
      "autonomy_level": "semi_autonomous",
      "enabled": true,
      "max_auto_approval_amount": 1000.0,
      "max_actions_per_hour": 10,
      "max_actions_per_day": 50
    },
    {
      "agent_id": "pricing_agent",
      "agent_name": "Pricing Optimization",
      "autonomy_level": "advisory",
      "enabled": true,
      "max_auto_approval_amount": 0.0,
      "max_actions_per_hour": 20,
      "max_actions_per_day": 100
    }
  ],
  "total": 8
}
```

---

### 2. Get Agent Configuration

**`GET /api/autonomy/config/{agent_id}`**

Retrieve detailed configuration for a specific agent.

#### Path Parameters

- `agent_id` (string, required) - Agent identifier (e.g., `procurement_agent`)

#### Response: 200 OK

```json
{
  "agent_id": "procurement_agent",
  "autonomy_level": "semi_autonomous",
  "min_confidence_low_risk": 0.7,
  "min_confidence_medium_risk": 0.85,
  "min_confidence_high_risk": 0.95,
  "max_auto_approval_amount": 1000.0,
  "max_auto_approval_quantity": 100,
  "max_actions_per_hour": 10,
  "max_actions_per_day": 50,
  "learning_enabled": true,
  "feedback_retention_days": 90,
  "notify_on_execution": true,
  "notify_on_pending": true,
  "enabled": true,
  "pause_until": null,
  "created_at": "2026-01-14T10:00:00Z",
  "updated_at": "2026-01-14T10:00:00Z",
  "updated_by": null
}
```

#### Response: 404 Not Found

```json
{
  "detail": "Agent 'unknown_agent' not found. Known agents: ['procurement_agent', 'pricing_agent', ...]"
}
```

---

### 3. Update Agent Configuration

**`PUT /api/autonomy/config/{agent_id}`**

Update autonomy configuration for an agent. All fields are optional - only include fields you want to change.

#### Path Parameters

- `agent_id` (string, required) - Agent identifier

#### Request Body

```json
{
  "autonomy_level": "fully_autonomous",
  "min_confidence_low_risk": 0.75,
  "min_confidence_medium_risk": 0.88,
  "min_confidence_high_risk": 0.96,
  "max_auto_approval_amount": 2000.0,
  "max_auto_approval_quantity": 200,
  "max_actions_per_hour": 15,
  "max_actions_per_day": 75,
  "learning_enabled": true,
  "notify_on_execution": false,
  "notify_on_pending": true,
  "enabled": true,
  "pause_until": "2026-01-15T00:00:00Z"
}
```

**Field Constraints:**
- `min_confidence_*`: 0.0 - 1.0 (float)
- `max_auto_approval_amount`: Positive float
- `max_auto_approval_quantity`: Positive integer
- `max_actions_per_hour`: Positive integer
- `max_actions_per_day`: Positive integer
- `pause_until`: ISO 8601 datetime string or null

#### Response: 200 OK

```json
{
  "agent_id": "procurement_agent",
  "autonomy_level": "fully_autonomous",
  "min_confidence_low_risk": 0.75,
  // ... full updated config
}
```

#### Response: 400 Bad Request

```json
{
  "detail": "Validation error: min_confidence_low_risk must be between 0.0 and 1.0"
}
```

---

### 4. Query Decisions

**`GET /api/autonomy/decisions`**

Query agent decisions with filters and pagination.

#### Query Parameters

- `agent_id` (string, optional) - Filter by agent ID
- `status` (enum, optional) - Filter by status: `pending_approval`, `approved`, `auto_executed`, `rejected`, `expired`
- `risk_level` (enum, optional) - Filter by risk: `low`, `medium`, `high`
- `decision_type` (string, optional) - Filter by type (e.g., `purchase_order`, `inventory_adjustment`)
- `min_confidence` (float, optional) - Minimum confidence (0.0 - 1.0)
- `page` (integer, optional, default: 1) - Page number (1-indexed)
- `page_size` (integer, optional, default: 20, max: 100) - Items per page

#### Example Request

```
GET /api/autonomy/decisions?agent_id=procurement_agent&status=pending_approval&page=1&page_size=20
```

#### Response: 200 OK

```json
{
  "decisions": [
    {
      "decision_id": "dec-123e4567-e89b-12d3-a456-426614174000",
      "agent_id": "procurement_agent",
      "decision_type": "purchase_order",
      "recommendation": {
        "action": "create_purchase_order",
        "product_id": "prod-123",
        "quantity": 50,
        "estimated_cost": 750.0,
        "reasoning": "Stock below reorder point"
      },
      "confidence": 0.88,
      "risk_level": "medium",
      "context": {
        "current_stock": 5,
        "reorder_point": 15,
        "lead_time_days": 7
      },
      "autonomy_level": "semi_autonomous",
      "status": "pending_approval",
      "requires_approval": true,
      "approved_by": null,
      "approved_at": null,
      "rejected_by": null,
      "rejected_at": null,
      "rejection_reason": null,
      "executed": false,
      "executed_at": null,
      "execution_result": null,
      "execution_error": null,
      "outcome_success": null,
      "outcome_metrics": null,
      "human_feedback": null,
      "feedback_rating": null,
      "created_at": "2026-01-14T14:30:00Z",
      "expires_at": "2026-01-15T14:30:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 20
}
```

---

### 5. Get Pending Decisions

**`GET /api/autonomy/decisions/pending`**

Retrieve decisions awaiting human approval. Shortcut for querying with `status=pending_approval`.

#### Query Parameters

- `agent_id` (string, optional) - Filter by agent ID
- `limit` (integer, optional, default: 100, max: 1000) - Max decisions to return

#### Response: 200 OK

```json
[
  {
    "decision_id": "dec-123",
    "agent_id": "procurement_agent",
    "decision_type": "purchase_order",
    // ... full decision object
  }
]
```

---

### 6. Approve Decision

**`POST /api/autonomy/decisions/{decision_id}/approve`**

Approve a pending decision, allowing it to be executed.

#### Path Parameters

- `decision_id` (string, required) - Decision identifier

#### Request Body

```json
{
  "approved_by": "usr-123e4567-e89b-12d3-a456-426614174000"
}
```

#### Response: 200 OK

```json
{
  "decision_id": "dec-123",
  "agent_id": "procurement_agent",
  "status": "approved",
  "approved_by": "usr-123e4567-e89b-12d3-a456-426614174000",
  "approved_at": "2026-01-14T15:00:00Z",
  // ... full decision object
}
```

#### Response: 404 Not Found

```json
{
  "detail": "Decision dec-123 not found"
}
```

#### Response: 400 Bad Request

```json
{
  "detail": "Decision dec-123 is not pending approval"
}
```

---

### 7. Reject Decision

**`POST /api/autonomy/decisions/{decision_id}/reject`**

Reject a pending decision with a reason.

#### Path Parameters

- `decision_id` (string, required) - Decision identifier

#### Request Body

```json
{
  "rejected_by": "usr-123e4567-e89b-12d3-a456-426614174000",
  "reason": "Supplier pricing too high, need to negotiate first"
}
```

#### Response: 200 OK

```json
{
  "decision_id": "dec-123",
  "agent_id": "procurement_agent",
  "status": "rejected",
  "rejected_by": "usr-123e4567-e89b-12d3-a456-426614174000",
  "rejected_at": "2026-01-14T15:05:00Z",
  "rejection_reason": "Supplier pricing too high, need to negotiate first",
  // ... full decision object
}
```

---

### 8. Get Agent Statistics

**`GET /api/autonomy/stats/{agent_id}`**

Retrieve performance statistics for an agent over a time period.

#### Path Parameters

- `agent_id` (string, required) - Agent identifier

#### Query Parameters

- `time_period` (enum, optional, default: `last_7d`) - Time period: `last_24h`, `last_7d`, `last_30d`

#### Response: 200 OK

```json
{
  "agent_id": "procurement_agent",
  "time_period": "last_7d",
  "total_decisions": 42,
  "auto_executed": 28,
  "pending_approval": 5,
  "approved_by_human": 7,
  "rejected_by_human": 2,
  "average_confidence": 0.84,
  "success_rate": 0.96,
  "approval_rate": 0.78,
  "average_response_time_seconds": 0.0,
  "total_value_processed": 15250.0,
  "total_value_auto_executed": 9500.0,
  "low_risk_decisions": 30,
  "medium_risk_decisions": 10,
  "high_risk_decisions": 2
}
```

---

## Known Agents

The following agents are available in the system:

| Agent ID | Name | Description |
|----------|------|-------------|
| `order_processing_agent` | Order Processing | Order validation, pricing |
| `inventory_agent` | Inventory Management | Stock optimization, reorder suggestions |
| `quote_agent` | Quote Generation | Quote generation from RFQs |
| `forecasting_agent` | Demand Forecasting | Demand prediction |
| `procurement_agent` | Procurement | Purchase order suggestions |
| `backorder_agent` | Backorder Management | Priority allocation decisions |
| `pricing_agent` | Pricing Optimization | Dynamic pricing recommendations |
| `task_executor_agent` | Task Execution | General task execution |

---

## Safety Controls

### Auto-Execution Criteria

For a decision to be auto-executed, ALL of the following must be true:

1. **Agent enabled**: `enabled = true`
2. **Not paused**: `pause_until` is null or in the past
3. **Autonomy level permits**:
   - `advisory`: Never auto-executes
   - `semi_autonomous`: Only auto-executes `low` risk
   - `fully_autonomous`: Auto-executes all risk levels (within limits)
4. **Confidence threshold met**: Based on risk level
   - Low risk: `confidence >= min_confidence_low_risk`
   - Medium risk: `confidence >= min_confidence_medium_risk`
   - High risk: `confidence >= min_confidence_high_risk`
5. **Value within limits**: `estimated_value <= max_auto_approval_amount`
6. **Quantity within limits**: `estimated_quantity <= max_auto_approval_quantity`
7. **Rate limits not exceeded**:
   - Hourly: `auto_executed_count_last_hour < max_actions_per_hour`
   - Daily: `auto_executed_count_last_day < max_actions_per_day`

If ANY criterion fails, the decision requires human approval.

### Emergency Controls

**Disable all autonomy:**
```json
PUT /api/autonomy/config/{agent_id}
{
  "enabled": false
}
```

**Temporary pause (e.g., during maintenance):**
```json
PUT /api/autonomy/config/{agent_id}
{
  "pause_until": "2026-01-15T00:00:00Z"
}
```

**Downgrade autonomy level:**
```json
PUT /api/autonomy/config/{agent_id}
{
  "autonomy_level": "advisory"
}
```

---

## Learning & Feedback

After a decision is executed, record the outcome for learning:

**Recording outcome (internal API, not exposed):**

```python
await autonomy_manager.record_outcome(
    decision_id="dec-123",
    success=True,
    metrics={
        "actual_cost": 745.0,
        "estimated_cost": 750.0,
        "variance_percent": -0.67,
        "delivery_on_time": True
    },
    feedback="Purchase order executed successfully",
    rating=5
)
```

This data is used to:
- Improve confidence calculations
- Adjust autonomy thresholds
- Generate agent performance reports

---

## Best Practices

### Configuration

1. **Start conservative**: Begin with `advisory` mode and low thresholds
2. **Gradual increase**: Monitor performance for 1-2 weeks before increasing autonomy
3. **Set realistic limits**: Base value/quantity limits on business tolerance
4. **Rate limiting**: Prevent runaway automation with hourly/daily caps

### Monitoring

1. **Review pending decisions daily**: Check what's being queued
2. **Track rejection reasons**: Identify patterns in human overrides
3. **Monitor stats weekly**: Look for anomalies in approval/success rates
4. **Set alerts**: Notify on high rejection rates or failed executions

### Approval Workflow

1. **Timely reviews**: Pending decisions expire after 24 hours
2. **Provide feedback**: Always include rejection reasons for learning
3. **Batch approvals**: Review similar low-risk decisions together
4. **Escalation**: Flag unusual high-risk decisions for senior review

---

## Error Handling

All endpoints follow standard HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Validation error
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error responses include a `detail` field:

```json
{
  "detail": "Descriptive error message"
}
```

---

## Rate Limiting

API endpoints are subject to rate limiting (configured in middleware):
- 60 requests per minute per IP
- 1000 requests per hour per IP

Exceeded limits return `429 Too Many Requests`.

---

## Integration Examples

See `apps/backend/src/ai/autonomy/integration_example.py` for detailed code examples showing:

1. Recording agent decisions
2. Checking auto-execution eligibility
3. Handling approval workflows
4. Recording learning feedback
5. Retrieving performance statistics

---

## Frontend Integration

### TypeScript Types

```typescript
export type AutonomyLevel = "advisory" | "semi_autonomous" | "fully_autonomous";
export type RiskLevel = "low" | "medium" | "high";
export type DecisionStatus = "pending_approval" | "approved" | "auto_executed" | "rejected" | "expired";

export interface AgentConfig {
  agent_id: string;
  autonomy_level: AutonomyLevel;
  min_confidence_low_risk: number;
  min_confidence_medium_risk: number;
  min_confidence_high_risk: number;
  max_auto_approval_amount: number;
  max_auto_approval_quantity: number;
  max_actions_per_hour: number;
  max_actions_per_day: number;
  learning_enabled: boolean;
  enabled: boolean;
  pause_until: string | null;
}

export interface AgentDecision {
  decision_id: string;
  agent_id: string;
  decision_type: string;
  recommendation: Record<string, any>;
  confidence: number;
  risk_level: RiskLevel;
  status: DecisionStatus;
  requires_approval: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface AutonomyStats {
  agent_id: string;
  time_period: string;
  total_decisions: number;
  auto_executed: number;
  pending_approval: number;
  approved_by_human: number;
  rejected_by_human: number;
  average_confidence: number;
  success_rate: number;
  approval_rate: number;
}
```

### API Client Example

```typescript
// Get all agents
const agents = await apiClient.get<AgentListResponse>("/api/autonomy/agents");

// Update agent config
await apiClient.put(`/api/autonomy/config/${agentId}`, {
  autonomy_level: "semi_autonomous",
  max_auto_approval_amount: 2000.0,
});

// Get pending decisions
const pending = await apiClient.get<AgentDecision[]>("/api/autonomy/decisions/pending");

// Approve decision
await apiClient.post(`/api/autonomy/decisions/${decisionId}/approve`, {
  approved_by: userId,
});

// Get agent stats
const stats = await apiClient.get<AutonomyStats>(
  `/api/autonomy/stats/${agentId}?time_period=last_7d`
);
```

---

## Security Considerations

1. **Authentication**: All endpoints require authentication (JWT token)
2. **Authorization**: Future enhancement - role-based access control
3. **Audit Trail**: All approvals/rejections logged with user IDs
4. **Data Persistence**: Currently in-memory (production needs database)
5. **Sensitive Data**: Decision context may contain business-critical data

---

## Roadmap

**Planned Enhancements:**

- [ ] Database-backed persistence (PostgreSQL)
- [ ] Role-based access control (RBAC)
- [ ] Advanced analytics dashboard
- [ ] ML-based confidence calculation
- [ ] Adaptive threshold learning
- [ ] Slack/email notifications for pending approvals
- [ ] Bulk approval/rejection operations
- [ ] Decision templates and workflows
- [ ] A/B testing of autonomy strategies

---

**Last Updated:** January 14, 2026
**API Version:** 1.0.0
**Status:** Beta - Backend Complete, Frontend UI Pending
