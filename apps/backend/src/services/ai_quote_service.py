"""
AI Quote Generation Service.

Uses Claude Sonnet 4.5 to generate quotes from natural language prompts.
Implements prompt caching for cost optimization (40-60% reduction).
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Any
from uuid import UUID

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings

settings = get_settings()
from src.db.demo_models import Product, Customer, ProductCategory


class ProductMatch(BaseModel):
    """Product match with confidence score."""

    product_id: str
    sku: str
    name: str
    category: str
    quantity: int
    unit_price: str
    line_total: str
    confidence: float = Field(ge=0.0, le=1.0, description="Match confidence 0-1")
    alternatives: list[dict[str, Any]] = Field(default_factory=list)


class CustomerMatch(BaseModel):
    """Customer match with confidence score."""

    customer_id: str | None
    customer_number: str | None
    company_name: str
    contact_name: str | None
    email: str | None
    confidence: float = Field(ge=0.0, le=1.0, description="Match confidence 0-1")
    is_new_customer: bool = False


class QuoteGenerationResult(BaseModel):
    """Result from AI quote generation."""

    customer: CustomerMatch
    line_items: list[ProductMatch]
    notes: str | None
    discount_percentage: float = 0.0
    subtotal: str
    discount_amount: str
    total: str
    valid_until: datetime
    confidence_score: float = Field(ge=0.0, le=1.0, description="Overall confidence")
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class AIQuoteService:
    """AI-powered quote generation service using Claude Sonnet 4.5."""

    def __init__(self, db: AsyncSession):
        """Initialize AI Quote Service."""
        self.db = db
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-5-20250929"
        self.max_tokens = 2000
        self.temperature = 0.3  # Lower temperature for consistency

    async def generate_quote(self, prompt: str, user_context: dict | None = None) -> QuoteGenerationResult:
        """
        Generate quote from natural language prompt.

        Args:
            prompt: Natural language description of quote
            user_context: Optional context (current user, organization, etc.)

        Returns:
            QuoteGenerationResult with parsed data and confidence scores

        Raises:
            ValueError: If prompt is invalid or API key is missing
            RuntimeError: If AI generation fails
        """
        if not settings.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY not configured. Please set the environment variable."
            )

        if not prompt or len(prompt.strip()) < 10:
            raise ValueError("Prompt must be at least 10 characters")

        # Get product catalog for context (with caching)
        products_context = await self._get_products_catalog()

        # Get customer list for matching
        customers_context = await self._get_customers_list()

        # Build system prompt with static content (cacheable)
        system_prompt = self._build_system_prompt(products_context, customers_context)

        # Call Claude API with prompt caching
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},  # Cache static content
                    }
                ],
                messages=[
                    {
                        "role": "user",
                        "content": f"""Parse this quote request into structured data:

Prompt: {prompt}

User Context: {user_context or {}}

Return a JSON object with this exact structure:
{{
  "customer": {{
    "company_name": "string",
    "contact_name": "string or null",
    "email": "string or null",
    "customer_id": "uuid or null (if existing customer matched)",
    "confidence": 0.0-1.0,
    "is_new_customer": boolean
  }},
  "line_items": [
    {{
      "product_id": "uuid",
      "sku": "string",
      "name": "string",
      "category": "string",
      "quantity": integer,
      "unit_price": "decimal string",
      "line_total": "decimal string",
      "confidence": 0.0-1.0,
      "alternatives": [list of alternative products if confidence < 0.8]
    }}
  ],
  "notes": "string or null",
  "discount_percentage": 0.0-100.0,
  "warnings": ["list of warnings about stock, pricing, etc."],
  "suggestions": ["list of suggestions for bulk discounts, bundles, etc."]
}}

