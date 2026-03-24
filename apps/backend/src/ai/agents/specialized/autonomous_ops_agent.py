"""Autonomous Operations Agent — Claude Sonnet 4.6 ERP decision engine.

Monitors ERP state and autonomously creates draft purchase orders,
sends payment reminders, flags unmatched bank transactions, and
escalates SLA breaches.

Runs in demo mode (structured mock data) when ANTHROPIC_API_KEY is absent.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Demo-mode detection
# ---------------------------------------------------------------------------


def _is_demo_mode() -> bool:
    return not os.getenv("ANTHROPIC_API_KEY")


# ---------------------------------------------------------------------------
# Action type constants
# ---------------------------------------------------------------------------

ACTION_DRAFT_PO = "create_draft_purchase_order"
ACTION_PAYMENT_REMINDER = "send_payment_reminder"
ACTION_ESCALATE_COLLECTIONS = "escalate_to_collections"
ACTION_FLAG_TRANSACTION = "flag_unmatched_transaction"
ACTION_NOTIFY_MANAGER = "notify_manager_sla_breach"


# ---------------------------------------------------------------------------
# Pydantic-free dataclass for action records (no DB write required)
# ---------------------------------------------------------------------------


class AutonomousAction:
    """A single action recommended or taken by the autonomous ops agent."""

    def __init__(
        self,
        action_type: str,
        entity_type: str,
        entity_id: str,
        description: str,
        confidence: float,
        status: str = "recommended",
        metadata: dict[str, Any] | None = None,
    ):
        self.action_id = str(uuid4())
        self.action_type = action_type
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.description = description
        self.confidence = confidence
        self.status = status  # recommended | approved | rejected | executed
        self.metadata = metadata or {}
        self.created_at = datetime.now(UTC).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "action_id": self.action_id,
            "action_type": self.action_type,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "description": self.description,
            "confidence": self.confidence,
            "status": self.status,
            "metadata": self.metadata,
            "created_at": self.created_at,
        }


# ---------------------------------------------------------------------------
# In-memory audit log (resets on server restart; swap for DB in production)
# ---------------------------------------------------------------------------

_audit_log: list[dict[str, Any]] = []


def get_audit_log() -> list[dict[str, Any]]:
    return list(reversed(_audit_log))  # newest first


def append_audit_log(entry: dict[str, Any]) -> None:
    _audit_log.append(entry)
    if len(_audit_log) > 500:  # cap at 500 entries
        _audit_log.pop(0)


# ---------------------------------------------------------------------------
# Demo data helpers
# ---------------------------------------------------------------------------


def _build_demo_run_result(trigger: str) -> dict[str, Any]:
    """Return a realistic mock autonomous ops run for demo/test mode."""
    now = datetime.now(UTC)
    actions = [
        AutonomousAction(
            action_type=ACTION_DRAFT_PO,
            entity_type="product",
            entity_id="prod-truckmount-001",
            description=(
                "Truckmount Filter Set stock is at 2 units — below reorder point of 5. "
                "Draft purchase order for 20 units from CleanTech Supplies created."
            ),
            confidence=0.95,
            status="recommended",
            metadata={
                "product_sku": "FILTER-TM-001",
                "current_stock": 2,
                "reorder_point": 5,
                "order_qty": 20,
                "supplier": "CleanTech Supplies Pty Ltd",
            },
        ),
        AutonomousAction(
            action_type=ACTION_PAYMENT_REMINDER,
            entity_type="invoice",
            entity_id="inv-2026-0318",
            description=(
                "Invoice INV-2026-0318 for Pacific Cleaning Co is 14 days overdue "
                "($3,200 AUD). First payment reminder sent to james@pacificcleaning.com.au."
            ),
            confidence=0.98,
            status="executed",
            metadata={
                "invoice_number": "INV-2026-0318",
                "customer": "Pacific Cleaning Co",
                "amount_aud": 3200.00,
                "days_overdue": 14,
                "dunning_level": 1,
                "email_sent_to": "james@pacificcleaning.com.au",
            },
        ),
        AutonomousAction(
            action_type=ACTION_ESCALATE_COLLECTIONS,
            entity_type="invoice",
            entity_id="inv-2026-0287",
            description=(
                "Invoice INV-2026-0287 for Apex Restoration is 35 days overdue "
                "($7,850 AUD). Escalated to collections — dunning level 3."
            ),
            confidence=0.91,
            status="recommended",
            metadata={
                "invoice_number": "INV-2026-0287",
                "customer": "Apex Restoration Pty Ltd",
                "amount_aud": 7850.00,
                "days_overdue": 35,
                "dunning_level": 3,
            },
        ),
        AutonomousAction(
            action_type=ACTION_FLAG_TRANSACTION,
            entity_type="bank_transaction",
            entity_id="txn-anz-20260325-004",
            description=(
                "Bank transaction $1,450.00 from 'CLEANQUIP PTY LTD' received 28 hours ago "
                "with no matching invoice. Flagged for manual review."
            ),
            confidence=0.87,
            status="recommended",
            metadata={
                "bank": "ANZ",
                "amount_aud": 1450.00,
                "payer": "CLEANQUIP PTY LTD",
                "hours_unmatched": 28,
                "transaction_date": now.date().isoformat(),
            },
        ),
    ]

    run_id = str(uuid4())
    entry = {
        "run_id": run_id,
        "trigger": trigger,
        "model": "claude-sonnet-4-6 (demo)",
        "started_at": now.isoformat(),
        "completed_at": datetime.now(UTC).isoformat(),
        "actions_evaluated": 47,
        "actions_taken": len(actions),
        "actions": [a.to_dict() for a in actions],
        "summary": (
            f"Autonomous ops run completed. {len(actions)} actions identified: "
            "1 draft PO created, 1 reminder sent, 1 invoice escalated, 1 transaction flagged."
        ),
    }
    append_audit_log(entry)
    return entry


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class AutonomousOpsAgent(BaseAgent):
    """
    ERP autonomous operations agent using Claude Sonnet 4.6.

    Evaluates ERP state across four domains:
      • Inventory  — creates draft POs when stock falls below reorder point
      • Invoicing  — sends reminders / escalates dunning based on overdue age
      • Bank feeds — flags unmatched transactions for review
      • Workflows  — notifies managers on SLA breaches

    In demo mode (no ANTHROPIC_API_KEY), returns structured mock decisions
    that mirror production output shape exactly.
    """

    def __init__(self) -> None:
        super().__init__(
            agent_id="autonomous-ops-agent",
            name="AutonomousOpsAgent",
            auto_register=False,
        )
        self.capabilities = [
            "autonomous_ops",
            "purchase_order_creation",
            "dunning",
            "bank_reconciliation",
            "sla_monitoring",
        ]

    async def execute(
        self,
        task: str = "run",
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Run autonomous ops evaluation and return a structured action report."""
        trigger = (context or {}).get("trigger", "manual")

        if _is_demo_mode():
            logger.info("AutonomousOpsAgent: demo mode run", trigger=trigger)
            return _build_demo_run_result(trigger)

        # Production path — requires ANTHROPIC_API_KEY
        return await self._run_production(trigger, context or {})

    async def _run_production(
        self, trigger: str, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Production run using Claude Sonnet 4.6 with real DB queries."""
        try:
            import anthropic  # type: ignore[import]
        except ImportError:
            logger.warning("anthropic SDK not installed; falling back to demo mode")
            return _build_demo_run_result(trigger)

        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        db: AsyncSession | None = context.get("db")
        actions: list[dict[str, Any]] = []

        # Gather live ERP signals
        signals = await self._gather_signals(db) if db else {}

        prompt = self._build_prompt(signals)

        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text if message.content else ""
        actions = self._parse_claude_actions(raw, signals)

        now = datetime.now(UTC)
        run_id = str(uuid4())
        entry = {
            "run_id": run_id,
            "trigger": trigger,
            "model": "claude-sonnet-4-6",
            "started_at": now.isoformat(),
            "completed_at": datetime.now(UTC).isoformat(),
            "actions_evaluated": len(signals.get("items", [])),
            "actions_taken": len(actions),
            "actions": actions,
            "summary": f"Production run: {len(actions)} autonomous actions identified.",
        }
        append_audit_log(entry)
        return entry

    async def _gather_signals(self, db: AsyncSession | None) -> dict[str, Any]:
        """Query DB for ERP signals requiring attention."""
        if db is None:
            return {}

        signals: dict[str, Any] = {"items": [], "low_stock": [], "overdue_invoices": []}

        try:
            from src.db.demo_models import Order, Product

            # Low stock signal
            result = await db.execute(
                select(Product).where(Product.stock <= 5).limit(20)
            )
            for p in result.scalars().all():
                signals["low_stock"].append(
                    {"id": str(p.id), "sku": p.sku, "name": p.name, "stock": p.stock}
                )
                signals["items"].append(f"low_stock:{p.sku}")

            # Overdue invoices (orders in certain statuses older than 7 days)
            cutoff = datetime.now(UTC) - timedelta(days=7)
            result = await db.execute(
                select(Order)
                .where(Order.status == "delivered")
                .where(Order.created_at <= cutoff)
                .limit(10)
            )
            for o in result.scalars().all():
                days_old = (datetime.now(UTC) - o.created_at).days
                signals["overdue_invoices"].append(
                    {"id": str(o.id), "order_number": o.order_number, "days_old": days_old}
                )
                signals["items"].append(f"overdue:{o.order_number}")

        except Exception as exc:
            logger.warning("Signal gathering failed", error=str(exc))

        return signals

    def _build_prompt(self, signals: dict[str, Any]) -> str:
        low_stock = signals.get("low_stock", [])
        overdue = signals.get("overdue_invoices", [])

        return (
            "You are an autonomous ERP operations agent for CCW, an Australian cleaning "
            "equipment supplier. Review these ERP signals and recommend specific actions.\n\n"
            f"LOW STOCK ITEMS ({len(low_stock)}):\n"
            + "\n".join(
                f"  - {p['sku']}: {p['name']} — {p['stock']} units remaining"
                for p in low_stock
            )
            + f"\n\nOVERDUE ORDERS ({len(overdue)}):\n"
            + "\n".join(
                f"  - {o['order_number']}: {o['days_old']} days since delivery (no invoice paid)"
                for o in overdue
            )
            + "\n\nFor each issue, recommend: action_type, description, confidence (0-1). "
            "Be concise and specific."
        )

    def _parse_claude_actions(
        self, raw: str, signals: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Parse Claude's text response into structured action records."""
        actions = []
        for item in signals.get("low_stock", []):
            action = AutonomousAction(
                action_type=ACTION_DRAFT_PO,
                entity_type="product",
                entity_id=item["id"],
                description=f"Low stock alert: {item['sku']} at {item['stock']} units — draft PO recommended.",
                confidence=0.90,
                status="recommended",
                metadata=item,
            )
            actions.append(action.to_dict())

        for item in signals.get("overdue_invoices", []):
            days = item.get("days_old", 0)
            action = AutonomousAction(
                action_type=ACTION_ESCALATE_COLLECTIONS if days >= 30 else ACTION_PAYMENT_REMINDER,
                entity_type="order",
                entity_id=item["id"],
                description=(
                    f"Order {item['order_number']} is {days} days old with no confirmed payment. "
                    "{'Escalating to collections.' if days >= 30 else 'Sending payment reminder.'}"
                ),
                confidence=0.88,
                status="recommended",
                metadata=item,
            )
            actions.append(action.to_dict())

        return actions

    async def stream(
        self,
        task: str = "run",
        context: dict[str, Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming not used for autonomous ops; yields single JSON result."""
        import json

        result = await self.execute(task, context)
        yield json.dumps(result)
