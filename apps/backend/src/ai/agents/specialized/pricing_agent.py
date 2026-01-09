"""Pricing agent for cost analysis and price optimization."""

from decimal import Decimal
from typing import Any, AsyncGenerator
from uuid import UUID

from langgraph.graph import END, StateGraph

from src.ai.base_agent import BaseAgent
from src.ai.tools.pricing_tools import (
    AnalyzePricingHistoryTool,
    CalculateMarginTool,
    RecommendPriceTool,
)
from src.utils import get_logger

from .pricing_state import PricingState

logger = get_logger(__name__)


class PricingAgent(BaseAgent):
    """Agent for pricing analysis and optimization.

    Capabilities:
    - Analyze historical pricing trends
    - Calculate profit margins
    - Recommend optimal pricing
    - Compare pricing strategies
    """

    def __init__(self):
        super().__init__(
            agent_id="pricing_agent",
            name="Pricing Agent",
            auto_register=False,
        )

        # Set capabilities for agent registry
        self.capabilities = ["pricing", "cost_analysis", "price_optimization", "margin_calculation"]
        self.description = "Analyzes costs and recommends optimal pricing strategies"
        self.estimated_execution_time = 15  # seconds
        self.requires_verification = True  # Pricing decisions should be reviewed

        # Register tools
        self.register_tool(AnalyzePricingHistoryTool())
        self.register_tool(CalculateMarginTool())
        self.register_tool(RecommendPriceTool())

        # Build LangGraph state graph
        self.graph = self._build_graph()

        logger.info("Pricing agent initialized")

        # Register with agent registry after full initialization
        self._schedule_registration()

    def _build_graph(self) -> StateGraph:
        """Build LangGraph state graph for pricing operations."""
        workflow = StateGraph(PricingState)

        # Add nodes
        workflow.add_node("parse_request", self._parse_request)
        workflow.add_node("fetch_data", self._fetch_data)
        workflow.add_node("analyze", self._analyze)
        workflow.add_node("calculate", self._calculate)
        workflow.add_node("recommend", self._recommend)
        workflow.add_node("validate", self._validate)
        workflow.add_node("finalize", self._finalize)

        # Set entry point
        workflow.set_entry_point("parse_request")

        # Add edges
        workflow.add_edge("parse_request", "fetch_data")
        workflow.add_edge("fetch_data", "analyze")
        workflow.add_edge("analyze", "calculate")
        workflow.add_edge("calculate", "recommend")
        workflow.add_edge("recommend", "validate")
        workflow.add_edge("validate", "finalize")
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def _parse_request(self, state: PricingState) -> PricingState:
        """Parse pricing request and extract parameters."""
        context = state.get("context", {})
        logger.info("Parsing pricing request", request_type=state.get("request_type"))

        # Initialize state fields
        state.setdefault("pricing_trends", [])
        state.setdefault("risk_factors", [])
        state.setdefault("price_justification", [])
        state.setdefault("validation_warnings", [])
        state.setdefault("tools_used", [])
        state.setdefault("metadata", {})
        state["validation_passed"] = False
        state["requires_review"] = True
        state["confidence_score"] = 0.5

        # Set defaults
        if not state.get("target_margin"):
            state["target_margin"] = 30.0  # Default 30% margin

        return state

    async def _fetch_data(self, state: PricingState) -> PricingState:
        """Fetch product cost data and historical pricing."""
        product_id = state["product_id"]
        logger.info("Fetching pricing data", product_id=product_id)

        try:
            product_uuid = UUID(product_id)
            async with self.get_db_session() as db:
                # Fetch historical pricing
                history_tool: AnalyzePricingHistoryTool = next(
                    t for t in self.tools if isinstance(t, AnalyzePricingHistoryTool)
                )
                history_result = await history_tool.execute(
                    product_id=product_uuid, days=90, db=db
                )

                if history_result.success and history_result.data.get("analysis"):
                    state["historical_data"] = history_result.data
                    state["tools_used"].append("analyze_pricing_history")

                    # Extract product data from historical analysis
                    analysis = history_result.data["analysis"][0]
                    state["product_data"] = {
                        "product_id": analysis["product_id"],
                        "sku": analysis["sku"],
                        "name": analysis["name"],
                    }
                else:
                    logger.warning("No historical pricing data found", product_id=product_id)
                    state["historical_data"] = None

                # Fetch current margin
                margin_tool: CalculateMarginTool = next(
                    t for t in self.tools if isinstance(t, CalculateMarginTool)
                )
                margin_result = await margin_tool.execute(product_id=product_uuid, db=db)

                if margin_result.success and margin_result.data.get("margins"):
                    state["margin_analysis"] = margin_result.data
                    state["tools_used"].append("calculate_margin")

                    # Update product data with cost/price info
                    margin_data = margin_result.data["margins"][0]
                    state["product_data"].update(
                        {
                            "cost": margin_data["cost"],
                            "current_price": margin_data["current_price"],
                            "current_margin": margin_data["margin_percentage"],
                        }
                    )
                else:
                    state["error"] = "Failed to fetch product cost data"
                    return state

        except Exception as e:
            logger.error("Data fetching failed", error=str(e))
            state["error"] = f"Failed to fetch data: {str(e)}"

        return state

    async def _analyze(self, state: PricingState) -> PricingState:
        """Analyze pricing trends and market position."""
        logger.info("Analyzing pricing trends")

        historical_data = state.get("historical_data")
        margin_analysis = state.get("margin_analysis")

        if not margin_analysis:
            state["error"] = "Cannot analyze without margin data"
            return state

        margin_data = margin_analysis["margins"][0]
        current_margin = margin_data["margin_percentage"]
        target_margin = state["target_margin"]

        # Analyze margin position
        if current_margin < target_margin:
            state["pricing_trends"].append(
                f"Current margin ({current_margin:.1f}%) is below target ({target_margin:.1f}%)"
            )
            state["risk_factors"].append("Underpriced - potential revenue loss")
        elif current_margin > target_margin + 10:
            state["pricing_trends"].append(
                f"Current margin ({current_margin:.1f}%) significantly exceeds target"
            )
            state["risk_factors"].append("Overpriced - potential sales volume loss")
        else:
            state["pricing_trends"].append(f"Current margin ({current_margin:.1f}%) is healthy")

        # Analyze historical trends if available
        if historical_data and historical_data.get("analysis"):
            analysis = historical_data["analysis"][0]

            if "avg_order_price" in analysis and analysis["avg_order_price"] > 0:
                avg_historical = analysis["avg_order_price"]
                current_price = margin_data["current_price"]

                price_diff_pct = ((current_price - avg_historical) / avg_historical) * 100

                if abs(price_diff_pct) > 15:
                    state["pricing_trends"].append(
                        f"Current price differs {price_diff_pct:+.1f}% from 90-day average"
                    )
                    if price_diff_pct > 0:
                        state["market_position"] = "above_market"
                        state["risk_factors"].append("Price above historical average - may reduce demand")
                    else:
                        state["market_position"] = "below_market"
                        state["risk_factors"].append("Price below historical average - may leave money on table")
                else:
                    state["market_position"] = "at_market"
                    state["pricing_trends"].append("Current price aligns with historical average")

                # Check sales volume
                if "total_quantity_sold" in analysis:
                    qty = analysis["total_quantity_sold"]
                    state["pricing_trends"].append(f"Sold {qty} units in last 90 days")
                    if qty < 10:
                        state["risk_factors"].append("Low sales volume - limited pricing data")
                        state["confidence_score"] = 0.6
                    else:
                        state["confidence_score"] = 0.85

        return state

    async def _calculate(self, state: PricingState) -> PricingState:
        """Calculate optimal margin and price point."""
        logger.info("Calculating optimal pricing")

        # Already have margin calculations from fetch_data
        # This node is for additional calculations if needed

        margin_analysis = state.get("margin_analysis")
        if margin_analysis:
            margin_data = margin_analysis["margins"][0]
            state["price_justification"].append(
                f"Current cost: ${margin_data['cost']:.2f}"
            )
            state["price_justification"].append(
                f"Current price: ${margin_data['current_price']:.2f} "
                f"({margin_data['margin_percentage']:.1f}% margin)"
            )

        return state

    async def _recommend(self, state: PricingState) -> PricingState:
        """Generate price recommendation."""
        product_id = state["product_id"]
        target_margin = state["target_margin"]

        logger.info("Generating price recommendation", product_id=product_id)

        try:
            product_uuid = UUID(product_id)
            async with self.get_db_session() as db:
                recommend_tool: RecommendPriceTool = next(
                    t for t in self.tools if isinstance(t, RecommendPriceTool)
                )
                recommendation_result = await recommend_tool.execute(
                    product_id=product_uuid,
                    target_margin_percentage=Decimal(str(target_margin)),
                    consider_history=True,
                    db=db,
                )

                if recommendation_result.success:
                    recommendation = recommendation_result.data["recommendation"]
                    state["recommended_price"] = recommendation["recommended_price"]
                    state["recommended_margin"] = recommendation["recommended_margin_percentage"]
                    state["price_justification"].extend(recommendation["reasoning"])
                    state["tools_used"].append("recommend_price")

                    # Update confidence based on recommendation confidence
                    if recommendation["confidence"] == "high":
                        state["confidence_score"] = min(state["confidence_score"] + 0.15, 1.0)

                    logger.info(
                        "Price recommendation generated",
                        recommended_price=state["recommended_price"],
                        recommended_margin=state["recommended_margin"],
                    )
                else:
                    state["error"] = f"Failed to generate recommendation: {recommendation_result.error}"

        except Exception as e:
            logger.error("Recommendation generation failed", error=str(e))
            state["error"] = f"Failed to generate recommendation: {str(e)}"

        return state

    async def _validate(self, state: PricingState) -> PricingState:
        """Validate price recommendation against business rules."""
        logger.info("Validating recommendation")

        validation_warnings = []
        recommended_price = state.get("recommended_price")
        recommended_margin = state.get("recommended_margin")

        if not recommended_price:
            state["validation_passed"] = False
            state["error"] = "No recommendation generated"
            return state

        # Business rules validation
        # Rule 1: Minimum margin
        MIN_MARGIN = 15.0
        if recommended_margin < MIN_MARGIN:
            validation_warnings.append(
                f"Recommended margin ({recommended_margin:.1f}%) below minimum ({MIN_MARGIN:.1f}%)"
            )

        # Rule 2: Maximum price change
        MAX_PRICE_CHANGE_PCT = 25.0
        product_data = state.get("product_data", {})
        current_price = product_data.get("current_price", 0)

        if current_price > 0:
            price_change_pct = abs(((recommended_price - current_price) / current_price) * 100)
            if price_change_pct > MAX_PRICE_CHANGE_PCT:
                validation_warnings.append(
                    f"Price change ({price_change_pct:.1f}%) exceeds maximum ({MAX_PRICE_CHANGE_PCT:.1f}%)"
                )
                state["requires_review"] = True

        # Rule 3: Check for risk factors
        if len(state.get("risk_factors", [])) > 2:
            validation_warnings.append("Multiple risk factors identified - manual review recommended")
            state["requires_review"] = True

        state["validation_warnings"] = validation_warnings
        state["validation_passed"] = len(validation_warnings) == 0

        if validation_warnings:
            logger.warning("Validation warnings", warnings=validation_warnings)

        return state

    async def _finalize(self, state: PricingState) -> PricingState:
        """Finalize and format pricing recommendation."""
        if state.get("error"):
            state["status"] = "failed"
            state["final_recommendation"] = {"error": state["error"]}
            return state

        product_data = state.get("product_data", {})
        recommended_price = state.get("recommended_price")
        recommended_margin = state.get("recommended_margin")
        current_price = product_data.get("current_price", 0)

        price_change = recommended_price - current_price if current_price > 0 else 0
        price_change_pct = (
            ((recommended_price - current_price) / current_price) * 100
            if current_price > 0
            else 0
        )

        state["final_recommendation"] = {
            "product": {
                "product_id": product_data.get("product_id"),
                "sku": product_data.get("sku"),
                "name": product_data.get("name"),
            },
            "current": {
                "price": current_price,
                "margin": product_data.get("current_margin", 0),
            },
            "recommendation": {
                "price": recommended_price,
                "margin": recommended_margin,
                "price_change": price_change,
                "price_change_percentage": price_change_pct,
            },
            "analysis": {
                "pricing_trends": state.get("pricing_trends", []),
                "market_position": state.get("market_position"),
                "risk_factors": state.get("risk_factors", []),
                "justification": state.get("price_justification", []),
            },
            "validation": {
                "passed": state.get("validation_passed", False),
                "warnings": state.get("validation_warnings", []),
                "requires_review": state.get("requires_review", True),
                "confidence_score": state.get("confidence_score", 0.5),
            },
            "tools_used": state.get("tools_used", []),
        }

        state["status"] = "completed"

        logger.info(
            "Pricing recommendation finalized",
            requires_review=state["requires_review"],
            validation_passed=state["validation_passed"],
        )

        return state

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute pricing analysis task.

        Args:
            task: Task description
            context: Context with product_id, target_margin, etc.

        Returns:
            dict with pricing recommendation
        """
        context = context or {}

        # Build initial state
        initial_state: PricingState = {
            "request_type": context.get("request_type", "recommend"),
            "product_id": context.get("product_id"),
            "target_margin": context.get("target_margin", 30.0),
            "quantity": context.get("quantity"),
            "context": context,
            # Data
            "product_data": None,
            "historical_data": None,
            "margin_analysis": None,
            # Analysis
            "pricing_trends": [],
            "market_position": None,
            "risk_factors": [],
            # Recommendation
            "recommended_price": None,
            "recommended_margin": None,
            "price_justification": [],
            "confidence_score": 0.5,
            # Validation
            "validation_passed": False,
            "validation_warnings": [],
            "requires_review": True,
            # Output
            "final_recommendation": None,
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

            return final_state.get("final_recommendation", {})

        except Exception as e:
            logger.error("Pricing agent execution failed", error=str(e))
            return {
                "error": f"Pricing analysis failed: {str(e)}",
                "status": "failed",
            }

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """Stream pricing analysis (not implemented - pricing is batch-based)."""
        yield "Analyzing pricing...\n"
        result = await self.execute(task, context)

        if "error" in result:
            yield f"Error: {result['error']}\n"
        else:
            yield f"✓ Price recommendation generated: ${result['recommendation']['price']:.2f}\n"
            if result["validation"]["requires_review"]:
                yield "⚠ Manual review recommended\n"


# Singleton instance
_pricing_agent: PricingAgent | None = None


def get_pricing_agent() -> PricingAgent:
    """Get or create pricing agent singleton."""
    global _pricing_agent
    if _pricing_agent is None:
        _pricing_agent = PricingAgent()
    return _pricing_agent
