"""Products API routes.

Performance optimized with Redis caching.
PHASE 4: Enhanced with multi-location stock to eliminate N+1 queries.
PHASE: Enhanced Shopify Integration - Task 1.2: Automatic metafield sync on product update.
"""
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.cache.decorators import cached, invalidate_cache
from src.config.database import get_async_db
from src.db.demo_models import Product as ProductModel
from src.db.inventory_models import ProductDangerousGoods, ProductStockByLocation
from src.db.schemas import (
    PaginatedResponse,
    Product,
    ProductCreate,
    ProductUpdate,
    StockByLocation,
)
from src.services.sse_service import sse_service

router = APIRouter(prefix="/api/products", tags=["products"], dependencies=[Depends(get_current_user)])


# ── Dangerous Goods Schemas ────────────────────────────────────────────────────

class DangerousGoodsUpsert(BaseModel):
    """Request body for setting dangerous goods classification on a product."""

    adg_class: str = Field(..., description="ADG Code class number, e.g. '8' for Corrosives")
    un_number: str = Field(..., description="UN number, e.g. 'UN1760'")
    proper_shipping_name: str = Field(..., description="ADG proper shipping name")
    packing_group: str | None = Field(None, description="Packing group: I, II, or III")


class DangerousGoodsResponse(BaseModel):
    """Response schema for dangerous goods classification."""

    product_id: UUID
    adg_class: str
    un_number: str
    proper_shipping_name: str
    packing_group: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=PaginatedResponse)
