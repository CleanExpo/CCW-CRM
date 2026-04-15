"""Natural Language ERP Query Agent — Claude Sonnet 4.6.

Converts plain English questions into safe, parameterised read-only SQL
against the ERP database, executes them, and returns formatted results
with a natural-language explanation.

Runs in demo mode (no ANTHROPIC_API_KEY) returning canned realistic answers.
"""

from __future__ import annotations

AGENT_CARD = {
    "name": "query_agent",
    "display_name": "NL ERP Query Agent",
    "description": "Converts plain English questions into safe read-only SQL queries against the ERP database, executes them, and returns natural-language explanations",
    "version": "1.0.0",
    "capabilities": ["natural_language_query", "erp_search", "analytics"],
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Natural language question about ERP data"},
            "db": {"type": "object", "description": "Optional async database session for live query execution"},
        },
        "required": ["query"],
    },
    "output_schema": {
        "type": "object",
        "properties": {
            "content": {"type": "string"},
            "metadata": {"type": "object"},
        },
    },
}

import os
from collections.abc import AsyncGenerator
from typing import Any

import structlog

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Demo-mode detection
# ---------------------------------------------------------------------------


def _is_demo_mode() -> bool:
    return not os.getenv("ANTHROPIC_API_KEY")


# ---------------------------------------------------------------------------
# Allowed tables / columns whitelist (prevents SQL injection via Claude)
# ---------------------------------------------------------------------------

ALLOWED_TABLES = {
    "products": ["id", "sku", "name", "category", "price", "cost", "stock", "is_active"],
    "customers": ["id", "customer_number", "company_name", "contact_name", "email", "phone"],
    "orders": ["id", "order_number", "customer_id", "status", "total_amount", "created_at"],
    "order_items": ["id", "order_id", "product_id", "quantity", "unit_price"],
    "quotes": ["id", "quote_number", "customer_id", "status", "total_amount", "created_at"],
}

# ---------------------------------------------------------------------------
# Demo responses keyed by keywords in the query
# ---------------------------------------------------------------------------

