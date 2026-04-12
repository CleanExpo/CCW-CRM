"""
Semantic Search Service for Product Discovery.

Provides vector-based semantic search using product embeddings with multi-language support.
"""

import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
import structlog
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.ai_search_models import SearchQuery
from src.db.demo_models import Product

logger = structlog.get_logger(__name__)
settings = get_settings()


class SemanticSearchService:
    """
    Service for semantic product search using vector embeddings.

    Features:
    - Pure vector search (semantic similarity only)
    - Hybrid search (vector + keyword, weighted)
    - Multi-language support
    - Search analytics tracking
    """

    EMBEDDING_MODEL = settings.ollama_embedding_model
    EMBEDDING_DIMENSIONS = 768  # nomic-embed-text dimension

    def __init__(self):
        self.ollama_url = settings.ollama_base_url
        self.client = httpx.AsyncClient(
            base_url=self.ollama_url,
            headers={
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def semantic_search(
        self,
        db: AsyncSession,
        query: str,
        language: str = "en",
        limit: int = 20,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Perform pure semantic search using vector similarity.

        Args:
            db: Database session
            query: Search query text
            language: Language code (default: en)
            limit: Maximum results to return
            customer_id: Optional customer ID for personalization tracking
            session_id: Optional session ID for analytics

        Returns:
            Search results with similarity scores
        """
        start_time = time.time()

        try:
            # Generate embedding for query
            query_embedding = await self._generate_query_embedding(query)

            # Search using pgvector cosine similarity
            results = await self._vector_search(
                db=db,
                query_embedding=query_embedding,
                language=language,
                limit=limit,
            )

            query_time_ms = int((time.time() - start_time) * 1000)

            # Track search query for analytics
            await self._track_search_query(
                db=db,
                query_text=query,
                query_language=language,
                query_type="semantic",
                results_count=len(results),
                results_product_ids=[r["product_id"] for r in results],
                query_time_ms=query_time_ms,
                customer_id=customer_id,
                session_id=session_id,
            )

            logger.info(
                "Semantic search completed",
                query=query,
                language=language,
                results_count=len(results),
                query_time_ms=query_time_ms,
            )

            return {
                "query": query,
                "language": language,
                "type": "semantic",
                "results": results,
                "total": len(results),
                "query_time_ms": query_time_ms,
            }

        except Exception as e:
            logger.error("Semantic search failed", query=query, error=str(e))
            return {
                "query": query,
                "language": language,
                "type": "semantic",
                "results": [],
                "total": 0,
                "error": str(e),
            }

    async def hybrid_search(
        self,
        db: AsyncSession,
        query: str,
        language: str = "en",
        limit: int = 20,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Perform hybrid search combining vector similarity and keyword matching.

        Args:
            db: Database session
            query: Search query text
            language: Language code
            limit: Maximum results to return
            vector_weight: Weight for vector similarity (0.0 to 1.0)
            keyword_weight: Weight for keyword matching (0.0 to 1.0)
            customer_id: Optional customer ID
            session_id: Optional session ID

        Returns:
            Search results with combined scores
        """
        start_time = time.time()

        try:
            # Generate embedding for query
            query_embedding = await self._generate_query_embedding(query)

            # Get vector search results
            vector_results = await self._vector_search(
                db=db,
                query_embedding=query_embedding,
                language=language,
                limit=limit * 2,  # Get more results for merging
            )

            # Get keyword search results
            keyword_results = await self._keyword_search(
                db=db,
                query=query,
                limit=limit * 2,
            )

            # Combine and re-rank results
            combined_results = self._merge_search_results(
                vector_results=vector_results,
                keyword_results=keyword_results,
                vector_weight=vector_weight,
                keyword_weight=keyword_weight,
                limit=limit,
            )

            query_time_ms = int((time.time() - start_time) * 1000)

            # Track search query
            await self._track_search_query(
                db=db,
                query_text=query,
                query_language=language,
                query_type="hybrid",
                results_count=len(combined_results),
                results_product_ids=[r["product_id"] for r in combined_results],
                query_time_ms=query_time_ms,
                customer_id=customer_id,
                session_id=session_id,
            )

            logger.info(
                "Hybrid search completed",
                query=query,
                language=language,
                results_count=len(combined_results),
                query_time_ms=query_time_ms,
            )

            return {
                "query": query,
                "language": language,
                "type": "hybrid",
                "results": combined_results,
                "total": len(combined_results),
                "query_time_ms": query_time_ms,
                "weights": {
                    "vector": vector_weight,
                    "keyword": keyword_weight,
                },
            }

        except Exception as e:
            logger.error("Hybrid search failed", query=query, error=str(e))
            return {
                "query": query,
                "language": language,
                "type": "hybrid",
                "results": [],
                "total": 0,
                "error": str(e),
            }

    async def _generate_query_embedding(self, query: str) -> list[float]:
        """
        Generate embedding for search query.

        Args:
            query: Search query text

        Returns:
            Embedding vector (768 dimensions for nomic-embed-text)
        """
        payload = {
            "model": self.EMBEDDING_MODEL,
            "prompt": query,
        }

        response = await self.client.post("/api/embeddings", json=payload)
        response.raise_for_status()

        data = response.json()
        embedding = data["embedding"]

        return embedding

    async def _vector_search(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        language: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Perform vector similarity search using pgvector.

        Uses cosine similarity (<=> operator) with IVFFlat index.

        Args:
            db: Database session
            query_embedding: Query embedding vector
            language: Language code
            limit: Maximum results

        Returns:
            List of products with similarity scores
        """
        # Convert embedding to pgvector format
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"

        # Use raw SQL for pgvector operations
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
                1 - (pe.embedding <=> :query_embedding::vector) AS similarity_score
            FROM product_embeddings pe
            JOIN products p ON p.id = pe.product_id
            WHERE pe.language_code = :language
                AND p.is_active = TRUE
            ORDER BY pe.embedding <=> :query_embedding::vector
            LIMIT :limit
            """
        )

        result = await db.execute(
            query_sql,
            {
                "query_embedding": embedding_str,
                "language": language,
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
                "similarity_score": float(row[7]),
                "match_type": "semantic",
            }
            for row in rows
        ]

    async def _keyword_search(
        self,
        db: AsyncSession,
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Perform traditional keyword search.

        Args:
            db: Database session
            query: Search query text
            limit: Maximum results

        Returns:
            List of products with keyword match scores
        """
        # Search in name, SKU, description
        search_pattern = f"%{query}%"

        stmt = (
            select(
                Product.id,
                Product.sku,
                Product.name,
                Product.description,
                Product.category,
                Product.price,
                Product.stock,
            )
            .where(
                Product.is_active == True,  # noqa: E712
                or_(
                    Product.name.ilike(search_pattern),
                    Product.sku.ilike(search_pattern),
                    Product.description.ilike(search_pattern),
                ),
            )
            .limit(limit)
        )

        result = await db.execute(stmt)
        products = result.all()

        # Calculate simple keyword match score (0.0 to 1.0)
        return [
            {
                "product_id": str(p[0]),
                "sku": p[1],
                "name": p[2],
                "description": p[3],
                "category": p[4],
                "price": float(p[5]),
                "stock": p[6],
                "keyword_score": self._calculate_keyword_score(query, p[1], p[2], p[3]),
                "match_type": "keyword",
            }
            for p in products
        ]

    def _calculate_keyword_score(
        self, query: str, sku: str, name: str, description: str | None
    ) -> float:
        """
        Calculate keyword match score (0.0 to 1.0).

        Higher score if query matches exactly or appears in name/SKU.

        Args:
            query: Search query
            sku: Product SKU
            name: Product name
            description: Product description

        Returns:
            Score between 0.0 and 1.0
        """
        query_lower = query.lower()
        score = 0.0

        # Exact SKU match (highest priority)
        if query_lower == sku.lower():
            return 1.0

        # SKU contains query
        if query_lower in sku.lower():
            score += 0.8

        # Exact name match
        if query_lower == name.lower():
            score += 0.9

        # Name contains query
        if query_lower in name.lower():
            score += 0.6

        # Description contains query
        if description and query_lower in description.lower():
            score += 0.3

        # Normalize to 0.0-1.0 range
        return min(score, 1.0)

    def _merge_search_results(
        self,
        vector_results: list[dict[str, Any]],
        keyword_results: list[dict[str, Any]],
        vector_weight: float,
        keyword_weight: float,
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Merge and re-rank vector and keyword search results.

        Args:
            vector_results: Results from vector search
            keyword_results: Results from keyword search
            vector_weight: Weight for vector similarity
            keyword_weight: Weight for keyword matching
            limit: Maximum results to return

        Returns:
            Merged and ranked results
        """
        # Create lookup dictionaries
        vector_lookup = {r["product_id"]: r for r in vector_results}
        keyword_lookup = {r["product_id"]: r for r in keyword_results}

        # Get all unique product IDs
        all_product_ids = set(vector_lookup.keys()) | set(keyword_lookup.keys())

        # Calculate combined scores
        combined = []
        for product_id in all_product_ids:
            vector_result = vector_lookup.get(product_id)
            keyword_result = keyword_lookup.get(product_id)

            # Get scores (default to 0.0 if not in result set)
            vector_score = (
                vector_result["similarity_score"] if vector_result else 0.0
            )
            keyword_score = (
                keyword_result["keyword_score"] if keyword_result else 0.0
            )

            # Combined weighted score
            combined_score = (
                vector_score * vector_weight + keyword_score * keyword_weight
            )

            # Use data from whichever result has it
            result_data = vector_result or keyword_result

            combined.append(
                {
                    **result_data,
                    "combined_score": combined_score,
                    "vector_score": vector_score,
                    "keyword_score": keyword_score,
                    "match_type": "hybrid",
                }
            )

        # Sort by combined score and return top results
        combined.sort(key=lambda x: x["combined_score"], reverse=True)
        return combined[:limit]

    async def _track_search_query(
        self,
        db: AsyncSession,
        query_text: str,
        query_language: str,
        query_type: str,
        results_count: int,
        results_product_ids: list[UUID],
        query_time_ms: int,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ):
        """
        Track search query for analytics.

        Args:
            db: Database session
            query_text: Search query text
            query_language: Language code
            query_type: Type of search (semantic, keyword, hybrid)
            results_count: Number of results returned
            results_product_ids: List of product IDs in results
            query_time_ms: Query execution time in milliseconds
            customer_id: Optional customer ID
            session_id: Optional session ID
        """
        try:
            search_query = SearchQuery(
                query_text=query_text,
                query_language=query_language,
                query_type=query_type,
                customer_id=customer_id,
                session_id=session_id,
                results_count=results_count,
                results_product_ids=results_product_ids,
                query_time_ms=query_time_ms,
                searched_at=datetime.now(UTC),
            )

            db.add(search_query)
            await db.commit()

        except Exception as e:
            logger.warning("Failed to track search query", error=str(e))
            # Don't fail the search if analytics tracking fails
            pass

    async def get_search_analytics(
        self,
        db: AsyncSession,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, Any]:
        """
        Get search analytics and insights.

        Args:
            db: Database session
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Search analytics data
        """
        query = select(SearchQuery)

        if start_date:
            query = query.where(SearchQuery.searched_at >= start_date)
        if end_date:
            query = query.where(SearchQuery.searched_at <= end_date)

        result = await db.execute(query)
        search_queries = result.scalars().all()

        # Calculate metrics
        total_searches = len(search_queries)
        avg_results = (
            sum(q.results_count for q in search_queries) / total_searches
            if total_searches > 0
            else 0
        )
        avg_query_time = (
            sum(q.query_time_ms for q in search_queries) / total_searches
            if total_searches > 0
            else 0
        )
        zero_results_count = sum(1 for q in search_queries if q.results_count == 0)

        # Top queries
        query_counts: dict[str, int] = {}
        for q in search_queries:
            query_counts[q.query_text] = query_counts.get(q.query_text, 0) + 1

        top_queries = sorted(query_counts.items(), key=lambda x: x[1], reverse=True)[
            :10
        ]

        return {
            "total_searches": total_searches,
            "avg_results_per_search": round(avg_results, 2),
            "avg_query_time_ms": round(avg_query_time, 2),
            "zero_results_count": zero_results_count,
            "zero_results_rate": (
                round(zero_results_count / total_searches * 100, 2)
                if total_searches > 0
                else 0
            ),
            "top_queries": [{"query": q, "count": c} for q, c in top_queries],
        }

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()


# Singleton instance
_semantic_search_service: SemanticSearchService | None = None


def get_semantic_search_service() -> SemanticSearchService:
    """Get SemanticSearchService singleton."""
    global _semantic_search_service
    if _semantic_search_service is None:
        _semantic_search_service = SemanticSearchService()
    return _semantic_search_service