@cached(ttl=300, key_prefix="api_products_list")  # 5 minute cache
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
    include_stock: bool = Query(True, description="Include multi-location stock data"),
    db: AsyncSession = Depends(get_async_db),
):
    """List products with pagination and filters.

    PHASE 4 OPTIMIZATION: Now includes multi-location stock data in a single query.
    - Before: 50 products = 51 API calls (1 list + 50 stock lookups)
    - After: 50 products = 1 API call (98% reduction)
    - Performance gain: Eliminates N+1 query pattern

    Cached for 5 minutes.
    """
    # Build query
    query = select(ProductModel)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (ProductModel.name.ilike(search_filter))
            | (ProductModel.sku.ilike(search_filter))
            | (ProductModel.description.ilike(search_filter))
        )

    if category:
        query = query.where(ProductModel.category == category)

    if is_active is not None:
        query = query.where(ProductModel.is_active == is_active)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(ProductModel.created_at.desc())

    # Execute query
    result = await db.execute(query)
    products = result.scalars().all()

    # PHASE 4 OPTIMIZATION: Fetch stock data for all products in a SINGLE query
    if include_stock and products:
        product_ids = [p.id for p in products]
        stock_query = select(ProductStockByLocation).where(
            ProductStockByLocation.product_id.in_(product_ids)
        )
        stock_result = await db.execute(stock_query)
        stock_records = stock_result.scalars().all()

        # Group stock by product_id for O(1) lookup
        stock_by_product: dict[UUID, list[ProductStockByLocation]] = {}
        for stock in stock_records:
            if stock.product_id not in stock_by_product:
                stock_by_product[stock.product_id] = []
            stock_by_product[stock.product_id].append(stock)

        # Build response with stock data
        items_with_stock = []
        for product in products:
            product_dict = Product.model_validate(product).model_dump()
            stock_list = stock_by_product.get(product.id, [])
            product_dict["stock_by_location"] = [
                StockByLocation(
                    location=s.location,
                    stock=s.stock,
                    reserved=s.reserved,
                    available=s.available,
                    reorder_point=s.reorder_point,
                    last_counted_at=(
                        s.last_counted_at.isoformat() if s.last_counted_at else None
                    ),
                ).model_dump()
                for s in stock_list
            ]
            items_with_stock.append(product_dict)

        return {
            "items": items_with_stock,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    # Fallback: No stock data requested
    return {
        "items": [Product.model_validate(p).model_dump() for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{product_id}", response_model=Product)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Get a single product by ID."""
    query = select(ProductModel).where(ProductModel.id == product_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return Product.model_validate(product)


@router.post("", response_model=Product, status_code=201)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_async_db),
):
    """Create a new product."""
    # Check if SKU already exists
    existing_query = select(ProductModel).where(ProductModel.sku == product_data.sku)
    result = await db.execute(existing_query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="SKU already exists")

    # Create product
    product = ProductModel(**product_data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)

    # Invalidate product caches (list and dashboard inventory)
    await invalidate_cache("products")
    await invalidate_cache("api_products_list")
    await invalidate_cache("dashboard_inventory")
    await invalidate_cache("dashboard_top_products")

    # Publish real-time events
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "total_products",
        "change": "increment",
        "timestamp": datetime.utcnow().isoformat(),
    })

    await sse_service.publish("dashboard-activity", {
        "activity_type": "product_created",
        "title": "New Product",
        "description": f"Product {product.name} created",
        "link": f"/products/{product.id}",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return Product.model_validate(product)


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: UUID,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_async_db),
):
    """Update a product.

    PHASE: Enhanced Shopify Integration - Task 1.2
    Automatically syncs metafields to Shopify if product is mapped.
    """
    # Get existing product
    query = select(ProductModel).where(ProductModel.id == product_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update fields
    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)

    # Invalidate product caches (list and dashboard inventory)
    await invalidate_cache("products")
    await invalidate_cache("api_products_list")
    await invalidate_cache("dashboard_inventory")
    await invalidate_cache("dashboard_top_products")

    # PHASE: Enhanced Shopify Integration - Task 1.2: Automatic Metafield Sync
    # Check if product has Shopify mapping and sync metafields automatically
    try:
        import structlog

        from src.db.shopify_models import ShopifyProductMapping
        from src.integrations.shopify.metafields import get_metafield_manager
        from src.services.sse_service import sse_service

        logger = structlog.get_logger(__name__)

        # Check if product is mapped to Shopify
        mapping_query = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_id
        )
        mapping_result = await db.execute(mapping_query)
        shopify_mapping = mapping_result.scalar_one_or_none()

        if shopify_mapping:
            logger.info(
                "Product updated, triggering automatic metafield sync",
                product_id=str(product_id),
                shopify_product_id=shopify_mapping.shopify_product_id,
            )

            # Publish SSE event: Metafield sync starting
            await sse_service.publish("shopify-metafield-sync", {
                "event_type": "sync_started",
                "product_id": str(product_id),
                "shopify_product_id": str(shopify_mapping.shopify_product_id),
                "timestamp": datetime.now().isoformat(),
            })

            # Trigger metafield sync
            metafield_manager = get_metafield_manager()
            sync_result = await metafield_manager.sync_product_metafields(
                db=db,
                product_id=product_id,
                shopify_product_id=str(shopify_mapping.shopify_product_id),
            )

            # Publish SSE event: Metafield sync completed
            await sse_service.publish("shopify-metafield-sync", {
                "event_type": "sync_completed" if sync_result["success"] else "sync_failed",
                "product_id": str(product_id),
                "shopify_product_id": str(shopify_mapping.shopify_product_id),
                "synced_count": sync_result.get("synced_count", 0),
                "synced_metafields": sync_result.get("synced_metafields", []),
                "errors": sync_result.get("errors", []),
                "timestamp": datetime.now().isoformat(),
            })

            logger.info(
                "Automatic metafield sync completed",
                product_id=str(product_id),
                success=sync_result["success"],
                synced_count=sync_result.get("synced_count", 0),
            )
        else:
            logger.debug(
                "Product not mapped to Shopify, skipping metafield sync",
                product_id=str(product_id),
            )

    except Exception as e:
        # Log error but don't fail the product update
        import structlog
        logger = structlog.get_logger(__name__)
        logger.error(
            "Failed to sync metafields automatically",
            product_id=str(product_id),
            error=str(e),
        )
        # Continue with product update success

    # Publish real-time dashboard update
    await sse_service.publish("dashboard-activity", {
        "activity_type": "product_updated",
        "title": "Product Updated",
        "description": f"Product {product.name} updated",
        "link": f"/products/{product.id}",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return Product.model_validate(product)


@router.delete("/{product_id}", status_code=204, response_model=None)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Soft delete a product (set is_active to False)."""
    # Get existing product
    query = select(ProductModel).where(ProductModel.id == product_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Soft delete
    product_name = product.name
    product.is_active = False
    await db.commit()

    # Invalidate product caches (list and dashboard inventory)
    await invalidate_cache("products")
    await invalidate_cache("api_products_list")
    await invalidate_cache("dashboard_inventory")
    await invalidate_cache("dashboard_top_products")

    # Publish real-time events
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "total_products",
        "change": "decrement",
        "timestamp": datetime.utcnow().isoformat(),
    })

    await sse_service.publish("dashboard-activity", {
        "activity_type": "product_deleted",
        "title": "Product Deleted",
        "description": f"Product {product_name} deleted",
        "link": "/products",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return None


# ── Dangerous Goods Endpoints (ADG Code compliance) ───────────────────────────


@router.get("/{product_id}/dangerous-goods", response_model=DangerousGoodsResponse)
async def get_product_dangerous_goods(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_db),
) -> DangerousGoodsResponse:
    """Get the dangerous goods classification for a product.

    Returns 404 if the product does not exist or is not classified as dangerous goods.
    """
    # Verify product exists
    product_result = await db.execute(select(ProductModel).where(ProductModel.id == product_id))
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    dg_result = await db.execute(
        select(ProductDangerousGoods).where(ProductDangerousGoods.product_id == product_id)
    )
    dg = dg_result.scalar_one_or_none()
    if not dg:
        raise HTTPException(status_code=404, detail="Product is not classified as dangerous goods")

    return DangerousGoodsResponse.model_validate(dg)


@router.put("/{product_id}/dangerous-goods", response_model=DangerousGoodsResponse, status_code=200)
async def upsert_product_dangerous_goods(
    product_id: UUID,
    dg_data: DangerousGoodsUpsert,
    db: AsyncSession = Depends(get_async_db),
) -> DangerousGoodsResponse:
    """Set or update the dangerous goods classification for a product (ADG Code).

    Creates the record if it does not exist; updates it if it does.
    """
    # Verify product exists
    product_result = await db.execute(select(ProductModel).where(ProductModel.id == product_id))
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    dg_result = await db.execute(
        select(ProductDangerousGoods).where(ProductDangerousGoods.product_id == product_id)
    )
    dg = dg_result.scalar_one_or_none()

    if dg:
        dg.adg_class = dg_data.adg_class
        dg.un_number = dg_data.un_number
        dg.proper_shipping_name = dg_data.proper_shipping_name
        dg.packing_group = dg_data.packing_group
    else:
        dg = ProductDangerousGoods(
            product_id=product_id,
            adg_class=dg_data.adg_class,
            un_number=dg_data.un_number,
            proper_shipping_name=dg_data.proper_shipping_name,
            packing_group=dg_data.packing_group,
        )
        db.add(dg)

    await db.commit()
    await db.refresh(dg)
    return DangerousGoodsResponse.model_validate(dg)


@router.delete("/{product_id}/dangerous-goods", status_code=204, response_model=None)
async def delete_product_dangerous_goods(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_db),
) -> None:
    """Remove dangerous goods classification from a product.

    Returns 204 if removed (or if the product was never classified as DG).
    """
    # Verify product exists
    product_result = await db.execute(select(ProductModel).where(ProductModel.id == product_id))
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    dg_result = await db.execute(
        select(ProductDangerousGoods).where(ProductDangerousGoods.product_id == product_id)
    )
    dg = dg_result.scalar_one_or_none()
    if dg:
        await db.delete(dg)
        await db.commit()
    return None
