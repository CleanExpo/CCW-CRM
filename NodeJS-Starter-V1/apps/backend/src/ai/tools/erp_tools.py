"""ERP data access tools for AI agents."""

from typing import Any
from uuid import UUID

import structlog
from pydantic import Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.db.demo_models import Customer, Order, Product, Quote

from .base import BaseTool, ToolInput, ToolOutput

logger = structlog.get_logger(__name__)


class SearchProductsInput(ToolInput):
    """Input schema for SearchProductsTool."""

    query: str = Field(description="Search query for product name or SKU")
    category: str | None = Field(default=None, description="Filter by category")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum results to return")


class SearchProductsTool(BaseTool):
    """Tool for searching products in the ERP system."""

    def __init__(self):
        super().__init__(
            name="search_products",
            description="Search for products by name, SKU, or category. Returns product details including price, stock, and category.",
        )

    async def execute(self, query: str, category: str | None = None, limit: int = 10) -> ToolOutput:
        """
        Search products by name or SKU.

        Args:
            query: Search query string
            category: Optional category filter
            limit: Maximum number of results

        Returns:
            ToolOutput with list of matching products
        """
        try:
            async for db in get_db():
                # Build query
                stmt = select(Product).where(Product.is_active == True)

                # Apply search filter
                if query:
                    search_filter = f"%{query}%"
                    stmt = stmt.where(
                        or_(
                            Product.name.ilike(search_filter),
                            Product.sku.ilike(search_filter),
                            Product.description.ilike(search_filter),
                        )
                    )

                # Apply category filter
                if category:
                    stmt = stmt.where(Product.category == category)

                # Apply limit and execute
                stmt = stmt.limit(limit)
                result = await db.execute(stmt)
                products = result.scalars().all()

                # Format results
                product_data = [
                    {
                        "id": str(p.id),
                        "sku": p.sku,
                        "name": p.name,
                        "description": p.description,
                        "category": p.category,
                        "price": float(p.price),
                        "cost": float(p.cost) if p.cost else None,
                        "stock": p.stock,
                        "warehouse_location": p.warehouse_location,
                    }
                    for p in products
                ]

                logger.info(
                    "Products searched",
                    query=query,
                    category=category,
                    results_count=len(product_data),
                )

                return ToolOutput(
                    success=True,
                    data={
                        "products": product_data,
                        "count": len(product_data),
                        "query": query,
                    },
                )

        except Exception as e:
            logger.error("Product search failed", error=str(e), query=query)
            return ToolOutput(success=False, error=f"Product search failed: {str(e)}")


class SearchCustomersInput(ToolInput):
    """Input schema for SearchCustomersTool."""

    query: str = Field(description="Search query for customer name or company")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum results to return")


class SearchCustomersTool(BaseTool):
    """Tool for searching customers in the ERP system."""

    def __init__(self):
        super().__init__(
            name="search_customers",
            description="Search for customers by company name or customer number. Returns customer contact details and status.",
        )

    async def execute(self, query: str, limit: int = 10) -> ToolOutput:
        """
        Search customers by company name or customer number.

        Args:
            query: Search query string
            limit: Maximum number of results

        Returns:
            ToolOutput with list of matching customers
        """
        try:
            async for db in get_db():
                # Build query
                stmt = select(Customer).where(Customer.is_active == True)

                # Apply search filter
                if query:
                    search_filter = f"%{query}%"
                    stmt = stmt.where(
                        or_(
                            Customer.company_name.ilike(search_filter),
                            Customer.customer_number.ilike(search_filter),
                            Customer.contact_name.ilike(search_filter),
                        )
                    )

                # Apply limit and execute
                stmt = stmt.limit(limit)
                result = await db.execute(stmt)
                customers = result.scalars().all()

                # Format results
                customer_data = [
                    {
                        "id": str(c.id),
                        "customer_number": c.customer_number,
                        "company_name": c.company_name,
                        "contact_name": c.contact_name,
                        "email": c.email,
                        "phone": c.phone,
                        "address": c.address,
                        "city": c.city,
                        "state": c.state,
                        "postcode": c.postcode,
                    }
                    for c in customers
                ]

                logger.info(
                    "Customers searched",
                    query=query,
                    results_count=len(customer_data),
                )

                return ToolOutput(
                    success=True,
                    data={
                        "customers": customer_data,
                        "count": len(customer_data),
                        "query": query,
                    },
                )

        except Exception as e:
            logger.error("Customer search failed", error=str(e), query=query)
            return ToolOutput(success=False, error=f"Customer search failed: {str(e)}")


