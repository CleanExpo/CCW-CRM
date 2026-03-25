"""
Product Recognition Service

Uses OpenAI GPT-4o Vision API to identify products from photos taken by tradespeople.

Workflow:
1. Tradesperson uploads photo
2. Image stored in Supabase Storage
3. GPT-4o Vision analyses the image
4. Returns list of matched products with confidence scores
5. Tradesperson confirms/adjusts matches
6. Draft order created
"""

import asyncio
import os
import time
from typing import Any
from uuid import uuid4

import httpx
import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

# Confidence threshold for auto-accepting a match
HIGH_CONFIDENCE_THRESHOLD = 0.85
MINIMUM_CONFIDENCE_THRESHOLD = 0.40


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------


class ProductMatch(BaseModel):
    """A single product match from AI recognition."""

    product_id: str | None = None
    sku: str | None = None
    product_name: str = Field(description="AI-identified product name")
    category: str | None = None
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0-1")
    suggested_quantity: int = Field(default=1, ge=1)
    reasoning: str | None = Field(None, description="Why the AI matched this product")
    matched_to_catalog: bool = Field(default=False, description="Whether this was matched to an actual catalog product")


class RecognitionResult(BaseModel):
    """Result of processing a product recognition image."""

    image_id: str
    status: str
    matches: list[ProductMatch] = Field(default_factory=list)
    processing_time_ms: int
    model_used: str = "gpt-4o"
    context_description: str | None = None  # AI description of the scene
    low_confidence_warning: bool = False
    error: str | None = None


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ProductRecognitionService:
    """
    AI-powered product recognition from photos.

    Uses GPT-4o Vision to identify products, then matches them against
    the CCW product catalog.
    """

    OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
    MODEL = "gpt-4o"
    MAX_RETRIES = 2
    TIMEOUT = 30.0

    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.demo_mode = not bool(self.api_key) or os.getenv("RECOGNITION_DEMO_MODE", "false").lower() == "true"
        if self.demo_mode:
            logger.info("product_recognition_demo_mode", reason="no_api_key" if not self.api_key else "demo_forced")

    def _build_prompt(self, context_notes: str | None = None) -> str:
        """Build the vision prompt for product identification."""
        context = f"\n\nAdditional context from the tradesperson: {context_notes}" if context_notes else ""

        return f"""You are an expert product identifier for CCW, an Australian cleaning equipment supplier.

Analyse this image and identify any cleaning equipment, tools, or supplies visible.{context}

For each product you can identify, provide:
1. Product name (specific model/brand if visible)
2. Category (e.g. "Truckmount", "Portable Extractor", "Wand", "Hose", "Chemical", "Safety Equipment")
3. Confidence score (0.0 to 1.0) — how certain you are
4. Suggested quantity (how many visible)
5. Brief reasoning for your identification

Respond in this exact JSON format:
{{
  "scene_description": "Brief description of what you see",
  "products": [
    {{
      "product_name": "...",
      "category": "...",
      "confidence": 0.95,
      "suggested_quantity": 1,
      "reasoning": "...",
      "sku_hint": "..." // If you can see any part numbers or model numbers
    }}
  ]
}}

If you cannot identify any products with confidence > 0.3, return an empty products array.
Only identify products relevant to cleaning equipment, tools, supplies, or safety equipment."""

    async def _call_openai_vision(
        self,
        image_base64: str,
        context_notes: str | None = None,
    ) -> dict[str, Any]:
        """Call OpenAI GPT-4o Vision API."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.MODEL,
            "max_tokens": 1000,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": self._build_prompt(context_notes),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
        }

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                    response = await client.post(
                        self.OPENAI_API_URL,
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < self.MAX_RETRIES:
                    retry_after = int(e.response.headers.get("Retry-After", 10))
                    logger.warning("openai_rate_limited", retry_after=retry_after, attempt=attempt)
                    await asyncio.sleep(retry_after)
                    continue
                raise
            except httpx.TimeoutException:
                if attempt < self.MAX_RETRIES:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise

        raise RuntimeError("Max retries exceeded calling OpenAI Vision API")

    def _demo_recognition(self, context_notes: str | None = None) -> dict[str, Any]:
        """Return realistic mock results for demo mode."""
        return {
            "choices": [
                {
                    "message": {
                        "content": """{
  "scene_description": "Cleaning equipment including a portable carpet extractor and accessories",
  "products": [
    {
      "product_name": "Prochem Steempro Plus Portable Extractor",
      "category": "Portable Extractor",
      "confidence": 0.91,
      "suggested_quantity": 1,
      "reasoning": "Distinctive orange and grey housing with Prochem branding visible",
      "sku_hint": "SP1200"
    },
    {
      "product_name": "Inline Solution Heater",
      "category": "Accessories",
      "confidence": 0.78,
      "suggested_quantity": 1,
      "reasoning": "Cylindrical heater unit connected to machine, standard size",
      "sku_hint": null
    }
  ]
}"""
                    }
                }
            ]
        }

    async def recognise_products_from_base64(
        self,
        image_base64: str,
        context_notes: str | None = None,
    ) -> RecognitionResult:
        """
        Recognise products from a base64-encoded image.

        Args:
            image_base64: Base64-encoded image (JPEG/PNG)
            context_notes: Optional text from tradesperson about what they're looking at

        Returns:
            RecognitionResult with matched products and confidence scores
        """
        image_id = str(uuid4())
        start_ms = int(time.time() * 1000)

        try:
            if self.demo_mode:
                raw_response = self._demo_recognition(context_notes)
            else:
                raw_response = await self._call_openai_vision(image_base64, context_notes)

            # Parse response
            content = raw_response["choices"][0]["message"]["content"]

            # Extract JSON from response (handle markdown code blocks)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            import json
            parsed = json.loads(content)

            matches = []
            for item in parsed.get("products", []):
                matches.append(ProductMatch(
                    product_name=item.get("product_name", "Unknown Product"),
                    category=item.get("category"),
                    confidence=float(item.get("confidence", 0.0)),
                    suggested_quantity=int(item.get("suggested_quantity", 1)),
                    reasoning=item.get("reasoning"),
                    sku=item.get("sku_hint"),
                    matched_to_catalog=False,  # Will be resolved in match_to_catalog()
                ))

            processing_time = int(time.time() * 1000) - start_ms
            max_confidence = max((m.confidence for m in matches), default=0.0)

            result = RecognitionResult(
                image_id=image_id,
                status="completed",
                matches=matches,
                processing_time_ms=processing_time,
                model_used=self.MODEL if not self.demo_mode else "demo",
                context_description=parsed.get("scene_description"),
                low_confidence_warning=max_confidence < HIGH_CONFIDENCE_THRESHOLD and len(matches) > 0,
            )

            logger.info(
                "product_recognition_complete",
                image_id=image_id,
                match_count=len(matches),
                max_confidence=max_confidence,
                processing_time_ms=processing_time,
            )

            return result

        except Exception as e:
            processing_time = int(time.time() * 1000) - start_ms
            logger.error("product_recognition_failed", image_id=image_id, error=str(e))
            return RecognitionResult(
                image_id=image_id,
                status="failed",
                matches=[],
                processing_time_ms=processing_time,
                error=str(e),
            )

    async def match_to_catalog(
        self,
        matches: list[ProductMatch],
        db_products: list[dict[str, Any]],
    ) -> list[ProductMatch]:
        """
        Match AI-identified products to actual catalog products.

        Uses fuzzy matching on product names and SKU hints.
        Updates matched_to_catalog=True and sets product_id.

        Args:
            matches: Raw AI matches
            db_products: Product catalog [{id, sku, name, category}]
        """
        for match in matches:
            best_catalog_match = None
            best_score = 0.0

            match_name_lower = match.product_name.lower()
            match_sku_lower = (match.sku or "").lower()

            for product in db_products:
                score = 0.0
                prod_name_lower = product.get("name", "").lower()
                prod_sku_lower = product.get("sku", "").lower()

                # SKU hint match (highest priority)
                if match_sku_lower and match_sku_lower in prod_sku_lower:
                    score = 0.95

                # Name word overlap scoring
                else:
                    match_words = set(match_name_lower.split())
                    prod_words = set(prod_name_lower.split())
                    if match_words and prod_words:
                        overlap = len(match_words & prod_words)
                        score = overlap / max(len(match_words), len(prod_words))

                if score > best_score and score > 0.4:
                    best_score = score
                    best_catalog_match = product

            if best_catalog_match:
                match.product_id = str(best_catalog_match["id"])
                match.sku = best_catalog_match.get("sku")
                match.matched_to_catalog = True
                # Blend AI confidence with catalog match score
                match.confidence = min(match.confidence, best_score * 0.9 + 0.1)

        return matches


# ---------------------------------------------------------------------------
# Singleton factory
# ---------------------------------------------------------------------------

_recognition_service: ProductRecognitionService | None = None


def get_recognition_service() -> ProductRecognitionService:
    global _recognition_service
    if _recognition_service is None:
        _recognition_service = ProductRecognitionService()
    return _recognition_service
