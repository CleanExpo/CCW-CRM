"""
Product Recommendation Service.

Provides intelligent product recommendations using multiple algorithms:
- Content-based (similar products via vector similarity)
- Collaborative filtering (frequently bought together)
- Personalized (customer history-based)
"""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.ai_search_models import (
    CustomerProductInteraction,
    InteractionType,
    ProductCoOccurrence,
    ProductEmbedding,
    ProductRecommendation,
    RecommendationType,
)
from src.db.demo_models import Order, OrderItem, Product

logger = structlog.get_logger(__name__)


class RecommendationService:
    """
    Service for generating product recommendations.

    Features:
    - Content-based: Similar products (vector similarity)
    - Collaborative filtering: Frequently bought together (market basket)
    - Personalized: Customer history-based recommendations
    - Precomputed recommendations for fast retrieval
    """

    def __init__(self):
        pass

    async def get_similar_products(
        self,
        db: AsyncSession,
        product_id: UUID,
        language: str = "en",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Get similar products based on vector similarity.

        Uses product embeddings and cosine similarity to find semantically similar products.

        Args:
            db: Database session
            product_id: Source product UUID
            language: Language code for embeddings
            limit: Maximum recommendations

        Returns:
            List of similar products with similarity scores
        """
        try:
            # Check if precomputed recommendations exist
            precomputed = await self._get_precomputed_recommendations(
                db=db,
                source_product_id=product_id,
                recommendation_type=RecommendationType.SIMILAR,
                limit=limit,
            )

            if precomputed:
                logger.info(
                    "Retrieved precomputed similar products",
                    product_id=str(product_id),
                    count=len(precomputed),
                )
                return precomputed

            # Compute on-demand using vector similarity
            recommendations = await self._compute_similar_products(
                db=db,
                product_id=product_id,
                language=language,
                limit=limit,
            )

            return recommendations

        except Exception as e:
            logger.error(
                "Failed to get similar products",
                product_id=str(product_id),
                error=str(e),
            )
            return []

    async def get_frequently_bought_together(
        self,
        db: AsyncSession,
        product_id: UUID,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Get products frequently bought together (collaborative filtering).

        Uses market basket analysis and co-occurrence data.

        Args:
            db: Database session
            product_id: Source product UUID
            limit: Maximum recommendations

        Returns:
            List of frequently bought together products
        """
        try:
            # Check precomputed recommendations first
            precomputed = await self._get_precomputed_recommendations(
                db=db,
                source_product_id=product_id,
                recommendation_type=RecommendationType.FREQUENTLY_BOUGHT_TOGETHER,
                limit=limit,
            )

            if precomputed:
                logger.info(
                    "Retrieved precomputed frequently bought together",
                    product_id=str(product_id),
                    count=len(precomputed),
                )
                return precomputed

            # Compute on-demand using co-occurrence data
            recommendations = await self._compute_frequently_bought_together(
                db=db,
                product_id=product_id,
                limit=limit,
            )

            return recommendations

        except Exception as e:
            logger.error(
                "Failed to get frequently bought together",
                product_id=str(product_id),
                error=str(e),
            )
            return []

    async def get_personalized_recommendations(
        self,
        db: AsyncSession,
        customer_id: UUID,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Get personalized recommendations based on customer history.

        Analyzes customer interactions (views, purchases, searches) to suggest relevant products.

        Args:
            db: Database session
            customer_id: Customer UUID
            limit: Maximum recommendations

        Returns:
            List of personalized product recommendations
        """
        try:
            # Get customer interaction history
            interactions = await self._get_customer_interactions(
                db=db,
                customer_id=customer_id,
            )

            if not interactions:
                logger.info(
                    "No interaction history for customer",
                    customer_id=str(customer_id),
                )
                return []

            # Generate recommendations based on interaction patterns
            recommendations = await self._compute_personalized_recommendations(
                db=db,
                customer_id=customer_id,
                interactions=interactions,
                limit=limit,
            )

            return recommendations

        except Exception as e:
            logger.error(
                "Failed to get personalized recommendations",
                customer_id=str(customer_id),
                error=str(e),
            )
            return []

    async def track_interaction(
        self,
        db: AsyncSession,
        customer_id: UUID,
        product_id: UUID,
        interaction_type: InteractionType,
        session_id: str | None = None,
        source: str = "web",
    ):
        """
        Track customer-product interaction for recommendation learning.

        Args:
            db: Database session
            customer_id: Customer UUID
            product_id: Product UUID
            interaction_type: Type of interaction (view, add_to_cart, purchase, etc.)
            session_id: Optional session ID
            source: Source of interaction (web, mobile, voice, api)
        """
        try:
            # Check if interaction already exists
            stmt = select(CustomerProductInteraction).where(
                and_(
                    CustomerProductInteraction.customer_id == customer_id,
                    CustomerProductInteraction.product_id == product_id,
                    CustomerProductInteraction.interaction_type == interaction_type,
                )
            )

            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                # Update existing interaction
                existing.interaction_count += 1
                existing.last_interaction_at = datetime.now(UTC)
            else:
                # Create new interaction
                interaction = CustomerProductInteraction(
                    customer_id=customer_id,
                    product_id=product_id,
                    interaction_type=interaction_type,
                    interaction_count=1,
                    session_id=session_id,
                    source=source,
                    first_interaction_at=datetime.now(UTC),
                    last_interaction_at=datetime.now(UTC),
                )
                db.add(interaction)

            await db.commit()

            logger.info(
                "Interaction tracked",
                customer_id=str(customer_id),
                product_id=str(product_id),
                interaction_type=interaction_type,
            )

        except Exception as e:
            logger.error("Failed to track interaction", error=str(e))
            # Don't fail the request if tracking fails
            pass

    async def precompute_recommendations(
        self,
        db: AsyncSession,
        product_ids: list[UUID] | None = None,
        recommendation_type: RecommendationType | None = None,
    ) -> dict[str, Any]:
        """
        Precompute recommendations for products to improve response time.

        Args:
            db: Database session
            product_ids: Optional list of product UUIDs (None = all products)
            recommendation_type: Optional type filter (None = all types)

        Returns:
            Precomputation results
        """
        try:
            # Get products to process
            if product_ids:
                query = select(Product).where(
                    Product.id.in_(product_ids),
                    Product.is_active == True,  # noqa: E712
                )
            else:
                query = select(Product).where(Product.is_active == True)  # noqa: E712

            result = await db.execute(query)
            products = result.scalars().all()

            results = {
                "total_products": len(products),
                "similar": {"computed": 0, "failed": 0},
                "frequently_bought_together": {"computed": 0, "failed": 0},
            }

            # Precompute similar products
            if recommendation_type in (None, RecommendationType.SIMILAR):
                for product in products:
                    try:
                        recs = await self._compute_and_save_similar_products(
                            db=db,
                            product_id=product.id,
                        )
                        if recs:
                            results["similar"]["computed"] += 1
                    except Exception as e:
                        logger.error(
                            "Failed to precompute similar products",
                            product_id=str(product.id),
                            error=str(e),
                        )
                        results["similar"]["failed"] += 1

            # Precompute frequently bought together
            if recommendation_type in (
                None,
                RecommendationType.FREQUENTLY_BOUGHT_TOGETHER,
            ):
                for product in products:
                    try:
                        recs = await self._compute_and_save_frequently_bought_together(
                            db=db,
                            product_id=product.id,
                        )
                        if recs:
                            results["frequently_bought_together"]["computed"] += 1
                    except Exception as e:
                        logger.error(
                            "Failed to precompute frequently bought together",
                            product_id=str(product.id),
                            error=str(e),
                        )
                        results["frequently_bought_together"]["failed"] += 1

            logger.info("Precomputation complete", results=results)
            return results

        except Exception as e:
            logger.error("Precomputation failed", error=str(e))
            return {"error": str(e)}

    async def update_co_occurrences(
        self,
        db: AsyncSession,
        order_id: UUID,
    ):
        """
        Update product co-occurrence data from a completed order.

        Analyzes order items to update "frequently bought together" data.

        Args:
            db: Database session
            order_id: Completed order UUID
        """
        try:
            # Get order items
            stmt = (
                select(OrderItem)
                .where(OrderItem.order_id == order_id)
                .order_by(OrderItem.created_at)
            )

            result = await db.execute(stmt)
            order_items = result.scalars().all()

            if len(order_items) < 2:
                # Need at least 2 items for co-occurrence
                return

            # Create/update co-occurrence records for all pairs
            for i, item_a in enumerate(order_items):
                for item_b in order_items[i + 1 :]:
                    await self._update_co_occurrence_pair(
                        db=db,
                        product_a_id=item_a.product_id,
                        product_b_id=item_b.product_id,
                    )

            await db.commit()

            logger.info(
                "Co-occurrences updated",
                order_id=str(order_id),
                pairs=len(order_items) * (len(order_items) - 1) // 2,
            )

        except Exception as e:
            logger.error(
                "Failed to update co-occurrences",
                order_id=str(order_id),
                error=str(e),
            )

    async def _get_precomputed_recommendations(
        self,
        db: AsyncSession,
        source_product_id: UUID,
        recommendation_type: RecommendationType,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Get precomputed recommendations from database."""
        stmt = (
            select(ProductRecommendation, Product)
            .join(Product, ProductRecommendation.recommended_product_id == Product.id)
            .where(
                and_(
                    ProductRecommendation.source_product_id == source_product_id,
                    ProductRecommendation.recommendation_type == recommendation_type,
                    Product.is_active == True,  # noqa: E712
                )
            )
            .order_by(ProductRecommendation.rank)
            .limit(limit)
        )

        result = await db.execute(stmt)
        rows = result.all()

        return [
            {
                "product_id": str(product.id),
                "sku": product.sku,
                "name": product.name,
                "description": product.description,
                "category": product.category,
                "price": float(product.price),
                "stock": product.stock,
                "score": float(rec.score),
                "rank": rec.rank,
                "reason": rec.reason,
                "recommendation_type": rec.recommendation_type,
            }
            for rec, product in rows
        ]

    async def _compute_similar_products(
        self,
        db: AsyncSession,
        product_id: UUID,
        language: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Compute similar products using vector similarity."""
        # Get source product embedding
        stmt = select(ProductEmbedding).where(
            and_(
                ProductEmbedding.product_id == product_id,
                ProductEmbedding.language_code == language,
            )
        )

        result = await db.execute(stmt)
        source_embedding = result.scalar_one_or_none()

        if not source_embedding:
            logger.warning(
                "No embedding found for product",
                product_id=str(product_id),
                language=language,
            )
            return []

        # Convert embedding to pgvector format
        embedding_str = "[" + ",".join(map(str, source_embedding.embedding)) + "]"

        # Find similar products using vector similarity
        query_sql = text(
            """
            SELECT
                p.id,
                p.sku,
                p.name,
                p.description,
                p.category,
                p.price,
                p.stock,
                1 - (pe.embedding <=> :source_embedding::vector) AS similarity_score
            FROM product_embeddings pe
            JOIN products p ON p.id = pe.product_id
            WHERE pe.language_code = :language
                AND p.is_active = TRUE
                AND p.id != :source_product_id
            ORDER BY pe.embedding <=> :source_embedding::vector
            LIMIT :limit
            """
        )

        result = await db.execute(
            query_sql,
            {
                "source_embedding": embedding_str,
                "language": language,
                "source_product_id": product_id,
                "limit": limit,
            },
        )

        rows = result.fetchall()

        return [
            {
                "product_id": str(row[0]),
                "sku": row[1],
                "name": row[2],
                "description": row[3],
                "category": row[4],
                "price": float(row[5]),
                "stock": row[6],
                "score": float(row[7]),
                "recommendation_type": "similar",
            }
            for row in rows
        ]

    async def _compute_frequently_bought_together(
        self,
        db: AsyncSession,
        product_id: UUID,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Compute frequently bought together using co-occurrence data."""
        stmt = (
            select(ProductCoOccurrence, Product)
            .join(
                Product,
                or_(
                    ProductCoOccurrence.product_a_id == Product.id,
                    ProductCoOccurrence.product_b_id == Product.id,
                ),
            )
            .where(
                and_(
                    or_(
                        ProductCoOccurrence.product_a_id == product_id,
                        ProductCoOccurrence.product_b_id == product_id,
                    ),
                    Product.is_active == True,  # noqa: E712
                    Product.id != product_id,
                )
            )
            .order_by(ProductCoOccurrence.co_occurrence_count.desc())
            .limit(limit)
        )

        result = await db.execute(stmt)
        rows = result.all()

        return [
            {
                "product_id": str(product.id),
                "sku": product.sku,
                "name": product.name,
                "description": product.description,
                "category": product.category,
                "price": float(product.price),
                "stock": product.stock,
                "co_occurrence_count": co_occ.co_occurrence_count,
                "confidence": float(co_occ.confidence) if co_occ.confidence else None,
                "lift": float(co_occ.lift) if co_occ.lift else None,
                "recommendation_type": "frequently_bought_together",
            }
            for co_occ, product in rows
        ]

    async def _compute_personalized_recommendations(
        self,
        db: AsyncSession,
        customer_id: UUID,
        interactions: list[CustomerProductInteraction],
        limit: int,
    ) -> list[dict[str, Any]]:
        """Compute personalized recommendations based on customer history."""
        # Get products customer has interacted with
        interacted_product_ids = [i.product_id for i in interactions]

        # Weight interactions by type
        interaction_weights = {
            InteractionType.PURCHASE: 5.0,
            InteractionType.ADD_TO_CART: 3.0,
            InteractionType.WISHLIST: 2.5,
            InteractionType.VIEW: 1.0,
            InteractionType.SEARCH: 0.5,
        }

        # Calculate weighted scores for each product
        product_scores: dict[UUID, float] = {}
        for interaction in interactions:
            weight = interaction_weights.get(interaction.interaction_type, 1.0)
            score = weight * interaction.interaction_count
            product_scores[interaction.product_id] = (
                product_scores.get(interaction.product_id, 0.0) + score
            )

        # Get similar products for top interacted products
        top_products = sorted(
            product_scores.items(), key=lambda x: x[1], reverse=True
        )[:5]

        recommended_product_ids: set[UUID] = set()
        recommendations = []

        for product_id, _ in top_products:
            # Get similar products
            similar = await self._compute_similar_products(
                db=db,
                product_id=product_id,
                language="en",  # TODO: Use customer preferred language
                limit=5,
            )

            for rec in similar:
                rec_id = UUID(rec["product_id"])
                # Don't recommend products already interacted with
                if rec_id not in interacted_product_ids and rec_id not in recommended_product_ids:
                    rec["recommendation_type"] = "personalized"
                    recommendations.append(rec)
                    recommended_product_ids.add(rec_id)

            if len(recommendations) >= limit:
                break

        return recommendations[:limit]

    async def _get_customer_interactions(
        self,
        db: AsyncSession,
        customer_id: UUID,
    ) -> list[CustomerProductInteraction]:
        """Get customer interaction history."""
        stmt = (
            select(CustomerProductInteraction)
            .where(CustomerProductInteraction.customer_id == customer_id)
            .order_by(CustomerProductInteraction.last_interaction_at.desc())
            .limit(100)  # Last 100 interactions
        )

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def _compute_and_save_similar_products(
        self,
        db: AsyncSession,
        product_id: UUID,
    ) -> list[ProductRecommendation]:
        """Compute and save similar product recommendations."""
        similar = await self._compute_similar_products(
            db=db,
            product_id=product_id,
            language="en",
            limit=10,
        )

        # Delete existing recommendations
        await db.execute(
            text(
                "DELETE FROM product_recommendations WHERE source_product_id = :product_id AND recommendation_type = 'similar'"
            ),
            {"product_id": product_id},
        )

        # Save new recommendations
        recommendations = []
        for rank, rec in enumerate(similar, start=1):
            recommendation = ProductRecommendation(
                source_product_id=product_id,
                recommended_product_id=UUID(rec["product_id"]),
                recommendation_type=RecommendationType.SIMILAR,
                score=rec["score"],
                rank=rank,
                reason=f"Similar product (similarity: {rec['score']:.2f})",
                algorithm_version="vector_similarity_v1",
            )
            db.add(recommendation)
            recommendations.append(recommendation)

        await db.commit()
        return recommendations

    async def _compute_and_save_frequently_bought_together(
        self,
        db: AsyncSession,
        product_id: UUID,
    ) -> list[ProductRecommendation]:
        """Compute and save frequently bought together recommendations."""
        frequently_bought = await self._compute_frequently_bought_together(
            db=db,
            product_id=product_id,
            limit=10,
        )

        # Delete existing recommendations
        await db.execute(
            text(
                "DELETE FROM product_recommendations WHERE source_product_id = :product_id AND recommendation_type = 'frequently_bought_together'"
            ),
            {"product_id": product_id},
        )

        # Save new recommendations
        recommendations = []
        for rank, rec in enumerate(frequently_bought, start=1):
            # Normalize co-occurrence count to 0.0-1.0 score
            max_count = 100  # Assume max reasonable co-occurrence
            score = min(rec["co_occurrence_count"] / max_count, 1.0)

            recommendation = ProductRecommendation(
                source_product_id=product_id,
                recommended_product_id=UUID(rec["product_id"]),
                recommendation_type=RecommendationType.FREQUENTLY_BOUGHT_TOGETHER,
                score=score,
                rank=rank,
                reason=f"Frequently bought together ({rec['co_occurrence_count']} times)",
                algorithm_version="market_basket_v1",
            )
            db.add(recommendation)
            recommendations.append(recommendation)

        await db.commit()
        return recommendations

    async def _update_co_occurrence_pair(
        self,
        db: AsyncSession,
        product_a_id: UUID,
        product_b_id: UUID,
    ):
        """Update co-occurrence record for a product pair."""
        # Ensure consistent ordering (smaller UUID first)
        if product_a_id > product_b_id:
            product_a_id, product_b_id = product_b_id, product_a_id

        # Check if co-occurrence exists
        stmt = select(ProductCoOccurrence).where(
            and_(
                ProductCoOccurrence.product_a_id == product_a_id,
                ProductCoOccurrence.product_b_id == product_b_id,
            )
        )

        result = await db.execute(stmt)
        co_occ = result.scalar_one_or_none()

        if co_occ:
            # Update existing
            co_occ.co_occurrence_count += 1
            co_occ.last_co_occurrence_at = datetime.now(UTC)
        else:
            # Create new
            co_occ = ProductCoOccurrence(
                product_a_id=product_a_id,
                product_b_id=product_b_id,
                co_occurrence_count=1,
                first_co_occurrence_at=datetime.now(UTC),
                last_co_occurrence_at=datetime.now(UTC),
            )
            db.add(co_occ)


# Singleton instance
_recommendation_service: RecommendationService | None = None


def get_recommendation_service() -> RecommendationService:
    """Get RecommendationService singleton."""
    global _recommendation_service
    if _recommendation_service is None:
        _recommendation_service = RecommendationService()
    return _recommendation_service
