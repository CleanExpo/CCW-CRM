"""Example integration of Autonomy Manager with AI agents.

This file demonstrates how to integrate the autonomy management system
with existing AI agents to enable autonomous decision-making with
configurable safety controls.
"""

from datetime import UTC, datetime
from uuid import UUID

from src.ai.autonomy import get_autonomy_manager
from src.ai.autonomy.models import RiskLevel
from src.utils import get_logger

logger = get_logger(__name__)


async def example_procurement_decision(
    agent_id: str = "procurement_agent",
    product_id: UUID = UUID("00000000-0000-0000-0000-000000000001"),
    quantity: int = 50,
    estimated_cost: float = 750.0,
) -> dict:
    """Example: Procurement agent making a purchase order decision.

    This shows how an agent would:
    1. Calculate confidence in the decision
    2. Assess risk level
    3. Record the decision with autonomy manager
    4. Check if auto-execution is allowed
    5. Execute or queue for approval

    Args:
        agent_id: ID of the procurement agent
        product_id: Product to reorder
        quantity: Quantity to order
        estimated_cost: Estimated total cost

    Returns:
        dict with decision outcome
    """
    manager = get_autonomy_manager()

    # Step 1: Agent calculates confidence based on historical data
    # (In real implementation, this would be ML-based)
    confidence = 0.88  # 88% confidence in this decision

    # Step 2: Assess risk level based on financial impact and business rules
    if estimated_cost > 2000:
        risk_level = RiskLevel.HIGH
    elif estimated_cost > 500:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW

    # Step 3: Prepare the recommendation
    recommendation = {
        "action": "create_purchase_order",
        "product_id": str(product_id),
        "quantity": quantity,
        "estimated_cost": estimated_cost,
        "reasoning": "Stock level below reorder point, lead time requires immediate action",
    }

    context = {
        "current_stock": 5,
        "reorder_point": 15,
        "avg_daily_sales": 3,
        "lead_time_days": 7,
        "supplier": "ACME Corp",
    }

    # Step 4: Record decision with autonomy manager
    decision = await manager.record_decision(
        agent_id=agent_id,
        decision_type="purchase_order",
        recommendation=recommendation,
        confidence=confidence,
        risk_level=risk_level,
        context=context,
        estimated_value=estimated_cost,
        estimated_quantity=quantity,
    )

    logger.info(
        "Procurement decision recorded",
        decision_id=decision.decision_id,
        status=decision.status,
        requires_approval=decision.requires_approval,
    )

    # Step 5: Handle based on decision status
    if decision.status == "auto_executed":
        # Agent can proceed with execution
        logger.info("Decision auto-approved, executing purchase order")

        # Execute the purchase order
        execution_result = await execute_purchase_order(
            product_id=product_id,
            quantity=quantity,
            estimated_cost=estimated_cost,
        )

        # Mark as executed
        await manager.mark_executed(
            decision_id=decision.decision_id,
            result=execution_result,
        )

        return {
            "decision_id": decision.decision_id,
            "status": "executed",
            "result": execution_result,
        }

    else:
        # Decision requires human approval
        logger.info("Decision requires approval, queuing for review")

        return {
            "decision_id": decision.decision_id,
            "status": "pending_approval",
            "message": "Purchase order queued for human approval",
            "approval_required_by": decision.expires_at.isoformat() if decision.expires_at else None,
        }


async def execute_purchase_order(
    product_id: UUID,
    quantity: int,
    estimated_cost: float,
) -> dict:
    """Execute a purchase order (mock implementation).

    In real implementation, this would:
    - Create PO in database
    - Send to supplier via integration
    - Update inventory forecasts
    - Send notifications

    Args:
        product_id: Product to order
        quantity: Quantity to order
        estimated_cost: Estimated cost

    Returns:
        Execution result
    """
    # Mock execution
    po_number = f"PO-{datetime.now(UTC).strftime('%Y%m%d')}-001"

    return {
        "po_number": po_number,
        "product_id": str(product_id),
        "quantity": quantity,
        "estimated_cost": estimated_cost,
        "status": "submitted",
        "created_at": datetime.now(UTC).isoformat(),
    }


