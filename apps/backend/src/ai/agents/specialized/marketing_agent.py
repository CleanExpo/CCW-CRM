"""Marketing Agent for AI-powered campaign generation and audience analysis."""

AGENT_CARD = {
    "name": "marketing_agent",
    "display_name": "Marketing Agent",
    "description": "Generates campaign copy, social posts, email sequences, and audience segment analysis for CCW products",
    "version": "1.0.0",
    "capabilities": ["generate_campaign", "analyze_audience", "get_stats", "marketing_copy", "audience_segmentation", "campaign_management"],
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["generate_campaign", "analyze_audience", "get_stats"]},
            "product_name": {"type": "string", "description": "Name of the product to market"},
            "target_audience": {"type": "string", "description": "Description of the target audience"},
            "campaign_type": {"type": "string", "enum": ["email", "social", "sms"]},
            "tone": {"type": "string", "enum": ["professional", "friendly", "urgent", "casual"]},
            "product_category": {"type": "string", "description": "Category for audience segmentation"},
            "location": {"type": "string", "description": "Geographic location for audience targeting"},
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

import os
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import structlog

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Anthropic availability check
# ---------------------------------------------------------------------------

try:
    import anthropic as _anthropic_module

    _ANTHROPIC_AVAILABLE = bool(os.getenv("ANTHROPIC_API_KEY"))
except ImportError:
    _anthropic_module = None  # type: ignore[assignment]
    _ANTHROPIC_AVAILABLE = False


# ---------------------------------------------------------------------------
# Pure helper functions (testable without DB or async)
# ---------------------------------------------------------------------------


def _mock_campaign(
    product_name: str,
    target_audience: str,
    campaign_type: str,
    tone: str,
) -> dict[str, Any]:
    """Return realistic mock campaign copy when Anthropic Claude is unavailable."""
    subjects = {
        "email": f"Introducing {product_name} — Built for {target_audience}",
        "social": f"Discover {product_name}",
        "sms": f"New arrival: {product_name}",
    }
    bodies = {
        "email": (
            f"Dear valued customer,\n\n"
            f"We're excited to introduce {product_name}, designed specifically "
            f"for {target_audience}. "
            f"With industry-leading performance and durability, this product is "
            f"ready to tackle your toughest jobs.\n\n"
            f"Key benefits:\n"
            f"- Professional-grade quality\n"
            f"- Easy to operate and maintain\n"
            f"- Backed by our industry expertise\n\n"
            f"Order yours today and experience the CCW difference."
        ),
        "social": (
            f"Introducing {product_name} — the choice of {target_audience}. "
            f"Professional quality, unbeatable value. Shop now and get yours "
            f"while stock lasts! #CCW #Equipment #Professional"
        ),
        "sms": (
            f"CCW: {product_name} now in stock! "
            f"Perfect for {target_audience}. "
            f"Limited qty. Reply STOP to unsubscribe."
        ),
    }
    ctas = {
        "email": "Shop Now",
        "social": "Learn More",
        "sms": "Order Now",
    }
    return {
        "campaign_subject": subjects.get(campaign_type, subjects["email"]),
        "campaign_body": bodies.get(campaign_type, bodies["email"]),
        "cta": ctas.get(campaign_type, "Shop Now"),
        "campaign_type": campaign_type,
        "created_at": datetime.now(UTC).isoformat(),
    }


