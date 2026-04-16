"""Product variant CRUD endpoints + Shopify multi-variant sync (UNI-1867, UNI-1866)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.inventory_models import ProductVariant
from src.db.shopify_models import ShopifyProductMapping
from src.integrations.shopify.client import ShopifyClient
from src.integrations.shopify.product_sync import sync_variants_to_shopify

router = APIRouter(prefix="/api/products", tags=["product-variants"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ProductVariantCreate(BaseModel):
    product_id: UUID
    sku: str
    name: str
    attributes: dict[str, str]
    price: Decimal
    stock_quantity: int = 0
    barcode: str | None = None


class ProductVariantUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    attributes: dict[str, str] | None = None
    price: Decimal | None = None
    stock_quantity: int | None = None
    barcode: str | None = None


class ProductVariantResponse(BaseModel):
    id: UUID
    product_id: UUID
    sku: str
    name: str
    attributes: dict[str, str]
    price: Decimal
    stock_quantity: int
    barcode: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_response(v: ProductVariant) -> ProductVariantResponse:
    return ProductVariantResponse(
        id=v.id,
        product_id=v.product_id,
        sku=v.variant_sku,
        name=v.name,
        attributes=v.attributes or {},
        price=v.price_override or Decimal("0"),
        stock_quantity=0,           # model has no stock_quantity column yet
        barcode=None,
        created_at=v.created_at,
    )


async def _get_variant_or_404(
    product_id: UUID,
    variant_id: UUID,
    db: AsyncSession,
) -> ProductVariant:
    stmt = select(ProductVariant).where(
        ProductVariant.id == variant_id,
        ProductVariant.product_id == product_id,
    )
    result = await db.execute(stmt)
    variant = result.scalars().first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant


# ---------------------------------------------------------------------------
# Routes — UNI-1867
# ---------------------------------------------------------------------------

@router.get("/{product_id}/variants", response_model=list[ProductVariantResponse])
async def list_variants(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """List all variants for a product."""
    stmt = select(ProductVariant).where(ProductVariant.product_id == product_id)
    result = await db.execute(stmt)
    return [_to_response(v) for v in result.scalars().all()]


@router.post("/{product_id}/variants", response_model=ProductVariantResponse, status_code=201)
async def create_variant(
    product_id: UUID,
    payload: ProductVariantCreate,
    db: AsyncSession = Depends(get_async_db),
):
    """Create a new product variant."""
    variant = ProductVariant(
        product_id=product_id,
        variant_sku=payload.sku,
        name=payload.name,
        attributes=payload.attributes,
        price_override=payload.price,
        is_active=True,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return _to_response(variant)


@router.put("/{product_id}/variants/{variant_id}", response_model=ProductVariantResponse)
async def update_variant(
    product_id: UUID,
    variant_id: UUID,
    payload: ProductVariantUpdate,
    db: AsyncSession = Depends(get_async_db),
):
    """Update a product variant."""
    variant = await _get_variant_or_404(product_id, variant_id, db)
    if payload.sku is not None:
        variant.variant_sku = payload.sku
    if payload.name is not None:
        variant.name = payload.name
    if payload.attributes is not None:
        variant.attributes = payload.attributes
    if payload.price is not None:
        variant.price_override = payload.price
    await db.commit()
    await db.refresh(variant)
    return _to_response(variant)


@router.delete("/{product_id}/variants/{variant_id}", status_code=204, response_model=None)
async def delete_variant(
    product_id: UUID,
    variant_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Delete a product variant."""
    variant = await _get_variant_or_404(product_id, variant_id, db)
    await db.delete(variant)
    await db.commit()


# ---------------------------------------------------------------------------
# Shopify sync endpoint — UNI-1866
# ---------------------------------------------------------------------------

@router.post("/{product_id}/sync-variants-to-shopify")
async def sync_variants_shopify(
    product_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Push all local variants for a product to Shopify."""
    # Resolve Shopify product ID from mapping table
    stmt = select(ShopifyProductMapping).where(
        ShopifyProductMapping.product_id == product_id
    )
    result = await db.execute(stmt)
    mapping = result.scalars().first()
    if not mapping:
        raise HTTPException(
            status_code=404,
            detail="No Shopify mapping found for this product — sync it first.",
        )

    # Fetch local variants
    stmt = select(ProductVariant).where(ProductVariant.product_id == product_id)
    result = await db.execute(stmt)
    local_variants = result.scalars().all()

    variants_payload = [
        {
            "sku": v.variant_sku,
            "title": v.name,
            "price": str(v.price_override or "0"),
            "inventory_quantity": 0,
            "option1": v.attributes.get("option1") if v.attributes else None,
            "option2": v.attributes.get("option2") if v.attributes else None,
            "option3": v.attributes.get("option3") if v.attributes else None,
        }
        for v in local_variants
    ]

    async with ShopifyClient() as client:
        sync_result = await sync_variants_to_shopify(
            client,
            str(mapping.shopify_product_id),
            variants_payload,
        )

    return sync_result
