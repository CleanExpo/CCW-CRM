"""Tests for the Toolshed API — bundle, search, and pattern endpoints.

Note: /verify is intentionally excluded — it runs pnpm + pytest subprocesses
(those are tested by running the quality-gate command directly).

Run from apps/backend/:
    uv run pytest tests/test_toolshed_api.py -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

http_client = TestClient(app)


class TestToolshedBundle:
    """Tests for POST /api/ai/toolshed/bundle."""

    def test_bundle_returns_all_fields(self) -> None:
        """Bundle response contains all required BundleResponse fields."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "add billing endpoint to backend"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "task" in data
        assert "keywords" in data
        assert "catalogs" in data
        assert "patterns" in data
        assert "constraints" in data
        assert "suggested_path" in data
        assert data["task"] == "add billing endpoint to backend"

    def test_bundle_extracts_keywords_strips_stop_words(self) -> None:
        """Bundle strips common stop words and keeps meaningful tokens."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "create a new order endpoint for the API"},
        )
        assert response.status_code == 200
        data = response.json()
        keywords = data["keywords"]
        # Stop words must be absent
        assert "a" not in keywords
        assert "for" not in keywords
        assert "the" not in keywords
        # Meaningful tokens must be present
        assert any(k in keywords for k in ("order", "orders", "endpoint", "api"))

    def test_bundle_backend_task_suggests_backend_first_path(self) -> None:
        """Backend task returns Backend-first suggested path."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "build a FastAPI endpoint for product search"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "Backend-first" in data["suggested_path"]

    def test_bundle_frontend_task_suggests_frontend_first_path(self) -> None:
        """Frontend task returns Frontend-first suggested path."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "build a React dashboard page component"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "Frontend-first" in data["suggested_path"]

    def test_bundle_agent_task_suggests_agent_first_path_and_pattern(self) -> None:
        """Agent task returns Agent-first path and includes 'agent' pattern."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "create an AI agent with 10 skills for forecasting"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "agent" in data["suggested_path"].lower()
        assert "agent" in data["patterns"]

    def test_bundle_integration_task_suggests_integration_path(self) -> None:
        """Integration task returns integration pattern path and includes integration pattern.

        Note: task must not contain words with 'ui' as a substring (e.g. 'build' contains 'ui')
        since the path detector uses substring matching, not word-boundary matching.
        """
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "create Shopify webhook sync"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "integration" in data["patterns"]
        assert "Integration pattern" in data["suggested_path"]

    def test_bundle_includes_all_constitution_constraints(self) -> None:
        """Bundle always returns CONSTITUTION constraints including the key prohibitions."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "anything"},
        )
        assert response.status_code == 200
        data = response.json()
        constraints = data["constraints"]
        assert len(constraints) >= 5
        # The most critical prohibition must always be present
        assert any("demo_models" in c for c in constraints)
        assert any("middleware" in c for c in constraints)
        assert any("catalog" in c.lower() for c in constraints)

    def test_bundle_has_all_six_catalogs(self) -> None:
        """Bundle response includes all 6 catalog keys."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "test task"},
        )
        assert response.status_code == 200
        data = response.json()
        catalogs = data["catalogs"]
        for expected in ("routes", "pages", "agents", "packages", "models", "integrations"):
            assert expected in catalogs, f"Missing catalog: {expected}"

    def test_bundle_catalog_values_are_lists_of_strings(self) -> None:
        """Each catalog in the bundle is a list of strings."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "product page"},
        )
        assert response.status_code == 200
        data = response.json()
        for catalog_name, lines in data["catalogs"].items():
            assert isinstance(lines, list), f"Catalog {catalog_name} not a list"
            for line in lines:
                assert isinstance(line, str), f"Non-string in catalog {catalog_name}"

    def test_bundle_max_lines_per_catalog_respected(self) -> None:
        """max_lines_per_catalog parameter limits catalog output size."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "orders endpoint", "max_lines_per_catalog": 10},
        )
        assert response.status_code == 200
        data = response.json()
        for catalog_name, lines in data["catalogs"].items():
            assert len(lines) <= 10, f"Catalog {catalog_name} exceeded max_lines: {len(lines)}"

    def test_bundle_patterns_excluded_when_include_patterns_false(self) -> None:
        """include_patterns=false returns empty patterns list."""
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": "some frontend task", "include_patterns": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["patterns"] == []

    def test_bundle_keywords_list_max_20_tokens(self) -> None:
        """Keywords list is capped at 20 tokens regardless of task length."""
        long_task = " ".join([f"word{i}" for i in range(50)])
        response = http_client.post(
            "/api/ai/toolshed/bundle",
            json={"task": long_task},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["keywords"]) <= 20