async def example_approval_workflow():
    """Example: Human approval workflow for pending decisions.

    This shows how a human would:
    1. Fetch pending decisions
    2. Review the decision
    3. Approve or reject with feedback
    """
    manager = get_autonomy_manager()

    # Fetch pending decisions for procurement agent
    pending = await manager.get_pending_decisions(
        agent_id="procurement_agent",
        limit=10,
    )

    logger.info("Pending decisions", count=len(pending))

    if pending:
        decision = pending[0]

        # Human reviews the decision
        print(f"\n=== Decision Review ===")
        print(f"Decision ID: {decision.decision_id}")
        print(f"Agent: {decision.agent_id}")
        print(f"Type: {decision.decision_type}")
        print(f"Confidence: {decision.confidence:.2%}")
        print(f"Risk Level: {decision.risk_level}")
        print(f"Recommendation: {decision.recommendation}")
        print(f"Context: {decision.context}")
        print(f"======================\n")

        # Simulate approval
        user_id = UUID("00000000-0000-0000-0000-000000000001")

        # Option 1: Approve
        approved_decision = await manager.approve_decision(
            decision_id=decision.decision_id,
            approved_by=user_id,
        )

        logger.info("Decision approved", decision_id=decision.decision_id)

        # Now execute the approved decision
        execution_result = await execute_purchase_order(
            product_id=UUID(decision.recommendation["product_id"]),
            quantity=decision.recommendation["quantity"],
            estimated_cost=decision.recommendation["estimated_cost"],
        )

        await manager.mark_executed(
            decision_id=decision.decision_id,
            result=execution_result,
        )

        # Option 2: Reject (alternative)
        # rejected_decision = await manager.reject_decision(
        #     decision_id=decision.decision_id,
        #     rejected_by=user_id,
        #     reason="Supplier pricing too high, need to negotiate first"
        # )


async def example_learning_feedback():
    """Example: Recording learning feedback for continuous improvement.

    After a decision is executed and outcome is known, record feedback
    so the agent can learn and improve over time.
    """
    manager = get_autonomy_manager()

    decision_id = "example-decision-id"

    # Record successful outcome
    await manager.record_outcome(
        decision_id=decision_id,
        success=True,
        metrics={
            "actual_cost": 745.0,
            "estimated_cost": 750.0,
            "variance_percent": -0.67,
            "delivery_on_time": True,
            "quality_rating": 5,
        },
        feedback="Purchase order executed successfully, delivery on time",
        rating=5,  # 5-star rating
    )

    logger.info("Learning feedback recorded", decision_id=decision_id)


async def example_get_agent_stats():
    """Example: Retrieve agent performance statistics."""
    manager = get_autonomy_manager()

    stats = await manager.get_stats(
        agent_id="procurement_agent",
        time_period="last_7d",
    )

    print(f"\n=== Procurement Agent Stats (Last 7 Days) ===")
    print(f"Total Decisions: {stats.total_decisions}")
    print(f"Auto-Executed: {stats.auto_executed}")
    print(f"Pending Approval: {stats.pending_approval}")
    print(f"Approved by Human: {stats.approved_by_human}")
    print(f"Rejected by Human: {stats.rejected_by_human}")
    print(f"Average Confidence: {stats.average_confidence:.2%}")
    print(f"Success Rate: {stats.success_rate:.2%}")
    print(f"Approval Rate: {stats.approval_rate:.2%}")
    print(f"Low Risk: {stats.low_risk_decisions}")
    print(f"Medium Risk: {stats.medium_risk_decisions}")
    print(f"High Risk: {stats.high_risk_decisions}")
    print(f"============================================\n")


# Integration Pattern for Existing Agents
# ========================================
#
# To integrate autonomy management into existing agents:
#
# 1. In agent's finalize method, after generating recommendations:
#
#    from src.ai.autonomy import get_autonomy_manager
#    manager = get_autonomy_manager()
#
#    decision = await manager.record_decision(
#        agent_id=self.agent_id,
#        decision_type="purchase_order",  # or "inventory_adjustment", etc.
#        recommendation=recommendation_data,
#        confidence=self._calculate_confidence(state),
#        risk_level=self._assess_risk(state),
#        context=context_data,
#        estimated_value=total_cost,
#        estimated_quantity=total_quantity,
#    )
#
#    state["autonomy_decision"] = {
#        "decision_id": decision.decision_id,
#        "status": decision.status,
#        "requires_approval": decision.requires_approval,
#    }
#
# 2. In the API endpoint that calls the agent:
#
#    result = await agent.execute(task, context)
#
#    if result.get("autonomy_decision"):
#        decision = result["autonomy_decision"]
#
#        if decision["status"] == "auto_executed":
#            # Execute the action
#            await execute_action(result["recommendation"])
#        else:
#            # Queue for approval
#            return {"status": "pending_approval", "decision_id": decision["decision_id"]}
#
# 3. Confidence calculation (add to agent):
#
#    def _calculate_confidence(self, state: AgentState) -> float:
#        """Calculate confidence score based on data quality and historical accuracy."""
#        base_confidence = 0.7
#
#        # Adjust based on data quality
#        if state.get("data_quality") == "high":
#            base_confidence += 0.15
#
#        # Adjust based on historical accuracy
#        if state.get("historical_accuracy", 0) > 0.9:
#            base_confidence += 0.1
#
#        return min(base_confidence, 1.0)
#
# 4. Risk assessment (add to agent):
#
#    def _assess_risk(self, state: AgentState) -> RiskLevel:
#        """Assess risk level of the decision."""
#        total_value = state.get("total_reorder_value", 0)
#
#        if total_value > 5000:
#            return RiskLevel.HIGH
#        elif total_value > 1000:
#            return RiskLevel.MEDIUM
#        else:
#            return RiskLevel.LOW
