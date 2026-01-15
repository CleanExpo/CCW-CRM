# Agent Learning & Feedback System

## Overview

The learning feedback system enables agents to continuously improve by analyzing decision outcomes, human feedback, and performance patterns. The system automatically recommends threshold adjustments and autonomy level changes based on real-world data.

---

## Core Concepts

### Learning Loop

```
1. Agent makes decision → Records with autonomy manager
         ↓
2. Decision executed (auto or after approval)
         ↓
3. Outcome recorded (success/failure + metrics)
         ↓
4. Human feedback collected (optional rating + comments)
         ↓
5. Learning engine analyzes patterns over time
         ↓
6. System recommends threshold adjustments
         ↓
7. Operator reviews and applies recommendations
         ↓
8. Agent improves with adjusted thresholds
```

### Data Collected

**Per Decision:**
- **Confidence Score**: Agent's confidence (0.0-1.0)
- **Risk Level**: Assessed risk (low/medium/high)
- **Decision Type**: Type of action (purchase_order, price_adjustment, etc.)
- **Recommendation**: What the agent recommended
- **Context**: Situational data used for decision

**Outcome Data:**
- **Success**: Boolean - did the action achieve its goal?
- **Metrics**: Quantitative measures (cost variance, time to complete, etc.)
- **Human Feedback**: Text feedback from reviewer
- **Rating**: 1-5 star rating of decision quality

**Approval Data:**
- **Status**: auto_executed, approved, rejected
- **Approved/Rejected By**: User ID
- **Rejection Reason**: Why decision was rejected (for learning)

---

## API Endpoints

### 1. Record Decision Outcome

**`POST /api/autonomy/decisions/{decision_id}/outcome`**

Record execution outcome and feedback after a decision is executed.

#### Request Body

```json
{
  "success": true,
  "metrics": {
    "estimated_cost": 750.00,
    "actual_cost": 745.00,
    "variance_percent": -0.67,
    "delivery_on_time": true,
    "quality_rating": 5
  },
  "feedback": "Purchase order executed successfully, delivery on time with accurate pricing",
  "rating": 5
}
```

#### Response: 200 OK

```json
{
  "decision_id": "dec-abc123",
  "agent_id": "procurement_agent",
  "status": "auto_executed",
  "executed": true,
  "executed_at": "2026-01-14T15:30:00Z",
  "outcome_success": true,
  "outcome_metrics": {
    "estimated_cost": 750.00,
    "actual_cost": 745.00,
    "variance_percent": -0.67,
    "delivery_on_time": true,
    "quality_rating": 5
  },
  "human_feedback": "Purchase order executed successfully...",
  "feedback_rating": 5,
  // ... other decision fields
}
```

#### Use Cases

**After Auto-Execution:**
```python
# Agent auto-executed a decision
decision_id = agent_result["autonomy"]["decision_id"]

# Execute the recommended action
execution_result = await execute_purchase_order(...)

# Record the outcome
await autonomy_manager.record_outcome(
    decision_id=decision_id,
    success=True,
    metrics={
        "estimated_cost": 750.00,
        "actual_cost": 745.00,
        "delivery_on_time": True,
    },
    rating=5,
)
```

**After Manual Approval:**
```python
# Human approved and executed
await autonomy_manager.record_outcome(
    decision_id=decision_id,
    success=True,
    feedback="Good recommendation, executed without issues",
    rating=4,
)
```

**Failed Execution:**
```python
# Execution failed
await autonomy_manager.record_outcome(
    decision_id=decision_id,
    success=False,
    feedback="Supplier was out of stock, couldn't complete order",
    rating=2,
)
```

---

### 2. Get Learning Analysis

**`GET /api/autonomy/learning/analysis/{agent_id}?days=30`**

Analyze agent performance over time period.

#### Query Parameters

- `days` (integer, 1-90, default: 30) - Days of data to analyze

#### Response: 200 OK

