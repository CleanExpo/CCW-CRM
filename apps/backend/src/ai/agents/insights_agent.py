"""Insights agent for automated business intelligence and data analysis."""

import json
from datetime import UTC, datetime
from typing import Any

from langgraph.graph import END, StateGraph

from src.db.demo_models import AIGeneratedContent
from src.utils import get_logger

from ..ollama_client import get_ollama_client
from ..tools.analytics_tools import (
    AggregateSalesTool,
    AnalyzeTrendsTool,
    CustomerSegmentationTool,
    InventoryAnalysisTool,
)
from ..base_agent import BaseAgent
from .insights_state import InsightsState

logger = get_logger(__name__)


class InsightsAgent(BaseAgent):
    """Agent for generating business insights from ERP data.

    Capabilities:
    - Sales performance analysis
    - Inventory recommendations
    - Customer segmentation
    - Trend identification
    - Anomaly detection
    """

    def __init__(self):
        super().__init__(
            agent_id="insights_agent",
            name="Insights Agent",
            auto_register=False
        )

        # Set capabilities for agent registry
        self.capabilities = ["data_analysis", "insights_generation", "analytics", "business_intelligence"]
        self.description = "Automated business intelligence and data analysis for ERP metrics"
        self.estimated_execution_time = 15  # seconds
        self.requires_verification = False

        self.ollama = get_ollama_client()

        # Register analytics tools
        self._register_tools()

        # Build LangGraph state graph
        self.graph = self._build_graph()

        logger.info("InsightsAgent initialized with analytics tools")

        # Register with agent registry after full initialization
        self._schedule_registration()

    def _register_tools(self) -> None:
        """Register analytics tools."""
        self.tools = {
            "aggregate_sales": AggregateSalesTool(),
            "analyze_trends": AnalyzeTrendsTool(),
            "segment_customers": CustomerSegmentationTool(),
            "analyze_inventory": InventoryAnalysisTool(),
        }

    def _build_graph(self) -> StateGraph:
        """Build LangGraph state graph for insights generation."""
        workflow = StateGraph(InsightsState)

        # Add nodes
        workflow.add_node("receive_request", self._receive_request)
        workflow.add_node("fetch_data", self._fetch_data)
        workflow.add_node("analyze_data", self._analyze_data)
        workflow.add_node("generate_insights", self._generate_insights)
        workflow.add_node("format_response", self._format_response)

        # Set entry point
        workflow.set_entry_point("receive_request")

        # Add edges
        workflow.add_edge("receive_request", "fetch_data")
        workflow.add_edge("fetch_data", "analyze_data")
        workflow.add_edge("analyze_data", "generate_insights")
        workflow.add_edge("generate_insights", "format_response")
        workflow.add_edge("format_response", END)

        return workflow.compile()

    async def _receive_request(self, state: InsightsState) -> InsightsState:
        """Parse the insight request and determine required tools."""
        category = state["category"]
        date_range = state.get("date_range")
        filters = state.get("filters", {})

        logger.info(f"Processing insight request", category=category, filters=filters)

        # Determine which tools to use based on category
        tools_to_use = []

        if category in ["sales", "all"]:
            tools_to_use.extend(["aggregate_sales", "analyze_trends"])

        if category in ["inventory", "all"]:
            tools_to_use.append("analyze_inventory")

        if category in ["customers", "all"]:
            tools_to_use.append("segment_customers")

        if not tools_to_use and category != "all":
            # Default to sales analysis
            tools_to_use = ["aggregate_sales"]

        state["tools_used"] = tools_to_use
        state["metadata"] = {
            "started_at": datetime.now(UTC).isoformat(),
            "category": category,
        }

        return state

    async def _fetch_data(self, state: InsightsState) -> InsightsState:
        """Fetch data using analytics tools."""
        tools_to_use = state["tools_used"]
        date_range = state.get("date_range")
        filters = state.get("filters", {})

        raw_data = {}
        aggregated_data = {}

        for tool_name in tools_to_use:
            if tool_name not in self.tools:
                logger.warning(f"Tool not found: {tool_name}")
                continue

            tool = self.tools[tool_name]

            try:
                # Prepare tool kwargs
                kwargs = {}

                if date_range:
                    kwargs["start_date"] = date_range.get("start_date")
                    kwargs["end_date"] = date_range.get("end_date")

                if tool_name == "aggregate_sales":
                    kwargs["group_by"] = filters.get("group_by", "product")
                    kwargs["top_n"] = filters.get("top_n", 10)
                elif tool_name == "analyze_trends":
                    kwargs["days"] = filters.get("days", 90)
                    kwargs["metric"] = filters.get("metric", "sales")
                    if "category" in filters:
                        kwargs["category"] = filters["category"]
                elif tool_name == "segment_customers":
                    kwargs["days"] = filters.get("days", 90)
                elif tool_name == "analyze_inventory":
                    kwargs["low_stock_threshold"] = filters.get("low_stock_threshold", 10)
                    kwargs["include_inactive"] = filters.get("include_inactive", False)

                # Execute tool
                result = await tool._run(**kwargs)
                raw_data[tool_name] = result

                logger.info(f"Tool executed successfully", tool=tool_name)

            except Exception as e:
                logger.error(f"Error executing tool: {tool_name}", error=str(e))
                state["error"] = f"Tool {tool_name} failed: {str(e)}"
                return state

        state["raw_data"] = raw_data
        state["aggregated_data"] = raw_data  # For now, same as raw_data

        return state

    async def _analyze_data(self, state: InsightsState) -> InsightsState:
        """Analyze data to identify trends, anomalies, and patterns."""
        raw_data = state.get("raw_data", {})

        trends = []
        anomalies = []

        # Analyze trends from trend analysis tool
        if "analyze_trends" in raw_data:
            trend_data = raw_data["analyze_trends"]
            if isinstance(trend_data, dict) and "trend" in trend_data:
                trends.append(
                    {
                        "type": "trend",
                        "metric": trend_data.get("metric", "sales"),
                        "direction": trend_data["trend"],
                        "percentage": trend_data.get("trend_percentage", 0),
                        "period_days": trend_data.get("period_days", 90),
                    }
                )

        # Identify anomalies in sales data
        if "aggregate_sales" in raw_data:
            sales_data = raw_data["aggregate_sales"]
            if isinstance(sales_data, dict) and "results" in sales_data:
                results = sales_data["results"]
                if results:
                    # Check for significant outliers
                    revenues = [r.get("total_revenue", 0) for r in results]
                    if revenues:
                        avg_revenue = sum(revenues) / len(revenues)
                        for result in results:
                            revenue = result.get("total_revenue", 0)
                            if revenue > avg_revenue * 2:
                                anomalies.append(
                                    {
                                        "type": "high_performer",
                                        "entity": result.get("name", "Unknown"),
                                        "value": revenue,
                                        "average": avg_revenue,
                                    }
                                )

        # Identify inventory issues
        if "analyze_inventory" in raw_data:
            inventory_data = raw_data["analyze_inventory"]
            if isinstance(inventory_data, dict):
                summary = inventory_data.get("summary", {})
                if summary.get("out_of_stock_count", 0) > 0:
                    anomalies.append(
                        {
                            "type": "out_of_stock",
                            "count": summary["out_of_stock_count"],
                            "severity": "critical",
                        }
                    )
                if summary.get("low_stock_count", 0) > 5:
                    anomalies.append(
                        {
                            "type": "low_stock",
                            "count": summary["low_stock_count"],
                            "severity": "warning",
                        }
                    )

        # Format context for LLM
        analysis_context = self._format_analysis_context(raw_data, trends, anomalies)

        state["analysis_context"] = analysis_context
        state["trends"] = trends
        state["anomalies"] = anomalies

        return state

    def _format_analysis_context(
        self, raw_data: dict[str, Any], trends: list[dict[str, Any]], anomalies: list[dict[str, Any]]
    ) -> str:
        """Format analysis context for LLM."""
        context_parts = ["# Business Data Analysis\n"]

        # Add trends
        if trends:
            context_parts.append("\n## Identified Trends:")
            for trend in trends:
                context_parts.append(
                    f"- {trend['metric'].capitalize()} trend: {trend['direction']} "
                    f"({trend.get('percentage', 0):.1f}% change over {trend.get('period_days', 0)} days)"
                )

        # Add anomalies
        if anomalies:
            context_parts.append("\n## Noteworthy Findings:")
            for anomaly in anomalies:
                if anomaly["type"] == "high_performer":
                    context_parts.append(
                        f"- {anomaly['entity']} is a high performer with revenue "
                        f"${anomaly['value']:,.2f} (2x average)"
                    )
                elif anomaly["type"] == "out_of_stock":
                    context_parts.append(
                        f"- {anomaly['count']} products are out of stock (Critical)"
                    )
                elif anomaly["type"] == "low_stock":
                    context_parts.append(
                        f"- {anomaly['count']} products have low stock (Warning)"
                    )

        # Add raw data summaries
        context_parts.append("\n## Data Summary:")

        if "aggregate_sales" in raw_data:
            sales = raw_data["aggregate_sales"]
            context_parts.append(
                f"- Sales data: {sales.get('total_items', 0)} items analyzed, "
                f"grouped by {sales.get('group_by', 'unknown')}"
            )

        if "segment_customers" in raw_data:
            segments = raw_data["segment_customers"]
            context_parts.append(
                f"- Customer analysis: {segments.get('total_customers', 0)} customers segmented"
            )

        if "analyze_inventory" in raw_data:
            inventory = raw_data["analyze_inventory"]
            summary = inventory.get("summary", {})
            context_parts.append(
                f"- Inventory: {summary.get('total_products', 0)} products tracked, "
                f"{summary.get('out_of_stock_count', 0)} out of stock"
            )

        return "\n".join(context_parts)

    async def _generate_insights(self, state: InsightsState) -> InsightsState:
        """Generate actionable insights using LLM."""
        analysis_context = state.get("analysis_context", "")
        category = state["category"]

        system_prompt = """You are a business intelligence analyst specializing in ERP data analysis.
Your task is to analyze the provided data and generate clear, actionable insights.

For each insight:
1. Identify a specific finding or pattern
2. Explain what it means for the business
3. Provide concrete recommendations
4. Assign a priority level (high, medium, low)

Be specific and data-driven. Focus on actionable recommendations."""

        user_prompt = f"""Analyze the following business data and generate insights for the {category} category:

{analysis_context}

Generate 3-5 key insights with specific recommendations. Format each insight as:
- Title: Brief insight title
- Finding: What the data shows
- Impact: Business impact
- Recommendation: Specific action to take
- Priority: high/medium/low"""

        try:
            response = await self.ollama.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
            )

            # Parse insights from response
            insights = self._parse_insights_from_response(response, state)

            state["insights"] = insights

            # Identify priority insights (high priority only)
            priority_insights = [i for i in insights if i.get("priority") == "high"]
            state["priority_insights"] = priority_insights[:3]  # Top 3

            logger.info(f"Generated {len(insights)} insights")

        except Exception as e:
            logger.error(f"Error generating insights", error=str(e))
            state["error"] = f"Failed to generate insights: {str(e)}"
            state["insights"] = []
            state["priority_insights"] = []

        return state

    def _parse_insights_from_response(
        self, response: str, state: InsightsState
    ) -> list[dict[str, Any]]:
        """Parse insights from LLM response."""
        insights = []
        raw_data = state.get("raw_data", {})

        # Simple parsing - split by lines and extract structured data
        lines = response.split("\n")
        current_insight = {}

        for line in lines:
            line = line.strip()
            if not line:
                if current_insight:
                    insights.append(current_insight)
                    current_insight = {}
                continue

            if line.startswith("- Title:") or line.startswith("Title:"):
                current_insight["title"] = line.split(":", 1)[1].strip()
            elif line.startswith("- Finding:") or line.startswith("Finding:"):
                current_insight["finding"] = line.split(":", 1)[1].strip()
            elif line.startswith("- Impact:") or line.startswith("Impact:"):
                current_insight["impact"] = line.split(":", 1)[1].strip()
            elif line.startswith("- Recommendation:") or line.startswith("Recommendation:"):
                current_insight["recommendation"] = line.split(":", 1)[1].strip()
            elif line.startswith("- Priority:") or line.startswith("Priority:"):
                priority_text = line.split(":", 1)[1].strip().lower()
                current_insight["priority"] = (
                    "high" if "high" in priority_text else "medium" if "medium" in priority_text else "low"
                )

        # Add last insight
        if current_insight:
            insights.append(current_insight)

        # If parsing failed, create generic insights from data
        if not insights and raw_data:
            insights = self._create_fallback_insights(raw_data)

        # Add metadata to insights
        for i, insight in enumerate(insights):
            insight["id"] = f"insight-{i+1}"
            insight["category"] = state["category"]
            insight["generated_at"] = datetime.now(UTC).isoformat()

        return insights

    def _create_fallback_insights(self, raw_data: dict[str, Any]) -> list[dict[str, Any]]:
        """Create basic insights if LLM parsing fails."""
        insights = []

        # Sales insight
        if "aggregate_sales" in raw_data:
            sales = raw_data["aggregate_sales"]
            results = sales.get("results", [])
            if results:
                top_item = results[0]
                insights.append(
                    {
                        "title": f"Top Performer: {top_item.get('name', 'Unknown')}",
                        "finding": f"${top_item.get('total_revenue', 0):,.2f} in revenue",
                        "impact": "Significant contribution to overall sales",
                        "recommendation": "Ensure adequate stock and consider promoting similar products",
                        "priority": "medium",
                    }
                )

        # Inventory insight
        if "analyze_inventory" in raw_data:
            inventory = raw_data["analyze_inventory"]
            summary = inventory.get("summary", {})
            if summary.get("out_of_stock_count", 0) > 0:
                insights.append(
                    {
                        "title": "Stock Replenishment Needed",
                        "finding": f"{summary['out_of_stock_count']} products out of stock",
                        "impact": "Lost sales opportunities and customer dissatisfaction",
                        "recommendation": "Review reorder recommendations and expedite procurement",
                        "priority": "high",
                    }
                )

        return insights

    async def _format_response(self, state: InsightsState) -> InsightsState:
        """Format final response for API."""
        insights = state.get("insights", [])
        priority_insights = state.get("priority_insights", [])
        raw_data = state.get("raw_data", {})

        formatted_response = {
            "category": state["category"],
            "insights": insights,
            "priority_insights": priority_insights,
            "total_insights": len(insights),
            "tools_used": state.get("tools_used", []),
            "metadata": state.get("metadata", {}),
        }

        # Add summary statistics
        if raw_data:
            formatted_response["summary"] = self._create_summary(raw_data)

        state["formatted_response"] = formatted_response
        state["metadata"]["completed_at"] = datetime.now(UTC).isoformat()

        return state

    def _create_summary(self, raw_data: dict[str, Any]) -> dict[str, Any]:
        """Create summary statistics from raw data."""
        summary = {}

        if "aggregate_sales" in raw_data:
            sales = raw_data["aggregate_sales"]
            results = sales.get("results", [])
            if results:
                total_revenue = sum(r.get("total_revenue", 0) for r in results)
                summary["total_revenue"] = total_revenue
                summary["top_products_count"] = len(results)

        if "segment_customers" in raw_data:
            segments = raw_data["segment_customers"]
            summary["total_customers"] = segments.get("total_customers", 0)
            summary["customer_segments"] = list(segments.get("segments", {}).keys())

        if "analyze_inventory" in raw_data:
            inventory = raw_data["analyze_inventory"]
            summary["inventory_summary"] = inventory.get("summary", {})

        return summary

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute an insights generation task.

        Args:
            task: The task description (e.g., "Generate sales insights")
            context: Context with category, date_range, filters, user_id

        Returns:
            dict with insights and metadata
        """
        context = context or {}

        # Build initial state
        initial_state: InsightsState = {
            "category": context.get("category", "sales"),
            "date_range": context.get("date_range"),
            "filters": context.get("filters", {}),
            "user_id": context.get("user_id"),
            "raw_data": None,
            "aggregated_data": None,
            "analysis_context": None,
            "trends": [],
            "anomalies": [],
            "insights": [],
            "priority_insights": [],
            "formatted_response": None,
            "tools_used": [],
            "error": None,
            "metadata": {},
        }

        try:
            # Execute graph
            final_state = await self.graph.ainvoke(initial_state)

            if final_state.get("error"):
                return {
                    "error": final_state["error"],
                    "category": final_state["category"],
                }

            # Save insights to database
            await self._save_insights(final_state)

            return final_state.get("formatted_response", {})

        except Exception as e:
            logger.error(f"Error executing insights agent", error=str(e))
            return {
                "error": f"Failed to generate insights: {str(e)}",
                "category": context.get("category", "unknown"),
            }

    async def _save_insights(self, state: InsightsState) -> None:
        """Save generated insights to database."""
        insights = state.get("insights", [])
        user_id = state.get("user_id")

        if not insights:
            return

        try:
            async with self.get_db_session() as db:
                for insight in insights:
                    content_record = AIGeneratedContent(
                        content_type="insight",
                        title=insight.get("title", "Untitled Insight"),
                        content=json.dumps(insight),
                        content_metadata=json.dumps(
                            {
                                "category": state["category"],
                                "priority": insight.get("priority", "medium"),
                                "tools_used": state.get("tools_used", []),
                            }
                        ),
                        entity_type="insight",
                        user_id=user_id,
                    )
                    db.add(content_record)

                await db.commit()
                logger.info(f"Saved {len(insights)} insights to database")

        except Exception as e:
            logger.error(f"Error saving insights", error=str(e))


# Dependency for FastAPI
_insights_agent: InsightsAgent | None = None


def get_insights_agent() -> InsightsAgent:
    """Get or create insights agent singleton."""
    global _insights_agent
    if _insights_agent is None:
        _insights_agent = InsightsAgent()
    return _insights_agent
