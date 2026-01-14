# Agent Autonomy Integration Guide

## Overview

This guide shows how to integrate the autonomy management system into existing AI agents. The procurement agent has been fully integrated as a reference implementation.

**Reference Implementation:** `apps/backend/src/ai/agents/specialized/procurement_agent.py`

---

## Integration Steps

### Step 1: Add Confidence Calculation Method

Add a method to calculate how confident the agent is in its decision. Base this on data quality, completeness, and historical patterns.

```python
def _calculate_confidence(self, state: AgentState) -> float:
    """Calculate confidence score for agent decisions.

    Confidence factors:
    - Data quality and completeness
    - Historical accuracy (if available)
    - Number of risk factors
    - Tool execution success rate

    Returns:
        float: Confidence score between 0.0 and 1.0
    """
    base_confidence = 0.70  # Start conservative

    # Boost confidence for complete data
    if state.get("data_complete"):
        base_confidence += 0.10

    # Boost for successful tool executions
    tools_used = state.get("tools_used", [])
    if len(tools_used) > 0:
        base_confidence += 0.05

    # Reduce confidence for identified risks
    risk_factors = state.get("risk_factors", [])
    risk_penalty = len(risk_factors) * 0.03
    base_confidence -= risk_penalty

    # Reduce confidence for missing critical data
    if not state.get("critical_data_available"):
        base_confidence -= 0.20

    # Keep in valid range
    confidence = max(0.0, min(1.0, base_confidence))

    logger.info(
        "Calculated confidence",
        confidence=confidence,
        data_complete=state.get("data_complete"),
        tools_used_count=len(tools_used),
        risk_factor_count=len(risk_factors),
    )

    return confidence
```

**Confidence Guidelines:**
- **0.90-1.0**: Very high confidence, excellent data quality
- **0.80-0.89**: High confidence, good data quality
- **0.70-0.79**: Moderate confidence, acceptable data quality
- **0.60-0.69**: Low confidence, some data gaps
- **<0.60**: Very low confidence, significant data issues

---

### Step 2: Add Risk Assessment Method

Add a method to assess the risk level of the decision based on business impact.

```python
def _assess_risk(self, state: AgentState) -> RiskLevel:
    """Assess risk level of agent decisions.

    Risk factors:
    - Financial impact (dollar value)
    - Operational impact (scope/complexity)
    - Urgency (time sensitivity)
    - Reversibility (can it be undone easily?)

    Returns:
        RiskLevel: low, medium, or high
    """
    from src.ai.autonomy.models import RiskLevel

    # Financial risk assessment
    estimated_value = state.get("estimated_value", 0)
    if estimated_value > 10000:
        risk_level = RiskLevel.HIGH
    elif estimated_value > 2000:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW

    # Elevate risk for high operational complexity
    items_affected = state.get("items_affected", 0)
    if items_affected > 100:
        if risk_level == RiskLevel.LOW:
            risk_level = RiskLevel.MEDIUM
        elif risk_level == RiskLevel.MEDIUM:
            risk_level = RiskLevel.HIGH

    # Elevate risk for critical/urgent items
    urgency = state.get("urgency", "normal")
    if urgency == "critical":
        if risk_level == RiskLevel.LOW:
            risk_level = RiskLevel.MEDIUM

    # Elevate risk for irreversible operations
    is_reversible = state.get("is_reversible", True)
    if not is_reversible:
        if risk_level == RiskLevel.LOW:
            risk_level = RiskLevel.MEDIUM

    logger.info(
        "Assessed risk level",
        risk_level=risk_level,
        estimated_value=estimated_value,
        items_affected=items_affected,
        urgency=urgency,
        is_reversible=is_reversible,
    )

    return risk_level
```

**Risk Level Guidelines:**

**LOW Risk:**
- Read-only operations
- Data retrieval and analysis
- Small financial impact (<$2,000)
- Easily reversible
- Examples: Generate report, analyze trends, fetch data

**MEDIUM Risk:**
- Moderate financial impact ($2,000-$10,000)
- Affects multiple items (10-100)
- Some operational complexity
- Reversible with effort
- Examples: Stock adjustments, batch price updates, reorder suggestions

**HIGH Risk:**
- Large financial impact (>$10,000)
- Affects many items (>100)
- High operational complexity
- Difficult or impossible to reverse
- Examples: Large purchase orders, bulk deletions, major system changes

---

### Step 3: Modify Finalize Method