```json
{
  "agent_id": "procurement_agent",
  "analysis_period_days": 30,
  "total_decisions": 42,
  "decision_breakdown": {
    "total": 42,
    "auto_executed_count": 28,
    "auto_executed_rate": 0.67,
    "pending_count": 5,
    "approved_count": 7,
    "approved_rate": 0.78,
    "rejected_count": 2,
    "expired_count": 0
  },
  "confidence_analysis": {
    "high (0.9-1.0)": {
      "count": 15,
      "avg_confidence": 0.93,
      "success_rate": 0.96,
      "approval_rate": 1.0
    },
    "medium-high (0.8-0.9)": {
      "count": 20,
      "avg_confidence": 0.84,
      "success_rate": 0.89,
      "approval_rate": 0.85
    },
    "medium (0.7-0.8)": {
      "count": 7,
      "avg_confidence": 0.74,
      "success_rate": 0.71,
      "approval_rate": 0.60
    }
  },
  "risk_analysis": {
    "low": {
      "count": 30,
      "avg_confidence": 0.86,
      "success_rate": 0.94,
      "auto_execution_rate": 0.90
    },
    "medium": {
      "count": 10,
      "avg_confidence": 0.81,
      "success_rate": 0.80,
      "auto_execution_rate": 0.40
    },
    "high": {
      "count": 2,
      "avg_confidence": 0.92,
      "success_rate": 1.0,
      "auto_execution_rate": 0.0
    }
  },
  "human_override_patterns": {
    "total_reviewed": 9,
    "approved_count": 7,
    "rejected_count": 2,
    "approval_rate": 0.78,
    "avg_confidence_approved": 0.84,
    "avg_confidence_rejected": 0.76,
    "patterns": {
      "high_confidence_rejected": [],
      "low_confidence_approved": [
        {
          "decision_id": "dec-xyz",
          "confidence": 0.68,
          "risk_level": "low"
        }
      ],
      "common_rejection_reasons": {
        "Supplier pricing too high, need to negotiate": 1,
        "Stock level incorrect, need recount": 1
      }
    }
  },
  "execution_analysis": {
    "total_executed": 35,
    "with_outcome_data": 28,
    "successful_count": 27,
    "success_rate": 0.96,
    "with_ratings": 20,
    "average_rating": 4.5
  }
}
```

#### Interpretation

**Decision Breakdown:**
- **67% auto-execution rate**: Agent is moderately autonomous
- **78% approval rate**: Most human-reviewed decisions are approved
- **Low rejection rate**: Agent making good recommendations

**Confidence Analysis:**
- **High confidence (0.9-1.0)**: 96% success rate → Agent very accurate when confident
- **Medium confidence (0.7-0.8)**: 71% success rate → Less reliable, may need threshold increase

**Risk Analysis:**
- **Low risk**: 90% auto-execution rate → Working as expected
- **Medium risk**: 40% auto-execution rate → Confidence not meeting thresholds
- **High risk**: 0% auto-execution rate → All require approval (good)

**Human Overrides:**
- **Low confidence approved**: Agent may be under-confident
- **High confidence rejected**: Agent may be overconfident (investigate)
- **Common rejection reasons**: Identify systematic issues

---

### 3. Get Threshold Recommendations

**`GET /api/autonomy/learning/recommendations/{agent_id}?days=30`**

Get recommended threshold adjustments based on performance analysis.

#### Query Parameters

- `days` (integer, 7-90, default: 30) - Days of data to analyze

#### Response: 200 OK

```json
{
  "agent_id": "procurement_agent",
  "current_config": {
    "autonomy_level": "semi_autonomous",
    "min_confidence_low_risk": 0.70,
    "min_confidence_medium_risk": 0.85,
    "min_confidence_high_risk": 0.95,
    "max_actions_per_hour": 10,
    "max_actions_per_day": 50
  },
  "recommendations": [
    {
      "type": "confidence_threshold",
      "parameter": "min_confidence_high_risk",
      "current_value": 0.95,
      "recommended_value": 0.92,
      "reason": "High confidence decisions have 96% success rate, can reduce threshold",
      "confidence": "high"
    },
    {
      "type": "autonomy_level",
      "parameter": "autonomy_level",
      "current_value": "semi_autonomous",
      "recommended_value": "fully_autonomous",
      "reason": "Agent has 95% approval rate, ready for fully autonomous mode",
      "confidence": "medium"
    },
    {
      "type": "rate_limit",
      "parameter": "max_actions_per_day",
      "current_value": 50,
      "recommended_value": 75,
      "reason": "Agent frequently hits daily rate limit, consider increasing",
      "confidence": "medium"
    }
  ],
  "analysis_summary": {
    "total_decisions": 42,
    "auto_execution_rate": 0.67,
    "approval_rate": 0.95
  }
}
```

