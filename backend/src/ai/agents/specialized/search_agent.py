"""
Search Agent for intelligent product search.

Orchestrates semantic search using embeddings and multi-language support.
"""

import json
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import structlog

from src.ai.base_agent import BaseAgent
from src.services.semantic_search_service import get_semantic_search_service

logger = structlog.get_logger(__name__)


class SearchAgent(BaseAgent):
    """
    Specialized agent for product search operations.

    Capabilities:
    - Semantic/vector search
    - Hybrid search (vector + keyword)
    - Multi-language search
    - Search analytics and optimization
    """

    def __init__(self, agent_id: str | None = None):
        """Initialize Search Agent."""
        super().__init__(
            agent_id=agent_id or "search_agent",
            name="Search Agent",
            auto_register=True,
        )

        # Agent capabilities
        self.capabilities = [
            "semantic_search",
            "product_search",
            "keyword_search",
            "hybrid_search",
            "multi_language_search",
            "search_analytics",
        ]

        # Agent metadata
        self.description = "Orchestrates intelligent product search using semantic embeddings and multi-language support"
        self.requires_verification = False
        self.estimated_execution_time = 5  # 5 seconds average

        # Get search service
        self.search_service = get_semantic_search_service()

        logger.info(
            "SearchAgent initialized",
            agent_id=self.agent_id,
            capabilities=self.capabilities,
        )

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Execute search task.

        Args:
            task: Search query or task description
            context: Optional context with search parameters

        Returns:
            Search results

        Context parameters:
            - language: Language code (default: en)
            - search_type: "semantic", "hybrid", or "keyword" (default: hybrid)
            - limit: Maximum results (default: 20)
            - customer_id: Optional customer UUID for personalization
            - session_id: Optional session ID for tracking
            - vector_weight: Weight for vector search in hybrid mode (default: 0.7)
            - keyword_weight: Weight for keyword search in hybrid mode (default: 0.3)
        """
        if not await self.validate_input(task, context):
            return {"error": "Invalid search query"}

        context = context or {}

        # Extract parameters
        query = task
        language = context.get("language", "en")
        search_type = context.get("search_type", "hybrid")
        limit = context.get("limit", 20)
        customer_id = context.get("customer_id")
        session_id = context.get("session_id")

        # Parse customer_id if string
        if customer_id and isinstance(customer_id, str):
            try:
                customer_id = UUID(customer_id)
            except ValueError:
                customer_id = None

        try:
            async with self.get_db_session() as db:
                if search_type == "semantic":
                    # Pure vector search
                    results = await self.search_service.semantic_search(
                        db=db,
                        query=query,
                        language=language,
                        limit=limit,
                        customer_id=customer_id,
                        session_id=session_id,
                    )

                elif search_type == "hybrid":
                    # Hybrid search (vector + keyword)
                    vector_weight = context.get("vector_weight", 0.7)
                    keyword_weight = context.get("keyword_weight", 0.3)

                    results = await self.search_service.hybrid_search(
                        db=db,
                        query=query,
                        language=language,
                        limit=limit,
                        vector_weight=vector_weight,
                        keyword_weight=keyword_weight,
                        customer_id=customer_id,
                        session_id=session_id,
                    )

                else:
                    return {"error": f"Unsupported search type: {search_type}"}

                logger.info(
                    "Search completed",
                    query=query,
                    search_type=search_type,
                    language=language,
                    results_count=results.get("total", 0),
                )

                return {
                    "success": True,
                    "query": query,
                    "search_type": search_type,
                    "language": language,
                    "results": results,
                }

        except Exception as e:
            logger.error("Search failed", query=query, error=str(e))
            return {"error": f"Search failed: {str(e)}"}

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream search results.

        Args:
            task: Search query
            context: Optional search parameters

        Yields:
            JSON-formatted result chunks
        """
        # Execute search
        result = await self.execute(task, context)

        # Stream result as single chunk (search is fast)
        yield json.dumps(result)

    async def semantic_search(
        self,
        query: str,
        language: str = "en",
        limit: int = 20,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Convenience method for semantic search.

        Args:
            query: Search query text
            language: Language code
            limit: Maximum results
            customer_id: Optional customer UUID
            session_id: Optional session ID

        Returns:
            Search results
        """
        return await self.execute(
            task=query,
            context={
                "search_type": "semantic",
                "language": language,
                "limit": limit,
                "customer_id": str(customer_id) if customer_id else None,
                "session_id": session_id,
            },
        )

    async def hybrid_search(
        self,
        query: str,
        language: str = "en",
        limit: int = 20,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
        customer_id: UUID | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Convenience method for hybrid search.

        Args:
            query: Search query text
            language: Language code
            limit: Maximum results
            vector_weight: Weight for vector similarity
            keyword_weight: Weight for keyword matching
            customer_id: Optional customer UUID
            session_id: Optional session ID

        Returns:
            Search results
        """
        return await self.execute(
            task=query,
            context={
                "search_type": "hybrid",
                "language": language,
                "limit": limit,
                "vector_weight": vector_weight,
                "keyword_weight": keyword_weight,
                "customer_id": str(customer_id) if customer_id else None,
                "session_id": session_id,
            },
        )

    async def get_search_analytics(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        """
        Get search analytics.

        Args:
            start_date: Optional start date (ISO format)
            end_date: Optional end date (ISO format)

        Returns:
            Search analytics data
        """
        from datetime import datetime

        try:
            async with self.get_db_session() as db:
                # Parse dates
                start = datetime.fromisoformat(start_date) if start_date else None
                end = datetime.fromisoformat(end_date) if end_date else None

                analytics = await self.search_service.get_search_analytics(
                    db=db,
                    start_date=start,
                    end_date=end,
                )

                return {"success": True, "analytics": analytics}

        except Exception as e:
            logger.error("Failed to get search analytics", error=str(e))
            return {"error": f"Analytics failed: {str(e)}"}

    async def health_check(self):
        """
        Check Search Agent health.

        Verifies:
        - Database connectivity
        - Search service availability
        - OpenAI API connectivity (via test embedding)
        """
        from src.ai.orchestration import AgentHealthReport, AgentStatus

        try:
            checks_passed = []
            checks_failed = []

            # Check 1: Database access
            try:
                async with self.get_db_session() as db:
                    if db:
                        checks_passed.append("database_accessible")
                    else:
                        checks_failed.append("database_check: session is None")
            except Exception as e:
                checks_failed.append(f"database_check: {str(e)}")

            # Check 2: Search service available
            try:
                if self.search_service:
                    checks_passed.append("search_service_available")
                else:
                    checks_failed.append("search_service_check: service is None")
            except Exception as e:
                checks_failed.append(f"search_service_check: {str(e)}")

            # Check 3: OpenAI API connectivity (test embedding)
            try:
                test_embedding = await self.search_service._generate_query_embedding(
                    "test query"
                )
                if len(test_embedding) == 1536:
                    checks_passed.append("openai_api_accessible")
                else:
                    checks_failed.append(
                        f"openai_api_check: unexpected embedding dimensions ({len(test_embedding)})"
                    )
            except Exception as e:
                checks_failed.append(f"openai_api_check: {str(e)}")

            # Determine status
            if len(checks_failed) == 0:
                status = AgentStatus.ACTIVE
            elif len(checks_passed) > len(checks_failed):
                status = AgentStatus.DEGRADED
            else:
                status = AgentStatus.OFFLINE

            from datetime import UTC, datetime

            return AgentHealthReport(
                agent_id=self.agent_id,
                status=status,
                checks_passed=checks_passed,
                checks_failed=checks_failed,
                last_checked=datetime.now(UTC),
            )

        except Exception as e:
            from datetime import UTC, datetime

            return AgentHealthReport(
                agent_id=self.agent_id,
                status=AgentStatus.OFFLINE,
                error=str(e),
                last_checked=datetime.now(UTC),
            )
