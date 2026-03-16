"""
Enhanced Semantic Search Service for Product and Customer Discovery.

Provides vector-based semantic search using OpenAI embeddings with hybrid search support.
"""

import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
import structlog
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.ai_search_models import SearchQuery
from src.db.demo_models import Customer, Product

logger = structlog.get_logger(__name__)
settings = get_settings()


class SemanticSearchServiceV2:
    """
    Enhanced service for semantic search using OpenAI embeddings.

    Features:
    - Pure vector search (semantic similarity only)
    - Hybrid search (vector + keyword, weighted)
    - Product and Customer search
    - Search analytics tracking
    """

    EMBEDDING_MODEL = "text-embedding-3-small"  # OpenAI model
    EMBEDDING_DIMENSIONS = 1536

    def __init__(self):
        self.api_key = settings.openai_api_key
        if not self.api_key:
            logger.warning("OpenAI API key not configured. Semantic search will fail.")

        self.client = httpx.AsyncClient(
            base_url="https://api.openai.com/v1",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def semantic_search_products(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Perform pure semantic product search using vector similarity.

        Args:
            db: Database session
            query: Search query text
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
            results = await self._vector_search_products(
                db=db,
                query_embedding=query_embedding,
                limit=limit,
            )

            query_time_ms = int((time.time() - start_time) * 1000)

            # Track search query for analytics
            await self._track_search_query(
                db=db,
                query_text=query,
                query_type="semantic_product",
                results_count=len(results),
                query_time_ms=query_time_ms,
                customer_id=customer_id,
                session_id=session_id,
            )

            logger.info(
                "Product semantic search completed",
                query=query,
                results_count=len(results),
                query_time_ms=query_time_ms,
            )

            return {
                "query": query,
                "type": "semantic_product",
                "results": results,
                "total": len(results),
                "query_time_ms": query_time_ms,
            }

        except Exception as e:
            logger.error("Product semantic search failed", query=query, error=str(e))
            return {
                "query": query,
                "type": "semantic_product",
                "results": [],
                "total": 0,
                "error": str(e),
            }

    async def semantic_search_customers(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Perform pure semantic customer search using vector similarity.

        Args:
            db: Database session
            query: Search query text
            limit: Maximum results to return
            session_id: Optional session ID for analytics

        Returns:
            Search results with similarity scores
        """
        start_time = time.time()

        try:
            # Generate embedding for query
            query_embedding = await self._generate_query_embedding(query)

            # Search using pgvector cosine similarity
            results = await self._vector_search_customers(
                db=db,
                query_embedding=query_embedding,
                limit=limit,
            )

            query_time_ms = int((time.time() - start_time) * 1000)

            # Track search query for analytics
            await self._track_search_query(
                db=db,
                query_text=query,
                query_type="semantic_customer",
                results_count=len(results),
                query_time_ms=query_time_ms,
                session_id=session_id,
            )

            logger.info(
                "Customer semantic search completed",
                query=query,
                results_count=len(results),
                query_time_ms=query_time_ms,
            )

            return {
                "query": query,
                "type": "semantic_customer",
                "results": results,
                "total": len(results),
                "query_time_ms": query_time_ms,
            }

        except Exception as e:
            logger.error("Customer semantic search failed", query=query, error=str(e))
            return {
                "query": query,
                "type": "semantic_customer",
                "results": [],
                "total": 0,
                "error": str(e),
            }

    async def hybrid_search_products(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Perform hybrid product search combining vector similarity and keyword matching.

        Args:
            db: Database session
            query: Search query text
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
            vector_results = await self._vector_search_products(
                db=db,
                query_embedding=query_embedding,
                limit=limit * 2,  # Get more results for merging
            )

            # Get keyword search results
            keyword_results = await self._keyword_search_products(
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
                query_type="hybrid_product",
                results_count=len(combined_results),
                query_time_ms=query_time_ms,
                customer_id=customer_id,
                session_id=session_id,
            )

            logger.info(
                "Product hybrid search completed",
                query=query,
                results_count=len(combined_results),
                query_time_ms=query_time_ms,
            )

            return {
                "query": query,
                "type": "hybrid_product",
                "results": combined_results,
                "total": len(combined_results),
                "query_time_ms": query_time_ms,
                "weights": {
                    "vector": vector_weight,
                    "keyword": keyword_weight,
                },
            }

        except Exception as e:
            logger.error("Product hybrid search failed", query=query, error=str(e))
            return {
                "query": query,
                "type": "hybrid_product",
                "results": [],
                "total": 0,
                "error": str(e),
            }

    async def hybrid_search_customers(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Perform hybrid customer search combining vector similarity and keyword matching.

        Args:
            db: Database session
            query: Search query text
            limit: Maximum results to return
            vector_weight: Weight for vector similarity (0.0 to 1.0)
            keyword_weight: Weight for keyword matching (0.0 to 1.0)
            session_id: Optional session ID

        Returns:
            Search results with combined scores
        """
        start_time = time.time()

        try:
            # Generate embedding for query
            query_embedding = await self._generate_query_embedding(query)

            # Get vector search results
            vector_results = await self._vector_search_customers(
                db=db,
                query_embedding=query_embedding,
                limit=limit * 2,
            )

            # Get keyword search results
            keyword_results = await self._keyword_search_customers(
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
                id_key="customer_id",
            )

            query_time_ms = int((time.time() - start_time) * 1000)

            # Track search query
            await self._track_search_query(
                db=db,
                query_text=query,
                query_type="hybrid_customer",
                results_count=len(combined_results),
                query_time_ms=query_time_ms,
                session_id=session_id,
            )

            logger.info(
                "Customer hybrid search completed",
                query=query,
                results_count=len(combined_results),
                query_time_ms=query_time_ms,
            )

            return {
                "query": query,
                "type": "hybrid_customer",
                "results": combined_results,
                "total": len(combined_results),
                "query_time_ms": query_time_ms,
                "weights": {
                    "vector": vector_weight,
                    "keyword": keyword_weight,
                },
            }

        except Exception as e:
            logger.error("Customer hybrid search failed", query=query, error=str(e))
            return {
                "query": query,
                "type": "hybrid_customer",
                "results": [],
                "total": 0,
                "error": str(e),
            }

    async def _generate_query_embedding(self, query: str) -> list[float]:
        """
        Generate embedding for search query using OpenAI.

        Args:
            query: Search query text

        Returns:
            Embedding vector (1536 dimensions)
        """
        payload = {
            "model": self.EMBEDDING_MODEL,
            "input": query,
            "encoding_format": "float",
        }

        response = await self.client.post("/embeddings", json=payload)
        response.raise_for_status()

        data = response.json()
        embedding = data["data"][0]["embedding"]

        return embedding

    async def _vector_search_products(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Perform vector similarity search for products using pgvector.

        Args:
            db: Database session
            query_embedding: Query embedding vector
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
                1 - (p.embedding <=> :query_embedding::vector) AS similarity_score
            FROM products p
            WHERE p.is_active = TRUE
                AND p.embedding IS NOT NULL
            ORDER BY p.embedding <=> :query_embedding::vector
            LIMIT :limit
            """
        )

        result = await db.execute(
            query_sql,
            {
                "query_embedding": embedding_str,
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

    async def _vector_search_customers(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Perform vector similarity search for customers using pgvector.

        Args:
            db: Database session
            query_embedding: Query embedding vector
            limit: Maximum results

        Returns:
            List of customers with similarity scores
        """
        # Convert embedding to pgvector format
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"

        # Use raw SQL for pgvector operations
        query_sql = text(
            """
            SELECT
                c.id,
                c.customer_number,
                c.company_name,
                c.contact_name,
                c.email,
                c.phone,
                c.address,
                c.city,
                c.state,
                1 - (c.embedding <=> :query_embedding::vector) AS similarity_score
            FROM customers c
            WHERE c.is_active = TRUE
                AND c.embedding IS NOT NULL
            ORDER BY c.embedding <=> :query_embedding::vector
            LIMIT :limit
            """
        )

        result = await db.execute(
            query_sql,
            {
                "query_embedding": embedding_str,
                "limit": limit,
            },
        )

        rows = result.fetchall()

        return [
            {
                "customer_id": str(row[0]),
                "customer_number": row[1],
                "company_name": row[2],
                "contact_name": row[3],
                "email": row[4],
                "phone": row[5],
                "address": row[6],
                "city": row[7],
                "state": row[8],
                "similarity_score": float(row[9]),
                "match_type": "semantic",
            }
            for row in rows
        ]

    async def _keyword_search_products(
        self,
        db: AsyncSession,
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Perform traditional keyword search for products.

        Args:
            db: Database session
            query: Search query text
            limit: Maximum results

        Returns:
            List of products with keyword match scores
        """
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

    async def _keyword_search_customers(
        self,
        db: AsyncSession,
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        Perform traditional keyword search for customers.

        Args:
            db: Database session
            query: Search query text
            limit: Maximum results

        Returns:
            List of customers with keyword match scores
        """
        search_pattern = f"%{query}%"

        stmt = (
            select(
                Customer.id,
                Customer.customer_number,
                Customer.company_name,
                Customer.contact_name,
                Customer.email,
                Customer.phone,
                Customer.address,
                Customer.city,
                Customer.state,
            )
            .where(
                Customer.is_active == True,  # noqa: E712
                or_(
                    Customer.company_name.ilike(search_pattern),
                    Customer.contact_name.ilike(search_pattern),
                    Customer.email.ilike(search_pattern),
                    Customer.customer_number.ilike(search_pattern),
                ),
            )
            .limit(limit)
        )

        result = await db.execute(stmt)
        customers = result.all()

        return [
            {
                "customer_id": str(c[0]),
                "customer_number": c[1],
                "company_name": c[2],
                "contact_name": c[3],
                "email": c[4],
                "phone": c[5],
                "address": c[6],
                "city": c[7],
                "state": c[8],
                "keyword_score": self._calculate_customer_keyword_score(
                    query, c[1], c[2], c[3]
                ),
                "match_type": "keyword",
            }
            for c in customers
        ]

    def _calculate_keyword_score(
        self, query: str, sku: str, name: str, description: str | None
    ) -> float:
        """Calculate keyword match score for products (0.0 to 1.0)."""
        query_lower = query.lower()
        score = 0.0

        if query_lower == sku.lower():
            return 1.0
        if query_lower in sku.lower():
            score += 0.8
        if query_lower == name.lower():
            score += 0.9
        if query_lower in name.lower():
            score += 0.6
        if description and query_lower in description.lower():
            score += 0.3

        return min(score, 1.0)

    def _calculate_customer_keyword_score(
        self, query: str, customer_number: str, company_name: str, contact_name: str
    ) -> float:
        """Calculate keyword match score for customers (0.0 to 1.0)."""
        query_lower = query.lower()
        score = 0.0

        if query_lower == customer_number.lower():
            return 1.0
        if query_lower in customer_number.lower():
            score += 0.8
        if query_lower == company_name.lower():
            score += 0.9
        if query_lower in company_name.lower():
            score += 0.7
        if query_lower in contact_name.lower():
            score += 0.5

        return min(score, 1.0)

    def _merge_search_results(
        self,
        vector_results: list[dict[str, Any]],
        keyword_results: list[dict[str, Any]],
        vector_weight: float,
        keyword_weight: float,
        limit: int,
        id_key: str = "product_id",
    ) -> list[dict[str, Any]]:
        """
        Merge and re-rank vector and keyword search results.

        Args:
            vector_results: Results from vector search
            keyword_results: Results from keyword search
            vector_weight: Weight for vector similarity
            keyword_weight: Weight for keyword matching
            limit: Maximum results to return
            id_key: ID field name ("product_id" or "customer_id")

        Returns:
            Merged and ranked results
        """
        vector_lookup = {r[id_key]: r for r in vector_results}
        keyword_lookup = {r[id_key]: r for r in keyword_results}

        all_ids = set(vector_lookup.keys()) | set(keyword_lookup.keys())

        combined = []
        for item_id in all_ids:
            vector_result = vector_lookup.get(item_id)
            keyword_result = keyword_lookup.get(item_id)

            vector_score = (
                vector_result["similarity_score"] if vector_result else 0.0
            )
            keyword_score = (
                keyword_result["keyword_score"] if keyword_result else 0.0
            )

            combined_score = (
                vector_score * vector_weight + keyword_score * keyword_weight
            )

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

        combined.sort(key=lambda x: x["combined_score"], reverse=True)
        return combined[:limit]

    async def _track_search_query(
        self,
        db: AsyncSession,
        query_text: str,
        query_type: str,
        results_count: int,
        query_time_ms: int,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ):
        """Track search query for analytics."""
        try:
            search_query = SearchQuery(
                query_text=query_text,
                query_language="en",
                query_type=query_type,
                customer_id=customer_id,
                session_id=session_id,
                results_count=results_count,
                results_product_ids=[],  # Simplified for now
                query_time_ms=query_time_ms,
                searched_at=datetime.now(UTC),
            )

            db.add(search_query)
            await db.commit()

        except Exception as e:
            logger.warning("Failed to track search query", error=str(e))

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()


# Singleton instance
_semantic_search_service_v2: SemanticSearchServiceV2 | None = None


def get_semantic_search_service_v2() -> SemanticSearchServiceV2:
    """Get SemanticSearchServiceV2 singleton."""
    global _semantic_search_service_v2
    if _semantic_search_service_v2 is None:
        _semantic_search_service_v2 = SemanticSearchServiceV2()
    return _semantic_search_service_v2