def _mock_audience_segments(
    product_category: str,
    location: str | None,
) -> dict[str, Any]:
    """Return realistic mock audience segments based on product category."""
    category_segments: dict[str, list[dict[str, str]]] = {
        "power_tools": [
            {
                "name": "Trade Professionals",
                "description": "Electricians, carpenters, and builders who rely on tools daily",
                "estimated_size": "18,000–25,000",
            },
            {
                "name": "DIY Enthusiasts",
                "description": "Homeowners tackling renovation projects",
                "estimated_size": "45,000–60,000",
            },
            {
                "name": "Workshop Owners",
                "description": "Small workshop businesses requiring reliable equipment",
                "estimated_size": "5,000–8,000",
            },
        ],
        "safety_equipment": [
            {
                "name": "Construction Managers",
                "description": "Site managers responsible for workplace safety compliance",
                "estimated_size": "12,000–18,000",
            },
            {
                "name": "Mining & Resources",
                "description": "Workers in high-risk environments requiring certified PPE",
                "estimated_size": "8,000–14,000",
            },
            {
                "name": "Manufacturing Facilities",
                "description": "Factory safety officers and procurement teams",
                "estimated_size": "20,000–30,000",
            },
        ],
        "heavy_machinery": [
            {
                "name": "Civil Contractors",
                "description": "Medium to large civil engineering and earthworks companies",
                "estimated_size": "4,000–7,000",
            },
            {
                "name": "Mining Operations",
                "description": "Surface and underground mining companies",
                "estimated_size": "2,500–4,500",
            },
            {
                "name": "Infrastructure Projects",
                "description": "Road, rail, and utilities construction projects",
                "estimated_size": "3,000–5,000",
            },
        ],
    }
    default_segments = [
        {
            "name": "Trade Buyers",
            "description": "Professional buyers sourcing equipment for business use",
            "estimated_size": "15,000–22,000",
        },
        {
            "name": "Retail Consumers",
            "description": "Individual customers purchasing for personal or home use",
            "estimated_size": "40,000–55,000",
        },
        {
            "name": "Institutional Purchasers",
            "description": "Schools, councils, and organisations with bulk requirements",
            "estimated_size": "2,000–4,000",
        },
    ]

    segments = category_segments.get(product_category, default_segments)
    loc_suffix = f" in {location}" if location else ""
    primary = segments[0]["name"] + loc_suffix if segments else "Trade Buyers"

    return {
        "segments": segments,
        "primary_segment": primary,
    }


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class MarketingAgent(BaseAgent):
    """AI agent for marketing campaign generation and audience analysis.

    Capabilities:
    - generate_campaign: Create campaign copy for email, social, or SMS
    - analyze_audience: Suggest target audience segments for a product category
    - get_stats: Return mock marketing performance stats
    """

    def __init__(self) -> None:
        """Initialize MarketingAgent."""
        super().__init__(
            agent_id="marketing-agent",
            name="Marketing Agent",
            auto_register=True,
        )
        self.capabilities = [
            "generate_campaign",
            "analyze_audience",
            "get_stats",
            "marketing_copy",
            "audience_segmentation",
            "campaign_management",
        ]
        self.description = "Generates marketing campaigns, copy, and audience insights"
        self.requires_verification = False
        self.estimated_execution_time = 5

        logger.info("MarketingAgent initialized", agent_id=self.agent_id)

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Execute a marketing task.

        Context keys:
            action: "generate_campaign" | "analyze_audience" | "get_stats"
            product_name, target_audience, campaign_type, tone (for generate_campaign)
            product_category, location (for analyze_audience)
        """
        ctx = context or {}
        action = ctx.get("action", "generate_campaign")

        try:
            if action == "generate_campaign":
                return await self._generate_campaign(ctx)
            elif action == "analyze_audience":
                return self._analyze_audience(ctx)
            elif action == "get_stats":
                return self._get_stats()
            else:
                return {"error": f"Unknown action: {action}"}
        except Exception as exc:
            err_msg = str(exc)
            if "api_key" in err_msg.lower() or "authentication" in err_msg.lower():
                err_msg = (
                    "Anthropic API key is missing or invalid. "
                    "Set the ANTHROPIC_API_KEY environment variable."
                )
            logger.error("marketing_agent_execute_failed", action=action, error=err_msg)
            return {"error": err_msg}

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """Not implemented — marketing agent does not support streaming."""
        yield "Marketing agent does not support streaming"

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _generate_campaign(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """Generate campaign copy, using Anthropic Claude if available."""
        product_name = ctx.get("product_name", "Equipment")
        target_audience = ctx.get("target_audience", "professionals")
        campaign_type = ctx.get("campaign_type", "email")
        tone = ctx.get("tone", "professional")

        if _ANTHROPIC_AVAILABLE and _anthropic_module is not None:
            return await self._claude_campaign(
                product_name, target_audience, campaign_type, tone
            )
        return _mock_campaign(product_name, target_audience, campaign_type, tone)

    async def _claude_campaign(
        self,
        product_name: str,
        target_audience: str,
        campaign_type: str,
        tone: str,
    ) -> dict[str, Any]:
        """Generate campaign copy via Anthropic Claude."""
        type_instructions = {
            "email": "Write a subject line and email body",
            "social": "Write a short social media post (under 280 characters for the subject/title, and a slightly longer body)",
            "sms": "Write a brief SMS message (subject as header, body under 160 characters)",
        }
        tone_instructions = {
            "professional": "Use a professional, authoritative tone.",
            "friendly": "Use a warm, approachable tone.",
            "urgent": "Use urgency and scarcity to drive action.",
            "casual": "Use a casual, conversational tone.",
        }

        system_content = (
            "You are an expert marketing copywriter for an industrial equipment supplier. "
            f"{type_instructions.get(campaign_type, type_instructions['email'])}. "
            f"{tone_instructions.get(tone, tone_instructions['professional'])} "
            "Return your response as JSON with keys: campaign_subject, campaign_body, cta."
        )
        user_content = (
            f"Product: {product_name}\n"
            f"Target audience: {target_audience}\n"
            f"Campaign type: {campaign_type}\n"
            f"Generate the marketing copy now."
        )

        import json

        client = _anthropic_module.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system_content,
            messages=[
                {"role": "user", "content": user_content},
            ],
        )

        raw = response.content[0].text.strip()
        try:
            parsed = json.loads(raw)
        except Exception:
            # Claude didn't return valid JSON — wrap it
            parsed = {
                "campaign_subject": f"Introducing {product_name}",
                "campaign_body": raw,
                "cta": "Shop Now",
            }

        return {
            "campaign_subject": parsed.get("campaign_subject", f"Introducing {product_name}"),
            "campaign_body": parsed.get("campaign_body", raw),
            "cta": parsed.get("cta", "Shop Now"),
            "campaign_type": campaign_type,
            "created_at": datetime.now(UTC).isoformat(),
        }

    def _analyze_audience(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """Return audience segment analysis."""
        product_category = ctx.get("product_category", "general")
        location = ctx.get("location")
        return _mock_audience_segments(product_category, location)

    def _get_stats(self) -> dict[str, Any]:
        """Return mock marketing performance stats."""
        return {
            "total_campaigns": 24,
            "active_campaigns": 6,
            "avg_open_rate": 28.4,
            "avg_conversion_rate": 3.7,
            "top_performing_type": "email",
        }


# ---------------------------------------------------------------------------
# Module-level singleton + factory
# ---------------------------------------------------------------------------

_marketing_agent: MarketingAgent | None = None


def get_marketing_agent() -> MarketingAgent:
    """Return the module-level singleton MarketingAgent."""
    global _marketing_agent
    if _marketing_agent is None:
        _marketing_agent = MarketingAgent()
    return _marketing_agent
