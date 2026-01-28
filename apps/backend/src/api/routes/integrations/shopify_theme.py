"""
Shopify Theme API Endpoints.

Custom API endpoints for Shopify themes to access dynamic ERP data.
These endpoints are called directly from Shopify theme liquid/JavaScript code.
"""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import Customer, Order, Product
from src.db.shopify_extended_models import ShopifyThemeEndpoint

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/shopify/theme", tags=["Shopify Theme APIs"])


# Pydantic Models

class ProductAvailabilityResponse(BaseModel):
    """Product availability response for theme."""

    sku: str
    available: bool
    stock_level: int
    warehouse_location: str | None
    estimated_delivery_days: int | None
    can_backorder: bool


class OrderValidationRequest(BaseModel):
    """Order validation request from theme."""

    customer_email: str = Field(..., pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    items: list[dict] = Field(..., min_length=1)
    shipping_address: dict


class OrderValidationResponse(BaseModel):
    """Order validation response."""

    valid: bool
    errors: list[str] = []
    warnings: list[str] = []
    estimated_total: float | None = None


class CustomPricingRequest(BaseModel):
    """Custom pricing request."""

    customer_email: str
    sku: str
    quantity: int = Field(..., gt=0)


class CustomPricingResponse(BaseModel):
    """Custom pricing response."""

    sku: str
    base_price: float
    discount_percentage: float | None = None
    final_price: float
    volume_discount_applied: bool = False


# Theme API Endpoints


@router.get("/product-availability/{sku}", response_model=ProductAvailabilityResponse)
async def get_product_availability(
    sku: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ProductAvailabilityResponse:
    """
    Get real-time product availability for Shopify theme.

    Called from product pages to show accurate stock information.
    """
    # Track endpoint usage
    await _track_endpoint_usage(db, "/product-availability/{sku}")

    # Get product
    result = await db.execute(select(Product).where(Product.sku == sku))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with SKU {sku} not found",
        )

    # Calculate availability
    available = product.stock > 0 and product.is_active
    can_backorder = product.stock == 0  # Allow backorders when out of stock

    # Estimate delivery based on stock
    if product.stock > 0:
        estimated_delivery_days = 2  # In stock: 2 days
    else:
        estimated_delivery_days = 14  # Backorder: 2 weeks

    logger.info(
        "Product availability checked",
        sku=sku,
        available=available,
        stock=product.stock,
    )

    return ProductAvailabilityResponse(
        sku=product.sku,
        available=available,
        stock_level=product.stock,
        warehouse_location=product.warehouse_location,
        estimated_delivery_days=estimated_delivery_days,
        can_backorder=can_backorder,
    )


@router.post("/validate-order", response_model=OrderValidationResponse)
async def validate_order(
    request: OrderValidationRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> OrderValidationResponse:
    """
    Validate order before checkout in Shopify theme.

    Performs custom business logic validation:
    - Stock availability
    - Customer eligibility
    - Delivery constraints
    - Minimum order requirements
    """
    await _track_endpoint_usage(db, "/validate-order")

    errors = []
    warnings = []
    estimated_total = 0.0

    # Validate customer exists
    customer_result = await db.execute(select(Customer).where(Customer.email == request.customer_email))
    customer = customer_result.scalar_one_or_none()

    if not customer:
        warnings.append(f"Customer {request.customer_email} not found in ERP. Will be created on order placement.")

    if not customer or not customer.is_active:
        errors.append("Customer account is inactive")

    # Validate items
    for item in request.items:
        sku = item.get("sku")
        quantity = item.get("quantity", 0)

        if not sku:
            errors.append("Item missing SKU")
            continue

        # Get product
        product_result = await db.execute(select(Product).where(Product.sku == sku))
        product = product_result.scalar_one_or_none()

        if not product:
            errors.append(f"Product {sku} not found")
            continue

        if not product.is_active:
            errors.append(f"Product {sku} is no longer available")
            continue

        # Check stock
        if product.stock < quantity:
            if product.stock == 0:
                warnings.append(f"Product {sku} is out of stock. Will be backordered.")
            else:
                warnings.append(
                    f"Only {product.stock} units of {sku} available (requested: {quantity})"
                )

        # Add to estimated total
        estimated_total += float(product.price) * quantity

    # Minimum order validation (example: $50 minimum)
    MIN_ORDER_AMOUNT = 50.0
    if estimated_total < MIN_ORDER_AMOUNT:
        warnings.append(f"Order total ${estimated_total:.2f} is below minimum ${MIN_ORDER_AMOUNT:.2f}")

    valid = len(errors) == 0

    logger.info(
        "Order validation",
        customer_email=request.customer_email,
        items_count=len(request.items),
        valid=valid,
        estimated_total=estimated_total,
    )

    return OrderValidationResponse(
        valid=valid,
        errors=errors,
        warnings=warnings,
        estimated_total=estimated_total if valid else None,
    )


@router.post("/custom-pricing", response_model=CustomPricingResponse)
async def get_custom_pricing(
    request: CustomPricingRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CustomPricingResponse:
    """
    Get custom pricing for customer (e.g., volume discounts, customer-specific pricing).

    Called from Shopify theme to display personalized pricing.
    """
    await _track_endpoint_usage(db, "/custom-pricing")

    # Get product
    result = await db.execute(select(Product).where(Product.sku == request.sku))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {request.sku} not found",
        )

    base_price = float(product.price)
    discount_percentage = None
    volume_discount_applied = False

    # Get customer
    customer_result = await db.execute(select(Customer).where(Customer.email == request.customer_email))
    customer = customer_result.scalar_one_or_none()

    # Apply volume discounts
    if request.quantity >= 100:
        discount_percentage = 15.0
        volume_discount_applied = True
    elif request.quantity >= 50:
        discount_percentage = 10.0
        volume_discount_applied = True
    elif request.quantity >= 20:
        discount_percentage = 5.0
        volume_discount_applied = True

    # Calculate final price
    if discount_percentage:
        final_price = base_price * (1 - discount_percentage / 100)
    else:
        final_price = base_price

    logger.info(
        "Custom pricing calculated",
        sku=request.sku,
        customer_email=request.customer_email,
        quantity=request.quantity,
        discount=discount_percentage,
        final_price=final_price,
    )

    return CustomPricingResponse(
        sku=request.sku,
        base_price=base_price,
        discount_percentage=discount_percentage,
        final_price=final_price,
        volume_discount_applied=volume_discount_applied,
    )


@router.get("/stock-check-bulk")
async def bulk_stock_check(
    skus: Annotated[str, Query(description="Comma-separated SKUs")],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> JSONResponse:
    """
    Bulk stock check for multiple products.

    Example: /stock-check-bulk?skus=SKU-001,SKU-002,SKU-003
    """
    await _track_endpoint_usage(db, "/stock-check-bulk")

    sku_list = [sku.strip() for sku in skus.split(",")]

    # Get products
    result = await db.execute(select(Product).where(Product.sku.in_(sku_list)))
    products = result.scalars().all()

    # Build response
    stock_data = {}
    for product in products:
        stock_data[product.sku] = {
            "available": product.stock > 0 and product.is_active,
            "stock_level": product.stock,
            "price": float(product.price),
        }

    # Add not found SKUs
    found_skus = {p.sku for p in products}
    for sku in sku_list:
        if sku not in found_skus:
            stock_data[sku] = {
                "available": False,
                "stock_level": 0,
                "price": None,
                "error": "Product not found",
            }

    logger.info("Bulk stock check", skus_requested=len(sku_list), products_found=len(products))

    return JSONResponse(content=stock_data)


@router.get("/delivery-estimate")
async def get_delivery_estimate(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    postcode: str = Query(..., description="Australian postcode"),
    sku: str = Query(..., description="Product SKU"),
) -> JSONResponse:
    """
    Get delivery estimate based on postcode and product availability.
    """
    await _track_endpoint_usage(db, "/delivery-estimate")

    # Get product
    result = await db.execute(select(Product).where(Product.sku == sku))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {sku} not found",
        )

    # Simple delivery estimation logic
    # In reality, this would integrate with shipping APIs
    if product.stock > 0:
        # In stock - estimate based on location
        if postcode.startswith("4"):  # Queensland
            delivery_days = 2
        elif postcode.startswith("2") or postcode.startswith("3"):  # NSW/VIC
            delivery_days = 3
        else:
            delivery_days = 5
    else:
        # Backorder - longer delivery
        delivery_days = 14

    estimated_date = datetime.now(UTC).date()
    # Add business days (simplified - doesn't account for weekends/holidays)
    from datetime import timedelta

    estimated_date += timedelta(days=delivery_days)

    logger.info(
        "Delivery estimate",
        sku=sku,
        postcode=postcode,
        delivery_days=delivery_days,
    )

    return JSONResponse(
        content={
            "sku": sku,
            "postcode": postcode,
            "estimated_delivery_days": delivery_days,
            "estimated_delivery_date": estimated_date.isoformat(),
            "in_stock": product.stock > 0,
        }
    )


# Helper Functions


async def _track_endpoint_usage(db: AsyncSession, endpoint_path: str):
    """
    Track theme endpoint usage for analytics.

    Updates request count and last accessed timestamp.
    """
    try:
        result = await db.execute(
            select(ShopifyThemeEndpoint).where(ShopifyThemeEndpoint.endpoint_path == endpoint_path)
        )
        endpoint = result.scalar_one_or_none()

        if endpoint:
            endpoint.request_count += 1
            endpoint.last_accessed_at = datetime.now(UTC)
            await db.commit()
        else:
            # Create endpoint record if it doesn't exist
            new_endpoint = ShopifyThemeEndpoint(
                endpoint_path=endpoint_path,
                endpoint_type="dynamic",
                is_active=True,
                request_count=1,
                last_accessed_at=datetime.now(UTC),
            )
            db.add(new_endpoint)
            await db.commit()

    except Exception as e:
        logger.warning("Failed to track endpoint usage", endpoint=endpoint_path, error=str(e))
        # Don't fail the request if tracking fails
        pass