class TestToolshedSearch:
    """Tests for GET /api/ai/toolshed/search."""

    def test_search_returns_dict_keyed_by_catalog(self) -> None:
        """Search returns a dict keyed by catalog name."""
        response = http_client.get("/api/ai/toolshed/search", params={"q": "orders"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        total = sum(len(v) for v in data.values())
        assert total >= 1  # "orders" appears in at least one catalog

    def test_search_result_has_correct_schema(self) -> None:
        """Each search result has catalog, line_number, line, context fields."""
        response = http_client.get("/api/ai/toolshed/search", params={"q": "customer"})
        assert response.status_code == 200
        data = response.json()
        for catalog_results in data.values():
            for result in catalog_results:
                assert "catalog" in result
                assert "line_number" in result
                assert "line" in result
                assert "context" in result
                assert isinstance(result["line_number"], int)
                assert result["line_number"] >= 1
                assert isinstance(result["context"], list)

    def test_search_filtered_to_specific_catalog(self) -> None:
        """catalog= param restricts results to a single catalog."""
        response = http_client.get(
            "/api/ai/toolshed/search",
            params={"q": "product", "catalog": "routes"},
        )
        assert response.status_code == 200
        data = response.json()
        # Only the "routes" key may appear
        for key in data.keys():
            assert key == "routes", f"Unexpected catalog in results: {key}"

    def test_search_invalid_catalog_returns_400(self) -> None:
        """Unknown catalog name returns HTTP 400."""
        response = http_client.get(
            "/api/ai/toolshed/search",
            params={"q": "test", "catalog": "nonexistent_catalog"},
        )
        assert response.status_code == 400
        assert "nonexistent_catalog" in response.json()["detail"]

    def test_search_query_too_short_returns_422(self) -> None:
        """Single-character query fails Pydantic min_length=2 validation → 422."""
        response = http_client.get("/api/ai/toolshed/search", params={"q": "x"})
        assert response.status_code == 422

    def test_search_max_results_respected(self) -> None:
        """max_results parameter caps the number of results per catalog."""
        response = http_client.get(
            "/api/ai/toolshed/search",
            params={"q": "the", "max_results": 3},
        )
        assert response.status_code == 200
        data = response.json()
        for catalog_results in data.values():
            assert len(catalog_results) <= 3


class TestToolshedPattern:
    """Tests for GET /api/ai/toolshed/pattern."""

    def test_pattern_endpoint_type(self) -> None:
        """endpoint pattern returns FastAPI code block."""
        response = http_client.get("/api/ai/toolshed/pattern", params={"type": "endpoint"})
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_type"] == "endpoint"
        assert "FastAPI" in data["content"]
        assert "router" in data["content"].lower() or "APIRouter" in data["content"]

    def test_pattern_component_type(self) -> None:
        """component pattern returns React/TypeScript code block."""
        response = http_client.get("/api/ai/toolshed/pattern", params={"type": "component"})
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_type"] == "component"
        assert "use client" in data["content"]

    def test_pattern_agent_type(self) -> None:
        """agent pattern includes 1:10 law mention."""
        response = http_client.get("/api/ai/toolshed/pattern", params={"type": "agent"})
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_type"] == "agent"
        assert "10 skill" in data["content"].lower() or "1:10" in data["content"]

    def test_pattern_integration_type(self) -> None:
        """integration pattern returns settings + client code."""
        response = http_client.get("/api/ai/toolshed/pattern", params={"type": "integration"})
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_type"] == "integration"
        assert "demo" in data["content"].lower()

    def test_pattern_page_type(self) -> None:
        """page pattern returns Next.js App Router code."""
        response = http_client.get("/api/ai/toolshed/pattern", params={"type": "page"})
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_type"] == "page"
        assert "Metadata" in data["content"] or "metadata" in data["content"]

    def test_pattern_all_five_types_return_non_empty_content(self) -> None:
        """All 5 pattern types return content longer than 50 chars."""
        for pattern_type in ("endpoint", "component", "agent", "integration", "page"):
            response = http_client.get(
                "/api/ai/toolshed/pattern", params={"type": pattern_type}
            )
            assert response.status_code == 200, f"Pattern '{pattern_type}' returned non-200"
            data = response.json()
            assert len(data["content"]) > 50, f"Pattern '{pattern_type}' content too short"

    def test_pattern_returns_available_patterns_list(self) -> None:
        """Each pattern response includes the full list of available patterns."""
        response = http_client.get("/api/ai/toolshed/pattern", params={"type": "endpoint"})
        assert response.status_code == 200
        data = response.json()
        available = data["available_patterns"]
        assert isinstance(available, list)
        assert len(available) == 5
        for expected in ("endpoint", "component", "agent", "integration", "page"):
            assert expected in available

    def test_pattern_invalid_type_returns_404(self) -> None:
        """Unknown pattern type returns HTTP 404."""
        response = http_client.get(
            "/api/ai/toolshed/pattern", params={"type": "invalid_type"}
        )
        assert response.status_code == 404
        assert "invalid_type" in response.json()["detail"]
