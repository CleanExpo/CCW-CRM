"""Procurement agent for inventory management and supplier recommendations."""

AGENT_CARD = {
    "name": "procurement_agent",
    "display_name": "Procurement Agent",
    "description": "Manages inventory levels and generates procurement recommendations including supplier selection, reorder calculations, and inventory replenishment planning",
    "version": "1.0.0",
    "capabilities": ["procurement", "inventory_management", "supplier_recommendation", "inventory_replenishment", "reorder_calculation"],
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["check_reorder_points", "recommend_supplier", "create_draft_po", "audit_inventory"],
                "description": "Procurement action to perform",
            },
            "product_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of product UUIDs to process",
            },
            "supplier_id": {"type": "string", "description": "Preferred supplier UUID"},
        },
        "required": ["action"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "content": {"type": "string"},
            "metadata": {"type": "object"},
        },
    },
}

from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

from langgraph.graph import END, StateGraph

from src.ai.base_agent import BaseAgent
from src.ai.tools.inventory_intelligence import INVENTORY_INTELLIGENCE_TOOLS
from src.ai.tools.procurement_tools import (
    AnalyzeInventoryTool,
    CalculateReorderQuantityTool,
    SuggestSuppliersTool,
)
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

        # Protocol v1.0: Agent Card
        self._protocol_card = self._build_agent_card()

        logger.info("Procurement agent initialized")

        # Register with agent registry after full initialization
        self._schedule_registration()

        # Register protocol card with registry
        self._register_protocol_card()

    @staticmethod
    def _build_agent_card() -> Any:
        """Build protocol AgentCard for this agent."""
        try:
            from src.ai.protocol.models import AgentCard, DelegationRule, PermissionTier

            return AgentCard(
                agent_id="procurement_agent",
                name="Procurement Agent",
                version="1.0.0",
                description="Manages inventory levels and procurement recommendations",
                capabilities=[
                    "procurement",
                    "inventory_management",
                    "supplier_recommendation",
                    "inventory_replenishment",
                    "reorder_calculation",
                ],
                boundaries=[
                    "Cannot place purchase orders directly",
                    "Cannot modify supplier contracts",
                    "Cannot approve spending above threshold",
                ],
                inputs={
                    "inventory_data": "Current stock levels and sales velocity",
                    "category": "Product category filter",
                    "context": "Additional procurement context",
                },
                outputs={
                    "reorder_recommendations": "List of products needing reorder",
                    "supplier_suggestions": "Recommended suppliers per product",
                    "stockout_risks": "Products at risk of stockout",
                },
                delegation_rules=[
                    DelegationRule(
                        capability="inventory_management",
                        max_chain_depth=2,
                    ),
                ],
                permission_tier=PermissionTier.STANDARD,
                max_concurrent=5,
                timeout_seconds=45,
            )
        except ImportError:
            return None

    def _register_protocol_card(self) -> None:
        """Register protocol card with agent registry."""
        if self._protocol_card is None:
            return
        try:
            from src.ai.orchestration import get_agent_registry

            registry = get_agent_registry()
            registry.register_agent_card(self.agent_id, self._protocol_card)
        except Exception as e:
            logger.debug("Could not register protocol card", error=str(e))

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
                    risk_factors.append("High number of low-stock items may indicate supply chain issues")  # noqa: E501

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

        state["procurement_plan"] = {
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
