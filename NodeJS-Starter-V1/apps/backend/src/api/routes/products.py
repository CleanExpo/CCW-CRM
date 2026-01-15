"""Products API routes."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.db.demo_models import Product as ProductModel
from src.db.schemas import PaginatedResponse, Product, ProductCreate, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=PaginatedResponse)
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = Query(None, max_length=200),
    category: str | None = Query(None, max_length=100),
    is_active: bool | None = Query(True),  # Default to active products only
    db: AsyncSession = Depends(get_db),
):
    """List products with pagination and filters."""
    # Build query
    query = select(ProductModel)

    # Apply filters with input validation
    if search:
        # Sanitize search input - SQLAlchemy parameterization prevents SQL injection
        # but we add length limits for performance
        search_term = search.strip()[:200]  # Limit length
        search_filter = f"%{search_term}%"
        query = query.where(
            (ProductModel.name.ilike(search_filter)) |
            (ProductModel.sku.ilike(search_filter)) |
            (ProductModel.description.ilike(search_filter))
        )

    if category:
        query = query.where(ProductModel.category == category)

    # Filter by is_active (defaults to True to exclude soft-deleted items)
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

    return {
        "items": [Product.model_validate(p) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{product_id}", response_model=Product)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
):
    """Create a new product."""
    # Check if SKU already exists
    existing_query = select(ProductModel).where(ProductModel.sku == product_data.sku)
    result = await db.execute(existing_query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU already exists")

    # Create product
    product = ProductModel(**product_data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)

    return Product.model_validate(product)


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: UUID,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a product."""
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

    return Product.model_validate(product)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a product (set is_active to False)."""
    # Get existing product
    query = select(ProductModel).where(ProductModel.id == product_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Soft delete
    product.is_active = False
    await db.commit()

    return None
