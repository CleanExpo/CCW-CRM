"""
Translation management API endpoints.

Endpoints for managing product translations, bulk translation,
translation coverage statistics, and translation approval workflow.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import Product
from src.db.i18n_models import Language, ProductTranslation
from src.services.i18n_service import I18nService

router = APIRouter(prefix="/api/translations", tags=["Translations"])


# Pydantic models for responses
class LanguageInfo(BaseModel):
    """Language information."""

    code: str
    name: str
    native_name: str
    is_rtl: bool


class ProductTranslationStatus(BaseModel):
    """Product with translation status across languages."""

    id: str
    sku: str
    name: str
    category: str
    translations: dict[str, dict[str, str]]  # {language_code: {status, translated_at}}


class TranslationCoverageStats(BaseModel):
    """Translation coverage statistics."""

    language_code: str
    language_name: str
    total_products: int
    translated_products: int
    pending_products: int
    ai_generated: int
    human_reviewed: int
    approved: int
    coverage_percentage: float


class BatchTranslationRequest(BaseModel):
    """Request for batch translation."""

    product_ids: list[str]
    target_languages: list[str]
    priority: int = 5


class BatchTranslationResponse(BaseModel):
    """Response for batch translation."""

    queued_count: int
    message: str
    queue_ids: list[str]


class UpdateTranslationRequest(BaseModel):
    """Request to update a translation."""

    name: str
    description: str | None = None
    short_description: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    translation_status: str = "human_reviewed"


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""

    data: list[dict]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/languages")
async def get_active_languages(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[LanguageInfo]:
    """
    Get all active languages.

    Returns list of active languages with metadata.
    """
    service = I18nService()
    languages = await service.get_active_languages(db)

    return [
        LanguageInfo(
            code=lang.code,
            name=lang.name,
            native_name=lang.native_name,
            is_rtl=lang.is_rtl,
        )
        for lang in languages
    ]


@router.get("/products")
async def list_products_with_translations(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    category: str | None = None,
    translation_status: str | None = None,
    language_code: str | None = None,
) -> PaginatedResponse:
    """
    List products with their translation status.

    Args:
        page: Page number (1-indexed)
        page_size: Items per page
        search: Search in product name/SKU
        category: Filter by product category
        translation_status: Filter by translation status (pending, ai_generated, human_reviewed, approved)
        language_code: Filter by specific language

    Returns:
        Paginated list of products with translation status
    """
    # Base query
    query = select(Product).where(Product.is_active == True)

    # Apply filters
    if search:
        query = query.where(
            (Product.name.ilike(f"%{search}%")) | (Product.sku.ilike(f"%{search}%"))
        )

    if category:
        query = query.where(Product.category == category)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Product.name).limit(page_size).offset((page - 1) * page_size)

    # Execute
    result = await db.execute(query)
    products = result.scalars().all()

    # For each product, get translation status
    products_data = []
    for product in products:
        # Get all translations for this product
        translations_stmt = select(ProductTranslation).where(
            ProductTranslation.product_id == product.id
        )
        translations_result = await db.execute(translations_stmt)
        translations = translations_result.scalars().all()

        # Build translations dict
        translations_dict = {}
        for trans in translations:
            translations_dict[trans.language_code] = {
                "status": trans.translation_status,
                "translated_at": trans.translated_at.isoformat() if trans.translated_at else None,
                "translated_by": trans.translated_by,
            }

        # Filter by translation status if specified
        if translation_status or language_code:
            if language_code:
                if language_code not in translations_dict:
                    if translation_status == "pending":
                        pass  # Include products with no translation for this language
                    else:
                        continue  # Skip products without translation
                elif translation_status and translations_dict[language_code]["status"] != translation_status:
                    continue
            elif translation_status:
                # Check if any translation has this status
                has_status = any(t["status"] == translation_status for t in translations_dict.values())
                if not has_status:
                    continue

        products_data.append(
            ProductTranslationStatus(
                id=str(product.id),
                sku=product.sku,
                name=product.name,
                category=product.category.value,
                translations=translations_dict,
            ).model_dump()
        )

    return PaginatedResponse(
        data=products_data,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/coverage")
async def get_translation_coverage(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[TranslationCoverageStats]:
    """
    Get translation coverage statistics for all languages.

    Returns statistics showing translation progress across all active languages.
    """
    # Use the v_translation_coverage view created in migration
    stmt = text("""
        SELECT
            language_code,
            language_name,
            total_products,
            translated_products,
            pending_products,
            ai_generated,
            human_reviewed,
            approved,
            coverage_percentage
        FROM v_translation_coverage
        ORDER BY language_code
    """)

    result = await db.execute(stmt)
    rows = result.fetchall()

    return [
        TranslationCoverageStats(
            language_code=row[0],
            language_name=row[1],
            total_products=row[2],
            translated_products=row[3],
            pending_products=row[4],
            ai_generated=row[5],
            human_reviewed=row[6],
            approved=row[7],
            coverage_percentage=float(row[8]),
        )
        for row in rows
    ]


@router.post("/products/batch")
async def batch_translate_products(
    request: BatchTranslationRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BatchTranslationResponse:
    """
    Queue batch translation for multiple products and languages.

    Creates translation queue entries that will be processed by the translation service.

    Args:
        request: Batch translation request with product IDs, target languages, and priority

    Returns:
        Response with queued count and queue IDs
    """
    service = I18nService()

    # Convert string IDs to UUIDs
    product_uuids = [UUID(pid) for pid in request.product_ids]

    # Call the service to queue translations
    result = await service.batch_translate_products(
        db, product_uuids, request.target_languages, request.priority
    )

    await db.commit()

    return BatchTranslationResponse(
        queued_count=result["queued"],
        message=result["message"],
        queue_ids=[str(qid) for qid in result.get("queue_ids", [])],
    )


@router.put("/products/{product_id}/{language_code}")
async def update_product_translation(
    product_id: str,
    language_code: str,
    request: UpdateTranslationRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Update or create a product translation.

    Allows manual editing of translations and marking them as human-reviewed.

    Args:
        product_id: Product UUID
        language_code: Language code (e.g., 'zh-CN')
        request: Translation data

    Returns:
        Success message with translation status
    """
    product_uuid = UUID(product_id)

    # Check if product exists
    product_result = await db.execute(select(Product).where(Product.id == product_uuid))
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if language exists
    language_result = await db.execute(select(Language).where(Language.code == language_code))
    language = language_result.scalar_one_or_none()
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    # Check if translation exists
    stmt = select(ProductTranslation).where(
        ProductTranslation.product_id == product_uuid,
        ProductTranslation.language_code == language_code,
    )
    result = await db.execute(stmt)
    translation = result.scalar_one_or_none()

    if translation:
        # Update existing translation
        translation.name = request.name
        translation.description = request.description
        translation.short_description = request.short_description
        translation.meta_title = request.meta_title
        translation.meta_description = request.meta_description
        translation.translation_status = request.translation_status
        translation.translated_at = datetime.utcnow()
        translation.translated_by = "manual_edit"
        translation.updated_at = datetime.utcnow()
    else:
        # Create new translation
        translation = ProductTranslation(
            product_id=product_uuid,
            language_code=language_code,
            name=request.name,
            description=request.description,
            short_description=request.short_description,
            meta_title=request.meta_title,
            meta_description=request.meta_description,
            translation_status=request.translation_status,
            translated_at=datetime.utcnow(),
            translated_by="manual_edit",
        )
        db.add(translation)

    await db.commit()

    return {
        "message": "Translation updated successfully",
        "product_id": product_id,
        "language_code": language_code,
        "status": translation.translation_status,
    }


@router.get("/products/{product_id}/{language_code}")
async def get_product_translation(
    product_id: str,
    language_code: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Get a specific product translation.

    Args:
        product_id: Product UUID
        language_code: Language code

    Returns:
        Translation data or 404 if not found
    """
    product_uuid = UUID(product_id)
    service = I18nService()

    translation = await service.get_product_translation(db, product_uuid, language_code)

    if not translation:
        raise HTTPException(
            status_code=404, detail=f"Translation not found for product {product_id} in language {language_code}"
        )

    return translation


@router.post("/products/{product_id}/translate/{language_code}")
async def translate_single_product(
    product_id: str,
    language_code: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Translate a single product to a specific language using AI.

    Args:
        product_id: Product UUID
        language_code: Target language code

    Returns:
        Translation result with generated content
    """
    product_uuid = UUID(product_id)
    service = I18nService()

    try:
        result = await service.translate_product(db, product_uuid, language_code)
        await db.commit()

        return {
            "message": "Translation generated successfully",
            "product_id": product_id,
            "language_code": language_code,
            "translation": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