IMPORTANT:
- Match products by name, SKU, or description similarity
- Match customers by company name or contact name
- Calculate line_total = quantity * unit_price
- Apply discount to subtotal if mentioned
- Include confidence scores for all matches
- Suggest alternatives if confidence < 0.8
- Warn if quantity exceeds available stock
- Suggest bulk discounts for large quantities (>10 units)
""",
                    }
                ],
            )

            # Parse AI response
            ai_text = response.content[0].text

            # Extract JSON from response (handle markdown code blocks)
            import json
            import re

            json_match = re.search(r"```json\s*(\{.*?\})\s*```", ai_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON object directly
                json_match = re.search(r"\{.*\}", ai_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    raise RuntimeError(f"Failed to extract JSON from AI response: {ai_text}")

            parsed_data = json.loads(json_str)

            # Validate and enrich data
            result = await self._validate_and_enrich(parsed_data)

            return result

        except Exception as e:
            raise RuntimeError(f"AI quote generation failed: {str(e)}") from e

    async def parse_prompt_preview(self, prompt: str) -> dict[str, Any]:
        """
        Parse prompt without saving (for preview/validation).

        Returns simplified structure for quick feedback.
        """
        try:
            result = await self.generate_quote(prompt)
            return {
                "customer": result.customer.model_dump(),
                "line_items": [item.model_dump() for item in result.line_items],
                "total": result.total,
                "confidence": result.confidence_score,
                "warnings": result.warnings,
            }
        except Exception as e:
            return {"error": str(e), "confidence": 0.0}

    async def suggest_products(self, partial_query: str, limit: int = 5) -> list[dict[str, Any]]:
        """Suggest products based on partial query."""
        query = select(Product).where(
            or_(
                Product.name.ilike(f"%{partial_query}%"),
                Product.sku.ilike(f"%{partial_query}%"),
                Product.description.ilike(f"%{partial_query}%"),
            ),
            Product.is_active == True,  # noqa: E712
        ).limit(limit)

        result = await self.db.execute(query)
        products = result.scalars().all()

        return [
            {
                "id": str(product.id),
                "sku": product.sku,
                "name": product.name,
                "category": product.category,
                "price": str(product.price),
                "stock": product.stock,
            }
            for product in products
        ]

    async def suggest_customers(self, partial_query: str, limit: int = 5) -> list[dict[str, Any]]:
        """Suggest customers based on partial query."""
        query = select(Customer).where(
            or_(
                Customer.company_name.ilike(f"%{partial_query}%"),
                Customer.contact_name.ilike(f"%{partial_query}%"),
                Customer.email.ilike(f"%{partial_query}%"),
            ),
            Customer.is_active == True,  # noqa: E712
        ).limit(limit)

        result = await self.db.execute(query)
        customers = result.scalars().all()

        return [
            {
                "id": str(customer.id),
                "customer_number": customer.customer_number,
                "company_name": customer.company_name,
                "contact_name": customer.contact_name,
                "email": customer.email,
            }
            for customer in customers
        ]

    # Private methods

    async def _get_products_catalog(self) -> str:
        """Get product catalog for AI context (cached)."""
        query = select(Product).where(Product.is_active == True).limit(100)  # noqa: E712
        result = await self.db.execute(query)
        products = result.scalars().all()

        catalog_text = "PRODUCT CATALOG:\n\n"
        for product in products:
            catalog_text += (
                f"- SKU: {product.sku}\n"
                f"  Name: {product.name}\n"
                f"  Category: {product.category}\n"
                f"  Price: ${product.price}\n"
                f"  Stock: {product.stock} units\n"
                f"  Description: {product.description or 'N/A'}\n\n"
            )

        return catalog_text

    async def _get_customers_list(self) -> str:
        """Get customer list for AI context."""
        query = select(Customer).where(Customer.is_active == True).limit(50)  # noqa: E712
        result = await self.db.execute(query)
        customers = result.scalars().all()

        customers_text = "CUSTOMER DATABASE:\n\n"
        for customer in customers:
            customers_text += (
                f"- Customer #{customer.customer_number}\n"
                f"  Company: {customer.company_name}\n"
                f"  Contact: {customer.contact_name}\n"
                f"  Email: {customer.email}\n\n"
            )

        return customers_text

    def _build_system_prompt(self, products_context: str, customers_context: str) -> str:
        """Build system prompt with context (cacheable)."""
        return f"""You are an AI assistant for CCW Online ERP, a construction equipment supplier.
