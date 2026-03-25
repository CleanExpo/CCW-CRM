"""Integration tests for Sprint 3 NL ERP Query endpoints.

Tests:
  POST /api/ai/query          — NL query (JSON response)
  GET  /api/ai/query/examples — example queries for UI
  GET  /api/ai/query/stream   — SSE streaming query

All tests run in demo mode (no ANTHROPIC_API_KEY required).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestNLQuery:
    """Tests for POST /api/ai/query."""

    @pytest.mark.xfail(
        strict=False,
        reason="Known asyncio event loop isolation issue with BaseHTTPMiddleware in session-scoped tests",
    )
    async def test_query_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "How many products do we have?"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_query_response_shape(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "How many products do we have?"},
            headers=auth_headers,
        )
        body = resp.json()
        for field in ("query", "answer", "confidence", "row_count", "results"):
            assert field in body, f"Missing field: {field}"

    async def test_query_echoes_input(self, client: AsyncClient, auth_headers: dict):
        q = "How many truckmounts do we have?"
        resp = await client.post(
            "/api/ai/query",
            json={"query": q},
            headers=auth_headers,
        )
        assert resp.json()["query"] == q

    async def test_truckmount_query_demo_answer(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "How many truckmounts do we have in stock?"},
            headers=auth_headers,
        )
        body = resp.json()
        assert len(body["answer"]) > 20  # non-trivial answer
        assert body["row_count"] > 0

    async def test_inactive_customers_demo_answer(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "Which customers haven't ordered in 90 days?"},
            headers=auth_headers,
        )
        body = resp.json()
        assert len(body["answer"]) > 20
        assert body["row_count"] > 0

    async def test_margin_query_demo_answer(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "Which products have the highest margin?"},
            headers=auth_headers,
        )
        body = resp.json()
        assert len(body["answer"]) > 20
        assert body["row_count"] > 0

    async def test_overdue_invoices_query(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "Show me overdue invoices"},
            headers=auth_headers,
        )
        body = resp.json()
        assert resp.status_code == 200
        assert len(body["answer"]) > 0

    async def test_confidence_in_range(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "How many products do we have?"},
            headers=auth_headers,
        )
        conf = resp.json()["confidence"]
        assert 0.0 <= conf <= 1.0

    async def test_results_is_list(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "Show me truckmount inventory"},
            headers=auth_headers,
        )
        assert isinstance(resp.json()["results"], list)

    async def test_empty_query_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={"query": "ab"},  # too short (min_length=3)
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_missing_query_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/ai/query",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422



@pytest.mark.asyncio
class TestQueryExamples:
    """Tests for GET /api/ai/query/examples."""

    async def test_examples_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/ai/query/examples", headers=auth_headers)
        assert resp.status_code == 200

    async def test_examples_response_shape(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/ai/query/examples", headers=auth_headers)
        body = resp.json()
        assert "examples" in body
        assert isinstance(body["examples"], list)
        assert len(body["examples"]) > 0

    async def test_examples_have_categories(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/ai/query/examples", headers=auth_headers)
        examples = resp.json()["examples"]
        for cat in examples:
            assert "category" in cat
            assert "queries" in cat
            assert len(cat["queries"]) > 0

    async def test_examples_include_inventory_category(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/ai/query/examples", headers=auth_headers)
        categories = [e["category"] for e in resp.json()["examples"]]
        assert "Inventory" in categories


@pytest.mark.asyncio
class TestQueryStream:
    """Tests for GET /api/ai/query/stream."""

    async def test_stream_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get(
            "/api/ai/query/stream?q=How+many+products+do+we+have",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_stream_content_type_sse(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get(
            "/api/ai/query/stream?q=How+many+products+do+we+have",
            headers=auth_headers,
        )
        assert "text/event-stream" in resp.headers.get("content-type", "")

    async def test_stream_body_contains_data(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get(
            "/api/ai/query/stream?q=Show+me+truckmount+inventory",
            headers=auth_headers,
        )
        assert b"data:" in resp.content

    async def test_stream_missing_q_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get(
            "/api/ai/query/stream",
            headers=auth_headers,
        )
        assert resp.status_code == 422

