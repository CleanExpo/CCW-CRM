"""
Form Auto-Fill Agent.

Provides context-aware form auto-fill suggestions based on customer history,
order patterns, and common workflows to reduce manual data entry.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent
from src.db.demo_models import Customer, Order, OrderItem, Product, PurchaseOrder

logger = structlog.get_logger(__name__)


class FormAutoFillAgent(BaseAgent):
    """
    Provides context-aware form auto-fill suggestions.

    Analyzes customer history, order patterns, and common workflows
    to pre-populate form fields and reduce manual data entry.
    """

    def __init__(self):
        """Initialize the form auto-fill agent."""
        super().__init__(
            name="FormAutoFillAgent",
            auto_register=True
        )
        self.capabilities = ["form_autofill", "customer_history", "pattern_detection", "duplicate_detection"]
        self.description = "Provides intelligent form auto-fill suggestions based on historical data"
        self.requires_verification = False
        self.estimated_execution_time = 2  # seconds

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Generate auto-fill suggestions based on context.

        Args:
            task: Task description
            context: Additional context with keys:
                - form_type: "order", "quote", "purchase_order", "customer"
                - customer_id: UUID of customer (optional)
                - supplier_id: UUID of supplier (optional for POs)
                - limit: Number of suggestions (default: 5)

        Returns:
            Dictionary with:
            - suggestions: Dict of field names → suggested values
            - confidence: Dict of field names → confidence scores (0-1)
            - source: Dict of field names → data source descriptions
            - error: Error message if any
        """
        self._log_execution_start(task, context)

        if not context:
            return {"error": "Context required for form auto-fill"}

        form_type = context.get("form_type")
        if not form_type:
            return {"error": "form_type required in context"}

        try:
            async with self.get_db_session() as db:
                if form_type == "order":
                    result = await self._autofill_order_form(db, context)
                elif form_type == "quote":
                    result = await self._autofill_quote_form(db, context)
                elif form_type == "purchase_order":
                    result = await self._autofill_purchase_order_form(db, context)
                elif form_type == "customer":
                    result = await self._check_duplicate_customer(db, context)
                else:
                    return {"error": f"Unknown form_type: {form_type}"}

                self._log_execution_complete(True)
                return result

        except Exception as e:
            logger.error("Form auto-fill failed", error=str(e), context=context)
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        """Not implemented for this agent."""
        yield "Form auto-fill does not support streaming"

    async def _autofill_order_form(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Generate auto-fill suggestions for order form.

        Args:
            db: Database session
            context: Context with customer_id, limit

        Returns:
            Auto-fill suggestions for order form
        """
        customer_id = context.get("customer_id")
        if not customer_id:
            return {
                "suggestions": {},
                "confidence": {},
                "source": {},
                "message": "No customer selected - select customer for suggestions"
            }

        try:
            customer_uuid = UUID(customer_id)
        except (ValueError, TypeError):
            return {"error": "Invalid customer_id format"}

        # Get customer details
        customer_query = select(Customer).where(Customer.id == customer_uuid)
        customer_result = await db.execute(customer_query)
        customer = customer_result.scalar_one_or_none()

        if not customer:
            return {"error": "Customer not found"}

        # Get last 3 orders for this customer
        orders_query = (
            select(Order)
            .where(Order.customer_id == customer_uuid)
            .order_by(desc(Order.order_date))
            .limit(3)
        )
        orders_result = await db.execute(orders_query)
        recent_orders = orders_result.scalars().all()

        suggestions = {}
        confidence = {}
        source = {}

        # Suggest shipping address from customer default
        if customer.address:
            suggestions["shipping_address"] = {
                "address": customer.address,
                "city": customer.city,
                "state": customer.state,
                "postal_code": customer.postal_code,
                "country": customer.country or "Australia"
            }
            confidence["shipping_address"] = 0.95
            source["shipping_address"] = "customer_default"

        # Suggest products from recent orders
        if recent_orders:
            # Get all order items from recent orders
            order_ids = [order.id for order in recent_orders]
            items_query = (
                select(OrderItem, Product)
                .join(Product, OrderItem.product_id == Product.id)
                .where(OrderItem.order_id.in_(order_ids))
            )
            items_result = await db.execute(items_query)
            order_items = items_result.all()

            # Count product frequency
            product_freq: dict[UUID, dict] = {}
            for item, product in order_items:
                if product.id not in product_freq:
                    product_freq[product.id] = {
                        "product_id": str(product.id),
                        "sku": product.sku,
                        "name": product.name,
                        "price": float(product.price),
                        "count": 0,
                        "total_quantity": 0,
                        "avg_quantity": 0
                    }
                product_freq[product.id]["count"] += 1
                product_freq[product.id]["total_quantity"] += item.quantity

            # Calculate average quantities and sort by frequency
            for prod_id in product_freq:
                count = product_freq[prod_id]["count"]
                product_freq[prod_id]["avg_quantity"] = product_freq[prod_id]["total_quantity"] // count

            # Get top 10 most frequent products
            top_products = sorted(
                product_freq.values(),
                key=lambda x: x["count"],
                reverse=True
            )[:10]

            suggestions["products"] = top_products

            # Confidence based on how recent and frequent
            if len(recent_orders) >= 3:
                confidence["products"] = 0.85
                source["products"] = f"pattern_last_{len(recent_orders)}_orders"
            elif len(recent_orders) == 2:
                confidence["products"] = 0.75
                source["products"] = "pattern_last_2_orders"
            else:
                confidence["products"] = 0.65
                source["products"] = "last_order"

            # Suggest notes from last order if present
            last_order = recent_orders[0]
            if last_order.notes:
                suggestions["notes"] = last_order.notes
                confidence["notes"] = 0.60
                source["notes"] = "last_order_notes"

        return {
            "suggestions": suggestions,
            "confidence": confidence,
            "source": source
        }

    async def _autofill_quote_form(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Generate auto-fill suggestions for quote form.

        Similar to order form but includes quote-specific fields.
        """
        # Reuse order form logic since quotes are similar to orders
        result = await self._autofill_order_form(db, context)

        # Add quote-specific suggestions
        if result.get("suggestions"):
            # Default valid_until to 30 days from now
            result["suggestions"]["valid_until"] = (
                datetime.now(UTC) + timedelta(days=30)
            ).strftime("%Y-%m-%d")
            result["confidence"]["valid_until"] = 0.90
            result["source"]["valid_until"] = "standard_30_day_validity"

        return result

    async def _autofill_purchase_order_form(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Generate auto-fill suggestions for purchase order form.

        Args:
            db: Database session
            context: Context with supplier_id

        Returns:
            Auto-fill suggestions for PO form
        """
        supplier_id = context.get("supplier_id")
        if not supplier_id:
            return {
                "suggestions": {},
                "confidence": {},
                "source": {},
                "message": "No supplier selected - select supplier for suggestions"
            }

        try:
            supplier_uuid = UUID(supplier_id)
        except (ValueError, TypeError):
            return {"error": "Invalid supplier_id format"}

        # Get last 3 POs for this supplier
        pos_query = (
            select(PurchaseOrder)
            .where(PurchaseOrder.supplier_id == supplier_uuid)
            .order_by(desc(PurchaseOrder.order_date))
            .limit(3)
        )
        pos_result = await db.execute(pos_query)
        recent_pos = pos_result.scalars().all()

        suggestions = {}
        confidence = {}
        source = {}

        if recent_pos:
            last_po = recent_pos[0]

            # Suggest delivery terms from last PO
            if last_po.notes:
                suggestions["notes"] = last_po.notes
                confidence["notes"] = 0.70
                source["notes"] = "last_po_notes"

            # Expected delivery date based on typical lead time
            # (Could enhance with historical lead time analysis)
            suggestions["expected_delivery"] = (
                datetime.now(UTC) + timedelta(days=14)
            ).strftime("%Y-%m-%d")
            confidence["expected_delivery"] = 0.75
            source["expected_delivery"] = "standard_14_day_lead_time"

        return {
            "suggestions": suggestions,
            "confidence": confidence,
            "source": source
        }

    async def _check_duplicate_customer(
        self,
        db: AsyncSession,
        context: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Check for potential duplicate customers.

        Args:
            db: Database session
            context: Context with email, name, phone

        Returns:
            Potential duplicate customers
        """
        email = context.get("email", "").strip().lower()
        name = context.get("name", "").strip()
        phone = context.get("phone", "").strip()

        if not email and not name:
            return {
                "duplicates": [],
                "message": "Provide email or name to check for duplicates"
            }

        # Build query to find similar customers
        conditions = []

        if email:
            conditions.append(func.lower(Customer.email) == email)

        if name:
            # Fuzzy match on company_name or contact_name
            name_lower = name.lower()
            conditions.append(
                or_(
                    func.lower(Customer.company_name).like(f"%{name_lower}%"),
                    func.lower(Customer.contact_name).like(f"%{name_lower}%")
                )
            )

        if phone:
            # Remove formatting for comparison
            phone_clean = phone.replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
            conditions.append(
                func.replace(
                    func.replace(Customer.phone, "-", ""),
                    " ",
                    ""
                ).like(f"%{phone_clean}%")
            )

        if not conditions:
            return {"duplicates": []}

        # Find potential duplicates
        query = select(Customer).where(or_(*conditions)).limit(5)
        result = await db.execute(query)
        potential_duplicates = result.scalars().all()

        duplicates = [
            {
                "id": str(customer.id),
                "customer_number": customer.customer_number,
                "company_name": customer.company_name,
                "contact_name": customer.contact_name,
                "email": customer.email,
                "phone": customer.phone,
                "match_reason": self._get_match_reason(customer, email, name, phone)
            }
            for customer in potential_duplicates
        ]

        return {
            "duplicates": duplicates,
            "confidence": 0.85 if duplicates else 0.0,
            "message": f"Found {len(duplicates)} potential duplicate(s)" if duplicates else "No duplicates found"
        }

    def _get_match_reason(
        self,
        customer: Customer,
        email: str,
        name: str,
        phone: str
    ) -> str:
        """Determine why customer matched as potential duplicate."""
        reasons = []

        if email and customer.email and customer.email.lower() == email.lower():
            reasons.append("email")

        if name:
            name_lower = name.lower()
            if customer.company_name and name_lower in customer.company_name.lower():
                reasons.append("company_name")
            if customer.contact_name and name_lower in customer.contact_name.lower():
                reasons.append("contact_name")

        if phone and customer.phone and phone.replace("-", "").replace(" ", "") in customer.phone.replace("-", "").replace(" ", ""):
            reasons.append("phone")

        return ", ".join(reasons) if reasons else "unknown"
