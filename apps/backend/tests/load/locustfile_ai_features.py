"""
Locust Load Testing for AI Features

Tests the performance and scalability of:
- Semantic Search
- Product Recommendations
- AP2 Integration
- Autonomous Development

Run with:
    locust -f locustfile_ai_features.py --host=http://localhost:8000

Target: 1000 concurrent users
Performance targets:
- Semantic Search: <500ms (p95)
- Recommendations: <200ms (p95)
- AP2 Mandates: <1000ms (p95)
"""

import random
from uuid import uuid4

from locust import HttpUser, between, tag, task


class AIFeatureUser(HttpUser):
    """
    Simulates a user interacting with AI features.

    Weight distribution:
    - 40% Search queries
    - 30% Recommendation views
    - 20% AP2 operations
    - 10% Autonomous dev monitoring
    """

    wait_time = between(1, 5)  # Wait 1-5 seconds between tasks

    # Test data
    product_ids = [
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002",
        "550e8400-e29b-41d4-a716-446655440003",
    ]

    customer_ids = [
        "550e8400-e29b-41d4-a716-446655440000",
        "650e8400-e29b-41d4-a716-446655440000",
    ]

    search_queries = [
        "power drill",
        "safety helmet",
        "concrete mixer",
        "hand tools",
        "construction equipment",
        "heavy machinery",
        "building materials",
        "electrical supplies",
        "plumbing tools",
        "safety gear",
    ]

    languages = ["en", "zh-CN", "es", "pt", "ar"]

    def on_start(self):
        """Called when a user starts. Authenticate if needed."""
        # For load testing, we'll use the demo mode which doesn't require auth
        # In production, would login here
        pass

    @task(20)
    @tag("search", "critical")
    def semantic_search(self):
        """Perform semantic search query."""
        query = random.choice(self.search_queries)
        language = random.choice(self.languages)
        limit = random.choice([10, 20, 50])

        with self.client.get(
            "/api/search/semantic",
            params={
                "query": query,
                "language": language,
                "limit": limit,
            },
            catch_response=True,
            name="/api/search/semantic",
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Check performance target
                    if data.get("results", {}).get("query_time_ms", 0) < 500:
                        response.success()
                    else:
                        response.failure("Query time exceeded 500ms target")
                else:
                    response.failure("Search failed")
            else:
                response.failure(f"Status code: {response.status_code}")

    @task(10)
    @tag("search", "critical")
    def hybrid_search(self):
        """Perform hybrid search (vector + keyword)."""
        query = random.choice(self.search_queries)
        language = random.choice(self.languages)

        with self.client.get(
            "/api/search/hybrid",
            params={
                "query": query,
                "language": language,
                "limit": 20,
                "vector_weight": 0.7,
                "keyword_weight": 0.3,
            },
            catch_response=True,
            name="/api/search/hybrid",
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if not data.get("success"):
                    response.failure("Hybrid search failed")
            else:
                response.failure(f"Status code: {response.status_code}")

    @task(5)
    @tag("search")
    def search_analytics(self):
        """Get search analytics."""
        self.client.get(
            "/api/search/analytics",
            name="/api/search/analytics",
        )

    @task(15)
    @tag("recommendations", "critical")
    def similar_products(self):
        """Get similar product recommendations."""
        product_id = random.choice(self.product_ids)
        language = random.choice(self.languages)

        with self.client.get(
            f"/api/recommendations/similar/{product_id}",
            params={
                "language": language,
                "limit": 10,
            },
            catch_response=True,
            name="/api/recommendations/similar",
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Check performance target
                    if data.get("query_time_ms", 0) < 200:
                        response.success()
                    else:
                        response.failure("Query time exceeded 200ms target")
                else:
                    response.failure("Recommendations failed")
            else:
                response.failure(f"Status code: {response.status_code}")

    @task(10)
    @tag("recommendations", "critical")
    def frequently_bought_together(self):
        """Get frequently bought together recommendations."""
        product_id = random.choice(self.product_ids)
        language = random.choice(self.languages)

        self.client.get(
            f"/api/recommendations/frequently-bought-together/{product_id}",
            params={
                "language": language,
                "limit": 5,
            },
            name="/api/recommendations/frequently-bought-together",
        )

    @task(10)
    @tag("recommendations")
    def personalized_recommendations(self):
        """Get personalized recommendations for customer."""
        customer_id = random.choice(self.customer_ids)
        language = random.choice(self.languages)

        self.client.get(
            f"/api/recommendations/personalized/{customer_id}",
            params={
                "language": language,
                "limit": 15,
            },
            name="/api/recommendations/personalized",
        )

    @task(5)
    @tag("recommendations")
    def track_interaction(self):
        """Track customer-product interaction."""
        interaction_types = ["view", "add_to_cart", "wishlist", "purchase"]

        self.client.post(
            "/api/recommendations/track-interaction",
            json={
                "customer_id": random.choice(self.customer_ids),
                "product_id": random.choice(self.product_ids),
                "interaction_type": random.choice(interaction_types),
                "session_id": f"load_test_{uuid4().hex[:8]}",
            },
            name="/api/recommendations/track-interaction",
        )

    @task(8)
    @tag("ap2", "critical")
    def create_intent_mandate(self):
        """Create AP2 intent mandate."""
        intent_descriptions = [
            "I want to buy construction equipment",
            "Need safety gear for workers",
            "Looking for power tools",
            "Purchase building materials",
        ]

        self.client.post(
            "/api/integrations/ap2/mandates/intent",
            json={
                "intent_description": random.choice(intent_descriptions),
                "language": random.choice(self.languages),
                "customer_id": random.choice(self.customer_ids),
            },
            name="/api/integrations/ap2/mandates/intent",
        )

    @task(4)
    @tag("ap2")
    def create_voice_session(self):
        """Create voice commerce session."""
        self.client.post(
            "/api/integrations/ap2/voice/sessions",
            json={
                "language": random.choice(self.languages),
                "assistant_type": "google_assistant",
                "customer_id": random.choice(self.customer_ids),
            },
            name="/api/integrations/ap2/voice/sessions",
        )

    @task(3)
    @tag("ap2")
    def get_ap2_connection_status(self):
        """Get AP2 connection status."""
        self.client.get(
            "/api/integrations/ap2/connection",
            name="/api/integrations/ap2/connection",
        )

    @task(2)
    @tag("autonomous")
    def get_execution_loop_status(self):
        """Get autonomous execution loop status."""
        self.client.get(
            "/api/autonomous/status",
            name="/api/autonomous/status",
        )

    @task(2)
    @tag("autonomous")
    def get_agent_activity(self):
        """Get agent activity dashboard."""
        self.client.get(
            "/api/autonomous/agents/activity",
            name="/api/autonomous/agents/activity",
        )

    @task(1)
    @tag("autonomous")
    def list_projects(self):
        """List autonomous development projects."""
        self.client.get(
            "/api/autonomous/projects",
            name="/api/autonomous/projects",
        )


class SearchOnlyUser(HttpUser):
    """User that only performs search operations (for focused load testing)."""

    wait_time = between(0.5, 2)

    search_queries = AIFeatureUser.search_queries
    languages = AIFeatureUser.languages

    @task(60)
    @tag("search-only")
    def semantic_search(self):
        """Semantic search."""
        query = random.choice(self.search_queries)
        language = random.choice(self.languages)

        self.client.get(
            "/api/search/semantic",
            params={
                "query": query,
                "language": language,
                "limit": 20,
            },
            name="/api/search/semantic",
        )

    @task(40)
    @tag("search-only")
    def hybrid_search(self):
        """Hybrid search."""
        query = random.choice(self.search_queries)
        language = random.choice(self.languages)

        self.client.get(
            "/api/search/hybrid",
            params={
                "query": query,
                "language": language,
                "limit": 20,
                "vector_weight": 0.7,
                "keyword_weight": 0.3,
            },
            name="/api/search/hybrid",
        )


class RecommendationOnlyUser(HttpUser):
    """User that only views recommendations (for focused load testing)."""

    wait_time = between(0.5, 2)

    product_ids = AIFeatureUser.product_ids
    customer_ids = AIFeatureUser.customer_ids
    languages = AIFeatureUser.languages

    @task(50)
    @tag("rec-only")
    def similar_products(self):
        """Similar products."""
        product_id = random.choice(self.product_ids)
        language = random.choice(self.languages)

        self.client.get(
            f"/api/recommendations/similar/{product_id}",
            params={
                "language": language,
                "limit": 10,
            },
            name="/api/recommendations/similar",
        )

    @task(30)
    @tag("rec-only")
    def frequently_bought_together(self):
        """Frequently bought together."""
        product_id = random.choice(self.product_ids)
        language = random.choice(self.languages)

        self.client.get(
            f"/api/recommendations/frequently-bought-together/{product_id}",
            params={
                "language": language,
                "limit": 5,
            },
            name="/api/recommendations/frequently-bought-together",
        )

    @task(20)
    @tag("rec-only")
    def personalized_recommendations(self):
        """Personalized recommendations."""
        customer_id = random.choice(self.customer_ids)
        language = random.choice(self.languages)

        self.client.get(
            f"/api/recommendations/personalized/{customer_id}",
            params={
                "language": language,
                "limit": 15,
            },
            name="/api/recommendations/personalized",
        )


class AP2OnlyUser(HttpUser):
    """User that only interacts with AP2 features (for focused load testing)."""

    wait_time = between(1, 3)

    customer_ids = AIFeatureUser.customer_ids
    languages = AIFeatureUser.languages

    @task(60)
    @tag("ap2-only")
    def create_intent_mandate(self):
        """Create intent mandate."""
        intent_descriptions = [
            "I want to buy construction equipment",
            "Need safety gear for workers",
            "Looking for power tools",
        ]

        self.client.post(
            "/api/integrations/ap2/mandates/intent",
            json={
                "intent_description": random.choice(intent_descriptions),
                "language": random.choice(self.languages),
                "customer_id": random.choice(self.customer_ids),
            },
            name="/api/integrations/ap2/mandates/intent",
        )

    @task(30)
    @tag("ap2-only")
    def create_voice_session(self):
        """Create voice session."""
        self.client.post(
            "/api/integrations/ap2/voice/sessions",
            json={
                "language": random.choice(self.languages),
                "assistant_type": "google_assistant",
                "customer_id": random.choice(self.customer_ids),
            },
            name="/api/integrations/ap2/voice/sessions",
        )

    @task(10)
    @tag("ap2-only")
    def get_connection_status(self):
        """Get connection status."""
        self.client.get(
            "/api/integrations/ap2/connection",
            name="/api/integrations/ap2/connection",
        )
