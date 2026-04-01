"""
Document Parser Agent.

Parses emails and documents to extract structured order data using NLP
and pattern matching.
"""

import re
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent
from src.ai.ollama_client import OllamaClient
from src.db.demo_models import Customer, Product

logger = structlog.get_logger(__name__)


class DocumentParserAgent(BaseAgent):
    """
    Parses emails and documents to extract structured order data.

    Uses NLP and pattern matching to extract customer info, products,
    quantities, and pricing from unstructured text and PDF documents.
    """

    def __init__(self):
        """Initialize the document parser agent."""
        super().__init__(
            name="DocumentParserAgent",
            auto_register=True
        )
        self.capabilities = [
            "document_parsing",
            "email_parsing",
            "pdf_parsing",
            "nlp_extraction",
            "product_matching",
        ]
        self.description = "Parses emails and documents to extract structured order data"
        self.requires_verification = True  # Requires user review
        self.estimated_execution_time = 5  # seconds

        # Initialize Ollama client for NLP
        self.ollama = OllamaClient()

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Parse document and extract structured data.

        Args:
            task: Task description
            context: Additional context with keys:
                - document_type: "email", "pdf_quote", "pdf_invoice"
                - content: Email text or PDF text content
                - sender_email: Optional sender email (for customer lookup)

        Returns:
            Dictionary with:
            - extracted_data: {customer, products, delivery, notes}
            - confidence: Float 0-1
            - unmatched_items: Products not found in catalog
            - validation_errors: Issues found
            - error: Error message if any
        """
        self._log_execution_start(task, context)

        if not context:
            return {"error": "Context required for document parsing"}

        document_type = context.get("document_type")
        content = context.get("content")

        if not document_type or not content:
            return {"error": "document_type and content required"}

        try:
            async with self.get_db_session() as db:
                if document_type == "email":
                    result = await self._parse_email_order(db, context)
                elif document_type in ["pdf_quote", "pdf_invoice"]:
                    result = await self._parse_pdf_document(db, context)
                else:
                    return {"error": f"Unknown document_type: {document_type}"}

                self._log_execution_complete(True)
                return result

        except Exception as e:
            logger.error("Document parsing failed", error=str(e), context=context)
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        """Not implemented for this agent."""
        yield "Document parsing does not support streaming"

    async def _parse_email_order(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Parse email text to extract order information.

        Args:
            db: Database session
            context: Context with content, sender_email

        Returns:
            Extracted order data
        """
        content = context.get("content", "")
        sender_email = context.get("sender_email")

        # Step 1: Identify customer by email
        customer = None
        if sender_email:
            customer_query = select(Customer).where(
                func.lower(Customer.email) == sender_email.lower()
            )
            customer_result = await db.execute(customer_query)
            customer = customer_result.scalar_one_or_none()

        # Step 2: Use LLM to extract structured data from email
        extraction_prompt = f"""
Extract order information from this email. Return JSON with:
- products: array of {{name, sku, quantity}}
- delivery_notes: any shipping/delivery instructions
- notes: other relevant information

Email content:
{content}

Return ONLY valid JSON, no other text.
"""

        try:
            llm_response = await self.ollama.generate(
                prompt=extraction_prompt,
                model="llama3.2:latest",
                temperature=0.1,  # Low temperature for consistent extraction
            )

            # Parse LLM response (assuming it returns JSON)
            import json
            extracted = json.loads(llm_response)

        except Exception as e:
            logger.warning("LLM extraction failed, using fallback", error=str(e))
            # Fallback to pattern matching
            extracted = await self._fallback_pattern_extraction(content)

        # Step 3: Match products against catalog
        products = extracted.get("products", [])
        matched_products = []
        unmatched_items = []

        for item in products:
            product_name = item.get("name", "")
            sku = item.get("sku", "")
            quantity = item.get("quantity", 1)

            matched = await self._match_product(db, product_name, sku)

            if matched:
                matched_products.append({
                    "product_id": str(matched.id),
                    "sku": matched.sku,
                    "name": matched.name,
                    "quantity": quantity,
                    "unit_price": float(matched.price),
                    "confidence": 0.85 if sku else 0.70,  # Higher confidence if SKU matched
                })
            else:
                unmatched_items.append({
                    "name": product_name,
                    "sku": sku,
                    "quantity": quantity,
                })

        # Calculate overall confidence
        total_items = len(products)
        matched_items = len(matched_products)
        confidence = matched_items / total_items if total_items > 0 else 0.0

        # Build result
        extracted_data = {
            "customer": {
                "id": str(customer.id) if customer else None,
                "email": sender_email,
                "name": customer.company_name if customer else None,
            },
            "products": matched_products,
            "delivery_notes": extracted.get("delivery_notes", ""),
            "notes": extracted.get("notes", ""),
        }

        validation_errors = []
        if not customer:
            validation_errors.append("Customer not found by email - manual selection required")
        if len(unmatched_items) > 0:
            validation_errors.append(f"{len(unmatched_items)} products could not be matched to catalog")

        return {
            "extracted_data": extracted_data,
            "confidence": confidence,
            "unmatched_items": unmatched_items,
            "validation_errors": validation_errors,
        }

    async def _parse_pdf_document(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Parse PDF document (quote/invoice) to extract data.

        Note: Full OCR requires external libraries (pytesseract, pdf2image).
        This is a simplified implementation assuming text is already extracted.

        Args:
            db: Database session
            context: Context with content (extracted text from PDF)

        Returns:
            Extracted document data
        """
        content = context.get("content", "")

        # Use similar LLM extraction as email
        extraction_prompt = f"""
Extract order/quote information from this document. Return JSON with:
- supplier_name: name of supplier/vendor (if present)
- products: array of {{name, sku, quantity, price}}
- total_amount: total amount (if present)
- notes: payment terms, delivery terms, other notes

Document content:
{content}

Return ONLY valid JSON, no other text.
"""

        try:
            llm_response = await self.ollama.generate(
                prompt=extraction_prompt,
                model="llama3.2:latest",
                temperature=0.1,
            )

            import json
            extracted = json.loads(llm_response)

        except Exception as e:
            logger.warning("PDF extraction failed", error=str(e))
            extracted = {
                "products": [],
                "notes": "Failed to extract - manual entry required",
            }

        # Match products
        products = extracted.get("products", [])
        matched_products = []
        unmatched_items = []

        for item in products:
            product_name = item.get("name", "")
            sku = item.get("sku", "")
            quantity = item.get("quantity", 1)
            price = item.get("price")

            matched = await self._match_product(db, product_name, sku)

            if matched:
                matched_products.append({
                    "product_id": str(matched.id),
                    "sku": matched.sku,
                    "name": matched.name,
                    "quantity": quantity,
                    "unit_price": price if price else float(matched.price),
                    "confidence": 0.80,
                })
            else:
                unmatched_items.append({
                    "name": product_name,
                    "sku": sku,
                    "quantity": quantity,
                    "price": price,
                })

        confidence = len(matched_products) / len(products) if len(products) > 0 else 0.0

        extracted_data = {
            "supplier_name": extracted.get("supplier_name"),
            "products": matched_products,
            "total_amount": extracted.get("total_amount"),
            "notes": extracted.get("notes", ""),
        }

        validation_errors = []
        if len(unmatched_items) > 0:
            validation_errors.append(f"{len(unmatched_items)} products could not be matched")

        return {
            "extracted_data": extracted_data,
            "confidence": confidence,
            "unmatched_items": unmatched_items,
            "validation_errors": validation_errors,
        }

    async def _fallback_pattern_extraction(self, content: str) -> dict[str, Any]:
        """
        Fallback pattern-based extraction when LLM fails.

        Looks for common patterns like:
        - "50x SKU-001" or "50 × SKU-001"
        - "Qty: 50, Product: Widget"
        """
        products = []

        # Pattern 1: "50x SKU-001" or "50 × SKU-001"
        pattern1 = r"(\d+)\s*[xX×]\s*([A-Z0-9\-]+)"
        matches1 = re.findall(pattern1, content)
        for qty, sku in matches1:
            products.append({
                "quantity": int(qty),
                "sku": sku,
                "name": sku,  # Use SKU as name fallback
            })

        # Pattern 2: "SKU-001 (50 units)" or "SKU-001: 50"
        pattern2 = r"([A-Z0-9\-]+)\s*[:\(]\s*(\d+)"
        matches2 = re.findall(pattern2, content)
        for sku, qty in matches2:
            # Avoid duplicates
            if not any(p.get("sku") == sku for p in products):
                products.append({
                    "quantity": int(qty),
                    "sku": sku,
                    "name": sku,
                })

        return {
            "products": products,
            "delivery_notes": "",
            "notes": "Extracted using pattern matching (fallback)",
        }

    async def _match_product(
        self,
        db: AsyncSession,
        product_name: str,
        sku: str | None = None
    ) -> Product | None:
        """
        Match product description/SKU to catalog product.

        Uses fuzzy matching on SKU and name.

        Args:
            db: Database session
            product_name: Product description
            sku: Optional SKU

        Returns:
            Matched Product or None
        """
        # Try exact SKU match first (highest confidence)
        if sku:
            sku_query = select(Product).where(
                func.upper(Product.sku) == sku.upper()
            )
            sku_result = await db.execute(sku_query)
            matched = sku_result.scalar_one_or_none()
            if matched:
                return matched

        # Try fuzzy name match (contains)
        if product_name:
            name_query = select(Product).where(
                func.lower(Product.name).like(f"%{product_name.lower()}%")
            ).limit(1)
            name_result = await db.execute(name_query)
            matched = name_result.scalar_one_or_none()
            if matched:
                return matched

        # No match found
        return None
