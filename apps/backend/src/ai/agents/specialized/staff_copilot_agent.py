"""Staff Copilot Agent — answers operational ERP/CRM queries for staff."""

import os
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Demo-mode detection
# ---------------------------------------------------------------------------


def _is_demo_mode() -> bool:
    """Return True when no LLM API key is configured."""
    return not (
        os.getenv("ANTHROPIC_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or os.getenv("GOOGLE_AI_API_KEY")
    )


# ---------------------------------------------------------------------------
# Pure helper functions (testable without DB or LLM)
# ---------------------------------------------------------------------------

DEMO_RESPONSES: dict[str, str] = {
    "general_query": (
        "I can help you with orders, inventory, customers, and product information. "
        "Try asking me to summarise an order, look up a customer, or suggest next actions "
        "based on the current page context."
    ),
    "summarise_order": (
        "Order ORD-2026-042 is for Acme Services Pty Ltd — 3 items, total $4,850 AUD, "
        "status: Processing. Items: 2x Kärcher HD 5/15 C Pressure Washer, 1x 30m Hose Reel. "
        "Estimated dispatch: tomorrow."
    ),
    "summarise_customer": (
        "Pacific Cleaning Co has placed 12 orders this year with an average order value of $3,200. "
        "Their last order was 5 days ago (ORD-2026-038, $2,150). Payment terms: Net 30. "
        "Primary contact: James Wu — james@pacificcleaning.com.au."
    ),
    "suggest_next_action": (
        "Based on current context, here are the recommended next actions: "
        "1) Follow up on 3 pending quotes expiring this week. "
        "2) Reorder truckmount filters — stock is at 2 units (minimum threshold: 5). "
        "3) Send invoice for delivered order ORD-2026-039."
    ),
}

MODULE_SYSTEM_PROMPTS: dict[str, str] = {
    "orders": (
        "You are an ERP assistant specialising in order management for CCW, an industrial "
        "cleaning equipment supplier. You help staff understand order status, line items, "
        "fulfilment progress, and next steps. Be concise and action-oriented."
    ),
    "products": (
        "You are an ERP assistant specialising in product management for CCW. You help staff "
        "with product details, stock levels, pricing, and category information. "
        "Be precise with specifications and pricing."
    ),
    "customers": (
        "You are a CRM assistant for CCW. You help staff understand customer purchase history, "
        "contact details, payment terms, and relationship context. "
        "Be professional and customer-centric."
    ),
    "inventory": (
        "You are an inventory management assistant for CCW. You help staff track stock levels, "
        "reorder points, warehouse locations, and stock movements. "
        "Flag low-stock and overstock situations proactively."
    ),
    "general": (
        "You are an ERP/CRM assistant for CCW, an industrial cleaning equipment supplier. "
        "You help staff with orders, inventory, customers, products, and general operations. "
        "Be helpful, concise, and business-focused."
    ),
}

SUGGESTED_ACTIONS_BY_MODULE: dict[str, list[str]] = {
    "orders": [
        "Show me pending orders",
        "Which orders are overdue?",
        "Summarise this order",
    ],
    "products": [
        "List low stock products",
        "Generate product description",
        "Show top selling products",
    ],
    "customers": [
        "Show customer purchase history",
        "Which customers haven't ordered recently?",
        "Summarise this customer",
    ],
    "inventory": [
        "Show reorder alerts",
        "List stock below minimum",
        "Show recent stock adjustments",
    ],
    "general": [
        "What needs attention today?",
        "Show overdue orders",
        "List pending approvals",
    ],
}


def build_system_prompt(module_context: str) -> str:
    """Return a system prompt tailored to the current module."""
    return MODULE_SYSTEM_PROMPTS.get(module_context, MODULE_SYSTEM_PROMPTS["general"])


def format_conversation_history(history: list[dict[str, str]]) -> list[dict[str, str]]:
    """Normalise conversation history to {role, content} dicts for the LLM."""
    formatted = []
    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            formatted.append({"role": role, "content": content})
    return formatted


def get_demo_response(
    query_type: str, user_query: str, module_context: str
) -> str:
    """Return a realistic hardcoded response when in demo mode."""
    base = DEMO_RESPONSES.get(query_type, DEMO_RESPONSES["general_query"])
    # For general queries, try to give a slightly more contextual answer
    if query_type == "general_query":
        q_lower = user_query.lower()
        if any(w in q_lower for w in ("order", "sale")):
            return DEMO_RESPONSES["summarise_order"]
        if any(w in q_lower for w in ("customer", "client", "buyer")):
            return DEMO_RESPONSES["summarise_customer"]
        if any(w in q_lower for w in ("next", "action", "todo", "should")):
            return DEMO_RESPONSES["suggest_next_action"]
    return base


def suggest_next_actions(module_context: str, entity_id: str | None) -> list[str]:
    """Return contextual quick-action suggestions."""
    actions = SUGGESTED_ACTIONS_BY_MODULE.get(
        module_context, SUGGESTED_ACTIONS_BY_MODULE["general"]
    )
    return actions


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class StaffCopilotAgent(BaseAgent):
    """AI agent that answers operational queries for ERP/CRM staff.

    Capabilities:
    - general_query: Answer natural language questions about operations
    - summarise_order: Retrieve and summarise a specific order
    - summarise_customer: Retrieve and summarise a customer profile
    - suggest_next_action: Suggest prioritised next steps based on context
    """

    def __init__(self) -> None:
        """Initialise StaffCopilotAgent."""
        self.capabilities = [
            "staff_query",
            "order_summary",
            "customer_summary",
            "next_action_suggestion",
            "erp_assistant",
        ]
        self.description = (
            "Answers staff queries about orders, inventory, customers, and operations"
        )
        self.requires_verification = False
        self.estimated_execution_time = 6
        super().__init__(
            agent_id="staff-copilot-agent",
            name="Staff Copilot Agent",
            auto_register=True,
        )
        logger.info("StaffCopilotAgent initialized", agent_id=self.agent_id)

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Execute a staff copilot query.

        Context keys:
            user_query (str): The staff member's question
            query_type (str): general_query | summarise_order | summarise_customer | suggest_next_action
            module_context (str): orders | products | customers | inventory | general
            entity_id (str | None): ID of the focused entity
            conversation_history (list[dict]): Prior messages
        """
        ctx = context or {}
        user_query = ctx.get("user_query", task)
        query_type = ctx.get("query_type", "general_query")
        module_context = ctx.get("module_context", "general")
        entity_id = ctx.get("entity_id")
        history = ctx.get("conversation_history", [])

        try:
            if _is_demo_mode():
                return self._demo_response(
                    query_type, user_query, module_context, entity_id
                )

            # Live mode — use Anthropic API
            return await self._live_response(
                user_query, query_type, module_context, entity_id, history
            )

        except Exception as exc:
            logger.error(
                "staff_copilot_execute_failed",
                query_type=query_type,
                error=str(exc),
            )
            return self._demo_response(query_type, user_query, module_context, entity_id)

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """Stream is not supported — yields a single complete response."""
        result = await self.execute(task, context)
        yield result.get("answer", "No response generated.")

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _demo_response(
        self,
        query_type: str,
        user_query: str,
        module_context: str,
        entity_id: str | None,
    ) -> dict[str, Any]:
        """Return a realistic demo response."""
        answer = get_demo_response(query_type, user_query, module_context)
        actions = suggest_next_actions(module_context, entity_id)
        sources: list[str] = []
        if query_type == "summarise_order":
            sources = ["Order ORD-2026-042", "3 line items"]
        elif query_type == "summarise_customer":
            sources = ["Customer: Pacific Cleaning Co", "12 orders this year"]
        return {
            "answer": answer,
            "suggested_actions": actions,
            "sources": sources,
            "demo_mode": True,
        }

    async def _live_response(
        self,
        user_query: str,
        query_type: str,
        module_context: str,
        entity_id: str | None,
        history: list[dict[str, str]],
    ) -> dict[str, Any]:
        """Generate a live response using the Anthropic API."""
        import anthropic

        client = anthropic.AsyncAnthropic()
        model = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-6")

        system_prompt = build_system_prompt(module_context)

        # Optionally enrich with DB context
        db_context = ""
        if entity_id and query_type in ("summarise_order", "summarise_customer"):
            db_context = await self._fetch_entity_context(query_type, entity_id)
            if db_context:
                system_prompt += f"\n\nEntity context:\n{db_context}"

        messages: list[dict[str, str]] = [
            *format_conversation_history(history),
            {"role": "user", "content": user_query},
        ]

        response = await client.messages.create(
            model=model,
            max_tokens=500,
            system=system_prompt,
            messages=messages,
        )

        answer = response.content[0].text.strip() if response.content else ""
        actions = suggest_next_actions(module_context, entity_id)
        sources: list[str] = [f"Entity: {entity_id}"] if entity_id else []

        return {
            "answer": answer,
            "suggested_actions": actions,
            "sources": sources,
            "demo_mode": False,
        }

    async def _fetch_entity_context(
        self, query_type: str, entity_id: str
    ) -> str:
        """Fetch minimal entity context from DB to enrich the LLM prompt."""
        try:
            async with self.get_db_session() as db:
                if query_type == "summarise_order":
                    return await self._fetch_order_context(db, entity_id)
                elif query_type == "summarise_customer":
                    return await self._fetch_customer_context(db, entity_id)
        except Exception as exc:
            logger.warning(
                "copilot_db_fetch_failed", query_type=query_type, error=str(exc)
            )
        return ""

    async def _fetch_order_context(self, db: AsyncSession, order_id: str) -> str:
        """Fetch order + line items for context."""
        from src.db.demo_models import Order, OrderItem

        order_row = await db.get(Order, order_id)
        if not order_row:
            return ""

        result = await db.execute(
            select(OrderItem).where(OrderItem.order_id == order_id)
        )
        items = result.scalars().all()

        lines = [
            f"Order: {order_row.order_number}",
            f"Status: {order_row.status}",
            f"Total: ${order_row.total_amount:.2f}",
            f"Line items: {len(items)}",
        ]
        for item in items[:5]:
            lines.append(f"  - {item.quantity}x (unit ${item.unit_price:.2f})")

        return "\n".join(lines)

    async def _fetch_customer_context(self, db: AsyncSession, customer_id: str) -> str:
        """Fetch customer record for context."""
        from src.db.demo_models import Customer

        cust = await db.get(Customer, customer_id)
        if not cust:
            return ""

        lines = [
            f"Customer: {cust.company_name or cust.contact_name}",
            f"Email: {cust.email}",
            f"Phone: {getattr(cust, 'phone', 'N/A')}",
        ]
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Module-level singleton + factory
# ---------------------------------------------------------------------------

_staff_copilot_agent: StaffCopilotAgent | None = None


def get_staff_copilot_agent() -> StaffCopilotAgent:
    """Return the module-level singleton StaffCopilotAgent."""
    global _staff_copilot_agent
    if _staff_copilot_agent is None:
        _staff_copilot_agent = StaffCopilotAgent()
    return _staff_copilot_agent