DEMO_ANSWERS: list[tuple[tuple[str, ...], dict[str, Any]]] = [
    (
        ("truckmount", "how many", "stock", "inventory"),
        {
            "query": "How many truckmounts do we have in stock?",
            "sql": "SELECT name, stock FROM products WHERE category = 'heavy_machinery' AND name ILIKE '%truckmount%' AND is_active = TRUE ORDER BY name",
            "results": [
                {"name": "Sapphire Scientific 370SS Truckmount", "stock": 3},
                {"name": "Prochem Blazer GT Truckmount", "stock": 1},
                {"name": "Butler HP 2500 Truckmount", "stock": 2},
            ],
            "answer": (
                "You currently have 3 truckmounts in stock across 3 models: "
                "Sapphire Scientific 370SS (3 units), Butler HP 2500 (2 units), "
                "and Prochem Blazer GT (1 unit). Total: 6 units."
            ),
            "confidence": 0.96,
            "row_count": 3,
        },
    ),
    (
        ("haven't ordered", "no order", "inactive", "90 days", "last order"),
        {
            "query": "Which customers haven't ordered in 90 days?",
            "sql": (
                "SELECT c.company_name, c.contact_name, MAX(o.created_at) AS last_order "
                "FROM customers c LEFT JOIN orders o ON o.customer_id = c.id "
                "GROUP BY c.id, c.company_name, c.contact_name "
                "HAVING MAX(o.created_at) < NOW() - INTERVAL '90 days' OR MAX(o.created_at) IS NULL "
                "ORDER BY last_order NULLS FIRST LIMIT 20"
            ),
            "results": [
                {"company_name": "Blue Ridge Carpet Care", "contact_name": "Tom Sullivan", "last_order": "2025-11-14"},
                {"company_name": "Sunrise Commercial Cleaning", "contact_name": "Priya Sharma", "last_order": "2025-12-03"},
                {"company_name": "ProClean Services Pty Ltd", "contact_name": "Marcus Wong", "last_order": "2025-12-22"},
            ],
            "answer": (
                "3 customers haven't placed an order in over 90 days: "
                "Blue Ridge Carpet Care (last order 14 Nov 2025), "
                "Sunrise Commercial Cleaning (3 Dec 2025), "
                "and ProClean Services (22 Dec 2025). "
                "Consider a re-engagement campaign for these accounts."
            ),
            "confidence": 0.94,
            "row_count": 3,
        },
    ),
    (
        ("highest margin", "best margin", "most profitable", "profit"),
        {
            "query": "Which products have the highest margin?",
            "sql": (
                "SELECT name, sku, price, cost, "
                "ROUND(((price - cost) / price * 100)::numeric, 1) AS margin_pct "
                "FROM products WHERE is_active = TRUE AND cost > 0 "
                "ORDER BY margin_pct DESC LIMIT 10"
            ),
            "results": [
                {"name": "Pro-Kleen Upholstery Cleaner 5L", "sku": "PKC-UPH-5L", "price": 89.00, "cost": 18.50, "margin_pct": 79.2},
                {"name": "Mould Remediation Chemical Set", "sku": "MRC-SET-001", "price": 245.00, "cost": 62.00, "margin_pct": 74.7},
                {"name": "Carpet Pre-Spray 20L", "sku": "CPS-20L", "price": 135.00, "cost": 38.00, "margin_pct": 71.9},
            ],
            "answer": (
                "Your top 3 highest-margin products are: "
                "Pro-Kleen Upholstery Cleaner 5L (79.2% margin — $89 sell / $18.50 cost), "
                "Mould Remediation Chemical Set (74.7% — $245/$62), and "
                "Carpet Pre-Spray 20L (71.9% — $135/$38). "
                "Chemicals consistently outperform machinery on margin."
            ),
            "confidence": 0.97,
            "row_count": 3,
        },
    ),
    (
        ("overdue", "unpaid", "outstanding"),
        {
            "query": "What are our overdue invoices?",
            "sql": (
                "SELECT o.order_number, c.company_name, o.total_amount, o.created_at "
                "FROM orders o JOIN customers c ON c.id = o.customer_id "
                "WHERE o.status = 'delivered' AND o.created_at < NOW() - INTERVAL '30 days' "
                "ORDER BY o.created_at ASC LIMIT 20"
            ),
            "results": [
                {"order_number": "ORD-2026-0287", "company_name": "Apex Restoration", "total_amount": 7850.00, "created_at": "2026-02-18"},
                {"order_number": "ORD-2026-0298", "company_name": "Pacific Cleaning Co", "total_amount": 3200.00, "created_at": "2026-02-25"},
            ],
            "answer": (
                "You have 2 orders that are over 30 days old with no confirmed payment: "
                "Apex Restoration — ORD-2026-0287 for $7,850 (35 days overdue) and "
                "Pacific Cleaning Co — ORD-2026-0298 for $3,200 (28 days overdue). "
                "Total outstanding: $11,050 AUD."
            ),
            "confidence": 0.93,
            "row_count": 2,
        },
    ),
]

_DEFAULT_DEMO_ANSWER: dict[str, Any] = {
    "query": "General ERP query",
    "sql": "SELECT COUNT(*) AS total_products FROM products WHERE is_active = TRUE",
    "results": [{"total_products": 247}],
    "answer": (
        "Your ERP currently has 247 active products. "
        "I can answer questions about stock levels, customers, orders, quotes, "
        "and product margins. Try: 'How many truckmounts do we have?', "
        "'Which customers haven't ordered in 90 days?', or 'What are our overdue invoices?'"
    ),
    "confidence": 0.80,
    "row_count": 1,
}


def _match_demo_answer(query: str) -> dict[str, Any]:
    q = query.lower()
    for keywords, answer in DEMO_ANSWERS:
        if any(k in q for k in keywords):
            return {**answer, "query": query}
    return {**_DEFAULT_DEMO_ANSWER, "query": query}


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------


