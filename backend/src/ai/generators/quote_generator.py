"""Quote generator for creating quotes from natural language requirements."""

import re
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Product, ProductCategory
from src.utils import get_logger

from ..ollama_client import get_ollama_client

logger = get_logger(__name__)


class QuoteGenerator:
    """Generator for creating quotes from natural language."""

    def __init__(self):
        self.ollama = get_ollama_client()

    async def parse_requirements(
        self, requirements: str, db: AsyncSession
    ) -> dict[str, Any]:
        """Parse natural language requirements into structured data.

        Args:
            requirements: Natural language description
            db: Database session

        Returns:
            Parsed requirements with products, quantities, customer info
        """
        system_prompt = """You are a quote requirements parser. Extract structured information from natural language.

Extract:
1. Product keywords/descriptions
2. Quantities (if specified)
3. Customer information (company name, contact)
4. Special requirements or notes

Format output as JSON:
{
  "products": [{"description": "...", "quantity": 1, "category": "..."}],
  "customer_info": {"company": "...", "contact": "..."},
  "notes": "...",
  "special_requirements": "..."
}"""  # noqa: E501

        user_prompt = f"""Parse this quote request:

{requirements}

Extract products, quantities, customer info, and any special requirements."""

        try:
            response = await self.ollama.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
            )

            # Try to parse JSON from response
            parsed = self._extract_json(response)

            if not parsed:
                # Fallback: basic keyword extraction
                parsed = self._fallback_parse(requirements)

            logger.info("Parsed requirements", product_count=len(parsed.get("products", [])))
            return parsed

        except Exception as e:
            logger.error("Error parsing requirements", error=str(e))
            return self._fallback_parse(requirements)

    def _extract_json(self, text: str) -> dict[str, Any] | None:
        """Extract JSON from text response."""
        import json

        # Try to find JSON in response
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        return None

    def _fallback_parse(self, requirements: str) -> dict[str, Any]:
        """Fallback parsing using simple keyword extraction."""
        # Extract numbers (likely quantities)
        quantities = re.findall(r"\b(\d+)\b", requirements)

        # Extract product keywords
        product_keywords = []
        for word in requirements.split():
            if len(word) > 3 and word.lower() not in [
                "need",
                "want",
                "quote",
                "for",
                "company",
                "customer",
            ]:
                product_keywords.append(word)

        return {
            "products": [
                {
                    "description": " ".join(product_keywords[:5]),
                    "quantity": int(quantities[0]) if quantities else 1,
                    "category": None,
                }
            ],
            "customer_info": {},
            "notes": requirements,
            "special_requirements": "",
        }

    async def find_products(
        self, parsed_requirements: dict[str, Any], db: AsyncSession
    ) -> list[dict[str, Any]]:
        """Find matching products in database.

        Args:
            parsed_requirements: Parsed requirements from parse_requirements
            db: Database session

        Returns:
            List of matching products with quantities
        """
        products_requested = parsed_requirements.get("products", [])
        matched_products = []

        for product_req in products_requested:
            description = product_req.get("description", "")
            quantity = product_req.get("quantity", 1)
            category = product_req.get("category")

            # Search for products
            query = select(Product).where(Product.is_active == True)  # noqa: E712

            # Add search filters
            if description:
                search_terms = description.split()
                conditions = []
                for term in search_terms:
                    conditions.append(Product.name.ilike(f"%{term}%"))
                    conditions.append(Product.description.ilike(f"%{term}%"))
                query = query.where(or_(*conditions))

            # Filter by category if specified
            if category:
                try:
                    cat_enum = ProductCategory(category.lower().replace(" ", "_"))
                    query = query.where(Product.category == cat_enum)
                except ValueError:
                    pass

            # Execute query
            result = await db.execute(query.limit(5))
            products = result.scalars().all()

            if products:
                # Take best match (first result)
                product = products[0]
                matched_products.append(
                    {
                        "product_id": str(product.id),
                        "sku": product.sku,
                        "name": product.name,
                        "description": product.description,
                        "category": product.category.value,
                        "unit_price": float(product.price),
                        "quantity": quantity,
                        "line_total": float(product.price * quantity),
                        "stock_available": product.stock,
                    }
                )
                logger.info(
                    "Matched product",
                    search=description,
                    matched=product.name,
                )
            else:
                logger.warning("No product match found", search=description)

        return matched_products

    async def calculate_pricing(
        self, matched_products: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Calculate pricing and totals.

        Args:
            matched_products: List of matched products with quantities

        Returns:
            Pricing calculations
        """
        subtotal = sum(p["line_total"] for p in matched_products)
        tax_rate = Decimal("0.10")  # 10% tax
        tax = float(Decimal(str(subtotal)) * tax_rate)
        total = subtotal + tax

        return {
            "subtotal": subtotal,
            "tax": tax,
            "tax_rate": float(tax_rate),
            "total": total,
            "currency": "AUD",
        }

    async def generate_quote_data(
        self,
        requirements: str,
        customer_id: str | None,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Generate complete quote data from requirements.

        Args:
            requirements: Natural language requirements
            customer_id: Optional customer ID
            db: Database session

        Returns:
            Complete quote data ready for creation
        """
        # Parse requirements
        parsed = await self.parse_requirements(requirements, db)

        # Find customer if specified
        customer = None
        if customer_id:
            result = await db.execute(
                select(Customer).where(Customer.id == UUID(customer_id))
            )
            customer = result.scalar_one_or_none()
        elif parsed.get("customer_info", {}).get("company"):
            # Try to find customer by company name
            company = parsed["customer_info"]["company"]
            result = await db.execute(
                select(Customer).where(Customer.company_name.ilike(f"%{company}%"))
            )
            customer = result.scalar_one_or_none()

        # Find matching products
        matched_products = await self.find_products(parsed, db)

        if not matched_products:
            return {
                "error": "No matching products found",
                "parsed_requirements": parsed,
            }

        # Calculate pricing
        pricing = await self.calculate_pricing(matched_products)

        # Generate quote number
        quote_number = f"Q-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"

        # Build quote data
        quote_data = {
            "quote_number": quote_number,
            "customer_id": str(customer.id) if customer else None,
            "customer": {
                "id": str(customer.id) if customer else None,
                "company_name": customer.company_name if customer else parsed.get("customer_info", {}).get("company"),  # noqa: E501
                "contact_name": customer.contact_name if customer else parsed.get("customer_info", {}).get("contact"),  # noqa: E501
                "email": customer.email if customer else None,
            },
            "items": matched_products,
            "subtotal": pricing["subtotal"],
            "tax": pricing["tax"],
            "tax_rate": pricing["tax_rate"],
            "total": pricing["total"],
            "currency": pricing["currency"],
            "notes": parsed.get("notes", ""),
            "special_requirements": parsed.get("special_requirements", ""),
            "valid_until": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
            "quote_date": datetime.now(UTC).isoformat(),
        }

        logger.info(
            "Generated quote",
            quote_number=quote_number,
            items=len(matched_products),
            total=pricing["total"],
        )

        return quote_data

    async def generate_quote_description(
        self, quote_data: dict[str, Any]
    ) -> str:
        """Generate a human-readable quote description.

        Args:
            quote_data: Quote data from generate_quote_data

        Returns:
            Formatted quote description
        """
        system_prompt = """You are a professional quote writer. Generate a clear, professional quote description.

Include:
- Brief introduction
- List of items with quantities
- Pricing summary
- Valid until date
- Professional closing"""  # noqa: E501

        items_text = "\n".join(
            [
                f"- {item['name']}: {item['quantity']} x ${item['unit_price']:.2f} = ${item['line_total']:.2f}"  # noqa: E501
                for item in quote_data["items"]
            ]
        )

        user_prompt = f"""Generate a professional quote description for:

Customer: {quote_data['customer'].get('company_name', 'Valued Customer')}
Quote Number: {quote_data['quote_number']}

Items:
{items_text}

Subtotal: ${quote_data['subtotal']:.2f}
Tax: ${quote_data['tax']:.2f}
Total: ${quote_data['total']:.2f}

Valid Until: {quote_data['valid_until'][:10]}

{f"Special Requirements: {quote_data['special_requirements']}" if quote_data.get('special_requirements') else ''}"""  # noqa: E501

        try:
            response = await self.ollama.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
            )
            return response.strip()
        except Exception as e:
            logger.error("Error generating description", error=str(e))
            # Fallback to simple description
            return f"Quote for {quote_data['customer'].get('company_name', 'Customer')}: {len(quote_data['items'])} items totaling ${quote_data['total']:.2f}"  # noqa: E501
