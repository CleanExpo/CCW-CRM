"""
Embeddings API Endpoints.

Generate and manage vector embeddings for semantic search.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_async_db
from src.db.demo_models import Customer, Product
from src.services.embedding_service import get_embedding_service

router = APIRouter(prefix="/api/embeddings", tags=["Embeddings"])


class EmbeddingGenerateRequest(BaseModel):
    """Request to generate embeddings."""

    entity_type: str = Field(..., description="Entity type: 'product' or 'customer'")
    entity_id: UUID = Field(..., description="Entity UUID")
    force_regenerate: bool = Field(False, description="Force regenerate if exists")


class BatchEmbeddingRequest(BaseModel):
    """Request to batch generate embeddings."""

    entity_type: str = Field(..., description="Entity type: 'products' or 'customers'")
    force_regenerate: bool = Field(False, description="Force regenerate existing")


class EmbeddingCoverageResponse(BaseModel):
    """Embedding coverage statistics."""

    products: dict
    customers: dict


@router.post("/generate")
async def generate_embedding(
    request: EmbeddingGenerateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Generate embedding for a single product or customer.

    Use this to generate embeddings on-demand for newly created entities.
    """
    service = get_embedding_service()

    if request.entity_type == "product":
        result = await service.generate_product_embedding(
            db=db,
            product_id=request.entity_id,
            language="en",
            force_regenerate=request.force_regenerate,
        )
        return result

    elif request.entity_type == "customer":
        # Generate customer embedding directly
        result_query = await db.execute(
            select(Customer).where(Customer.id == request.entity_id)
        )
        customer = result_query.scalar_one_or_none()

        if not customer:
            return {
                "success": False,
                "error": f"Customer {request.entity_id} not found",
            }

        # Generate embedding text
        parts = [
            f"Company: {customer.company_name}",
            f"Contact: {customer.contact_name}",
        ]
        if customer.address:
            parts.append(f"Address: {customer.address}")
        if customer.city:
            parts.append(f"City: {customer.city}")
        if customer.state:
            parts.append(f"State: {customer.state}")

        text = " | ".join(parts)

        # Call OpenAI API
        embedding = await service._call_openai_embeddings(text)

        # Update customer
        await db.execute(
            update(Customer)
            .where(Customer.id == request.entity_id)
            .values(embedding=embedding)
        )
        await db.commit()

        return {
            "success": True,
            "customer_id": str(request.entity_id),
            "dimensions": len(embedding),
        }

    else:
        return {
            "success": False,
            "error": f"Invalid entity_type: {request.entity_type}",
        }


@router.post("/batch")
async def batch_generate_embeddings(
    request: BatchEmbeddingRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Batch generate embeddings for all products or customers.

    This can take several minutes for large datasets. Progress is logged to console.
    """
    service = get_embedding_service()

    if request.entity_type == "products":
        result = await service.batch_generate_embeddings(
            db=db,
            product_ids=None,  # All products
            language="en",
            force_regenerate=request.force_regenerate,
        )
        return result

    elif request.entity_type == "customers":
        # Batch generate customer embeddings directly
        import httpx

        from src.config import get_settings

        settings = get_settings()
        api_key = settings.openai_api_key

        if not api_key:
            return {
                "success": False,
                "error": "OpenAI API key not configured",
            }

        client = httpx.AsyncClient(
            base_url="https://api.openai.com/v1",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

        # Get customers without embeddings (or all if force)
        if request.force_regenerate:
            query = select(Customer).where(Customer.is_active == True)  # noqa: E712
        else:
            query = select(Customer).where(
                Customer.is_active == True,  # noqa: E712
                Customer.embedding == None,  # noqa: E711
            )

        result_query = await db.execute(query)
        customers = result_query.scalars().all()

        total = len(customers)
        processed = 0
        failed = 0

        for customer in customers:
            try:
                # Generate embedding text
                parts = [
                    f"Company: {customer.company_name}",
                    f"Contact: {customer.contact_name}",
                ]
                if customer.address:
                    parts.append(f"Address: {customer.address}")
                if customer.city:
                    parts.append(f"City: {customer.city}")
                if customer.state:
                    parts.append(f"State: {customer.state}")

                text = " | ".join(parts)

                # Call OpenAI API
                payload = {
                    "model": "text-embedding-3-small",
                    "input": text,
                    "encoding_format": "float",
                }

                response = await client.post("/embeddings", json=payload)
                response.raise_for_status()

                data = response.json()
                embedding = data["data"][0]["embedding"]

                # Update customer
                await db.execute(
                    update(Customer)
                    .where(Customer.id == customer.id)
                    .values(embedding=embedding)
                )

                processed += 1

            except Exception:
                failed += 1

        await db.commit()
        await client.aclose()

        return {
            "success": True,
            "total": total,
            "processed": processed,
            "failed": failed,
        }

    else:
        return {
            "success": False,
            "error": f"Invalid entity_type: {request.entity_type}",
        }


@router.get("/coverage", response_model=EmbeddingCoverageResponse)
async def get_embedding_coverage(
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Get embedding coverage statistics for products and customers.

    Shows how many entities have embeddings generated vs total entities.
    """
    # Products
    products_total = await db.execute(
        select(Product).where(Product.is_active == True)  # noqa: E712
    )
    products_total_count = len(products_total.scalars().all())

    products_with_embeddings = await db.execute(
        select(Product).where(
            Product.is_active == True,  # noqa: E712
            Product.embedding != None,  # noqa: E711
        )
    )
    products_with_count = len(products_with_embeddings.scalars().all())

    # Customers
    customers_total = await db.execute(
        select(Customer).where(Customer.is_active == True)  # noqa: E712
    )
    customers_total_count = len(customers_total.scalars().all())

    customers_with_embeddings = await db.execute(
        select(Customer).where(
            Customer.is_active == True,  # noqa: E712
            Customer.embedding != None,  # noqa: E711
        )
    )
    customers_with_count = len(customers_with_embeddings.scalars().all())

    return EmbeddingCoverageResponse(
        products={
            "total": products_total_count,
            "with_embeddings": products_with_count,
            "without_embeddings": products_total_count - products_with_count,
            "coverage_percent": (
                round(products_with_count / products_total_count * 100, 2)
                if products_total_count > 0
                else 0
            ),
        },
        customers={
            "total": customers_total_count,
            "with_embeddings": customers_with_count,
            "without_embeddings": customers_total_count - customers_with_count,
            "coverage_percent": (
                round(customers_with_count / customers_total_count * 100, 2)
                if customers_total_count > 0
                else 0
            ),
        },
    )
