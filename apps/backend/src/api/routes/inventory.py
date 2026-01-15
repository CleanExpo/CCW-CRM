"""Multi-store inventory API endpoints.

Provides RESTful endpoints for managing stock across multiple locations.
"""

from datetime import datetime, timedelta
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.db.demo_models import Product
from src.db.inventory_models import (
    ProductStockByLocation,
    StockAdjustment,
    StockReservation,
    StockTransfer,
    StoreLocation,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/inventory", tags=["Multi-Store Inventory"])


# ============================================
# Request/Response Models
# ============================================


class InventoryListResponse(BaseModel):
    """List of inventory items with pagination."""

    items: list[dict]
    total: int
    page: int
    page_size: int


# ============================================
# Root Endpoints
# ============================================


@router.get("", response_model=InventoryListResponse)
@router.get("/", response_model=InventoryListResponse, include_in_schema=False)
async def list_all_inventory(
    db: Annotated[AsyncSession, Depends(get_db)],
    location: str | None = Query(None, description="Filter by location"),
    low_stock_only: bool = Query(False, description="Only show low stock items"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    """List all inventory across locations or filtered by location.

    Args:
        location: Optional location filter (brisbane, sydney, melbourne)
        low_stock_only: Only show products below reorder point
        page: Page number
        page_size: Items per page

    Returns:
        Paginated list of inventory items
    """
    # Build base query
    query = (
        select(ProductStockByLocation, Product)
        .join(Product, ProductStockByLocation.product_id == Product.id)
    )

    # Apply location filter if specified
    if location:
        try:
            StoreLocation(location)
            query = query.where(ProductStockByLocation.location == location)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid location. Must be one of: {', '.join([l.value for l in StoreLocation])}",
            )

    # Apply low stock filter if requested
    if low_stock_only:
        query = query.where(
            ProductStockByLocation.available < ProductStockByLocation.reorder_point
        )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    # Execute query
    result = await db.execute(query)
    rows = result.all()

    # Format response
    items = [
        {
            "product_id": str(stock.product_id),
            "sku": product.sku,
            "name": product.name,
            "location": stock.location,
            "stock": stock.stock,
            "available": stock.available,
            "reserved": stock.reserved,
            "reorder_point": stock.reorder_point,
        }
        for stock, product in rows
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


class StockByLocationResponse(BaseModel):
    """Stock information for a specific location."""

    location: str
    stock: int
    reserved: int
    available: int
    reorder_point: int | None
    last_counted_at: str | None


class ProductStockResponse(BaseModel):
    """Complete stock information for a product."""

    product_id: str
    product_name: str
    product_sku: str
    total_stock: int
    total_reserved: int
    total_available: int
    locations: list[StockByLocationResponse]


class StockTransferRequest(BaseModel):
    """Request to transfer stock between locations."""

    product_id: str = Field(..., description="Product UUID")
    from_location: str = Field(..., description="Source location")
    to_location: str = Field(..., description="Destination location")
    quantity: int = Field(..., gt=0, description="Quantity to transfer")
    reason: str | None = Field(None, description="Reason for transfer")
    notes: str | None = Field(None, description="Additional notes")


class StockAdjustmentRequest(BaseModel):
    """Request to adjust stock at a location."""

    product_id: str = Field(..., description="Product UUID")
    location: str = Field(..., description="Store location")
    quantity_change: int = Field(..., description="Quantity change (+ or -)")
    adjustment_type: str = Field(..., description="Type of adjustment")
    reason: str | None = Field(None, description="Reason for adjustment")


class ReserveStockRequest(BaseModel):
    """Request to reserve stock for an order."""

    product_id: str = Field(..., description="Product UUID")
    order_id: str = Field(..., description="Order UUID")
    location: str = Field(..., description="Store location")
    quantity: int = Field(..., gt=0, description="Quantity to reserve")
    expires_hours: int = Field(default=24, description="Hours until expiration")


# ============================================
# Stock Level Endpoints
# ============================================


@router.get("/product/{product_id}/locations")
async def get_product_stock_by_locations(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProductStockResponse:
    """Get stock levels for a product across all locations.

    Args:
        product_id: Product UUID

    Returns:
        Stock information for all locations
    """
    # Get product
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get stock by location
    stmt = select(ProductStockByLocation).where(
        ProductStockByLocation.product_id == product_id
    )
    result = await db.execute(stmt)
    stock_records = result.scalars().all()

    # Calculate totals
    total_stock = sum(s.stock for s in stock_records)
    total_reserved = sum(s.reserved for s in stock_records)
    total_available = sum(s.available for s in stock_records)

    # Build location details
    locations = [
        StockByLocationResponse(
            location=s.location,
            stock=s.stock,
            reserved=s.reserved,
            available=s.available,
            reorder_point=s.reorder_point,
            last_counted_at=s.last_counted_at.isoformat() if s.last_counted_at else None,
        )
        for s in stock_records
    ]

    return ProductStockResponse(
        product_id=str(product_id),
        product_name=product.name,
        product_sku=product.sku,
        total_stock=total_stock,
        total_reserved=total_reserved,
        total_available=total_available,
        locations=locations,
    )


@router.get("/by-location")
async def get_stock_by_location(
    location: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    low_stock_only: bool = False,
) -> dict:
    """Get all products' stock at a specific location.

    Args:
        location: Store location (brisbane, sydney, melbourne)
        page: Page number
        page_size: Items per page
        low_stock_only: Only show products below reorder point

    Returns:
        Paginated list of products with stock at location
    """
    # Validate location
    try:
        StoreLocation(location)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid location. Must be one of: {', '.join([l.value for l in StoreLocation])}",  # noqa: E501, E741
        )

    # Build query
    query = (
        select(ProductStockByLocation, Product)
        .join(Product, ProductStockByLocation.product_id == Product.id)
        .where(ProductStockByLocation.location == location)
    )

    # Filter for low stock if requested
    if low_stock_only:
        query = query.where(
            and_(
                ProductStockByLocation.reorder_point.isnot(None),
                ProductStockByLocation.stock <= ProductStockByLocation.reorder_point,
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Product.name).limit(page_size).offset((page - 1) * page_size)

    # Execute
    result = await db.execute(query)
    rows = result.all()

    # Build response
    items = []
    for stock, product in rows:
        items.append(
            {
                "product_id": str(product.id),
                "product_name": product.name,
                "product_sku": product.sku,
                "stock": stock.stock,
                "reserved": stock.reserved,
                "available": stock.available,
                "reorder_point": stock.reorder_point,
                "below_reorder_point": (
                    stock.stock <= stock.reorder_point if stock.reorder_point else False
                ),
            }
        )

    return {
        "location": location,
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/low-stock")
async def get_low_stock_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    threshold: int = Query(10, ge=0, description="Stock threshold"),
) -> dict:
    """Get products with low stock across all locations.

    Args:
        threshold: Stock level threshold (default: 10)

    Returns:
        List of products below threshold at any location
    """
    # Query products with stock below threshold
    stmt = (
        select(ProductStockByLocation, Product)
        .join(Product, ProductStockByLocation.product_id == Product.id)
        .where(ProductStockByLocation.stock <= threshold)
        .order_by(ProductStockByLocation.stock)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Group by product
    products_dict = {}
    for stock, product in rows:
        if str(product.id) not in products_dict:
            products_dict[str(product.id)] = {
                "product_id": str(product.id),
                "product_name": product.name,
                "product_sku": product.sku,
                "locations": [],
            }

        products_dict[str(product.id)]["locations"].append(
            {
                "location": stock.location,
                "stock": stock.stock,
                "reserved": stock.reserved,
                "available": stock.available,
            }
        )

    return {
        "threshold": threshold,
        "products": list(products_dict.values()),
        "total_products": len(products_dict),
    }


@router.get("/stock-health")
async def get_stock_health(
    db: Annotated[AsyncSession, Depends(get_db)],
    threshold: int = Query(20, ge=0, description="Low stock threshold"),
) -> dict:
    """Get comprehensive stock health analysis across all locations.

    Categorizes products into three tiers:
    - Critical: Out of stock at ALL locations (total_available = 0)
    - Low: Low stock but available (0 < total_available < threshold)
    - Warning: Location imbalance (any location = 0 but others have stock)

    Args:
        threshold: Stock level to consider as "low" (default: 20)

    Returns:
        Categorized stock health data
    """
    # Get all products with their stock by location
    stmt = (
        select(Product, ProductStockByLocation)
        .join(ProductStockByLocation, Product.id == ProductStockByLocation.product_id)
        .where(Product.is_active)
        .order_by(Product.name)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Group by product
    products_dict = {}
    for product, stock in rows:
        product_id = str(product.id)
        if product_id not in products_dict:
            products_dict[product_id] = {
                "id": product_id,
                "sku": product.sku,
                "name": product.name,
                "stock_by_location": [],
            }

        products_dict[product_id]["stock_by_location"].append(
            {
                "location": stock.location,
                "quantity": stock.stock,
                "reserved": stock.reserved,
                "available": stock.available,
            }
        )

    # Categorize products
    critical = []  # total_available = 0
    low = []  # 0 < total_available < threshold
    warning = []  # any location = 0 but total > 0

    for product_data in products_dict.values():
        locations = product_data["stock_by_location"]

        # Calculate totals
        total_available = sum(loc["available"] for loc in locations)
        min_available = min(loc["available"] for loc in locations)
        has_zero_location = any(loc["available"] == 0 for loc in locations)

        product_data["total_available"] = total_available
        product_data["min_available"] = min_available

        if total_available == 0:
            critical.append(product_data)
        elif total_available < threshold:
            low.append(product_data)
        elif has_zero_location and total_available > 0:
            warning.append(product_data)

    return {
        "critical": critical,
        "low": low,
        "warning": warning,
    }


@router.get("/transfer-suggestions")
async def get_transfer_suggestions(
    db: Annotated[AsyncSession, Depends(get_db)],
    min_quantity: int = Query(5, ge=1, description="Minimum transfer quantity"),
) -> dict:
    """Generate intelligent stock transfer suggestions to optimize distribution.

    Analyzes stock across locations and suggests transfers where:
    - One location is low/out of stock
    - Another location has surplus stock
    - Transfer would improve availability for customers

    Args:
        min_quantity: Minimum quantity to suggest transferring (default: 5)

    Returns:
        List of transfer suggestions with cost-benefit analysis
    """
    # Get all products with stock by location
    stmt = (
        select(Product, ProductStockByLocation)
        .join(ProductStockByLocation, Product.id == ProductStockByLocation.product_id)
        .where(Product.is_active)
        .order_by(Product.name)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Group by product
    products_dict = {}
    for product, stock in rows:
        product_id = str(product.id)
        if product_id not in products_dict:
            products_dict[product_id] = {
                "product": product,
                "locations": {},
            }

        products_dict[product_id]["locations"][stock.location] = {
            "stock": stock.stock,
            "reserved": stock.reserved,
            "available": stock.available,
        }

    # Generate transfer suggestions
    suggestions = []
    suggestion_id = 1

    for product_id, data in products_dict.items():
        product = data["product"]
        locations = data["locations"]

        # Ensure all three locations exist
        all_locations = ["brisbane", "sydney", "melbourne"]
        for loc in all_locations:
            if loc not in locations:
                locations[loc] = {"stock": 0, "reserved": 0, "available": 0}

        # Find imbalances
        for to_location in all_locations:
            to_stock = locations[to_location]["available"]

            # Only suggest if destination is low (< 10 units)
            if to_stock >= 10:
                continue

            # Find best source location
            for from_location in all_locations:
                if from_location == to_location:
                    continue

                from_stock = locations[from_location]["available"]

                # Source must have surplus (>20 units)
                if from_stock <= 20:
                    continue

                # Calculate suggested quantity
                # Transfer enough to bring destination to ~15 units
                target_quantity = 15 - to_stock
                max_transferable = from_stock - 15  # Leave 15 at source

                suggested_quantity = min(
                    max(target_quantity, min_quantity), max_transferable
                )

                if suggested_quantity < min_quantity:
                    continue

                # Determine priority
                if to_stock == 0:
                    priority = "high"
                elif to_stock < 5:
                    priority = "high"
                elif to_stock < 10:
                    priority = "medium"
                else:
                    priority = "low"

                # Calculate cost-benefit
                # Estimated transfer cost: $10 base + $5 per unit
                estimated_cost = float(10 + (5 * suggested_quantity))

                # Potential revenue impact: prevent lost sales
                # Assume product sells at retail price
                potential_revenue = float(product.price * suggested_quantity)

                # Build reason
                if to_stock == 0:
                    reason = f"{to_location.capitalize()} out of stock, {from_location.capitalize()} has {from_stock} available"  # noqa: E501
                else:
                    reason = f"{to_location.capitalize()} low on stock ({to_stock} units) while {from_location.capitalize()} has surplus ({from_stock} units)"  # noqa: E501

                suggestions.append(
                    {
                        "id": f"t{suggestion_id}",
                        "product_id": product_id,
                        "product_sku": product.sku,
                        "product_name": product.name,
                        "from_location": from_location,
                        "to_location": to_location,
                        "suggested_quantity": suggested_quantity,
                        "priority": priority,
                        "reason": reason,
                        "current_stock_from": locations[from_location]["stock"],
                        "current_stock_to": locations[to_location]["stock"],
                        "projected_stock_from": locations[from_location]["stock"]
                        - suggested_quantity,
                        "projected_stock_to": locations[to_location]["stock"]
                        + suggested_quantity,
                        "estimated_cost": estimated_cost,
                        "potential_revenue_impact": potential_revenue,
                    }
                )

                suggestion_id += 1

                # Only suggest one transfer per product (best match)
                break

    # Sort by priority (high first) and potential revenue
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(
        key=lambda x: (priority_order[x["priority"]], -x["potential_revenue_impact"])
    )

    # Calculate totals
    total_potential_revenue = sum(s["potential_revenue_impact"] for s in suggestions)
    total_estimated_cost = sum(s["estimated_cost"] for s in suggestions)

    return {
        "suggestions": suggestions[:10],  # Limit to top 10
        "total_potential_revenue": total_potential_revenue,
        "total_estimated_cost": total_estimated_cost,
    }


# ============================================
# Stock Transfer Endpoints
# ============================================


@router.post("/transfer")
async def create_stock_transfer(
    transfer_req: StockTransferRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a stock transfer between locations.

    Args:
        transfer_req: Transfer request details

    Returns:
        Created transfer details
    """
    product_id = UUID(transfer_req.product_id)

    # Validate locations
    try:
        StoreLocation(transfer_req.from_location)
        StoreLocation(transfer_req.to_location)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid location")

    if transfer_req.from_location == transfer_req.to_location:
        raise HTTPException(status_code=400, detail="From and to locations must be different")

    # Check source location has enough stock
    stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == transfer_req.from_location,
        )
    )
    result = await db.execute(stmt)
    source_stock = result.scalar_one_or_none()

    if not source_stock:
        raise HTTPException(
            status_code=400, detail=f"Product not found at {transfer_req.from_location}"
        )

    if source_stock.available < transfer_req.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock at {transfer_req.from_location}. "
            f"Available: {source_stock.available}, Requested: {transfer_req.quantity}",
        )

    # Create transfer record
    transfer = StockTransfer(
        product_id=product_id,
        from_location=transfer_req.from_location,
        to_location=transfer_req.to_location,
        quantity=transfer_req.quantity,
        reason=transfer_req.reason,
        notes=transfer_req.notes,
        status="completed",  # Auto-complete in demo mode
        completed_at=datetime.now(),
    )
    db.add(transfer)

    # Update source location (decrease)
    source_stock.stock -= transfer_req.quantity

    # Log adjustment for source
    source_adjustment = StockAdjustment(
        product_id=product_id,
        location=transfer_req.from_location,
        quantity_change=-transfer_req.quantity,
        previous_quantity=source_stock.stock + transfer_req.quantity,
        new_quantity=source_stock.stock,
        adjustment_type="transfer",
        reason=f"Transfer to {transfer_req.to_location}",
        reference_id=transfer.id,
    )
    db.add(source_adjustment)

    # Get or create destination location stock
    stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == transfer_req.to_location,
        )
    )
    result = await db.execute(stmt)
    dest_stock = result.scalar_one_or_none()

    if not dest_stock:
        dest_stock = ProductStockByLocation(
            product_id=product_id,
            location=transfer_req.to_location,
            stock=transfer_req.quantity,
            reserved=0,
        )
        db.add(dest_stock)
        prev_qty = 0
    else:
        prev_qty = dest_stock.stock
        dest_stock.stock += transfer_req.quantity

    # Log adjustment for destination
    dest_adjustment = StockAdjustment(
        product_id=product_id,
        location=transfer_req.to_location,
        quantity_change=transfer_req.quantity,
        previous_quantity=prev_qty,
        new_quantity=dest_stock.stock,
        adjustment_type="transfer",
        reason=f"Transfer from {transfer_req.from_location}",
        reference_id=transfer.id,
    )
    db.add(dest_adjustment)

    await db.commit()

    logger.info(
        "Stock transfer completed",
        transfer_id=str(transfer.id),
        product_id=str(product_id),
        from_location=transfer_req.from_location,
        to_location=transfer_req.to_location,
        quantity=transfer_req.quantity,
    )

    return {
        "success": True,
        "transfer_id": str(transfer.id),
        "from_location": transfer_req.from_location,
        "to_location": transfer_req.to_location,
        "quantity": transfer_req.quantity,
        "status": "completed",
    }


@router.get("/transfers")
async def get_stock_transfers(
    db: Annotated[AsyncSession, Depends(get_db)],
    product_id: UUID | None = None,
    location: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    """Get stock transfer history.

    Args:
        product_id: Filter by product
        location: Filter by from or to location
        status: Filter by status
        page: Page number
        page_size: Items per page

    Returns:
        Paginated list of transfers
    """
    query = select(StockTransfer, Product).join(Product, StockTransfer.product_id == Product.id)

    # Apply filters
    if product_id:
        query = query.where(StockTransfer.product_id == product_id)
    if location:
        query = query.where(
            or_(
                StockTransfer.from_location == location,
                StockTransfer.to_location == location,
            )
        )
    if status:
        query = query.where(StockTransfer.status == status)

    # Count total
    count_stmt = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.order_by(StockTransfer.initiated_at.desc()).limit(page_size).offset(
        (page - 1) * page_size
    )

    result = await db.execute(query)
    rows = result.all()

    items = []
    for transfer, product in rows:
        items.append(
            {
                "transfer_id": str(transfer.id),
                "product_id": str(product.id),
                "product_name": product.name,
                "product_sku": product.sku,
                "from_location": transfer.from_location,
                "to_location": transfer.to_location,
                "quantity": transfer.quantity,
                "status": transfer.status,
                "reason": transfer.reason,
                "initiated_at": transfer.initiated_at.isoformat(),
                "completed_at": transfer.completed_at.isoformat() if transfer.completed_at else None,  # noqa: E501
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# ============================================
# Stock Reservation Endpoints
# ============================================


@router.post("/reserve")
async def reserve_stock(
    reservation_req: ReserveStockRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Reserve stock for an order at a specific location.

    Args:
        reservation_req: Reservation request details

    Returns:
        Created reservation details
    """
    product_id = UUID(reservation_req.product_id)
    order_id = UUID(reservation_req.order_id)

    # Check stock availability
    stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == reservation_req.location,
        )
    )
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()

    if not stock:
        raise HTTPException(
            status_code=400,
            detail=f"Product not found at {reservation_req.location}",
        )

    if stock.available < reservation_req.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient available stock. Available: {stock.available}, Requested: {reservation_req.quantity}",  # noqa: E501
        )

    # Create reservation
    expires_at = datetime.now() + timedelta(hours=reservation_req.expires_hours)

    reservation = StockReservation(
        product_id=product_id,
        order_id=order_id,
        location=reservation_req.location,
        quantity=reservation_req.quantity,
        status="active",
        expires_at=expires_at,
    )
    db.add(reservation)

    # Update reserved quantity
    stock.reserved += reservation_req.quantity

    await db.commit()

    logger.info(
        "Stock reserved",
        reservation_id=str(reservation.id),
        product_id=str(product_id),
        order_id=str(order_id),
        location=reservation_req.location,
        quantity=reservation_req.quantity,
    )

    return {
        "success": True,
        "reservation_id": str(reservation.id),
        "product_id": str(product_id),
        "order_id": str(order_id),
        "location": reservation_req.location,
        "quantity": reservation_req.quantity,
        "expires_at": expires_at.isoformat(),
        "status": "active",
    }


@router.post("/release/{reservation_id}")
async def release_reservation(
    reservation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Release a stock reservation (e.g., when order is cancelled).

    Args:
        reservation_id: Reservation UUID

    Returns:
        Updated reservation status
    """
    # Get reservation
    stmt = select(StockReservation).where(StockReservation.id == reservation_id)
    result = await db.execute(stmt)
    reservation = result.scalar_one_or_none()

    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if reservation.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot release reservation with status: {reservation.status}",
        )

    # Get stock record
    stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id == reservation.product_id,
            ProductStockByLocation.location == reservation.location,
        )
    )
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()

    if stock:
        # Release reserved quantity
        stock.reserved = max(0, stock.reserved - reservation.quantity)

    # Update reservation status
    reservation.status = "cancelled"
    reservation.cancelled_at = datetime.now()

    await db.commit()

    logger.info(
        "Stock reservation released",
        reservation_id=str(reservation_id),
        product_id=str(reservation.product_id),
        quantity=reservation.quantity,
    )

    return {
        "success": True,
        "reservation_id": str(reservation_id),
        "status": "cancelled",
        "released_quantity": reservation.quantity,
    }


# ============================================
# Stock Adjustment Endpoints
# ============================================


@router.post("/adjust")
async def adjust_stock(
    adjustment_req: StockAdjustmentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Adjust stock level at a location (for corrections, damages, etc.).

    Args:
        adjustment_req: Adjustment request details

    Returns:
        Updated stock level
    """
    product_id = UUID(adjustment_req.product_id)

    # Get or create stock record
    stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == adjustment_req.location,
        )
    )
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()

    if not stock:
        # Create new stock record if it doesn't exist
        stock = ProductStockByLocation(
            product_id=product_id,
            location=adjustment_req.location,
            stock=max(0, adjustment_req.quantity_change),
            reserved=0,
        )
        db.add(stock)
        previous_qty = 0
    else:
        previous_qty = stock.stock

    # Apply adjustment
    new_stock = max(0, stock.stock + adjustment_req.quantity_change)
    stock.stock = new_stock

    # Log adjustment
    adjustment = StockAdjustment(
        product_id=product_id,
        location=adjustment_req.location,
        quantity_change=adjustment_req.quantity_change,
        previous_quantity=previous_qty,
        new_quantity=new_stock,
        adjustment_type=adjustment_req.adjustment_type,
        reason=adjustment_req.reason,
    )
    db.add(adjustment)

    await db.commit()

    logger.info(
        "Stock adjusted",
        adjustment_id=str(adjustment.id),
        product_id=str(product_id),
        location=adjustment_req.location,
        change=adjustment_req.quantity_change,
        new_stock=new_stock,
    )

    return {
        "success": True,
        "adjustment_id": str(adjustment.id),
        "product_id": str(product_id),
        "location": adjustment_req.location,
        "previous_quantity": previous_qty,
        "quantity_change": adjustment_req.quantity_change,
        "new_quantity": new_stock,
    }