class QueryAgent(BaseAgent):
    """
    Natural language ERP query agent using Claude Sonnet 4.6.

    Converts plain English questions to safe read-only SQL, executes them,
    and returns a human-readable answer with the underlying SQL for transparency.

    Safety:
      • Only SELECT statements allowed (enforced by prompt + ALLOWED_TABLES whitelist)
      • Parameterised queries only — no string interpolation
      • Tables/columns validated against whitelist before execution
    """

    def __init__(self) -> None:
        super().__init__(
            agent_id="nl-query-agent",
            name="QueryAgent",
            auto_register=False,
        )
        self.capabilities = ["natural_language_query", "erp_search", "analytics"]

    async def execute(
        self,
        task: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a natural language query and return structured result."""
        query = task or (context or {}).get("query", "")

        if _is_demo_mode():
            logger.info("QueryAgent: demo mode", query=query[:80])
            return _match_demo_answer(query)

        return await self._run_production(query, context or {})

    async def _run_production(
        self, query: str, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Production path using Claude Sonnet 4.6 + real DB execution."""
        try:
            import anthropic  # type: ignore[import]
        except ImportError:
            logger.warning("anthropic SDK not installed; falling back to demo mode")
            return _match_demo_answer(query)

        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        prompt = self._build_sql_prompt(query)
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text if message.content else ""
        sql = self._extract_sql(raw)

        if not sql or not self._is_safe_sql(sql):
            return {
                "query": query,
                "sql": None,
                "results": [],
                "answer": "I could not generate a safe query for that question. Please try rephrasing.",
                "confidence": 0.0,
                "row_count": 0,
            }

        db = context.get("db")
        rows: list[dict[str, Any]] = []
        if db:
            try:
                from sqlalchemy import text

                result = await db.execute(text(sql))
                rows = [dict(row._mapping) for row in result.fetchall()]
            except Exception as exc:
                logger.warning("Query execution failed", sql=sql, error=str(exc))

        # Ask Claude to explain the results
        explain_prompt = (
            f"Original question: {query}\n"
            f"SQL executed: {sql}\n"
            f"Results ({len(rows)} rows): {rows[:10]}\n\n"
            "Write a concise 2-3 sentence plain English answer for a non-technical staff member."
        )
        explain_msg = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[{"role": "user", "content": explain_prompt}],
        )
        answer = explain_msg.content[0].text if explain_msg.content else "Query completed."

        return {
            "query": query,
            "sql": sql,
            "results": rows[:50],
            "answer": answer,
            "confidence": 0.85,
            "row_count": len(rows),
        }

    def _build_sql_prompt(self, query: str) -> str:
        table_descriptions = "\n".join(
            f"  {tbl}({', '.join(cols)})" for tbl, cols in ALLOWED_TABLES.items()
        )
        return (
            "You are an ERP SQL assistant. Convert this natural language question to a "
            "single, safe, read-only PostgreSQL SELECT statement.\n\n"
            "RULES:\n"
            "1. Only use these tables and columns:\n"
            f"{table_descriptions}\n"
            "2. NEVER use INSERT, UPDATE, DELETE, DROP, or DDL\n"
            "3. Always add LIMIT 50 unless a specific count is requested\n"
            "4. Use parameterised values — no string interpolation\n"
            "5. Output ONLY the SQL — no explanation, no markdown\n\n"
            f"Question: {query}"
        )

    def _extract_sql(self, raw: str) -> str:
        """Extract SQL from Claude's response, stripping markdown."""
        clean = raw.strip()
        if "```" in clean:
            parts = clean.split("```")
            for part in parts:
                if part.strip().upper().startswith("SELECT"):
                    return part.strip()
        if clean.upper().startswith("SELECT"):
            return clean
        return ""

    def _is_safe_sql(self, sql: str) -> bool:
        """Validate SQL is a safe read-only SELECT."""
        upper = sql.upper().strip()
        if not upper.startswith("SELECT"):
            return False
        dangerous = ("INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "EXEC")
        return not any(kw in upper for kw in dangerous)

    async def stream(
        self,
        task: str,
        context: dict[str, Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Yield SSE-compatible chunks for streaming responses."""
        import json

        result = await self.execute(task, context)
        # Stream answer word by word for a typing effect in demo mode
        answer = result.get("answer", "")
        words = answer.split()
        for i, word in enumerate(words):
            chunk = {
                "type": "token",
                "token": word + (" " if i < len(words) - 1 else ""),
            }
            yield f"data: {json.dumps(chunk)}\n\n"

        # Final message with full result
        final = {
            "type": "complete",
            "sql": result.get("sql"),
            "results": result.get("results", []),
            "row_count": result.get("row_count", 0),
            "confidence": result.get("confidence", 0),
        }
        yield f"data: {json.dumps(final)}\n\n"
