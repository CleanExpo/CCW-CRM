"""Procurement agent for inventory management and supplier recommendations."""

from typing import Any, AsyncGenerator
from uuid import UUID

from langgraph.graph import END, StateGraph

from src.ai.base_agent import BaseAgent
from src.ai.tools.procurement_tools import (
    AnalyzeInventoryTool,
    CalculateReorderQuantityTool,
    SuggestSuppliersTool,
)
from src.ai.tools.inventory_intelligence import INVENTORY_INTELLIGENCE_TOOLS
from src.db.demo_models import ProductCategory
from src.utils import get_logger

from .procurement_state import ProcurementState

logger = get_logger(__name__)


class ProcurementAgent(BaseAgent):
    """Agent for procurement and inventory management.

    Capabilities:
    - Analyze inventory levels and sales velocity
    - Calculate optimal reorder quantities
    - Recommend suppliers and procurement actions
    - Identify stockout risks
    """

    def __init__(self):
        super().__init__(
            agent_id="procurement_agent",
            name="Procurement Agent",
            auto_register=False,
        )

        # Set capabilities for agent registry
        self.capabilities = [
            "procurement",
            "inventory_management",
            "supplier_recommendation",
            "inventory_replenishment",
            "reorder_calculation",
        ]
        self.description = "Manages inventory levels and procurement recommendations"
        self.estimated_execution_time = 20  # seconds
        self.requires_verification = True  # Procurement decisions should be reviewed

        # Register tools
        self.register_tool(AnalyzeInventoryTool())
        self.register_tool(CalculateReorderQuantityTool())
        self.register_tool(SuggestSuppliersTool())

        # Register inventory intelligence tools
        for tool_class in INVENTORY_INTELLIGENCE_TOOLS:
            self.register_tool(tool_class())

        # Build LangGraph state graph
        self.graph = self._build_graph()

        logger.info("Procurement agent initialized")

        # Register with agent registry after full initialization
        self._schedule_registration()

    def _build_graph(self) -> StateGraph:
        """Build LangGraph state graph for procurement operations."""
        workflow = StateGraph(ProcurementState)

        # Add nodes
        workflow.add_node("parse_request", self._parse_request)
        workflow.add_node("analyze_inventory", self._analyze_inventory)
        workflow.add_node("calculate_reorders", self._calculate_reorders)
        workflow.add_node("suggest_suppliers", self._suggest_suppliers)
        workflow.add_node("generate_insights", self._generate_insights)
        workflow.add_node("finalize", self._finalize)

        # Set entry point
        workflow.set_entry_point("parse_request")

        # Add edges
        workflow.add_edge("parse_request", "analyze_inventory")
        workflow.add_edge("analyze_inventory", "calculate_reorders")
        workflow.add_edge("calculate_reorders", "suggest_suppliers")
        workflow.add_edge("suggest_suppliers", "generate_insights")
        workflow.add_edge("generate_insights", "finalize")
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def _parse_request(self, state: ProcurementState) -> ProcurementState:
        """Parse procurement request and initialize state."""
        logger.info("Parsing procurement request", request_type=state.get("request_type"))

        # Initialize state fields
        state.setdefault("low_stock_products", [])
        state.setdefault("out_of_stock_products", [])
        state.setdefault("priority_items", [])
        state.setdefault("reorder_calculations", {})
        state.setdefault("supplier_recommendations", {})
        state.setdefault("insights", [])
        state.setdefault("risk_factors", [])
        state.setdefault("tools_used", [])
        state.setdefault("metadata", {})
        state["total_reorder_value"] = 0.0

        return state

    async def _analyze_inventory(self, state: ProcurementState) -> ProcurementState:
        """Analyze current inventory levels."""
        category = state.get("category")
        logger.info("Analyzing inventory", category=category)

        try:
            # Convert category string to enum if provided
            category_enum = None
            if category:
                try:
                    category_enum = ProductCategory(category)
                except ValueError:
                    logger.warning("Invalid category", category=category)

            async with self.get_db_session() as db:
                inventory_tool: AnalyzeInventoryTool = next(
                    t for t in self.tools if isinstance(t, AnalyzeInventoryTool)
                )

                inventory_result = await inventory_tool.execute(
                    category=category_enum,
                    low_stock_threshold=50,
                    days_lookback=90,
                    db=db,
                )

                if inventory_result.success:
                    state["inventory_data"] = inventory_result.data
                    state["tools_used"].append("analyze_inventory")

                    # Extract key groups
                    inventory = inventory_result.data["inventory"]
                    state["out_of_stock_products"] = [
                        item for item in inventory if item["stock_status"] == "out_of_stock"
                    ]
                    state["low_stock_products"] = [
                        item for item in inventory if item["stock_status"] == "low_stock"
                    ]

                    # Priority items: out of stock or low stock with high urgency
                    state["priority_items"] = [
                        item
                        for item in inventory
                        if item["urgency"] in ["critical", "high"]
                    ]

                    logger.info(
                        "Inventory analysis complete",
                        total_products=len(inventory),
                        out_of_stock=len(state["out_of_stock_products"]),
                        low_stock=len(state["low_stock_products"]),
                        priority_items=len(state["priority_items"]),
                    )
                else:
                    state["error"] = f"Inventory analysis failed: {inventory_result.error}"

        except Exception as e:
            logger.error("Inventory analysis failed", error=str(e))
            state["error"] = f"Failed to analyze inventory: {str(e)}"

        return state

    async def _calculate_reorders(self, state: ProcurementState) -> ProcurementState:
        """Calculate reorder quantities for priority items."""
        priority_items = state.get("priority_items", [])

        if not priority_items:
            logger.info("No priority items requiring reorder calculations")
            return state

        logger.info("Calculating reorder quantities", items_count=len(priority_items))

        reorder_calculations = {}
        total_value = 0.0

        try:
            async with self.get_db_session() as db:
                reorder_tool: CalculateReorderQuantityTool = next(
                    t for t in self.tools if isinstance(t, CalculateReorderQuantityTool)
                )

                # Calculate reorders for up to 10 priority items (to avoid overwhelming)
                for item in priority_items[:10]:
                    product_id = UUID(item["product_id"])

                    reorder_result = await reorder_tool.execute(
                        product_id=product_id,
                        lead_time_days=14,  # Default 2-week lead time
                        safety_stock_days=7,  # 1-week safety buffer
                        db=db,
                    )

                    if reorder_result.success:
                        reorder_data = reorder_result.data
                        reorder_calculations[item["product_id"]] = reorder_data

                        # Add to total value
                        order_value = reorder_data["after_order"]["order_value"]
                        total_value += order_value

                state["reorder_calculations"] = reorder_calculations
                state["total_reorder_value"] = total_value
                state["tools_used"].append("calculate_reorder_quantity")

                logger.info(
                    "Reorder calculations complete",
                    products_calculated=len(reorder_calculations),
                    total_value=total_value,
                )

        except Exception as e:
            logger.error("Reorder calculation failed", error=str(e))
            state["error"] = f"Failed to calculate reorders: {str(e)}"

        return state

    async def _suggest_suppliers(self, state: ProcurementState) -> ProcurementState:
        """Suggest suppliers for products needing restock."""
        reorder_calculations = state.get("reorder_calculations", {})

        if not reorder_calculations:
            logger.info("No reorder calculations to suggest suppliers for")
            return state

        logger.info("Suggesting suppliers", products_count=len(reorder_calculations))

        supplier_recommendations = {}

        try:
            async with self.get_db_session() as db:
                supplier_tool: SuggestSuppliersTool = next(
                    t for t in self.tools if isinstance(t, SuggestSuppliersTool)
                )

                # Get supplier suggestions for each product
                for product_id_str, reorder_data in reorder_calculations.items():
                    product_id = UUID(product_id_str)
                    recommended_qty = reorder_data["reorder_calculation"]["recommended_order_qty"]

                    supplier_result = await supplier_tool.execute(
                        product_id=product_id,
                        quantity=recommended_qty,
                        db=db,
                    )

                    if supplier_result.success:
                        supplier_recommendations[product_id_str] = supplier_result.data

                state["supplier_recommendations"] = supplier_recommendations
                state["tools_used"].append("suggest_suppliers")

                logger.info(
                    "Supplier suggestions complete",
                    products_with_suppliers=len(supplier_recommendations),
                )

        except Exception as e:
            logger.error("Supplier suggestion failed", error=str(e))
            # Don't fail the whole agent if suppliers fail
            logger.warning("Continuing without supplier recommendations")

        return state

    async def _generate_insights(self, state: ProcurementState) -> ProcurementState:
        """Generate insights and identify risks."""
        logger.info("Generating procurement insights")

        insights = []
        risk_factors = []

        inventory_data = state.get("inventory_data")
        if inventory_data:
            summary = inventory_data["summary"]

            # Insight: Out of stock items
            out_of_stock_count = summary["out_of_stock_count"]
            if out_of_stock_count > 0:
                insights.append(f"{out_of_stock_count} products are currently out of stock")
                risk_factors.append("Active stockouts impacting sales")

            # Insight: Low stock items
            low_stock_count = summary["low_stock_count"]
            if low_stock_count > 0:
                insights.append(f"{low_stock_count} products have low inventory levels")
                if low_stock_count > 10:
                    risk_factors.append("High number of low-stock items may indicate supply chain issues")

            # Insight: Inventory value
            total_value = summary["total_inventory_value"]
            insights.append(f"Total inventory value: ${total_value:,.2f}")

        # Insight: Reorder recommendations
        reorder_calculations = state.get("reorder_calculations", {})
        if reorder_calculations:
            items_to_reorder = len(reorder_calculations)
            total_reorder = state.get("total_reorder_value", 0)
            insights.append(
                f"Recommend ordering {items_to_reorder} products (total: ${total_reorder:,.2f})"
            )

            # Check for high reorder value
            if total_reorder > 50000:
                risk_factors.append(
                    "High reorder value may strain cash flow - consider phased ordering"
                )

        # Insight: Priority items
        priority_items = state.get("priority_items", [])
        if len(priority_items) > 5:
            insights.append(f"{len(priority_items)} high-priority items need immediate attention")
            risk_factors.append("Multiple urgent items may overwhelm procurement capacity")

        state["insights"] = insights
        state["risk_factors"] = risk_factors

        logger.info(
            "Insights generated",
            insights_count=len(insights),
            risk_factors_count=len(risk_factors),
        )

        return state

    def _calculate_confidence(self, state: ProcurementState) -> float:
        """Calculate confidence score for procurement decisions.

        Confidence is based on:
        - Data quality (complete inventory analysis)
        - Number of risk factors (fewer is better)
        - Historical accuracy (simulated for now)
        - Supplier availability

        Returns:
            float: Confidence score between 0.0 and 1.0
        """
        base_confidence = 0.70

        # Boost confidence if we have complete data
        inventory_data = state.get("inventory_data")
        if inventory_data and inventory_data.get("summary"):
            base_confidence += 0.10

        # Boost if we have reorder calculations
        reorder_calculations = state.get("reorder_calculations", {})
        if reorder_calculations:
            base_confidence += 0.05

        # Boost if we have supplier recommendations
        supplier_recommendations = state.get("supplier_recommendations", {})
        if supplier_recommendations:
            base_confidence += 0.05

        # Reduce confidence based on risk factors
        risk_factors = state.get("risk_factors", [])
        risk_penalty = len(risk_factors) * 0.03
        base_confidence -= risk_penalty

        # Reduce confidence if missing key data
        if not inventory_data:
            base_confidence -= 0.20

        # Ensure confidence stays in valid range
        confidence = max(0.0, min(1.0, base_confidence))

        logger.info(
            "Calculated confidence",
            confidence=confidence,
            has_inventory_data=bool(inventory_data),
            reorder_count=len(reorder_calculations),
            supplier_count=len(supplier_recommendations),
            risk_factor_count=len(risk_factors),
        )

        return confidence

    def _assess_risk(self, state: ProcurementState) -> str:
        """Assess risk level of procurement decisions.

        Risk assessment based on:
        - Total reorder value (financial impact)
        - Number of priority items (operational complexity)
        - Stock urgency (critical/high urgency = higher risk)

        Returns:
            str: Risk level - "low", "medium", or "high"
        """
        from src.ai.autonomy.models import RiskLevel

        total_value = state.get("total_reorder_value", 0)
        priority_items = state.get("priority_items", [])
        out_of_stock = state.get("out_of_stock_products", [])

        # Financial risk thresholds
        if total_value > 10000:
            risk_level = RiskLevel.HIGH
        elif total_value > 2000:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        # Elevate risk if many critical items
        critical_items = [
            item for item in priority_items if item.get("urgency") == "critical"
        ]
        if len(critical_items) > 5:
            if risk_level == RiskLevel.LOW:
                risk_level = RiskLevel.MEDIUM
            elif risk_level == RiskLevel.MEDIUM:
                risk_level = RiskLevel.HIGH

        # Elevate risk if multiple out-of-stock items
        if len(out_of_stock) > 10:
            if risk_level == RiskLevel.LOW:
                risk_level = RiskLevel.MEDIUM

        logger.info(
            "Assessed risk level",
            risk_level=risk_level,
            total_value=total_value,
            priority_item_count=len(priority_items),
            critical_item_count=len(critical_items),
            out_of_stock_count=len(out_of_stock),
        )

        return risk_level

    async def _finalize(self, state: ProcurementState) -> ProcurementState:
        """Finalize and format procurement plan."""
        if state.get("error"):
            state["status"] = "failed"
            state["procurement_plan"] = {"error": state["error"]}
            return state

        # Build procurement plan
        priority_items = state.get("priority_items", [])
        reorder_calculations = state.get("reorder_calculations", {})
        supplier_recommendations = state.get("supplier_recommendations", {})

        # Format procurement actions
        procurement_actions = []
        for item in priority_items[:10]:  # Limit to top 10
            product_id = item["product_id"]
            action = {
                "product_id": product_id,
                "sku": item["sku"],
                "name": item["name"],
                "current_stock": item["current_stock"],
                "urgency": item["urgency"],
                "days_until_stockout": item["days_until_stockout"],
            }

            # Add reorder calculation if available
            if product_id in reorder_calculations:
                reorder_data = reorder_calculations[product_id]
                action["reorder"] = {
                    "recommended_qty": reorder_data["reorder_calculation"]["recommended_order_qty"],
                    "order_value": reorder_data["after_order"]["order_value"],
                    "should_reorder_now": reorder_data["reorder_calculation"]["should_reorder_now"],
                }

            # Add supplier recommendation if available
            if product_id in supplier_recommendations:
                supplier_data = supplier_recommendations[product_id]
                top_supplier = supplier_data["suppliers"][0]  # Best ranked supplier
                action["recommended_supplier"] = {
                    "supplier_id": top_supplier["supplier_id"],
                    "supplier_name": top_supplier["supplier_name"],
                    "unit_price": top_supplier["unit_price"],
                    "lead_time_days": top_supplier["lead_time_days"],
                    "total_cost": top_supplier["total_cost"],
                }

            procurement_actions.append(action)

        inventory_data = state.get("inventory_data", {})
        summary = inventory_data.get("summary", {})

        procurement_plan = {
            "summary": {
                "total_products_analyzed": summary.get("total_products", 0),
                "out_of_stock_count": summary.get("out_of_stock_count", 0),
                "low_stock_count": summary.get("low_stock_count", 0),
                "priority_items_count": len(priority_items),
                "total_inventory_value": summary.get("total_inventory_value", 0),
                "recommended_reorder_value": state.get("total_reorder_value", 0),
            },
            "priority_actions": procurement_actions,
            "insights": state.get("insights", []),
            "risk_factors": state.get("risk_factors", []),
            "requires_review": True,
            "tools_used": state.get("tools_used", []),
        }

        state["procurement_plan"] = procurement_plan

        # Integrate with autonomy system if there are procurement actions
        if procurement_actions:
            try:
                from src.ai.autonomy import get_autonomy_manager

                # Calculate confidence and assess risk
                confidence = self._calculate_confidence(state)
                risk_level = self._assess_risk(state)

                # Get autonomy manager
                manager = get_autonomy_manager()

                # Record decision with autonomy manager
                decision = await manager.record_decision(
                    agent_id=self.agent_id,
                    decision_type="procurement_plan",
                    recommendation=procurement_plan,
                    confidence=confidence,
                    risk_level=risk_level,
                    context={
                        "category": state.get("category"),
                        "priority_item_count": len(priority_items),
                        "out_of_stock_count": len(state.get("out_of_stock_products", [])),
                        "low_stock_count": len(state.get("low_stock_products", [])),
                    },
                    estimated_value=state.get("total_reorder_value", 0),
                    estimated_quantity=len(procurement_actions),
                )

                # Add autonomy decision info to state
                state["autonomy_decision"] = {
                    "decision_id": decision.decision_id,
                    "status": decision.status,
                    "requires_approval": decision.requires_approval,
                    "confidence": confidence,
                    "risk_level": risk_level,
                    "auto_executed": decision.status == "auto_executed",
                }

                # Update procurement plan with autonomy info
                procurement_plan["autonomy"] = {
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

        logger.info(
            "Procurement plan finalized",
            priority_actions=len(procurement_actions),
            total_reorder_value=state.get("total_reorder_value", 0),
        )

        return state

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute procurement analysis task.

        Args:
            task: Task description
            context: Context with request_type, category, product_id, etc.

        Returns:
            dict with procurement plan
        """
        context = context or {}

        # Build initial state
        initial_state: ProcurementState = {
            "request_type": context.get("request_type", "analyze_inventory"),
            "category": context.get("category"),
            "product_id": context.get("product_id"),
            "context": context,
            # Data
            "inventory_data": None,
            "low_stock_products": [],
            "out_of_stock_products": [],
            "priority_items": [],
            # Calculations
            "reorder_calculations": {},
            "total_reorder_value": 0.0,
            # Suppliers
            "supplier_recommendations": {},
            # Analysis
            "insights": [],
            "risk_factors": [],
            # Output
            "procurement_plan": None,
            "status": "pending",
            "error": None,
            # Metadata
            "tools_used": [],
            "metadata": {},
        }

        try:
            # Execute graph
            final_state = await self.graph.ainvoke(initial_state)

            if final_state.get("error"):
                return {
                    "error": final_state["error"],
                    "status": "failed",
                }

            return final_state.get("procurement_plan", {})

        except Exception as e:
            logger.error("Procurement agent execution failed", error=str(e))
            return {
                "error": f"Procurement analysis failed: {str(e)}",
                "status": "failed",
            }

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """Stream procurement analysis (not implemented - procurement is batch-based)."""
        yield "Analyzing inventory and procurement needs...\n"
        result = await self.execute(task, context)

        if "error" in result:
            yield f"Error: {result['error']}\n"
        else:
            priority_count = len(result.get("priority_actions", []))
            yield f"✓ Procurement plan generated: {priority_count} priority items identified\n"
            if result.get("risk_factors"):
                yield f"⚠ {len(result['risk_factors'])} risk factors identified\n"


# Singleton instance
_procurement_agent: ProcurementAgent | None = None


def get_procurement_agent() -> ProcurementAgent:
    """Get or create procurement agent singleton."""
    global _procurement_agent
    if _procurement_agent is None:
        _procurement_agent = ProcurementAgent()
    return _procurement_agent
