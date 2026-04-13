"""Multi-store inventory API endpoints.

Provides RESTful endpoints for managing stock across multiple locations.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.demo_models import Product
from src.db.inventory_models import (
    ProductAttribute,
    ProductBarcode,
    ProductStockByLocation,
    ProductVariant,
    ReorderRule,
    StockAdjustment,
    StockReservation,
    StockTake,
    StockTakeItem,
    StockTransfer,
    StoreLocation,
    Supplier,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/inventory", tags=["Multi-Store Inventory"], dependencies=[Depends(get_current_user)])


# ============================================
# Request/Response Models
# ============================================


class InventoryListResponse(BaseModel):
    """List of inventory items with pagination."""

    items: list[dict]
    total: int
    page: int
    page_size: int


# GAP-015: Auto-reorder models
class AutoReorderRequest(BaseModel):
    """Request for auto-reorder trigger."""

    organization_id: UUID
    product_ids: list[UUID] | None = None  # If None, check all products
    dry_run: bool = False  # Preview without creating POs


class AutoReorderItem(BaseModel):
    """Auto-reorder result item."""

    product_id: UUID
    product_name: str
    current_stock: int
    reorder_point: int
    reorder_quantity: int
    supplier_id: UUID | None
    po_created: bool
    po_id: UUID | None


class AutoReorderResponse(BaseModel):
    """Auto-reorder response."""

    items: list[AutoReorderItem]
    total_products_checked: int
    total_pos_created: int
    total_value: Decimal


# GAP-018: Bulk adjust models
class BulkAdjustItem(BaseModel):
    """Bulk adjustment item."""

    product_id: UUID
    adjustment_quantity: int  # Can be negative
    reason: str  # "stock_take", "damage", "theft", "correction"


class BulkAdjustRequest(BaseModel):
    """Request for bulk adjustment."""

    organization_id: UUID
    adjustments: list[BulkAdjustItem]
    notes: str | None = None


class BulkAdjustResult(BaseModel):
    """Bulk adjustment result."""

    product_id: UUID
    old_quantity: int
    adjustment: int
    new_quantity: int
    success: bool


class BulkAdjustResponse(BaseModel):
    """Bulk adjustment response."""

    results: list[BulkAdjustResult]
    total_adjusted: int
    total_failed: int


# GAP-019: Active stock takes models
class ActiveStockTake(BaseModel):
    """Active stock take session."""

    id: UUID
    name: str
    started_at: datetime
    started_by: str
    location: str | None
    items_counted: int
    total_items: int
    progress_percentage: float


class ActiveStockTakesResponse(BaseModel):
    """Active stock takes response."""

    stock_takes: list[ActiveStockTake]
    total: int


# GAP-020: Cycle count models
class CycleCountGenerateRequest(BaseModel):
    """Request for cycle count generation."""

    organization_id: UUID
    start_date: datetime
    frequency_a: int = 7  # Days between A counts
    frequency_b: int = 30
    frequency_c: int = 90


class CycleCountSchedule(BaseModel):
    """Cycle count schedule item."""

    product_id: UUID
    product_name: str
    classification: str  # "A", "B", "C"
    next_count_date: datetime
    frequency_days: int


class CycleCountGenerateResponse(BaseModel):
    """Cycle count generation response."""

    schedule: list[CycleCountSchedule]
    total_products: int
    a_count: int
    b_count: int
    c_count: int


# ============================================
# Root Endpoints
# ============================================


@router.get("", response_model=InventoryListResponse)
@router.get("/", response_model=InventoryListResponse, include_in_schema=False)
async def list_all_inventory(
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
                detail=f"Invalid location. Must be one of: {', '.join([loc.value for loc in StoreLocation])}",
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
# Summary & Settings Endpoints (must be before dynamic routes)
# ============================================


class InventorySummaryResponse(BaseModel):
    """Inventory dashboard summary statistics."""

    total_skus: int
    total_stock_value: float
    below_reorder_point: int
    active_reservations: int


class ReorderSettingsRequest(BaseModel):
    """Request to update reorder settings for a product at a location."""

    reorder_point: int = Field(..., ge=0, description="Stock level at which to reorder")
    reorder_quantity: int = Field(..., ge=1, description="Quantity to reorder when triggered")


@router.get("/summary", response_model=InventorySummaryResponse)
async def get_inventory_summary(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InventorySummaryResponse:
    """Get inventory dashboard summary statistics.

    Returns:
        Summary with total SKUs, stock value, below-reorder count, and active reservations
    """
    # Count distinct products in stock
    total_skus_stmt = select(func.count(func.distinct(ProductStockByLocation.product_id)))
    total_skus_result = await db.execute(total_skus_stmt)
    total_skus = total_skus_result.scalar() or 0

    # Total stock value: sum(stock * product.price) joined with products
    stock_value_stmt = (
        select(func.sum(ProductStockByLocation.stock * Product.price))
        .join(Product, ProductStockByLocation.product_id == Product.id)
    )
    stock_value_result = await db.execute(stock_value_stmt)
    total_stock_value = float(stock_value_result.scalar() or 0.0)

    # Count rows where reorder_point IS NOT NULL AND stock <= reorder_point
    below_reorder_stmt = select(func.count()).where(
        and_(
            ProductStockByLocation.reorder_point.isnot(None),
            ProductStockByLocation.stock <= ProductStockByLocation.reorder_point,
        )
    )
    below_reorder_result = await db.execute(below_reorder_stmt)
    below_reorder_point = below_reorder_result.scalar() or 0

    # Count active reservations
    active_reservations_stmt = select(func.count()).where(
        StockReservation.status == "active"
    )
    active_reservations_result = await db.execute(active_reservations_stmt)
    active_reservations = active_reservations_result.scalar() or 0

    logger.info(
        "Inventory summary fetched",
        total_skus=total_skus,
        total_stock_value=total_stock_value,
        below_reorder_point=below_reorder_point,
        active_reservations=active_reservations,
    )

    return InventorySummaryResponse(
        total_skus=total_skus,
        total_stock_value=total_stock_value,
        below_reorder_point=below_reorder_point,
        active_reservations=active_reservations,
    )


@router.patch("/reorder-settings/{product_id}/{location}")
async def update_reorder_settings(
    product_id: str,
    location: str,
    body: ReorderSettingsRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Update reorder point and quantity for a product at a location.

    Args:
        product_id: Product UUID
        location: Store location (brisbane, sydney, melbourne)
        body: Reorder settings to apply

    Returns:
        Updated stock record details
    """
    # Validate location
    try:
        StoreLocation(location)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid location. Must be one of: {', '.join([loc.value for loc in StoreLocation])}",
        )

    # Parse product_id
    try:
        product_uuid = UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id format")

    # Fetch the stock record
    stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id == product_uuid,
            ProductStockByLocation.location == location,
        )
    )
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()

    if not stock:
        raise HTTPException(
            status_code=404,
            detail=f"Stock record not found for product {product_id} at {location}",
        )

    # Apply updates
    stock.reorder_point = body.reorder_point
    stock.reorder_quantity = body.reorder_quantity

    await db.commit()
    await db.refresh(stock)

    logger.info(
        "Reorder settings updated",
        product_id=product_id,
        location=location,
        reorder_point=body.reorder_point,
        reorder_quantity=body.reorder_quantity,
    )

    return {
        "success": True,
        "product_id": product_id,
        "location": location,
        "reorder_point": stock.reorder_point,
        "reorder_quantity": stock.reorder_quantity,
        "stock": stock.stock,
        "available": stock.available,
    }