#### Recommendation Types

**1. Confidence Threshold Adjustments**

Recommendations based on confidence-to-outcome correlation:

- **Lower threshold**: When high confidence consistently leads to success
  - Example: 95% → 92% for high-risk decisions
  - Allows more auto-execution while maintaining safety

- **Raise threshold**: When low/medium confidence has low success rates
  - Example: 70% → 75% for low-risk decisions
  - Reduces auto-execution of uncertain decisions

**2. Autonomy Level Changes**

Recommendations based on approval rates:

- **Increase autonomy**: When approval rate > 90% consistently
  - Advisory → Semi-Autonomous (after 20+ decisions)
  - Semi-Autonomous → Fully Autonomous (after 50+ decisions)

- **Decrease autonomy**: When approval rate < 70%
  - Fully Autonomous → Semi-Autonomous
  - Agent needs more human oversight

**3. Rate Limit Adjustments**

Recommendations based on usage patterns:

- **Increase limits**: When frequently hitting limits
  - Indicates healthy agent usage, can handle more

- **Decrease limits**: When rarely approaching limits
  - May indicate overly generous limits

---

## Analysis Metrics Explained

### Confidence Accuracy

**What it measures**: How well confidence scores predict outcomes

**Calculation**:
```
For each confidence range (e.g., 0.8-0.9):
  - Group all decisions in that range
  - Calculate success rate of executed decisions
  - Calculate approval rate of human-reviewed decisions
```

**Interpretation**:
- **High confidence, high success**: Agent is accurate ✓
- **High confidence, low success**: Agent is overconfident ⚠️
- **Low confidence, high success**: Agent is under-confident ℹ️
- **Low confidence, low success**: Agent is accurate ✓

**Example**:
```json
{
  "high (0.9-1.0)": {
    "count": 15,
    "avg_confidence": 0.93,
    "success_rate": 0.96,  // 96% success when confident
    "approval_rate": 1.0    // Always approved by humans
  }
}
```
**Action**: Can lower high-risk threshold from 0.95 to 0.92

---

### Risk Accuracy

**What it measures**: How well risk assessments align with outcomes

**Calculation**:
```
For each risk level:
  - Group all decisions with that risk level
  - Calculate success rate
  - Calculate auto-execution rate
  - Compare to expected patterns
```

**Expected Patterns**:
- **Low risk**: High auto-execution rate (>80%), high success rate (>90%)
- **Medium risk**: Moderate auto-execution (30-60%), moderate success (80-90%)
- **High risk**: Low auto-execution (<20%), high success when executed (>85%)

**Example**:
```json
{
  "medium": {
    "count": 10,
    "avg_confidence": 0.81,
    "success_rate": 0.80,
    "auto_execution_rate": 0.40  // Only 40% auto-executed
  }
}
```
**Analysis**: Medium-risk decisions have 81% confidence on average, below the 85% threshold. Working as intended.

---

### Human Override Patterns

**What it measures**: Patterns in human approvals and rejections

**Key Insights**:

1. **High Confidence Rejected**
   - Agent thought it was right, humans disagreed
   - May indicate overconfidence or missing context
   - **Action**: Investigate rejection reasons, adjust confidence calculation

2. **Low Confidence Approved**
   - Agent uncertain, humans confident
   - May indicate under-confidence or overly conservative
   - **Action**: Could lower thresholds slightly

3. **Common Rejection Reasons**
   - Identify systematic issues
   - Feed back into agent training/confidence calculation