Integrate autonomy manager into the agent's finalize method.

```python
async def _finalize(self, state: AgentState) -> AgentState:
    """Finalize and format agent output."""

    # ... existing finalization logic ...

    # Build recommendation/output
    recommendation = {
        "action": "suggested_action",
        "details": state.get("details"),
        "reasoning": state.get("reasoning"),
        # ... other fields
    }

    state["output"] = recommendation

    # Integrate with autonomy system
    if should_track_decision(recommendation):  # Your logic
        try:
            from src.ai.autonomy import get_autonomy_manager

            # Calculate confidence and assess risk
            confidence = self._calculate_confidence(state)
            risk_level = self._assess_risk(state)

            # Get autonomy manager
            manager = get_autonomy_manager()

            # Record decision
            decision = await manager.record_decision(
                agent_id=self.agent_id,
                decision_type="your_decision_type",  # e.g., "purchase_order", "price_adjustment"
                recommendation=recommendation,
                confidence=confidence,
                risk_level=risk_level,
                context={
                    "key_context_1": state.get("context_1"),
                    "key_context_2": state.get("context_2"),
                    # Include relevant context for human review
                },
                estimated_value=state.get("estimated_value", 0),
                estimated_quantity=state.get("estimated_quantity", 0),
            )

            # Add autonomy info to state
            state["autonomy_decision"] = {
                "decision_id": decision.decision_id,
                "status": decision.status,
                "requires_approval": decision.requires_approval,
                "confidence": confidence,
                "risk_level": risk_level,
                "auto_executed": decision.status == "auto_executed",
            }

            # Update output with autonomy info
            recommendation["autonomy"] = {
                "decision_id": decision.decision_id,
                "status": decision.status.value if hasattr(decision.status, "value") else decision.status,
                "requires_approval": decision.requires_approval,
                "confidence": confidence,
                "risk_level": risk_level.value if hasattr(risk_level, "value") else risk_level,
            }

            logger.info(
                "Autonomy decision recorded",
                decision_id=decision.decision_id,
                status=decision.status,
                confidence=confidence,
                risk_level=risk_level,
                requires_approval=decision.requires_approval,
            )

        except Exception as e:
            logger.error("Failed to record autonomy decision", error=str(e))
            # Don't fail the agent if autonomy integration fails
            logger.warning("Continuing without autonomy decision tracking")

    state["status"] = "completed"
    return state
```

---

### Step 4: Handle Autonomy Decisions in API Endpoints

Modify API endpoints that call agents to handle autonomy decisions.

```python
@router.post("/api/agents/your-agent/execute")
async def execute_your_agent(request: YourAgentRequest):
    """Execute agent with autonomy support."""

    # Execute agent
    agent = get_your_agent()
    result = await agent.execute(task=request.task, context=request.context)

    # Check autonomy decision
    autonomy_decision = result.get("autonomy_decision")

    if autonomy_decision:
        if autonomy_decision["status"] == "auto_executed":
            # Agent decision was auto-executed
            logger.info(
                "Agent decision auto-executed",
                decision_id=autonomy_decision["decision_id"],
                confidence=autonomy_decision["confidence"],
            )

            # Execute the recommended action
            execution_result = await execute_action(result["recommendation"])

            # Mark decision as executed
            from src.ai.autonomy import get_autonomy_manager
            manager = get_autonomy_manager()
            await manager.mark_executed(
                decision_id=autonomy_decision["decision_id"],
                result=execution_result,
            )

            return {
                "status": "executed",
                "result": execution_result,
                "decision_id": autonomy_decision["decision_id"],
            }

        else:
            # Decision requires approval
            logger.info(
                "Agent decision requires approval",
                decision_id=autonomy_decision["decision_id"],
                risk_level=autonomy_decision["risk_level"],
            )

            return {
                "status": "pending_approval",
                "decision_id": autonomy_decision["decision_id"],
                "recommendation": result["recommendation"],
                "confidence": autonomy_decision["confidence"],
                "risk_level": autonomy_decision["risk_level"],
                "message": "Decision queued for human approval",
            }

    # No autonomy decision (advisory mode or no actions)
    return {
        "status": "completed",
        "result": result,
    }
```

---

## Agent-Specific Examples

### Pricing Agent

**Decision Type:** `price_adjustment`

**Confidence Factors:**
- Historical pricing accuracy
- Market data completeness
- Competitive intelligence availability
- Demand forecast reliability