Your task is to parse natural language quote requests into structured data.

{products_context}

{customers_context}

PRICING RULES:
- List prices are shown in the catalog
- Bulk discounts: 5-10% for quantities > 10, 10-15% for quantities > 50, 15-20% for quantities > 100
- Standard quote validity: 30 days
- Tax (GST): 10% (will be added by system, don't include in calculations)

MATCHING GUIDELINES:
- Product matching: Use fuzzy matching on name, SKU, or description
- Customer matching: Match by company name or contact name
- Confidence scoring:
  - 1.0 = Exact match (SKU or customer number)
  - 0.8-0.99 = Strong match (name similarity > 80%)
  - 0.6-0.79 = Moderate match (name similarity 60-80%, needs review)
  - < 0.6 = Weak match (provide alternatives)

OUTPUT REQUIREMENTS:
- Always return valid JSON
- Include confidence scores for all matches
- Provide alternatives for low-confidence matches
- Warn about stock availability issues
- Suggest bulk discounts when applicable
- Calculate accurate totals (quantity × unit_price)
"""

    async def _validate_and_enrich(self, parsed_data: dict[str, Any]) -> QuoteGenerationResult:
        """Validate AI-parsed data and enrich with database checks."""
        warnings = list(parsed_data.get("warnings", []))
        suggestions = list(parsed_data.get("suggestions", []))

        # Validate customer
        customer_data = parsed_data.get("customer", {})
        if customer_data.get("customer_id"):
            # Verify customer exists
            query = select(Customer).where(Customer.id == UUID(customer_data["customer_id"]))
            result = await self.db.execute(query)
            existing_customer = result.scalar_one_or_none()

            if not existing_customer:
                warnings.append(f"Customer ID {customer_data['customer_id']} not found in database")
                customer_data["customer_id"] = None
                customer_data["confidence"] = max(0.0, customer_data.get("confidence", 0.8) - 0.3)

        # Validate products
        validated_items = []
        for item in parsed_data.get("line_items", []):
            # Verify product exists
            query = select(Product).where(Product.id == UUID(item["product_id"]))
            result = await self.db.execute(query)
            product = result.scalar_one_or_none()

            if not product:
                warnings.append(f"Product {item['name']} (SKU: {item['sku']}) not found")
                continue

            # Check stock
            if item["quantity"] > product.stock:
                warnings.append(
                    f"Requested quantity ({item['quantity']}) exceeds available stock "
                    f"({product.stock}) for {product.name}"
                )

            # Suggest bulk discount if not applied
            if item["quantity"] > 10 and parsed_data.get("discount_percentage", 0) == 0:
                suggestions.append(
                    f"Consider bulk discount for {product.name} (quantity: {item['quantity']})"
                )

            validated_items.append(item)

        if not validated_items:
            raise ValueError("No valid products found in quote request")

        # Calculate totals
        subtotal = sum(Decimal(item["line_total"]) for item in validated_items)
        discount_pct = Decimal(str(parsed_data.get("discount_percentage", 0))) / 100
        discount_amount = subtotal * discount_pct
        total = subtotal - discount_amount

        # Calculate overall confidence (average of all matches)
        confidences = [customer_data.get("confidence", 0.5)] + [
            item.get("confidence", 0.7) for item in validated_items
        ]
        overall_confidence = sum(confidences) / len(confidences)

        # Build result
        return QuoteGenerationResult(
            customer=CustomerMatch(**customer_data),
            line_items=[ProductMatch(**item) for item in validated_items],
            notes=parsed_data.get("notes"),
            discount_percentage=parsed_data.get("discount_percentage", 0.0),
            subtotal=str(subtotal),
            discount_amount=str(discount_amount),
            total=str(total),
            valid_until=datetime.now(UTC) + timedelta(days=settings.quote_validity_days),
            confidence_score=overall_confidence,
            warnings=warnings,
            suggestions=suggestions,
        )