class SearchOrdersInput(ToolInput):
    """Input schema for SearchOrdersTool."""

    customer_id: str | None = Field(default=None, description="Filter by customer ID")
    status: str | None = Field(default=None, description="Filter by order status")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum results to return")


class SearchOrdersTool(BaseTool):
    """Tool for searching orders in the ERP system."""

    def __init__(self):
        super().__init__(
            name="search_orders",
            description="Search for orders by customer or status. Returns order details including items and totals.",
        )

    async def execute(
        self,
        customer_id: str | None = None,
        status: str | None = None,
        limit: int = 10,
    ) -> ToolOutput:
        """
        Search orders by customer or status.

        Args:
            customer_id: Optional customer ID filter
            status: Optional status filter
            limit: Maximum number of results

        Returns:
            ToolOutput with list of matching orders
        """
        try:
            async for db in get_db():
                # Build query
                stmt = select(Order).order_by(Order.order_date.desc())

                # Apply filters
                if customer_id:
                    try:
                        stmt = stmt.where(Order.customer_id == UUID(customer_id))
                    except ValueError:
                        return ToolOutput(
                            success=False,
                            error=f"Invalid customer_id format: {customer_id}",
                        )

                if status:
                    stmt = stmt.where(Order.status == status)

                # Apply limit and execute
                stmt = stmt.limit(limit)
                result = await db.execute(stmt)
                orders = result.scalars().all()

                # Format results
                order_data = [
                    {
                        "id": str(o.id),
                        "order_number": o.order_number,
                        "customer_id": str(o.customer_id),
                        "status": o.status,
                        "total": float(o.total),
                        "order_date": o.order_date.isoformat() if o.order_date else None,
                        "notes": o.notes,
                    }
                    for o in orders
                ]

                logger.info(
                    "Orders searched",
                    customer_id=customer_id,
                    status=status,
                    results_count=len(order_data),
                )

                return ToolOutput(
                    success=True,
                    data={
                        "orders": order_data,
                        "count": len(order_data),
                        "filters": {
                            "customer_id": customer_id,
                            "status": status,
                        },
                    },
                )

        except Exception as e:
            logger.error(
                "Order search failed",
                error=str(e),
                customer_id=customer_id,
                status=status,
            )
            return ToolOutput(success=False, error=f"Order search failed: {str(e)}")


class GetQuoteDetailsInput(ToolInput):
    """Input schema for GetQuoteDetailsTool."""

    quote_id: str = Field(description="Quote ID to retrieve")


class GetQuoteDetailsTool(BaseTool):
    """Tool for retrieving quote details from the ERP system."""

    def __init__(self):
        super().__init__(
            name="get_quote_details",
            description="Get detailed information about a specific quote including line items, customer, and totals.",
        )

    async def execute(self, quote_id: str) -> ToolOutput:
        """
        Get quote details by ID.

        Args:
            quote_id: Quote ID to retrieve

        Returns:
            ToolOutput with quote details
        """
        try:
            async for db in get_db():
                # Parse UUID
                try:
                    quote_uuid = UUID(quote_id)
                except ValueError:
                    return ToolOutput(
                        success=False,
                        error=f"Invalid quote_id format: {quote_id}",
                    )

                # Query quote
                stmt = select(Quote).where(Quote.id == quote_uuid)
                result = await db.execute(stmt)
                quote = result.scalar_one_or_none()

                if not quote:
                    return ToolOutput(
                        success=False,
                        error=f"Quote not found: {quote_id}",
                    )

                # Format result
                quote_data = {
                    "id": str(quote.id),
                    "quote_number": quote.quote_number,
                    "customer_id": str(quote.customer_id),
                    "status": quote.status,
                    "total": float(quote.total),
                    "quote_date": quote.quote_date.isoformat() if quote.quote_date else None,
                    "valid_until": (
                        quote.valid_until.isoformat() if quote.valid_until else None
                    ),
                    "notes": quote.notes,
                }

                logger.info("Quote details retrieved", quote_id=quote_id)

                return ToolOutput(
                    success=True,
                    data={"quote": quote_data},
                )

        except Exception as e:
            logger.error("Quote retrieval failed", error=str(e), quote_id=quote_id)
            return ToolOutput(success=False, error=f"Quote retrieval failed: {str(e)}")