**Example**:
```json
{
  "patterns": {
    "high_confidence_rejected": [
      {
        "decision_id": "dec-123",
        "confidence": 0.88,
        "risk_level": "medium",
        "reason": "Supplier pricing changed, data was stale"
      }
    ]
  }
}
```
**Action**: Update agent to check supplier pricing freshness before calculating confidence

---

## Using Learning Data to Improve Agents

### Step 1: Regular Analysis

**Frequency**: Weekly or monthly depending on decision volume

```bash
# Get analysis for last 30 days
curl http://localhost:8000/api/autonomy/learning/analysis/procurement_agent?days=30
```

**Review**:
- Total decisions (need at least 20 for meaningful analysis)
- Auto-execution rate (should align with autonomy level)
- Success rate (should be >85% overall)
- Approval rate (should be >75% for human-reviewed)

---

### Step 2: Review Recommendations

```bash
# Get recommendations
curl http://localhost:8000/api/autonomy/learning/recommendations/procurement_agent?days=30
```

**Evaluate Each Recommendation**:

1. **Check Confidence Level**
   - "high" confidence → Safe to apply
   - "medium" confidence → Review carefully
   - "low" confidence → May need more data

2. **Assess Business Impact**
   - Will this change auto-execution rate significantly?
   - What's the risk if recommendation is wrong?
   - Does it align with business tolerance?

3. **Apply Gradually**
   - Don't apply all recommendations at once
   - Apply one, monitor for 1-2 weeks, then next
   - Can always revert if results aren't good

---

### Step 3: Apply Recommendations

```bash
# Apply a recommendation (e.g., lower high-risk threshold)
curl -X PUT http://localhost:8000/api/autonomy/config/procurement_agent \
  -H "Content-Type: application/json" \
  -d '{
    "min_confidence_high_risk": 0.92
  }'
```

**Monitor After Changes**:
- Watch auto-execution rate for next 7 days
- Check success rate of newly auto-executed decisions
- Review any increase in human rejections

---

### Step 4: Refine Agent Confidence Calculation

Based on patterns in rejection reasons and failed outcomes:

**Example: Supplier Pricing Staleness**

**Problem Found**: Rejections cite "pricing changed" frequently

**Solution**:
```python
def _calculate_confidence(self, state: ProcurementState) -> float:
    base_confidence = 0.70

    # Existing logic...

    # NEW: Reduce confidence if supplier pricing is stale
    supplier_data_age_hours = state.get("supplier_data_age_hours", 0)
    if supplier_data_age_hours > 24:
        base_confidence -= 0.10  # Reduce confidence for stale data

    return max(0.0, min(1.0, base_confidence))
```

**Result**: Agent will be less confident when data is stale, requiring more human review

---

## Best Practices

### 1. Collect Outcome Data Consistently

**Always record outcomes** after execution:
- Success/failure
- Quantitative metrics when available
- Human feedback for important decisions

**Example Pattern**:
```python
# After any agent execution
try:
    result = await execute_action(recommendation)
    success = True
    metrics = calculate_metrics(recommendation, result)
except Exception as e:
    success = False
    metrics = {"error": str(e)}

# Record outcome
await record_outcome(
    decision_id=decision_id,
    success=success,
    metrics=metrics,
)
```

---

### 2. Provide Meaningful Feedback

**Good Feedback Examples**:
- ✅ "Excellent recommendation, supplier had best pricing and delivered on time"
- ✅ "Price was correct but lead time was underestimated by 3 days"
- ✅ "Supplier A was out of stock, should have checked supplier B first"

