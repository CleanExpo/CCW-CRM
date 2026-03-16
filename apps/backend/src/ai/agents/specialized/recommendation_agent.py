"""
Recommendation Agent for intelligent product recommendations.

Provides personalized product recommendations using multiple algorithms.
"""

import json
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import structlog

from src.ai.base_agent import BaseAgent
from src.db.ai_search_models import InteractionType, RecommendationType
from src.services.recommendation_service import get_recommendation_service

logger = structlog.get_logger(__name__)


class RecommendationAgent(BaseAgent):
    """
    Specialized agent for product recommendation operations.

    Capabilities:
    - Similar products (content-based)
    - Frequently bought together (collaborative filtering)
    - Personalized recommendations (customer history-based)
    - Interaction tracking for learning
    """

    def __init__(self, agent_id: str | None = None):
        """Initialize Recommendation Agent."""
        super().__init__(
            agent_id=agent_id or "recommendation_agent",
            name="Recommendation Agent",
            auto_register=True,
        )

        # Agent capabilities
        self.capabilities = [
            "product_recommendations",
            "similar_products",
            "frequently_bought_together",
            "personalized_recommendations",
            "interaction_tracking",
            "recommendation_precomputation",
        ]

        # Agent metadata
        self.description = "Provides intelligent product recommendations using collaborative filtering and content-based algorithms"
        self.requires_verification = False
        self.estimated_execution_time = 3  # 3 seconds average

        # Get recommendation service
        self.recommendation_service = get_recommendation_service()

        logger.info(
            "RecommendationAgent initialized",
            agent_id=self.agent_id,
            capabilities=self.capabilities,
        )

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Execute recommendation task.

        Args:
            task: Task description (e.g., "recommend similar products")
            context: Context with parameters

        Returns:
            Recommendation results

        Context parameters:
            - recommendation_type: "similar", "frequently_bought_together", or "personalized"
            - product_id: Product UUID (for similar/frequently_bought_together)
            - customer_id: Customer UUID (for personalized)
            - language: Language code (default: en)
            - limit: Maximum recommendations (default: 10)
        """
        if not await self.validate_input(task, context):
            return {"error": "Invalid recommendation request"}

        context = context or {}

        # Extract parameters
        recommendation_type = context.get("recommendation_type")
        product_id = context.get("product_id")
        customer_id = context.get("customer_id")
        language = context.get("language", "en")
        limit = context.get("limit", 10)

        # Parse UUIDs if strings
        if product_id and isinstance(product_id, str):
            try:
                product_id = UUID(product_id)
            except ValueError:
                return {"error": "Invalid product_id format"}

        if customer_id and isinstance(customer_id, str):
            try:
                customer_id = UUID(customer_id)
            except ValueError:
                return {"error": "Invalid customer_id format"}

        try:
            async with self.get_db_session() as db:
                if recommendation_type == "similar":
                    if not product_id:
                        return {"error": "product_id required for similar products"}

                    recommendations = (
                        await self.recommendation_service.get_similar_products(
                            db=db,
                            product_id=product_id,
                            language=language,
                            limit=limit,
                        )
                    )

                elif recommendation_type == "frequently_bought_together":
                    if not product_id:
                        return {
                            "error": "product_id required for frequently bought together"
                        }

                    recommendations = await self.recommendation_service.get_frequently_bought_together(
                        db=db,
                        product_id=product_id,
                        limit=limit,
                    )

                elif recommendation_type == "personalized":
                    if not customer_id:
                        return {
                            "error": "customer_id required for personalized recommendations"
                        }

                    recommendations = await self.recommendation_service.get_personalized_recommendations(
                        db=db,
                        customer_id=customer_id,
                        limit=limit,
                    )

                else:
                    return {
                        "error": f"Unsupported recommendation type: {recommendation_type}"
                    }

                logger.info(
                    "Recommendations generated",
                    recommendation_type=recommendation_type,
                    product_id=str(product_id) if product_id else None,
                    customer_id=str(customer_id) if customer_id else None,
                    count=len(recommendations),
                )

                return {
                    "success": True,
                    "recommendation_type": recommendation_type,
                    "recommendations": recommendations,
                    "total": len(recommendations),
                }

        except Exception as e:
            logger.error(
                "Recommendation failed",
                recommendation_type=recommendation_type,
                error=str(e),
            )
            return {"error": f"Recommendation failed: {str(e)}"}

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream recommendation results.

        Args:
            task: Task description
            context: Recommendation parameters

        Yields:
            JSON-formatted result chunks
        """
        # Execute recommendations
        result = await self.execute(task, context)

        # Stream result as single chunk (recommendations are fast)
        yield json.dumps(result)

    async def get_similar_products(
        self,
        product_id: UUID,
        language: str = "en",
        limit: int = 10,
    ) -> dict[str, Any]:
        """
        Convenience method for similar products.

        Args:
            product_id: Source product UUID
            language: Language code
            limit: Maximum recommendations

        Returns:
            Similar product recommendations
        """
        return await self.execute(
            task="get similar products",
            context={
                "recommendation_type": "similar",
                "product_id": str(product_id),
                "language": language,
                "limit": limit,
            },
        )

    async def get_frequently_bought_together(
        self,
        product_id: UUID,
        limit: int = 10,
    ) -> dict[str, Any]:
        """
        Convenience method for frequently bought together.

        Args:
            product_id: Source product UUID
            limit: Maximum recommendations

        Returns:
            Frequently bought together recommendations
        """
        return await self.execute(
            task="get frequently bought together",
            context={
                "recommendation_type": "frequently_bought_together",
                "product_id": str(product_id),
                "limit": limit,
            },
        )

    async def get_personalized_recommendations(
        self,
        customer_id: UUID,
        limit: int = 10,
    ) -> dict[str, Any]:
        """
        Convenience method for personalized recommendations.

        Args:
            customer_id: Customer UUID
            limit: Maximum recommendations

        Returns:
            Personalized recommendations
        """
        return await self.execute(
            task="get personalized recommendations",
            context={
                "recommendation_type": "personalized",
                "customer_id": str(customer_id),
                "limit": limit,
            },
        )

    async def track_interaction(
        self,
        customer_id: UUID,
        product_id: UUID,
        interaction_type: str,
        session_id: str | None = None,
        source: str = "web",
    ) -> dict[str, Any]:
        """
        Track customer-product interaction.

        Args:
            customer_id: Customer UUID
            product_id: Product UUID
            interaction_type: Type of interaction (view, add_to_cart, purchase, etc.)
            session_id: Optional session ID
            source: Source of interaction (web, mobile, voice, api)

        Returns:
            Tracking result
        """
        try:
            # Convert string interaction type to enum
            interaction_enum = InteractionType(interaction_type)

            async with self.get_db_session() as db:
                await self.recommendation_service.track_interaction(
                    db=db,
                    customer_id=customer_id,
                    product_id=product_id,
                    interaction_type=interaction_enum,
                    session_id=session_id,
                    source=source,
                )

                logger.info(
                    "Interaction tracked",
                    customer_id=str(customer_id),
                    product_id=str(product_id),
                    interaction_type=interaction_type,
                )

                return {
                    "success": True,
                    "message": "Interaction tracked successfully",
                }

        except ValueError:
            return {"error": f"Invalid interaction type: {interaction_type}"}
        except Exception as e:
            logger.error("Failed to track interaction", error=str(e))
            return {"error": f"Tracking failed: {str(e)}"}

    async def precompute_recommendations(
        self,
        product_ids: list[UUID] | None = None,
        recommendation_type: str | None = None,
    ) -> dict[str, Any]:
        """
        Precompute recommendations for faster retrieval.

        Args:
            product_ids: Optional list of product UUIDs (None = all products)
            recommendation_type: Optional type filter (None = all types)

        Returns:
            Precomputation results
        """
        try:
            # Convert string recommendation type to enum if provided
            recommendation_enum = None
            if recommendation_type:
                recommendation_enum = RecommendationType(recommendation_type)

            async with self.get_db_session() as db:
                results = await self.recommendation_service.precompute_recommendations(
                    db=db,
                    product_ids=product_ids,
                    recommendation_type=recommendation_enum,
                )

                logger.info("Recommendations precomputed", results=results)

                return {
                    "success": True,
                    "results": results,
                }

        except ValueError:
            return {"error": f"Invalid recommendation type: {recommendation_type}"}
        except Exception as e:
            logger.error("Precomputation failed", error=str(e))
            return {"error": f"Precomputation failed: {str(e)}"}

    async def update_co_occurrences(
        self,
        order_id: UUID,
    ) -> dict[str, Any]:
        """
        Update co-occurrence data from a completed order.

        Args:
            order_id: Completed order UUID

        Returns:
            Update result
        """
        try:
            async with self.get_db_session() as db:
                await self.recommendation_service.update_co_occurrences(
                    db=db,
                    order_id=order_id,
                )

                logger.info("Co-occurrences updated", order_id=str(order_id))

                return {
                    "success": True,
                    "message": "Co-occurrences updated successfully",
                }

        except Exception as e:
            logger.error("Failed to update co-occurrences", error=str(e))
            return {"error": f"Update failed: {str(e)}"}

    async def health_check(self):
        """
        Check Recommendation Agent health.

        Verifies:
        - Database connectivity
        - Recommendation service availability
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

            # Check 2: Recommendation service available
            try:
                if self.recommendation_service:
                    checks_passed.append("recommendation_service_available")
                else:
                    checks_failed.append(
                        "recommendation_service_check: service is None"
                    )
            except Exception as e:
                checks_failed.append(f"recommendation_service_check: {str(e)}")

            # Check 3: Test retrieval of precomputed recommendations
            try:
                async with self.get_db_session() as db:
                    from uuid import uuid4

                    # Try to get recommendations for a random product (should return empty gracefully)
                    test_result = await self.recommendation_service.get_similar_products(
                        db=db,
                        product_id=uuid4(),  # Random UUID (won't exist)
                        language="en",
                        limit=1,
                    )
                    if isinstance(test_result, list):
                        checks_passed.append("recommendation_retrieval_works")
                    else:
                        checks_failed.append(
                            "recommendation_retrieval_check: unexpected result type"
                        )
            except Exception as e:
                checks_failed.append(f"recommendation_retrieval_check: {str(e)}")

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
