"""AI Content Generation API endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.ai.agents.content_generator import ContentGenerator, get_content_generator
from src.utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai/generate")


# Request/Response Models


class GenerateQuoteRequest(BaseModel):
    """Request to generate a quote from natural language."""

    requirements: str = Field(..., description="Natural language description of quote requirements")
    customer_id: str | None = Field(None, description="Optional customer ID")
    user_id: str | None = Field(None, description="User ID")


class QuoteItem(BaseModel):
    """Quote line item."""

    product_id: str
    sku: str
    name: str
    description: str | None
    category: str
    unit_price: float
    quantity: int
    line_total: float
    stock_available: int


class GenerateQuoteResponse(BaseModel):
    """Response with generated quote data."""

    quote_number: str
    customer_id: str | None
    customer: dict[str, Any]
    items: list[dict[str, Any]]
    subtotal: float
    tax: float
    tax_rate: float
    total: float
    currency: str
    notes: str
    special_requirements: str
    valid_until: str
    quote_date: str
    description: str | None = Field(None, description="Human-readable quote description")
    requires_review: bool = Field(False, description="Whether quote needs human review")
    validation_errors: list[str] = Field(default_factory=list)


class GenerateEmailRequest(BaseModel):
    """Request to generate an email."""

    email_type: str = Field(..., description="Type: quote_follow_up, order_confirmation, custom")
    context: dict[str, Any] = Field(..., description="Context data (quote_id, order_id, customer_id)")  # noqa: E501
    requirements: str | None = Field(None, description="Additional requirements for custom emails")
    tone: str = Field(default="formal", description="Email tone: formal, friendly, urgent")
    user_id: str | None = Field(None, description="User ID")


class GenerateEmailResponse(BaseModel):
    """Response with generated email."""

    subject: str
    body: str
    to: str
    customer_name: str
    company_name: str
    requires_review: bool = Field(False, description="Whether email needs human review")
    validation_errors: list[str] = Field(default_factory=list)


# Endpoints


@router.post("/quote", response_model=GenerateQuoteResponse)
async def generate_quote(
    request: GenerateQuoteRequest,
    agent: Annotated[ContentGenerator, Depends(get_content_generator)],
) -> GenerateQuoteResponse | dict[str, Any]:
    """Generate a quote from natural language requirements.

    Args:
        request: Quote generation request
        agent: ContentGenerator instance

    Returns:
        Generated quote data
    """
    logger.info("Generating quote", requirements_length=len(request.requirements))

    try:
        # Prepare context
        context = {
            "content_type": "quote",
            "requirements": request.requirements,
            "context": {
                "customer_id": request.customer_id,
            },
            "user_id": request.user_id,
        }

        # Execute agent
        result = await agent.execute(
            task=f"Generate quote: {request.requirements}",
            context=context,
        )

        if "error" in result:
            return {"error": result["error"]}

        # Extract structured data
        structured_data = result.get("structured_data", {})

        if not structured_data:
            return {"error": "Failed to generate quote data"}

        return GenerateQuoteResponse(
            **structured_data,
            description=result.get("text_content"),
            requires_review=result.get("requires_review", False),
            validation_errors=result.get("validation_errors", []),
        )

    except Exception as e:
        logger.error("Error generating quote", error=str(e))
        return {
            "error": f"Failed to generate quote: {str(e)}",
        }


@router.post("/email", response_model=GenerateEmailResponse)
async def generate_email(
    request: GenerateEmailRequest,
    agent: Annotated[ContentGenerator, Depends(get_content_generator)],
) -> GenerateEmailResponse | dict[str, Any]:
    """Generate an email for customer communication.

    Args:
        request: Email generation request
        agent: ContentGenerator instance

    Returns:
        Generated email
    """
    logger.info("Generating email", email_type=request.email_type)

    try:
        # Prepare context
        context_data = {
            "email_type": request.email_type,
            "tone": request.tone,
            **request.context,
        }

        context = {
            "content_type": "email",
            "requirements": request.requirements or f"Generate {request.email_type} email",
            "context": context_data,
            "user_id": request.user_id,
        }

        # Execute agent
        result = await agent.execute(
            task=f"Generate {request.email_type} email",
            context=context,
        )

        if "error" in result:
            return {"error": result["error"]}

        # Extract structured data
        structured_data = result.get("structured_data", {})

        if not structured_data:
            return {"error": "Failed to generate email"}

        return GenerateEmailResponse(
            **structured_data,
            requires_review=result.get("requires_review", False),
            validation_errors=result.get("validation_errors", []),
        )

    except Exception as e:
        logger.error("Error generating email", error=str(e))
        return {
            "error": f"Failed to generate email: {str(e)}",
        }


@router.post("/summary")
async def generate_summary(
    requirements: str,
    summary_type: str = "general",
    user_id: str | None = None,
    agent: ContentGenerator = Depends(get_content_generator),
) -> dict[str, Any]:
    """Generate a summary or report.

    Args:
        requirements: Summary requirements
        summary_type: Type of summary
        user_id: User ID
        agent: ContentGenerator instance

    Returns:
        Generated summary
    """
    logger.info("Generating summary", summary_type=summary_type)

    try:
        context = {
            "content_type": "summary",
            "requirements": requirements,
            "context": {
                "summary_type": summary_type,
            },
            "user_id": user_id,
        }

        result = await agent.execute(
            task=f"Generate {summary_type} summary",
            context=context,
        )

        return result

    except Exception as e:
        logger.error("Error generating summary", error=str(e))
        return {
            "error": f"Failed to generate summary: {str(e)}",
        }
