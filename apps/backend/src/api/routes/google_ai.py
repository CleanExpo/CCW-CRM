"""
Google AI API endpoints.

Provides endpoints for Google AI features including:
- Text generation with Gemini
- Text embeddings
- Vision analysis
- Product description generation
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.api.deps import get_current_user
from src.api.deps import get_optional_user
from src.db.models import User
from src.integrations.google import generate_text_with_google, get_google_ai_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/google-ai", tags=["Google AI"], dependencies=[Depends(get_current_user)])


# Request/Response Models


class TextGenerationRequest(BaseModel):
    """Request for text generation."""

    prompt: str = Field(..., min_length=1, max_length=10000, description="Text prompt for generation")
    temperature: float = Field(default=0.7, ge=0.0, le=1.0, description="Sampling temperature (0.0-1.0)")
    max_tokens: int = Field(default=1024, ge=1, le=8192, description="Maximum tokens to generate")
    model: str | None = Field(default=None, description="Optional: Override default model")


class TextGenerationResponse(BaseModel):
    """Response from text generation."""

    text: str = Field(..., description="Generated text")
    model: str = Field(..., description="Model used for generation")
    prompt_length: int = Field(..., description="Length of input prompt")
    response_length: int = Field(..., description="Length of generated text")


class ProductDescriptionRequest(BaseModel):
    """Request for AI product description generation."""

    product_name: str = Field(..., min_length=1, max_length=500)
    product_category: str | None = Field(default=None, max_length=100)
    key_features: list[str] | None = Field(default=None, max_items=10)
    target_audience: str | None = Field(default=None, max_length=200)
    tone: str = Field(default="professional", description="Tone: professional, casual, technical, marketing")


class ProductDescriptionResponse(BaseModel):
    """Response with generated product description."""

    product_name: str
    description: str
    model_used: str


class EmbeddingRequest(BaseModel):
    """Request for text embeddings."""

    texts: list[str] = Field(..., min_items=1, max_items=100, description="Texts to embed")
    model: str = Field(default="models/embedding-001", description="Embedding model")


class EmbeddingResponse(BaseModel):
    """Response with embeddings."""

    embeddings: list[list[float]] = Field(..., description="List of embedding vectors")
    dimension: int = Field(..., description="Dimension of each embedding vector")
    count: int = Field(..., description="Number of embeddings generated")


# Endpoints


@router.post("/generate", response_model=TextGenerationResponse)
async def generate_text(
    request: TextGenerationRequest,
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
    """
    Generate text using Google Gemini.

    This endpoint uses the secure, centralized Google AI client to generate
    text based on the provided prompt.

    **Security:** Requires authentication (optional for demo)
    **Rate Limit:** 60 requests per minute per user
    """
    try:
        client = get_google_ai_client()

        logger.info(
            "google_ai_text_generation_request",
            user_id=str(current_user.id) if current_user else "anonymous",
            prompt_length=len(request.prompt),
            temperature=request.temperature,
        )

        response = await client.generate_text(
            prompt=request.prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            model=request.model,
        )

        logger.info(
            "google_ai_text_generation_success",
            user_id=str(current_user.id) if current_user else "anonymous",
            response_length=len(response["text"]),
        )

        return TextGenerationResponse(
            text=response["text"],
            model=response["model"],
            prompt_length=len(request.prompt),
            response_length=len(response["text"]),
        )

    except ValueError as e:
        # API key not configured
        logger.error("google_ai_not_configured", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google AI API is not configured. Please contact the administrator.",
        )
    except Exception as e:
        logger.error(
            "google_ai_text_generation_error",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate text: {str(e)}",
        )


@router.post("/product-description", response_model=ProductDescriptionResponse)
async def generate_product_description(
    request: ProductDescriptionRequest,
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
    """
    Generate AI-powered product description.

    Uses Google Gemini to create compelling, professional product descriptions
    based on product name, category, features, and target audience.

    **Example Use Case:**
    - E-commerce product listings
    - Marketing materials
    - Product catalogs
    """
    try:
        # Build detailed prompt
        prompt_parts = [
            f"Write a compelling {request.tone} product description for:",
            f"\nProduct: {request.product_name}",
        ]

        if request.product_category:
            prompt_parts.append(f"Category: {request.product_category}")

        if request.key_features:
            prompt_parts.append(f"Key Features: {', '.join(request.key_features)}")

        if request.target_audience:
            prompt_parts.append(f"Target Audience: {request.target_audience}")

        prompt_parts.append(
            "\nRequirements:"
            "\n- 100-200 words"
            "\n- Highlight benefits, not just features"
            "\n- Use persuasive language"
            "\n- Include a call-to-action"
        )

        prompt = "\n".join(prompt_parts)

        logger.info(
            "google_ai_product_description_request",
            user_id=str(current_user.id) if current_user else "anonymous",
            product_name=request.product_name,
        )

        # Use convenience function
        description = await generate_text_with_google(
            prompt=prompt,
            temperature=0.8,  # Slightly more creative
            max_tokens=300,
        )

        logger.info(
            "google_ai_product_description_success",
            user_id=str(current_user.id) if current_user else "anonymous",
            description_length=len(description),
        )

        return ProductDescriptionResponse(
            product_name=request.product_name,
            description=description,
            model_used="gemini-1.5-flash",
        )

    except ValueError as e:
        logger.error("google_ai_not_configured", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google AI API is not configured. Please contact the administrator.",
        )
    except Exception as e:
        logger.error(
            "google_ai_product_description_error",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate product description: {str(e)}",
        )


@router.post("/embeddings", response_model=EmbeddingResponse)
async def generate_embeddings(
    request: EmbeddingRequest,
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
    """
    Generate text embeddings using Google AI.

    Text embeddings are vector representations of text that can be used for:
    - Semantic search
    - Text similarity comparison
    - Clustering and classification
    - Recommendation systems

    **Example Use Case:**
    - Search products by semantic similarity
    - Find related documents
    - Cluster customer feedback
    """
    try:
        client = get_google_ai_client()

        logger.info(
            "google_ai_embeddings_request",
            user_id=str(current_user.id) if current_user else "anonymous",
            text_count=len(request.texts),
        )

        embeddings = await client.generate_embeddings(
            texts=request.texts,
            model=request.model,
        )

        logger.info(
            "google_ai_embeddings_success",
            user_id=str(current_user.id) if current_user else "anonymous",
            embedding_count=len(embeddings),
        )

        return EmbeddingResponse(
            embeddings=embeddings,
            dimension=len(embeddings[0]) if embeddings else 0,
            count=len(embeddings),
        )

    except ValueError as e:
        logger.error("google_ai_not_configured", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google AI API is not configured. Please contact the administrator.",
        )
    except Exception as e:
        logger.error(
            "google_ai_embeddings_error",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embeddings: {str(e)}",
        )


class VisionAnalyzeRequest(BaseModel):
    """Request for product attribute extraction from an image URL."""

    image_url: str = Field(..., description="Publicly accessible image URL")
    product_name: str | None = Field(default=None, max_length=255, description="Optional product name for context")
    category: str | None = Field(default=None, max_length=100, description="Optional product category for context")


class ExtractedAttribute(BaseModel):
    """A single extracted product attribute."""

    key: str
    value: str
    unit: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class VisionAnalyzeResponse(BaseModel):
    """Extracted product attributes from image analysis."""

    attributes: list[ExtractedAttribute]
    summary: str
    model_used: str


@router.post("/vision-analyze", response_model=VisionAnalyzeResponse)
async def vision_analyze_product(
    body: VisionAnalyzeRequest,
    _: Annotated[User | None, Depends(get_optional_user)] = None,
) -> VisionAnalyzeResponse:
    """
    Extract product attributes from an image using Gemini Vision.

    Analyses the product image and returns structured key-value attributes
    (e.g., dimensions, materials, voltage, weight) suitable for the product
    attributes table.
    """
    try:
        client = get_google_ai_client()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google AI API is not configured.",
        )

    context_parts = []
    if body.product_name:
        context_parts.append(f"Product: {body.product_name}")
    if body.category:
        context_parts.append(f"Category: {body.category}")
    context_hint = ". ".join(context_parts)

    prompt = (
        f"Analyse this product image{(f' ({context_hint})') if context_hint else ''}. "
        "Extract all visible or inferrable product attributes as a structured JSON array. "
        "Each attribute should have: key (snake_case name), value (string), unit (optional, e.g. 'kg', 'cm', 'V'), "
        "and confidence (0.0–1.0). "
        "Also provide a brief one-sentence summary of what you see. "
        'Return ONLY valid JSON in this format: {"attributes": [...], "summary": "..."}'
    )

    try:
        raw = await client.vision_analysis(
            image_url=body.image_url,
            prompt=prompt,
            model="models/gemini-2.5-flash",
        )
    except Exception as e:
        logger.error("google_ai_vision_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vision analysis failed: {str(e)}",
        )

    # Parse the JSON response from Gemini
    import json
    import re

    try:
        # Strip markdown code fences if present
        cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw.get("text", "{}")).strip()
        parsed = json.loads(cleaned)
        attrs = [
            ExtractedAttribute(
                key=a.get("key", "unknown"),
                value=str(a.get("value", "")),
                unit=a.get("unit"),
                confidence=float(a.get("confidence", 0.7)),
            )
            for a in parsed.get("attributes", [])
        ]
        summary = parsed.get("summary", "No summary available.")
    except (json.JSONDecodeError, KeyError, ValueError):
        # Fallback: return raw text as a single attribute
        attrs = [ExtractedAttribute(key="description", value=raw.get("text", ""), confidence=0.5)]
        summary = "Could not parse structured attributes."

    return VisionAnalyzeResponse(
        attributes=attrs,
        summary=summary,
        model_used="gemini-2.5-flash",
    )


@router.get("/health")
async def google_ai_health_check():
    """
    Check if Google AI integration is configured and operational.

    Returns:
        - configured: Whether API key is set
        - status: "ready" or "not_configured"
    """
    try:
        client = get_google_ai_client()
        return {
            "configured": True,
            "status": "ready",
            "default_model": client.config.default_model,
        }
    except ValueError:
        return {
            "configured": False,
            "status": "not_configured",
            "message": "GOOGLE_AI_API_KEY environment variable not set",
        }
