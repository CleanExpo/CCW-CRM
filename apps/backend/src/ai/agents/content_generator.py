"""Content generator agent for quotes, emails, and reports."""

import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from langgraph.graph import END, StateGraph

from src.db.demo_models import AIGeneratedContent
from src.utils import get_logger

from ..base_agent import BaseAgent
from ..generators import EmailGenerator, QuoteGenerator
from .content_state import ContentState

logger = get_logger(__name__)


class ContentGenerator(BaseAgent):
    """Agent for generating various types of business content.

    Capabilities:
    - Quote generation from natural language
    - Email generation (follow-ups, confirmations, custom)
    - Summary and report generation
    """

    def __init__(self):
        super().__init__(
            agent_id="content_generator",
            name="Content Generator",
            auto_register=False
        )

        # Set capabilities for agent registry
        self.capabilities = ["content_generation", "quote_generation", "email_generation", "report_generation"]  # noqa: E501
        self.description = "Generates business content including quotes, emails, and reports"
        self.estimated_execution_time = 10  # seconds
        self.requires_verification = True  # Content should be reviewed before sending

        self.quote_generator = QuoteGenerator()
        self.email_generator = EmailGenerator()

        # Build LangGraph state graph
        self.graph = self._build_graph()

        logger.info("ContentGenerator initialized")

        # Register with agent registry after full initialization
        self._schedule_registration()

    def _build_graph(self) -> StateGraph:
        """Build LangGraph state graph for content generation."""
        workflow = StateGraph(ContentState)

        # Add nodes
        workflow.add_node("parse_request", self._parse_request)
        workflow.add_node("gather_context", self._gather_context)
        workflow.add_node("generate_content", self._generate_content)
        workflow.add_node("validate", self._validate)
        workflow.add_node("finalize", self._finalize)

        # Set entry point
        workflow.set_entry_point("parse_request")

        # Add edges
        workflow.add_edge("parse_request", "gather_context")
        workflow.add_edge("gather_context", "generate_content")
        workflow.add_edge("generate_content", "validate")
        workflow.add_edge("validate", "finalize")
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def _parse_request(self, state: ContentState) -> ContentState:
        """Parse the content generation request."""
        content_type = state["content_type"]
        requirements = state["requirements"]
        context = state.get("context", {})

        logger.info("Parsing content request", content_type=content_type)

        # Initialize state fields
        state["parsed_requirements"] = {
            "type": content_type,
            "raw_requirements": requirements,
            "context": context,
        }
        state["entities_found"] = []
        state["validation_errors"] = []
        state["requires_review"] = False
        state["tools_used"] = []
        state["metadata"] = {
            "started_at": datetime.now(UTC).isoformat(),
            "content_type": content_type,
        }

        return state

    async def _gather_context(self, state: ContentState) -> ContentState:
        """Gather relevant context from database."""
        content_type = state["content_type"]
        context = state.get("context", {})

        logger.info("Gathering context", content_type=content_type)

        # Context is already provided in most cases
        state["relevant_data"] = context

        return state

    async def _generate_content(self, state: ContentState) -> ContentState:
        """Generate content based on type."""
        content_type = state["content_type"]
        state["requirements"]
        state.get("context", {})

        logger.info("Generating content", content_type=content_type)

        try:
            if content_type == "quote":
                await self._generate_quote(state)
            elif content_type == "email":
                await self._generate_email(state)
            elif content_type == "summary":
                await self._generate_summary(state)
            else:
                state["error"] = f"Unknown content type: {content_type}"

        except Exception as e:
            logger.error("Error generating content", error=str(e))
            state["error"] = f"Failed to generate content: {str(e)}"

        return state

    async def _generate_quote(self, state: ContentState) -> None:
        """Generate quote content."""
        requirements = state["requirements"]
        context = state.get("context", {})
        customer_id = context.get("customer_id")

        async with self.get_db_session() as db:
            quote_data = await self.quote_generator.generate_quote_data(
                requirements=requirements,
                customer_id=customer_id,
                db=db,
            )

            if "error" in quote_data:
                state["error"] = quote_data["error"]
                state["structured_output"] = None
                return

            # Generate description
            description = await self.quote_generator.generate_quote_description(quote_data)

            state["structured_output"] = quote_data
            state["draft_content"] = description
            state["tools_used"].append("quote_generator")

    async def _generate_email(self, state: ContentState) -> None:
        """Generate email content."""
        context = state.get("context", {})
        email_type = context.get("email_type", "custom")
        tone = context.get("tone", "formal")

        async with self.get_db_session() as db:
            if email_type == "quote_follow_up":
                quote_id = context.get("quote_id")
                if not quote_id:
                    state["error"] = "quote_id required for quote follow-up"
                    return

                email_data = await self.email_generator.generate_quote_follow_up(
                    quote_id=quote_id,
                    tone=tone,
                    db=db,
                )

            elif email_type == "order_confirmation":
                order_id = context.get("order_id")
                if not order_id:
                    state["error"] = "order_id required for order confirmation"
                    return

                email_data = await self.email_generator.generate_order_confirmation(
                    order_id=order_id,
                    tone=tone,
                    db=db,
                )

            elif email_type == "custom":
                customer_id = context.get("customer_id")
                purpose = context.get("purpose", "general")

                if not customer_id:
                    state["error"] = "customer_id required for custom email"
                    return

                email_data = await self.email_generator.generate_custom_email(
                    customer_id=customer_id,
                    purpose=purpose,
                    context=state["requirements"],
                    tone=tone,
                    db=db,
                )

            else:
                state["error"] = f"Unknown email type: {email_type}"
                return

            if "error" in email_data:
                state["error"] = email_data["error"]
                return

            state["structured_output"] = email_data
            state["draft_content"] = email_data.get("body", "")
            state["tools_used"].append("email_generator")

    async def _generate_summary(self, state: ContentState) -> None:
        """Generate summary content."""
        # Simple summary generation using context
        context = state.get("context", {})
        summary_type = context.get("summary_type", "general")

        # For now, just create a placeholder
        state["draft_content"] = f"Summary of {summary_type}"
        state["structured_output"] = {"type": summary_type, "content": state["draft_content"]}
        state["tools_used"].append("summary_generator")

    async def _validate(self, state: ContentState) -> ContentState:
        """Validate generated content."""
        content_type = state["content_type"]
        structured_output = state.get("structured_output")
        validation_errors = []

        if not structured_output:
            validation_errors.append("No content generated")
        elif content_type == "quote":
            # Validate quote
            if not structured_output.get("items"):
                validation_errors.append("Quote has no items")
            if structured_output.get("total", 0) <= 0:
                validation_errors.append("Quote total must be positive")
        elif content_type == "email":
            # Validate email
            if not structured_output.get("subject"):
                validation_errors.append("Email missing subject")
            if not structured_output.get("body"):
                validation_errors.append("Email missing body")

        state["validation_errors"] = validation_errors
        state["requires_review"] = len(validation_errors) > 0

        if validation_errors:
            logger.warning("Validation errors", errors=validation_errors)

        return state

    async def _finalize(self, state: ContentState) -> ContentState:
        """Finalize and format output."""
        if state.get("error"):
            state["final_output"] = {
                "error": state["error"],
                "content_type": state["content_type"],
            }
            return state

        state["final_output"] = {
            "content_type": state["content_type"],
            "structured_data": state.get("structured_output"),
            "text_content": state.get("draft_content"),
            "requires_review": state.get("requires_review", False),
            "validation_errors": state.get("validation_errors", []),
            "tools_used": state.get("tools_used", []),
            "metadata": state.get("metadata", {}),
        }

        state["metadata"]["completed_at"] = datetime.now(UTC).isoformat()

        # Save to database
        await self._save_content(state)

        return state

    async def _save_content(self, state: ContentState) -> None:
        """Save generated content to database."""
        structured_output = state.get("structured_output")
        if not structured_output:
            return

        try:
            async with self.get_db_session() as db:
                content_type = state["content_type"]

                # Determine title
                if content_type == "quote":
                    title = structured_output.get("quote_number", "Generated Quote")
                elif content_type == "email":
                    title = structured_output.get("subject", "Generated Email")
                else:
                    title = f"Generated {content_type}"

                # Create record
                content_record = AIGeneratedContent(
                    content_type=content_type,
                    title=title,
                    content=json.dumps(structured_output),
                    content_metadata=json.dumps(state.get("metadata", {})),
                    entity_type=content_type,
                    user_id=state.get("user_id"),
                )

                db.add(content_record)
                await db.commit()

                logger.info("Saved generated content", type=content_type, id=content_record.id)

        except Exception as e:
            logger.error("Error saving content", error=str(e))

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute a content generation task.

        Args:
            task: The task description
            context: Context with content_type, requirements, customer_id, etc.

        Returns:
            dict with generated content
        """
        context = context or {}

        # Build initial state
        initial_state: ContentState = {
            "content_type": context.get("content_type", "quote"),
            "requirements": context.get("requirements", task),
            "context": context.get("context", {}),
            "user_id": context.get("user_id"),
            "parsed_requirements": None,
            "entities_found": [],
            "relevant_data": None,
            "calculations": None,
            "draft_content": None,
            "structured_output": None,
            "formatted_content": None,
            "validation_errors": [],
            "requires_review": False,
            "final_output": None,
            "metadata": {},
            "tools_used": [],
            "error": None,
        }

        try:
            # Execute graph
            final_state = await self.graph.ainvoke(initial_state)

            if final_state.get("error"):
                return {
                    "error": final_state["error"],
                    "content_type": final_state["content_type"],
                }

            return final_state.get("final_output", {})

        except Exception as e:
            logger.error("Error executing content generator", error=str(e))
            return {
                "error": f"Failed to generate content: {str(e)}",
                "content_type": context.get("content_type", "unknown"),
            }

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """Stream content generation (not implemented - content is batch generated).

        Args:
            task: Task description
            context: Execution context

        Yields:
            Status updates
        """
        context = context or {}
        content_type = context.get("content_type", "quote")

        yield f"Generating {content_type}...\n"

        result = await self.execute(task, context)

        if "error" in result:
            yield f"Error: {result['error']}\n"
        else:
            yield f"✓ {content_type.title()} generated successfully\n"
            if result.get("requires_review"):
                yield "⚠ Review required before sending\n"


# Dependency for FastAPI
_content_generator: ContentGenerator | None = None


def get_content_generator() -> ContentGenerator:
    """Get or create content generator singleton."""
    global _content_generator
    if _content_generator is None:
        _content_generator = ContentGenerator()
    return _content_generator