**Poor Feedback Examples**:
- ❌ "Good" (too vague)
- ❌ "OK" (no actionable info)
- ❌ "Bad" (doesn't explain why)

**Feedback Structure**:
- What was accurate/inaccurate
- What could be improved
- Specific data points (timing, cost, quality)

---

### 3. Analyze Regularly

**Minimum Data Requirements**:
- **10 decisions**: Can start to see patterns
- **20 decisions**: Meaningful for single metric analysis
- **50 decisions**: Sufficient for threshold recommendations
- **100+ decisions**: Robust statistical analysis

**Analysis Schedule**:
- **< 50 decisions/month**: Monthly analysis
- **50-200 decisions/month**: Bi-weekly analysis
- **200+ decisions/month**: Weekly analysis

---

### 4. Apply Recommendations Gradually

**Don't**:
- ❌ Apply all recommendations at once
- ❌ Make large threshold changes (>0.10)
- ❌ Skip monitoring after changes

**Do**:
- ✅ Apply one recommendation at a time
- ✅ Make small adjustments (0.02-0.05)
- ✅ Monitor for 1-2 weeks before next change
- ✅ Document what changed and when
- ✅ Be ready to revert if needed

---

### 5. Balance Autonomy and Safety

**Progressive Autonomy**:
1. **Start**: Advisory mode, 2-4 weeks
2. **Evaluate**: >85% approval rate → Semi-Autonomous
3. **Monitor**: Semi-Autonomous, 4-8 weeks
4. **Evaluate**: >90% approval rate → Fully Autonomous
5. **Monitor**: Continuously, ready to dial back if needed

**Safety Checks**:
- Never exceed business risk tolerance
- Always have emergency disable ready
- Monitor closely after any change
- Maintain audit trail of all decisions

---

## Troubleshooting

### Problem: No Recommendations Generated

**Cause**: Insufficient data

**Solution**:
- Need at least 10 decisions for analysis
- Operate agent longer before expecting recommendations
- Ensure outcome data is being recorded

---

### Problem: Recommendations Don't Match Intuition

**Cause**: Different perspective than system

**Solution**:
- Review the underlying analysis data
- Check if outcome data accurately reflects reality
- Consider if your intuition is based on recent bias
- System uses 30-day average, may smooth over recent changes

---

### Problem: Agent Performance Degraded After Applying Recommendation

**Cause**: Recommendation was premature or data was noisy

**Solution**:
- Revert the change immediately
- Analyze what went wrong (more data needed? wrong metric?)
- Wait for more data before trying again
- Consider if external factors changed (market conditions, etc.)

---

## Integration with Frontend

### TypeScript Types

```typescript
export interface OutcomeRecord {
  success: boolean;
  metrics?: Record<string, any>;
  feedback?: string;
  rating?: number; // 1-5
}

export interface LearningAnalysis {
  agent_id: string;
  analysis_period_days: number;
  total_decisions: number;
  decision_breakdown: DecisionBreakdown;
  confidence_analysis: ConfidenceAnalysis;
  risk_analysis: RiskAnalysis;
  human_override_patterns: OverridePatterns;
  execution_analysis: ExecutionAnalysis;
}

export interface ThresholdRecommendation {
  type: "confidence_threshold" | "autonomy_level" | "rate_limit";
  parameter: string;
  current_value: any;
  recommended_value: any;
  reason: string;
  confidence: "high" | "medium" | "low";
}
```

### API Client Methods

```typescript
// Record outcome
await apiClient.post(`/api/autonomy/decisions/${decisionId}/outcome`, {
  success: true,
  metrics: { cost_variance: -0.67 },
  rating: 5,
});

// Get analysis
const analysis = await apiClient.get<LearningAnalysis>(
  `/api/autonomy/learning/analysis/${agentId}?days=30`
);

// Get recommendations
const recs = await apiClient.get(
  `/api/autonomy/learning/recommendations/${agentId}?days=30`
);
```

---

## Future Enhancements

**Planned Features**:
- [ ] Automated A/B testing of different thresholds
- [ ] ML-based confidence prediction using historical patterns
- [ ] Anomaly detection for sudden performance degradation
- [ ] Predictive recommendations before issues occur
- [ ] Multi-agent learning (cross-agent insights)
- [ ] Seasonal adjustment awareness
- [ ] Real-time recommendation updates

---

**Last Updated**: January 14, 2026
**Status**: Production Ready - Backend Complete
**Dependencies**: Autonomy Manager, AutonomyStorage