**Risk Factors:**
- Price change magnitude (% change)
- Number of products affected
- Competitive implications
- Margin impact

```python
def _calculate_confidence(self, state: PricingState) -> float:
    base_confidence = 0.75

    # Boost for complete market data
    if state.get("market_data_complete"):
        base_confidence += 0.10

    # Boost for historical accuracy
    historical_accuracy = state.get("historical_accuracy", 0)
    if historical_accuracy > 0.9:
        base_confidence += 0.10

    # Reduce for large price changes
    max_price_change = state.get("max_price_change_percent", 0)
    if max_price_change > 20:
        base_confidence -= 0.15

    return max(0.0, min(1.0, base_confidence))

def _assess_risk(self, state: PricingState) -> RiskLevel:
    from src.ai.autonomy.models import RiskLevel

    num_products = state.get("num_products_affected", 0)
    max_price_change = state.get("max_price_change_percent", 0)

    # Large price changes are higher risk
    if max_price_change > 30 or num_products > 100:
        return RiskLevel.HIGH
    elif max_price_change > 15 or num_products > 20:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.LOW
```

---

### Inventory Agent

**Decision Type:** `inventory_adjustment`

**Confidence Factors:**
- Stock count accuracy
- Movement history completeness
- Forecast reliability
- Warehouse data sync status

**Risk Factors:**
- Adjustment magnitude
- Stock-out risk
- Overstock risk
- Financial impact

```python
def _calculate_confidence(self, state: InventoryState) -> float:
    base_confidence = 0.70

    # Boost for recent stock count
    days_since_count = state.get("days_since_physical_count", 999)
    if days_since_count < 7:
        base_confidence += 0.15
    elif days_since_count < 30:
        base_confidence += 0.08

    # Boost for movement history
    if state.get("has_movement_history"):
        base_confidence += 0.05

    # Reduce for data discrepancies
    discrepancies = state.get("data_discrepancies", 0)
    base_confidence -= discrepancies * 0.05

    return max(0.0, min(1.0, base_confidence))

def _assess_risk(self, state: InventoryState) -> RiskLevel:
    from src.ai.autonomy.models import RiskLevel

    adjustment_qty = abs(state.get("adjustment_quantity", 0))
    current_stock = state.get("current_stock", 0)

    # Calculate adjustment percentage
    if current_stock > 0:
        adjustment_percent = (adjustment_qty / current_stock) * 100
    else:
        adjustment_percent = 100

    # Large adjustments are higher risk
    if adjustment_percent > 50 or adjustment_qty > 1000:
        return RiskLevel.HIGH
    elif adjustment_percent > 20 or adjustment_qty > 100:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.LOW
```

---

### Quote Agent

**Decision Type:** `quote_generation`

**Confidence Factors:**
- Product pricing accuracy
- Customer history completeness
- Margin calculation accuracy
- Competitive pricing data

**Risk Factors:**
- Quote value
- Margin percentage
- Customer importance
- Competitive pressure

```python
def _calculate_confidence(self, state: QuoteState) -> float:
    base_confidence = 0.80  # Quotes are typically lower risk

    # Boost for customer history
    if state.get("has_customer_history"):
        base_confidence += 0.10

    # Boost for accurate product pricing
    if state.get("pricing_verified"):
        base_confidence += 0.05

    # Reduce for custom products
    if state.get("has_custom_items"):
        base_confidence -= 0.10

    return max(0.0, min(1.0, base_confidence))

def _assess_risk(self, state: QuoteState) -> RiskLevel:
    from src.ai.autonomy.models import RiskLevel

    quote_value = state.get("quote_value", 0)
    margin_percent = state.get("margin_percent", 0)

    # High-value quotes with low margins are higher risk
    if quote_value > 50000 or margin_percent < 10:
        return RiskLevel.HIGH
    elif quote_value > 10000 or margin_percent < 20:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.LOW
```

---

## Testing Integration

### Test 1: Advisory Mode (No Auto-Execution)

```bash
# Set agent to advisory mode
curl -X PUT http://localhost:8000/api/autonomy/config/procurement_agent \
  -H "Content-Type: application/json" \
  -d '{"autonomy_level": "advisory"}'

# Execute agent
curl -X POST http://localhost:8000/api/agents/procurement/execute \
  -H "Content-Type: application/json" \
  -d '{"request_type": "analyze_inventory"}'

# Expected: Decision requires approval, status = "pending_approval"
```

