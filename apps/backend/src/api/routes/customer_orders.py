from typing import Annotated
from datetime import datetime
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from src.config.database import get_async_db
from src.db.demo_models import Customer, Order, OrderItem, Product
from src.api.deps import get_current_user

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/customers", tags=["Customer Orders"])


class ProductDetail(BaseModel):
    """Product information for order items."""
    
    id: UUID = Field(description="Product ID")
    name: str = Field(description="Product name")
    sku: str = Field(description="Product SKU")
    unit_price: float = Field(description="Unit price")


class OrderItemResponse(BaseModel):
    """Order item with product details."""
    
    id: UUID = Field(description="Order item ID")
    product: ProductDetail = Field(description="Product details")
    quantity: int = Field(description="Quantity ordered")
    unit_price: float = Field(description="Unit price at time of order")
    total_price: float = Field(description="Total price for this item")


class OrderResponse(BaseModel):
    """Order with items included."""
    
    id: UUID = Field(description="Order ID")
    order_number: str = Field(description="Order number")
    status: str = Field(description="Order status")
    order_date: datetime = Field(description="Order date")
    total_amount: float = Field(description="Total order amount")
    items: list[OrderItemResponse] = Field(description="Order items")


class OrderHistoryResponse(BaseModel):
    """Paginated order history response.
    
    Attributes:
        orders: List of orders with full details including items
        total_count: Total number of orders matching the filter criteria
        page: Current page number (1-based)
        page_size: Number of items returned per page
        total_pages: Total number of pages available
    """
    
    orders: list[OrderResponse] = Field(description="List of orders")
    total_count: int = Field(description="Total number of orders")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Number of items per page")
    total_pages: int = Field(description="Total number of pages")


@router.get("/{customer_id}/orders", response_model=OrderHistoryResponse)
async def get_customer_order_history(
    customer_id: Annotated[UUID, Path(description="Customer ID")],
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 50,
    status: Annotated[str | None, Query(description="Filter by order status")] = None,
    start_date: Annotated[datetime | None, Query(description="Filter orders after this date")] = None,
    end_date: Annotated[datetime | None, Query(description="Filter orders before this date")] = None,
) -> OrderHistoryResponse:
    """Retrieve paginated order history for a customer with full order details.
    
    Fetches all orders for the specified customer including order items and product details.
    Results are sorted by order date (newest first) and support filtering by status and date range.
    
    Args:
        customer_id: UUID of the customer to retrieve orders for
        db: Database session dependency
        current_user: Authenticated user from JWT token
        page: Page number for pagination (1-based)
        page_size: Number of orders per page (max 100)
        status: Optional filter by order status (e.g., 'pending', 'completed', 'cancelled')
        start_date: Optional filter for orders placed on or after this date
        end_date: Optional filter for orders placed on or before this date
    
    Returns:
        OrderHistoryResponse: Paginated response containing orders with items and pagination metadata
    
    Raises:
        HTTPException: 404 if customer not found
        HTTPException: 500 for database or internal server errors
    
    Example:
        GET /api/customers/123e4567-e89b-12d3-a456-426614174000/orders?page=1&page_size=10&status=completed
        
        Response:
        {
            "orders": [
                {
                    "id": "123e4567-e89b-12d3-a456-426614174001",
                    "order_number": "ORD-2024-001",
                    "status": "completed",
                    "order_date": "2024-01-15T10:30:00Z",
                    "total_amount": 1250.00,
                    "items": [
                        {
                            "id": "123e4567-e89b-12d3-a456-426614174002",
                            "product": {
                                "id": "123e4567-e89b-12d3-a456-426614174003",
                                "name": "Industrial Pump",
                                "sku": "PUMP-001",
                                "unit_price": 500.00
                            },
                            "quantity": 2,
                            "unit_price": 500.00,
                            "total_price": 1000.00
                        }
                    ]
                }
            ],
            "total_count": 25,
            "page": 1,
            "page_size": 10,
            "total_pages": 3
        }
    """
    try:
        # Verify customer exists before proceeding with order query
        customer_query = select(Customer).where(Customer.id == customer_id)
        customer_result = await db.execute(customer_query)
        customer = customer_result.scalar_one_or_none()
        
        if not customer:
            logger.warning("Customer not found", customer_id=str(customer_id))
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Build base query for orders
        query = select(Order).where(Order.customer_id == customer_id)
        
        # Apply optional filters
        filters = []
        
        if status:
            filters.append(Order.status == status)
        
        if start_date:
            filters.append(Order.order_date >= start_date)
        
        if end_date:
            filters.append(Order.order_date <= end_date)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Get total count for pagination metadata
        count_query = select(func.count()).select_from(Order).where(Order.customer_id == customer_id)
        if filters:
            count_query = count_query.where(and_(*filters))

        count_result = await db.execute(count_query)
        total_count = count_result.scalar() or 0
        
        # Apply pagination and sorting (newest orders first)
        offset = (page - 1) * page_size
        query = (
            query.order_by(desc(Order.order_date))
            .offset(offset)
            .limit(page_size)
            .options(selectinload(Order.order_items).selectinload(OrderItem.product))
        )

        # Execute main query to get orders with items eagerly loaded (eliminates N+1)
        result = await db.execute(query)
        orders = result.scalars().all()

        # Build order responses using eagerly-loaded items
        order_responses = []
        for order in orders:
            items_data = [(item, item.product) for item in order.order_items]
            
            # Build order items response with product details
            order_items = []
            for order_item, product in items_data:
                product_detail = ProductDetail(
                    id=product.id,
                    name=product.name,
                    sku=product.sku,
                    unit_price=product.unit_price
                )
                
                # Calculate total price for this line item
                item_response = OrderItemResponse(
                    id=order_item.id,
                    product=product_detail,
                    quantity=order_item.quantity,
                    unit_price=order_item.unit_price,
                    total_price=order_item.quantity * order_item.unit_price
                )
                order_items.append(item_response)
            
            # Build complete order response
            order_response = OrderResponse(
                id=order.id,
                order_number=order.order_number,
                status=order.status,
                order_date=order.order_date,
                total_amount=order.total_amount,
                items=order_items
            )
            order_responses.append(order_response)
        
        # Calculate total pages using ceiling division
        total_pages = (total_count + page_size - 1) // page_size
        
        logger.info(
            "Retrieved customer order history",
            customer_id=str(customer_id),
            total_orders=total_count,
            page=page,
            page_size=page_size
        )
        
        return OrderHistoryResponse(
            orders=order_responses,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.error(
            "Error retrieving customer order history",
            customer_id=str(customer_id),
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving order history"
        )