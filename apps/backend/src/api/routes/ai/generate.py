"""AI Content Generation API endpoints."""

import os
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.ai.agents.content_generator import ContentGenerator, get_content_generator
from src.utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai/generate")

# Check if OpenAI is available
try:
    import openai
    OPENAI_AVAILABLE = bool(os.getenv("OPENAI_API_KEY"))
    if OPENAI_AVAILABLE:
        openai.api_key = os.getenv("OPENAI_API_KEY")
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI package not installed. Image and copy generation will not be available.")


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


# ============================================
# AI MARKETING - Image & Copy Generation
# ============================================


class GenerateImageRequest(BaseModel):
    """Request to generate an image using DALL-E 3."""

    prompt: str = Field(..., description="Description of the image to generate")
    size: str = Field(default="1024x1024", description="Image size: 1024x1024, 1792x1024, 1024x1792")
    quality: str = Field(default="standard", description="Quality: standard or hd")
    style: str = Field(default="vivid", description="Style: vivid or natural")


class GenerateImageResponse(BaseModel):
    """Response with generated image URL."""

    imageUrl: str = Field(..., description="URL of the generated image")
    revisedPrompt: str | None = Field(None, description="DALL-E revised prompt")
    createdAt: str = Field(..., description="Timestamp of generation")


class GenerateCopyRequest(BaseModel):
    """Request to generate marketing copy using GPT-4."""

    prompt: str = Field(..., description="Description of the copy to generate")
    type: str = Field(default="email", description="Content type: email, social, ad")
    tone: str = Field(default="professional", description="Tone: professional, casual, persuasive")
    maxTokens: int = Field(default=500, description="Maximum tokens in response")


class GenerateCopyResponse(BaseModel):
    """Response with generated marketing copy."""

    content: str = Field(..., description="Generated copy content")
    type: str = Field(..., description="Content type")
    tone: str = Field(..., description="Content tone")
    createdAt: str = Field(..., description="Timestamp of generation")


@router.post("/image", response_model=GenerateImageResponse)
async def generate_image(
    request: GenerateImageRequest,
) -> GenerateImageResponse | dict[str, Any]:
    """Generate an image using DALL-E 3.

    Args:
        request: Image generation request

    Returns:
        Generated image URL and metadata

    Raises:
        HTTPException: If OpenAI is not configured or generation fails
    """
    if not OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="OpenAI integration not configured. Please set OPENAI_API_KEY environment variable.",
        )

    logger.info("Generating image with DALL-E 3", prompt_length=len(request.prompt))

    try:
        # Call OpenAI DALL-E 3 API
        response = openai.images.generate(
            model="dall-e-3",
            prompt=request.prompt,
            size=request.size,
            quality=request.quality,
            style=request.style,
            n=1,
        )

        image_url = response.data[0].url
        revised_prompt = getattr(response.data[0], "revised_prompt", None)

        logger.info("Image generated successfully", image_url=image_url)

        return GenerateImageResponse(
            imageUrl=image_url,
            revisedPrompt=revised_prompt,
            createdAt=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error("Error generating image", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate image: {str(e)}",
        )


class GenerateProductCopyRequest(BaseModel):
    """Request to generate AI-powered product copy."""

    product_name: str = Field(..., description="Name of the product")
    product_category: str = Field(..., description="Product category (e.g. power_tools, safety_equipment)")
    copy_type: str = Field(..., description="Type of copy: description | features | marketing | technical")
    key_info: str | None = Field(None, description="Additional key information, specs, or selling points")


class GenerateProductCopyResponse(BaseModel):
    """Response with generated product copy."""

    generated_copy: str = Field(..., description="The AI-generated copy text")
    copy_type: str = Field(..., description="The type of copy that was generated")
    product_name: str = Field(..., description="The product name used in generation")
    created_at: str = Field(..., description="ISO timestamp of generation")


@router.post("/product-copy", response_model=GenerateProductCopyResponse)
async def generate_product_copy(
    request: GenerateProductCopyRequest,
) -> GenerateProductCopyResponse:
    """Generate AI-powered product copy (description, features, marketing, technical).

    Args:
        request: Product copy generation request

    Returns:
        Generated product copy and metadata

    Raises:
        HTTPException: If OpenAI is not configured or generation fails
    """
    if not OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Please set OPENAI_API_KEY environment variable.",
        )

    logger.info(
        "Generating product copy",
        product_name=request.product_name,
        copy_type=request.copy_type,
    )

    try:
        system_prompts = {
            "description": "You are an expert product copywriter for industrial equipment suppliers. Write a compelling product description in 2-3 paragraphs.",
            "features": "You are a technical writer for industrial equipment. List 5-8 key features and benefits as concise bullet points.",
            "marketing": "You are a sales copywriter for construction and cleaning equipment suppliers. Write persuasive marketing copy in 1-2 paragraphs.",
            "technical": "You are a technical documentation writer for industrial equipment. Write precise technical specifications and usage notes.",
        }

        system_content = system_prompts.get(
            request.copy_type,
            system_prompts["description"],
        )

        user_prompt = (
            f"Product: {request.product_name}\n"
            f"Category: {request.product_category}\n"
            f"Additional info: {request.key_info or 'None provided'}\n\n"
            f"Generate the requested copy."
        )

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=600,
            temperature=0.7,
        )

        result = response.choices[0].message.content.strip()

        logger.info("Product copy generated successfully", content_length=len(result))

        return GenerateProductCopyResponse(
            generated_copy=result,
            copy_type=request.copy_type,
            product_name=request.product_name,
            created_at=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error("Error generating product copy", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate product copy: {str(e)}",
        )


@router.post("/copy", response_model=GenerateCopyResponse)
async def generate_copy(
    request: GenerateCopyRequest,
) -> GenerateCopyResponse | dict[str, Any]:
    """Generate marketing copy using GPT-4.

    Args:
        request: Copy generation request

    Returns:
        Generated marketing copy

    Raises:
        HTTPException: If OpenAI is not configured or generation fails
    """
    if not OPENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="OpenAI integration not configured. Please set OPENAI_API_KEY environment variable.",
        )

    logger.info("Generating copy with GPT-4", prompt_length=len(request.prompt))

    try:
        # Build system prompt based on type and tone
        system_prompts = {
            "email": "You are an expert email copywriter. Write compelling, professional email copy.",
            "social": "You are a social media expert. Write engaging, concise social media content.",
            "ad": "You are an advertising copywriter. Write persuasive, attention-grabbing ad copy.",
        }

        tone_instructions = {
            "professional": "Use a professional, business-appropriate tone.",
            "casual": "Use a friendly, casual, conversational tone.",
            "persuasive": "Use persuasive language that drives action and engagement.",
        }

        system_content = f"{system_prompts.get(request.type, system_prompts['email'])} {tone_instructions.get(request.tone, tone_instructions['professional'])}"

        # Call OpenAI GPT-4 API
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": request.prompt},
            ],
            max_tokens=request.maxTokens,
            temperature=0.7,
        )

        generated_content = response.choices[0].message.content.strip()

        logger.info("Copy generated successfully", content_length=len(generated_content))

        return GenerateCopyResponse(
            content=generated_content,
            type=request.type,
            tone=request.tone,
            createdAt=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        logger.error("Error generating copy", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate copy: {str(e)}",
        )