### Test 2: Semi-Autonomous (Low Risk Auto-Executes)

```bash
# Set agent to semi-autonomous
curl -X PUT http://localhost:8000/api/autonomy/config/procurement_agent \
  -H "Content-Type: application/json" \
  -d '{
    "autonomy_level": "semi_autonomous",
    "max_auto_approval_amount": 2000.0
  }'

# Execute agent with low-value recommendation
# Expected: If value < $2000 and confidence >= 0.7, auto-executes
```

### Test 3: Fully Autonomous (All Within Limits)

```bash
# Set agent to fully autonomous
curl -X PUT http://localhost:8000/api/autonomy/config/procurement_agent \
  -H "Content-Type: application/json" \
  -d '{
    "autonomy_level": "fully_autonomous",
    "max_auto_approval_amount": 5000.0,
    "min_confidence_high_risk": 0.90
  }'

# Execute agent with high-value recommendation
# Expected: If value < $5000 and confidence >= thresholds, auto-executes
```

---

## Checklist for Integration

- [ ] Add `_calculate_confidence()` method
- [ ] Add `_assess_risk()` method
- [ ] Modify `_finalize()` to record decisions
- [ ] Update API endpoint to handle autonomy decisions
- [ ] Add execution logic for auto-approved decisions
- [ ] Test with advisory mode
- [ ] Test with semi-autonomous mode
- [ ] Test with fully autonomous mode
- [ ] Test rate limiting
- [ ] Test value thresholds
- [ ] Document agent-specific confidence factors
- [ ] Document agent-specific risk factors

---

## Common Patterns

### Pattern 1: Data Quality Affects Confidence

```python
# Complete, verified data → Higher confidence
if data_verified and data_complete:
    confidence += 0.15

# Partial or unverified data → Lower confidence
if not data_complete:
    confidence -= 0.20
```

### Pattern 2: Financial Impact Affects Risk

```python
# Higher value → Higher risk
if estimated_value > 10000:
    risk_level = RiskLevel.HIGH
elif estimated_value > 2000:
    risk_level = RiskLevel.MEDIUM
else:
    risk_level = RiskLevel.LOW
```

### Pattern 3: Complexity Affects Both

```python
# More items affected → Lower confidence, Higher risk
items_affected = state.get("items_affected", 0)

# Confidence penalty for complexity
confidence -= min(0.20, items_affected / 1000)

# Risk elevation for scale
if items_affected > 100:
    risk_level = elevate_risk(risk_level)
```

---

## Best Practices

1. **Start Conservative**: Begin with lower confidence scores and higher risk assessments
2. **Gradual Tuning**: Monitor outcomes and adjust thresholds over time
3. **Clear Logging**: Log all confidence and risk calculations for debugging
4. **Graceful Degradation**: Don't fail agent execution if autonomy integration fails
5. **Rich Context**: Include all relevant context for human review
6. **Historical Learning**: Use outcome data to improve confidence calculations
7. **Domain Knowledge**: Base risk thresholds on actual business tolerance
8. **User Feedback**: Incorporate human override patterns into confidence models

---

## Troubleshooting

**Problem:** All decisions require approval even in fully autonomous mode

**Solution:** Check confidence calculations - may be too low. Verify agent configuration has correct autonomy level.

**Problem:** Decisions auto-execute when they shouldn't

**Solution:** Review risk assessment logic - may be underestimating risk. Check value/quantity thresholds.

**Problem:** Agent fails after adding autonomy integration

**Solution:** Ensure imports are correct. Add try-catch around autonomy logic. Check logs for specific error.

**Problem:** Confidence always returns same value

**Solution:** Verify state data is being populated correctly. Add logging to see what factors are being evaluated.

---

## Next Steps

After integrating autonomy into an agent:

1. **Monitor Performance**: Track approval rates, rejection reasons, success rates
2. **Tune Thresholds**: Adjust confidence and risk calculations based on outcomes
3. **Collect Feedback**: Record human overrides and learn from them
4. **Iterate**: Continuously improve confidence and risk models
5. **Document**: Update this guide with agent-specific learnings

---

**Reference Implementation:** `apps/backend/src/ai/agents/specialized/procurement_agent.py`

**API Documentation:** `docs/AGENT-AUTONOMY-API.md`

**Integration Examples:** `apps/backend/src/ai/autonomy/integration_example.py`