# ============================================
# Barcode Endpoints (must be before /{...} dynamic routes)
# ============================================


class BarcodeCreateRequest(BaseModel):
    """Request body for adding a barcode to a product."""

    product_id: str = Field(..., description="Product UUID")
    barcode: str = Field(..., min_length=1, max_length=100, description="Barcode value")
    barcode_type: str = Field(default="EAN13", description="EAN13 | UPC | QR | CODE128")


class BarcodeProductResponse(BaseModel):
    """Response for a barcode lookup."""

    product_id: str
    product_name: str
    sku: str
    barcodes: list[dict]
    stock_by_location: list[dict]


@router.get("/barcode/{code}", response_model=BarcodeProductResponse)
async def lookup_by_barcode(
    code: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BarcodeProductResponse:
    """Look up a product by barcode value.

    Args:
        code: Barcode string to look up

    Returns:
        Product details including all barcodes and stock by location

    Raises:
        404: If barcode not found
    """
    # Find the barcode record
    barcode_stmt = select(ProductBarcode).where(ProductBarcode.barcode == code)
    barcode_result = await db.execute(barcode_stmt)
    barcode_row = barcode_result.scalar_one_or_none()

    if not barcode_row:
        raise HTTPException(status_code=404, detail=f"Barcode '{code}' not found")

    product_id = barcode_row.product_id

    # Fetch product details
    product_stmt = select(Product).where(Product.id == product_id)
    product_result = await db.execute(product_stmt)
    product = product_result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found for this barcode")

    # Fetch all barcodes for this product
    all_barcodes_stmt = select(ProductBarcode).where(ProductBarcode.product_id == product_id)
    all_barcodes_result = await db.execute(all_barcodes_stmt)
    all_barcodes = all_barcodes_result.scalars().all()

    # Fetch stock by location
    stock_stmt = select(ProductStockByLocation).where(
        ProductStockByLocation.product_id == product_id
    )
    stock_result = await db.execute(stock_stmt)
    stock_rows = stock_result.scalars().all()

    logger.info("Barcode lookup successful", barcode=code, product_id=str(product_id))

    return BarcodeProductResponse(
        product_id=str(product_id),
        product_name=product.name,
        sku=product.sku,
        barcodes=[
            {"barcode": b.barcode, "barcode_type": b.barcode_type}
            for b in all_barcodes
        ],
        stock_by_location=[
            {"location": s.location, "stock_quantity": s.available}
            for s in stock_rows
        ],
    )


@router.post("/barcode", status_code=201)
async def add_barcode(
    body: BarcodeCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Add a barcode to a product.

    Args:
        body: product_id, barcode value, and barcode_type

    Returns:
        Created barcode record

    Raises:
        409: If barcode already exists
        404: If product not found
    """
    # Validate product_id format
    try:
        product_uuid = UUID(body.product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id format")

    # Check product exists
    product_stmt = select(Product).where(Product.id == product_uuid)
    product_result = await db.execute(product_stmt)
    product = product_result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{body.product_id}' not found")

    # Check barcode uniqueness
    existing_stmt = select(ProductBarcode).where(ProductBarcode.barcode == body.barcode)
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Barcode '{body.barcode}' is already assigned to another product",
        )

    # Create new barcode record
    new_barcode = ProductBarcode(
        product_id=product_uuid,
        barcode=body.barcode,
        barcode_type=body.barcode_type,
    )
    db.add(new_barcode)
    await db.commit()
    await db.refresh(new_barcode)

    logger.info(
        "Barcode added",
        barcode=body.barcode,
        product_id=body.product_id,
        barcode_type=body.barcode_type,
    )

    return {
        "id": str(new_barcode.id),
        "product_id": str(new_barcode.product_id),
        "barcode": new_barcode.barcode,
        "barcode_type": new_barcode.barcode_type,
        "created_at": new_barcode.created_at.isoformat(),
    }


@router.delete("/barcode/{code}", status_code=204, response_model=None)
async def remove_barcode(
    code: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Delete a barcode record by barcode value.

    Args:
        code: Barcode string to delete

    Raises:
        404: If barcode not found
    """
    barcode_stmt = select(ProductBarcode).where(ProductBarcode.barcode == code)
    barcode_result = await db.execute(barcode_stmt)
    barcode_row = barcode_result.scalar_one_or_none()

    if not barcode_row:
        raise HTTPException(status_code=404, detail=f"Barcode '{code}' not found")

    await db.delete(barcode_row)
    await db.commit()

    logger.info("Barcode removed", barcode=code)


# ============================================
# Stock Level Endpoints
# ============================================


@router.get("/product/{product_id}/locations")
async def get_product_stock_by_locations(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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

    # PHASE 5: Publish real-time inventory updates for both locations
    from src.services.sse_service import sse_service

    # Source location update
    source_available = source_stock.stock - (source_stock.reserved or 0)
    await sse_service.publish(f"inventory-{transfer_req.from_location}", {
        "product_id": str(product_id),
        "location": transfer_req.from_location,
        "stock": source_stock.stock,
        "reserved": source_stock.reserved or 0,
        "available": source_available,
        "change_type": "transfer",
        "timestamp": datetime.utcnow().timestamp(),
    })
    await sse_service.publish("inventory-all", {
        "product_id": str(product_id),
        "location": transfer_req.from_location,
        "stock": source_stock.stock,
        "reserved": source_stock.reserved or 0,
        "available": source_available,
        "change_type": "transfer",
        "timestamp": datetime.utcnow().timestamp(),
    })

    # Destination location update
    dest_available = dest_stock.stock - (dest_stock.reserved or 0)
    await sse_service.publish(f"inventory-{transfer_req.to_location}", {
        "product_id": str(product_id),
        "location": transfer_req.to_location,
        "stock": dest_stock.stock,
        "reserved": dest_stock.reserved or 0,
        "available": dest_available,
        "change_type": "transfer",
        "timestamp": datetime.utcnow().timestamp(),
    })
    await sse_service.publish("inventory-all", {
        "product_id": str(product_id),
        "location": transfer_req.to_location,
        "stock": dest_stock.stock,
        "reserved": dest_stock.reserved or 0,
        "available": dest_available,
        "change_type": "transfer",
        "timestamp": datetime.utcnow().timestamp(),
    })

    logger.info(
        "Stock transfer completed",
        transfer_id=str(transfer.id),
        product_id=str(product_id),
        from_location=transfer_req.from_location,
        to_location=transfer_req.to_location,
        quantity=transfer_req.quantity,
    )

    # PHASE 2: Enhanced Shopify Integration - Task 2.1: Automatic Shopify Sync
    # Trigger automatic Shopify inventory sync after stock transfer
    try:
        from src.config.shopify_settings import get_shopify_settings
        from src.db.shopify_models import ShopifyProductMapping
        from src.integrations.shopify.client import get_shopify_client
        from src.integrations.shopify.inventory_sync import InventorySyncService

        # Check if product has Shopify mapping
        mapping_query = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_id
        )
        mapping_result = await db.execute(mapping_query)
        shopify_mapping = mapping_result.scalar_one_or_none()

        if shopify_mapping and shopify_mapping.shopify_inventory_item_id:
            logger.info(
                "Stock transferred, triggering automatic Shopify sync",
                product_id=str(product_id),
                from_location=transfer_req.from_location,
                to_location=transfer_req.to_location,
            )

            # Get Shopify settings
            shopify_settings = get_shopify_settings()

            # Initialize sync service
            shopify_client = get_shopify_client(shopify_settings)
            sync_service = InventorySyncService(shopify_client)

            # Sync to Shopify (aggregates multi-location stock, handled in Task 2.2)
            async with shopify_client:
                sync_result = await sync_service.sync_stock_to_shopify(
                    db=db,
                    product_id=product_id,
                    shopify_product_id=str(shopify_mapping.shopify_product_id),
                    shopify_inventory_item_id=str(shopify_mapping.shopify_inventory_item_id),
                    shopify_location_id=shopify_settings.inventory_location_id,
                    triggered_by="auto_inventory_transfer",
                )

                if sync_result["success"]:
                    logger.info(
                        "Automatic Shopify sync completed after transfer",
                        product_id=str(product_id),
                        delta=sync_result.get("delta", 0),
                    )
                else:
                    logger.error(
                        "Automatic Shopify sync failed after transfer",
                        product_id=str(product_id),
                        error=sync_result.get("error"),
                    )
        else:
            logger.debug(
                "Product not mapped to Shopify, skipping automatic sync",
                product_id=str(product_id),
            )

    except Exception as e:
        # Log error but don't fail the stock transfer
        logger.error(
            "Failed to trigger automatic Shopify sync after transfer",
            product_id=str(product_id),
            error=str(e),
        )
        # Continue with transfer success

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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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
    db: Annotated[AsyncSession, Depends(get_async_db)],
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

    # PHASE 5: Publish real-time inventory update to SSE subscribers
    from src.services.sse_service import sse_service
    available = new_stock - (stock.reserved or 0)
    await sse_service.publish(f"inventory-{adjustment_req.location}", {
        "product_id": str(product_id),
        "location": adjustment_req.location,
        "stock": new_stock,
        "reserved": stock.reserved or 0,
        "available": available,
        "change_type": "adjustment",
        "timestamp": datetime.utcnow().timestamp(),
    })
    await sse_service.publish("inventory-all", {
        "product_id": str(product_id),
        "location": adjustment_req.location,
        "stock": new_stock,
        "reserved": stock.reserved or 0,
        "available": available,
        "change_type": "adjustment",
        "timestamp": datetime.utcnow().timestamp(),
    })

    logger.info(
        "Stock adjusted",
        adjustment_id=str(adjustment.id),
        product_id=str(product_id),
        location=adjustment_req.location,
        change=adjustment_req.quantity_change,
        new_stock=new_stock,
    )

    # PHASE 2: Enhanced Shopify Integration - Task 2.1: Automatic Shopify Sync
    # Trigger automatic Shopify inventory sync after stock adjustment
    try:
        from src.config.shopify_settings import get_shopify_settings
        from src.db.shopify_models import ShopifyProductMapping
        from src.integrations.shopify.client import get_shopify_client
        from src.integrations.shopify.inventory_sync import InventorySyncService

        # Check if product has Shopify mapping
        mapping_query = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_id
        )
        mapping_result = await db.execute(mapping_query)
        shopify_mapping = mapping_result.scalar_one_or_none()

        if shopify_mapping and shopify_mapping.shopify_inventory_item_id:
            logger.info(
                "Stock adjusted, triggering automatic Shopify sync",
                product_id=str(product_id),
                location=adjustment_req.location,
                new_stock=new_stock,
            )

            # Get Shopify settings
            shopify_settings = get_shopify_settings()

            # Initialize sync service
            shopify_client = get_shopify_client(shopify_settings)
            sync_service = InventorySyncService(shopify_client)

            # Sync to Shopify (with retry logic built-in)
            # Note: This syncs the product's total stock, aggregating across locations handled in Task 2.2
            async with shopify_client:
                sync_result = await sync_service.sync_stock_to_shopify(
                    db=db,
                    product_id=product_id,
                    shopify_product_id=str(shopify_mapping.shopify_product_id),
                    shopify_inventory_item_id=str(shopify_mapping.shopify_inventory_item_id),
                    shopify_location_id=shopify_settings.inventory_location_id,
                    triggered_by="auto_inventory_adjustment",
                )

                if sync_result["success"]:
                    logger.info(
                        "Automatic Shopify sync completed",
                        product_id=str(product_id),
                        delta=sync_result.get("delta", 0),
                    )
                else:
                    logger.error(
                        "Automatic Shopify sync failed",
                        product_id=str(product_id),
                        error=sync_result.get("error"),
                    )
        else:
            logger.debug(
                "Product not mapped to Shopify, skipping automatic sync",
                product_id=str(product_id),
            )

    except Exception as e:
        # Log error but don't fail the stock adjustment
        logger.error(
            "Failed to trigger automatic Shopify sync",
            product_id=str(product_id),
            error=str(e),
        )
        # Continue with stock adjustment success

    return {
        "success": True,
        "adjustment_id": str(adjustment.id),
        "product_id": str(product_id),
        "location": adjustment_req.location,
        "previous_quantity": previous_qty,
        "quantity_change": adjustment_req.quantity_change,
        "new_quantity": new_stock,
    }


# ============================================
# Stock Take / Cycle Count Endpoints
# ============================================


class StockTakeCreateRequest(BaseModel):
    location: str


class StockTakeItemInput(BaseModel):
    product_id: str
    counted_qty: int = Field(..., ge=0)


class StockTakeSubmitRequest(BaseModel):
    items: list[StockTakeItemInput]


@router.post("/stock-take", status_code=201)
async def create_stock_take(
    body: StockTakeCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Start a new stock-take session for a location."""
    try:
        StoreLocation(body.location)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid location: {body.location}")

    take = StockTake(location=body.location, status="draft")
    db.add(take)
    await db.commit()
    await db.refresh(take)
    logger.info("Stock take started", id=str(take.id), location=body.location)
    return {"id": str(take.id), "location": take.location, "status": take.status,
            "created_at": take.created_at.isoformat()}


@router.get("/stock-takes")
async def list_stock_takes(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    location: str | None = Query(None),
    status: str | None = Query(None),
) -> list[dict]:
    """List stock-take sessions, optionally filtered by location/status."""
    stmt = select(StockTake).order_by(StockTake.created_at.desc())
    if location:
        stmt = stmt.where(StockTake.location == location)
    if status:
        stmt = stmt.where(StockTake.status == status)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "location": t.location,
            "status": t.status,
            "created_at": t.created_at.isoformat(),
            "submitted_at": t.submitted_at.isoformat() if t.submitted_at else None,
        }
        for t in rows
    ]


@router.post("/stock-take/{take_id}/submit")
async def submit_stock_take(
    take_id: str,
    body: StockTakeSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Submit a stock-take, applying variances as StockAdjustment records.

    Runs atomically: all adjustments applied or none.
    """
    try:
        take_uuid = UUID(take_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid take_id")

    stmt = select(StockTake).where(StockTake.id == take_uuid)
    result = await db.execute(stmt)
    take = result.scalar_one_or_none()

    if not take:
        raise HTTPException(status_code=404, detail="Stock take not found")
    if take.status == "submitted":
        raise HTTPException(status_code=409, detail="Stock take already submitted")

    now = datetime.now(UTC)

    async with db.begin_nested():
        for item_input in body.items:
            try:
                product_uuid = UUID(item_input.product_id)
            except ValueError:
                continue

            # Get system stock level at this location
            stock_stmt = select(ProductStockByLocation).where(
                and_(
                    ProductStockByLocation.product_id == product_uuid,
                    ProductStockByLocation.location == take.location,
                )
            )
            stock_result = await db.execute(stock_stmt)
            stock = stock_result.scalar_one_or_none()
            if not stock:
                continue

            system_qty = stock.stock
            variance = item_input.counted_qty - system_qty

            # Create StockTakeItem
            take_item = StockTakeItem(
                stock_take_id=take_uuid,
                product_id=product_uuid,
                system_qty=system_qty,
                counted_qty=item_input.counted_qty,
                variance=variance,
            )
            db.add(take_item)

            # Apply variance as StockAdjustment if non-zero
            if variance != 0:
                new_stock = max(0, system_qty + variance)
                stock.stock = new_stock
                stock.last_counted_at = now

                adj = StockAdjustment(
                    product_id=product_uuid,
                    location=take.location,
                    quantity_change=variance,
                    previous_quantity=system_qty,
                    new_quantity=new_stock,
                    adjustment_type="stock_count",
                    reason=f"Stock take {take_id}",
                )
                db.add(adj)

        take.status = "submitted"
        take.submitted_at = now

    await db.commit()
    logger.info("Stock take submitted", id=take_id, items_count=len(body.items))
    return {"success": True, "take_id": take_id, "items_processed": len(body.items)}


# ============================================
# Reorder Rules Endpoints
# ============================================


class ReorderRuleCreateRequest(BaseModel):
    product_id: str
    location: str
    supplier_id: str | None = None
    auto_approve_under_qty: int = Field(default=0, ge=0)
    lead_time_days: int = Field(default=7, ge=0)
    is_enabled: bool = True


class ReorderRuleUpdateRequest(BaseModel):
    supplier_id: str | None = None
    auto_approve_under_qty: int | None = None
    lead_time_days: int | None = None
    is_enabled: bool | None = None


@router.get("/reorder-rules")
async def list_reorder_rules(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    location: str | None = Query(None),
) -> list[dict]:
    """List all reorder rules, optionally filtered by location."""
    stmt = select(ReorderRule).order_by(ReorderRule.created_at.desc())
    if location:
        stmt = stmt.where(ReorderRule.location == location)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "product_id": str(r.product_id),
            "location": r.location,
            "supplier_id": str(r.supplier_id) if r.supplier_id else None,
            "auto_approve_under_qty": r.auto_approve_under_qty,
            "lead_time_days": r.lead_time_days,
            "is_enabled": r.is_enabled,
        }
        for r in rows
    ]


@router.post("/reorder-rules", status_code=201)
async def create_reorder_rule(
    body: ReorderRuleCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Create or upsert a reorder rule for a product+location."""
    try:
        product_uuid = UUID(body.product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id")
    supplier_uuid = UUID(body.supplier_id) if body.supplier_id else None

    # Upsert by product+location unique constraint
    existing_stmt = select(ReorderRule).where(
        and_(ReorderRule.product_id == product_uuid, ReorderRule.location == body.location)
    )
    existing_result = await db.execute(existing_stmt)
    rule = existing_result.scalar_one_or_none()

    if rule:
        rule.supplier_id = supplier_uuid
        rule.auto_approve_under_qty = body.auto_approve_under_qty
        rule.lead_time_days = body.lead_time_days
        rule.is_enabled = body.is_enabled
    else:
        rule = ReorderRule(
            product_id=product_uuid,
            location=body.location,
            supplier_id=supplier_uuid,
            auto_approve_under_qty=body.auto_approve_under_qty,
            lead_time_days=body.lead_time_days,
            is_enabled=body.is_enabled,
        )
        db.add(rule)

    await db.commit()
    await db.refresh(rule)
    return {
        "id": str(rule.id),
        "product_id": str(rule.product_id),
        "location": rule.location,
        "supplier_id": str(rule.supplier_id) if rule.supplier_id else None,
        "auto_approve_under_qty": rule.auto_approve_under_qty,
        "lead_time_days": rule.lead_time_days,
        "is_enabled": rule.is_enabled,
    }


# ============================================
# Reorder Alerts Endpoint
# ============================================


class ReorderAlertResponse(BaseModel):
    product_id: str
    sku: str
    name: str
    location: str
    stock: int
    reorder_point: int
    reorder_quantity: int | None
    supplier_id: str | None
    supplier_name: str | None


@router.get("/reorder-alerts", response_model=list[ReorderAlertResponse])
async def get_reorder_alerts(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    location: str | None = Query(None),
) -> list[ReorderAlertResponse]:
    """Return products at or below their reorder point.

    Joins with ReorderRule (if present) to include preferred supplier.
    """
    stmt = (
        select(ProductStockByLocation, Product)
        .join(Product, ProductStockByLocation.product_id == Product.id)
        .where(
            and_(
                ProductStockByLocation.reorder_point.isnot(None),
                ProductStockByLocation.stock <= ProductStockByLocation.reorder_point,
            )
        )
        .order_by(ProductStockByLocation.stock.asc())
    )
    if location:
        stmt = stmt.where(ProductStockByLocation.location == location)

    result = await db.execute(stmt)
    rows = result.all()

    alerts = []
    for stock, product in rows:
        # Try to find a matching ReorderRule for supplier info
        rule_stmt = select(ReorderRule, Supplier).outerjoin(
            Supplier, ReorderRule.supplier_id == Supplier.id
        ).where(
            and_(
                ReorderRule.product_id == stock.product_id,
                ReorderRule.location == stock.location,
                ReorderRule.is_enabled.is_(True),
            )
        )
        rule_result = await db.execute(rule_stmt)
        rule_row = rule_result.first()
        supplier_id = None
        supplier_name = None
        if rule_row:
            rule, supplier = rule_row
            if rule:
                supplier_id = str(rule.supplier_id) if rule.supplier_id else None
            if supplier:
                supplier_name = supplier.company_name

        alerts.append(
            ReorderAlertResponse(
                product_id=str(stock.product_id),
                sku=product.sku,
                name=product.name,
                location=stock.location,
                stock=stock.stock,
                reorder_point=stock.reorder_point,
                reorder_quantity=stock.reorder_quantity,
                supplier_id=supplier_id,
                supplier_name=supplier_name,
            )
        )

    return alerts


# ============================================
# Product Attributes Endpoints
# ============================================


class ProductAttributeCreateRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    value: str = Field(..., min_length=1, max_length=500)
    unit: str | None = None


@router.get("/products/{product_id}/attributes")
async def list_product_attributes(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[dict]:
    """List all attributes for a product."""
    try:
        pid = UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id")

    stmt = select(ProductAttribute).where(ProductAttribute.product_id == pid)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {"id": str(a.id), "key": a.key, "value": a.value, "unit": a.unit,
         "created_at": a.created_at.isoformat()}
        for a in rows
    ]


@router.post("/products/{product_id}/attributes", status_code=201)
async def add_product_attribute(
    product_id: str,
    body: ProductAttributeCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Add an attribute to a product."""
    try:
        pid = UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id")

    attr = ProductAttribute(product_id=pid, key=body.key, value=body.value, unit=body.unit)
    db.add(attr)
    await db.commit()
    await db.refresh(attr)
    return {"id": str(attr.id), "key": attr.key, "value": attr.value, "unit": attr.unit}


@router.delete("/products/{product_id}/attributes/{attribute_id}", status_code=204, response_model=None)
async def delete_product_attribute(
    product_id: str,
    attribute_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Delete a product attribute."""
    try:
        pid = UUID(product_id)
        aid = UUID(attribute_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    stmt = select(ProductAttribute).where(
        and_(ProductAttribute.id == aid, ProductAttribute.product_id == pid)
    )
    result = await db.execute(stmt)
    attr = result.scalar_one_or_none()
    if not attr:
        raise HTTPException(status_code=404, detail="Attribute not found")
    await db.delete(attr)
    await db.commit()


# ============================================
# Product Variants Endpoints
# ============================================


class ProductVariantCreateRequest(BaseModel):
    variant_sku: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    attributes: dict | None = None
    price_override: float | None = None
    is_active: bool = True


@router.get("/products/{product_id}/variants")
async def list_product_variants(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[dict]:
    """List all variants for a product."""
    try:
        pid = UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id")

    stmt = select(ProductVariant).where(ProductVariant.product_id == pid)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": str(v.id),
            "variant_sku": v.variant_sku,
            "name": v.name,
            "attributes": v.attributes,
            "price_override": float(v.price_override) if v.price_override else None,
            "is_active": v.is_active,
            "created_at": v.created_at.isoformat(),
        }
        for v in rows
    ]


@router.post("/products/{product_id}/variants", status_code=201)
async def create_product_variant(
    product_id: str,
    body: ProductVariantCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Create a product variant."""
    try:
        pid = UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id")

    # Check SKU uniqueness
    existing = await db.execute(
        select(ProductVariant).where(ProductVariant.variant_sku == body.variant_sku)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Variant SKU '{body.variant_sku}' already exists")

    variant = ProductVariant(
        product_id=pid,
        variant_sku=body.variant_sku,
        name=body.name,
        attributes=body.attributes,
        price_override=body.price_override,
        is_active=body.is_active,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return {
        "id": str(variant.id),
        "variant_sku": variant.variant_sku,
        "name": variant.name,
        "attributes": variant.attributes,
        "price_override": float(variant.price_override) if variant.price_override else None,
        "is_active": variant.is_active,
    }


@router.delete("/products/{product_id}/variants/{variant_id}", status_code=204, response_model=None)
async def delete_product_variant(
    product_id: str,
    variant_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Delete a product variant."""
    try:
        pid = UUID(product_id)
        vid = UUID(variant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    stmt = select(ProductVariant).where(
        and_(ProductVariant.id == vid, ProductVariant.product_id == pid)
    )
    result = await db.execute(stmt)
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    await db.delete(variant)
    await db.commit()


# ============================================
# GAP-015: Auto-reorder endpoint
# ============================================


@router.post("/auto-reorder", response_model=AutoReorderResponse)
async def trigger_auto_reorder(
    request: AutoReorderRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> AutoReorderResponse:
    """
    Trigger auto-reorder for products below reorder point.

    Uses auto_reorder service for business logic.
    """
    from uuid import uuid4

    from src.services.auto_reorder import should_reorder

    # Get products to check
    stmt = select(Product).where(Product.organization_id == request.organization_id)
    if request.product_ids:
        stmt = stmt.where(Product.id.in_(request.product_ids))

    result = await db.execute(stmt)
    products = result.scalars().all()

    items = []
    total_value = Decimal("0.00")
    pos_created = 0

    for product in products:
        # Check if reorder needed using service
        reorder_calc = should_reorder(
            product_id=product.id,
            current_stock=product.stock,
            reorder_point=getattr(product, 'reorder_point', 0) or 0,
            pending_po_quantity=0,
        )

        if reorder_calc.should_reorder:
            quantity = reorder_calc.reorder_quantity

            po_id = None
            po_created_flag = False

            if not request.dry_run:
                # Create PO (simplified - in production, group by supplier)
                po_id = uuid4()
                po_created_flag = True
                pos_created += 1
                total_value += product.cost * quantity

            items.append(AutoReorderItem(
                product_id=product.id,
                product_name=product.name,
                current_stock=product.stock,
                reorder_point=getattr(product, 'reorder_point', 0) or 0,
                reorder_quantity=quantity,
                supplier_id=None,  # Would need supplier relationship
                po_created=po_created_flag,
                po_id=po_id
            ))

    logger.info(
        "auto_reorder_triggered",
        organization_id=str(request.organization_id),
        products_checked=len(products),
        items_to_reorder=len(items),
        pos_created=pos_created,
        dry_run=request.dry_run,
    )

    return AutoReorderResponse(
        items=items,
        total_products_checked=len(products),
        total_pos_created=pos_created,
        total_value=total_value
    )


# ============================================
# GAP-018: Bulk adjust inventory
# ============================================


@router.post("/bulk-adjust", response_model=BulkAdjustResponse)
async def bulk_adjust_inventory(
    request: BulkAdjustRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BulkAdjustResponse:
    """
    Bulk adjust inventory quantities (e.g., stock take results).
    """
    from sqlalchemy import update

    results = []

    for item in request.adjustments:
        # Get product
        stmt = select(Product).where(
            Product.id == item.product_id,
            Product.organization_id == request.organization_id
        )
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()

        if not product:
            results.append(BulkAdjustResult(
                product_id=item.product_id,
                old_quantity=0,
                adjustment=item.adjustment_quantity,
                new_quantity=0,
                success=False
            ))
            continue

        old_qty = product.stock
        new_qty = old_qty + item.adjustment_quantity

        if new_qty < 0:
            new_qty = 0  # Can't go negative

        # Update product
        stmt = update(Product).where(
            Product.id == item.product_id
        ).values(stock=new_qty)
        await db.execute(stmt)

        results.append(BulkAdjustResult(
            product_id=item.product_id,
            old_quantity=old_qty,
            adjustment=item.adjustment_quantity,
            new_quantity=new_qty,
            success=True
        ))

    await db.commit()

    total_adjusted = sum(1 for r in results if r.success)
    total_failed = len(results) - total_adjusted

    logger.info(
        "bulk_adjust_complete",
        organization_id=str(request.organization_id),
        total_adjusted=total_adjusted,
        total_failed=total_failed,
        reason=request.adjustments[0].reason if request.adjustments else None,
    )

    return BulkAdjustResponse(
        results=results,
        total_adjusted=total_adjusted,
        total_failed=total_failed
    )


# ============================================
# GAP-019: Active stock takes
# ============================================


@router.get("/stock-takes/active", response_model=ActiveStockTakesResponse)
async def get_active_stock_takes(
    organization_id: Annotated[UUID, Query()],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ActiveStockTakesResponse:
    """
    Get active stock take sessions.
    """

    # Query active stock takes
    stmt = select(StockTake).where(
        StockTake.status == "in_progress"
    )
    result = await db.execute(stmt)
    stock_takes_db = result.scalars().all()

    stock_takes = []
    for st in stock_takes_db:
        # Count items
        items_stmt = select(func.count()).select_from(StockTakeItem).where(
            StockTakeItem.stock_take_id == st.id
        )
        total_result = await db.execute(items_stmt)
        total_items = total_result.scalar() or 0

        # Count counted items
        counted_stmt = select(func.count()).select_from(StockTakeItem).where(
            and_(
                StockTakeItem.stock_take_id == st.id,
                StockTakeItem.actual_quantity.isnot(None)
            )
        )
        counted_result = await db.execute(counted_stmt)
        items_counted = counted_result.scalar() or 0

        progress = (items_counted / total_items * 100) if total_items > 0 else 0.0

        stock_takes.append(ActiveStockTake(
            id=st.id,
            name=st.notes or f"Stock Take {st.id}",
            started_at=st.scheduled_date or datetime.now(),
            started_by="System",  # Would need user tracking
            location=None,
            items_counted=items_counted,
            total_items=total_items,
            progress_percentage=progress
        ))

    logger.info(
        "active_stock_takes_fetched",
        organization_id=str(organization_id),
        count=len(stock_takes),
    )

    return ActiveStockTakesResponse(
        stock_takes=stock_takes,
        total=len(stock_takes)
    )


# ============================================
# GAP-020: Generate cycle count schedule
# ============================================


@router.post("/cycle-count/generate", response_model=CycleCountGenerateResponse)
async def generate_cycle_count_schedule(
    request: CycleCountGenerateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CycleCountGenerateResponse:
    """
    Generate cycle count schedule for ABC classification.
    """
    # Get all products
    stmt = select(Product).where(Product.organization_id == request.organization_id)
    result = await db.execute(stmt)
    products = result.scalars().all()

    # Classify by value (simple ABC: top 20% = A, next 30% = B, rest = C)
    products_sorted = sorted(products, key=lambda p: p.cost * p.stock, reverse=True)
    total = len(products_sorted)

    schedule = []
    a_count = b_count = c_count = 0

    for i, product in enumerate(products_sorted):
        if i < total * 0.2:
            classification = "A"
            frequency = request.frequency_a
            a_count += 1
        elif i < total * 0.5:
            classification = "B"
            frequency = request.frequency_b
            b_count += 1
        else:
            classification = "C"
            frequency = request.frequency_c
            c_count += 1

        next_count = request.start_date + timedelta(days=frequency)

        schedule.append(CycleCountSchedule(
            product_id=product.id,
            product_name=product.name,
            classification=classification,
            next_count_date=next_count,
            frequency_days=frequency
        ))

    logger.info(
        "cycle_count_schedule_generated",
        organization_id=str(request.organization_id),
        total_products=total,
        a_count=a_count,
        b_count=b_count,
        c_count=c_count,
    )

    return CycleCountGenerateResponse(
        schedule=schedule,
        total_products=total,
        a_count=a_count,
        b_count=b_count,
        c_count=c_count
    )
