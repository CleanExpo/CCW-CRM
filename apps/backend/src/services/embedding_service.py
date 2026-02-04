"""
Product Embedding Generation Service.

Generates vector embeddings for products using OpenAI API for semantic search.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.ai_search_models import ProductEmbedding
from src.db.demo_models import Product

logger = structlog.get_logger(__name__)
settings = get_settings()


class EmbeddingService:
    """
    Service for generating and managing product embeddings.

    Uses OpenAI text-embedding-3-small (1536 dimensions).
    """

    MODEL = "text-embedding-3-small"
    DIMENSIONS = 1536
    BATCH_SIZE = 100  # Process 100 products at a time

    def __init__(self):
        self.api_key = settings.openai_api_key
        self.client = httpx.AsyncClient(
            base_url="https://api.openai.com/v1",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def generate_product_embedding(
        self,
        db: AsyncSession,
        product_id: UUID,
        language: str = "en",
        force_regenerate: bool = False,
    ) -> dict[str, Any]:
        """
        Generate embedding for a single product.

        Args:
            db: Database session
            product_id: Product UUID
            language: Language code
            force_regenerate: Regenerate even if embedding exists

        Returns:
            Result with embedding data
        """
        # Get product
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()

        if not product:
            logger.error("Product not found", product_id=str(product_id))
            return {"success": False, "error": "Product not found"}

        # Check if embedding already exists
        if not force_regenerate:
            existing_result = await db.execute(
                select(ProductEmbedding).where(
                    ProductEmbedding.product_id == product_id,
                    ProductEmbedding.language_code == language,
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                logger.info(
                    "Embedding already exists",
                    product_id=str(product_id),
                    language=language,
                )
                return {
                    "success": True,
                    "already_exists": True,
                    "embedding_id": str(existing.id),
                }

        # Generate text for embedding
        text = self._generate_text_for_embedding(product, language)

        try:
            # Call OpenAI API
            embedding_vector = await self._call_openai_embeddings(text)

            # Save to database
            embedding = ProductEmbedding(
                product_id=product_id,
                language_code=language,
                embedding=embedding_vector,
                model_version=self.MODEL,
                model_provider="openai",
                generated_from=text[:500],  # Store first 500 chars
                generation_timestamp=datetime.now(UTC),
            )

            # Update if exists, otherwise create new
            if force_regenerate:
                existing_result = await db.execute(
                    select(ProductEmbedding).where(
                        ProductEmbedding.product_id == product_id,
                        ProductEmbedding.language_code == language,
                    )
                )
                existing = existing_result.scalar_one_or_none()

                if existing:
                    existing.embedding = embedding_vector
                    existing.generated_from = text[:500]
                    existing.generation_timestamp = datetime.now(UTC)
                else:
                    db.add(embedding)
            else:
                db.add(embedding)

            await db.commit()

            logger.info(
                "Embedding generated",
                product_id=str(product_id),
                language=language,
                text_length=len(text),
            )

            return {
                "success": True,
                "embedding_id": str(embedding.id),
                "dimensions": self.DIMENSIONS,
            }

        except Exception as e:
            logger.error(
                "Failed to generate embedding",
                product_id=str(product_id),
                error=str(e),
            )
            return {"success": False, "error": str(e)}

    async def batch_generate_embeddings(
        self,
        db: AsyncSession,
        product_ids: list[UUID] | None = None,
        language: str = "en",
        force_regenerate: bool = False,
    ) -> dict[str, Any]:
        """
        Batch generate embeddings for multiple products.

        Args:
            db: Database session
            product_ids: List of product UUIDs (None = all products)
            language: Language code
            force_regenerate: Regenerate existing embeddings

        Returns:
            Batch generation results
        """
        # Get products to process
        if product_ids:
            query = select(Product).where(
                Product.id.in_(product_ids),
                Product.is_active == True,
            )
        else:
            query = select(Product).where(Product.is_active == True)

        result = await db.execute(query)
        products = result.scalars().all()

        results = {
            "total": len(products),
            "successful": 0,
            "failed": 0,
            "skipped": 0,
            "errors": [],
        }

        # Process in batches
        for i in range(0, len(products), self.BATCH_SIZE):
            batch = products[i : i + self.BATCH_SIZE]

            logger.info(
                "Processing batch",
                batch_num=i // self.BATCH_SIZE + 1,
                batch_size=len(batch),
            )

            # Generate embeddings concurrently within batch
            tasks = [
                self.generate_product_embedding(
                    db=db,
                    product_id=product.id,
                    language=language,
                    force_regenerate=force_regenerate,
                )
                for product in batch
            ]

            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for idx, result_item in enumerate(batch_results):
                if isinstance(result_item, Exception):
                    results["failed"] += 1
                    results["errors"].append(f"Product {batch[idx].id}: {str(result_item)}")
                elif result_item.get("success"):
                    if result_item.get("already_exists"):
                        results["skipped"] += 1
                    else:
                        results["successful"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(
                        f"Product {batch[idx].id}: {result_item.get('error', 'Unknown error')}"
                    )

            # Small delay between batches to avoid rate limits
            if i + self.BATCH_SIZE < len(products):
                await asyncio.sleep(1)

        logger.info(
            "Batch embedding generation complete",
            total=results["total"],
            successful=results["successful"],
            failed=results["failed"],
            skipped=results["skipped"],
        )

        return results

    def _generate_text_for_embedding(self, product: Product, language: str) -> str:
        """
        Generate text representation of product for embedding.

        Combines name, description, category for rich semantic representation.

        Args:
            product: Product model
            language: Language code

        Returns:
            Text for embedding
        """
        # In full implementation, would fetch translations for the language
        # For now, use English data

        parts = []

        # Product name
        parts.append(f"Product: {product.name}")

        # SKU
        parts.append(f"SKU: {product.sku}")

        # Category
        parts.append(f"Category: {product.category}")

        # Description
        if product.description:
            parts.append(f"Description: {product.description}")

        # Price (for context)
        parts.append(f"Price: ${product.price}")

        # Availability
        if product.stock > 0:
            parts.append("In stock")
        else:
            parts.append("Out of stock")

        return " | ".join(parts)

    async def _call_openai_embeddings(self, text: str) -> list[float]:
        """
        Call OpenAI Embeddings API.

        Args:
            text: Text to embed

        Returns:
            Embedding vector (1536 dimensions)
        """
        payload = {
            "model": self.MODEL,
            "input": text,
            "encoding_format": "float",
        }

        response = await self.client.post("/embeddings", json=payload)
        response.raise_for_status()

        data = response.json()
        embedding = data["data"][0]["embedding"]

        return embedding

    async def delete_product_embeddings(
        self,
        db: AsyncSession,
        product_id: UUID,
    ) -> dict[str, Any]:
        """
        Delete all embeddings for a product.

        Args:
            db: Database session
            product_id: Product UUID

        Returns:
            Deletion result
        """
        result = await db.execute(
            select(ProductEmbedding).where(ProductEmbedding.product_id == product_id)
        )
        embeddings = result.scalars().all()

        for embedding in embeddings:
            await db.delete(embedding)

        await db.commit()

        logger.info(
            "Product embeddings deleted",
            product_id=str(product_id),
            count=len(embeddings),
        )

        return {
            "success": True,
            "deleted_count": len(embeddings),
        }

    async def get_embedding_stats(self, db: AsyncSession) -> dict[str, Any]:
        """
        Get statistics about embeddings.

        Args:
            db: Database session

        Returns:
            Statistics
        """
        # Total embeddings
        total_result = await db.execute(select(ProductEmbedding))
        total_embeddings = len(total_result.scalars().all())

        # Total products
        products_result = await db.execute(select(Product).where(Product.is_active == True))
        total_products = len(products_result.scalars().all())

        # Coverage by language
        # (Simplified - in real implementation, would use SQL aggregation)

        coverage_percentage = (
            (total_embeddings / total_products * 100) if total_products > 0 else 0
        )

        return {
            "total_embeddings": total_embeddings,
            "total_products": total_products,
            "coverage_percentage": round(coverage_percentage, 2),
            "model": self.MODEL,
            "dimensions": self.DIMENSIONS,
        }

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Get EmbeddingService singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
