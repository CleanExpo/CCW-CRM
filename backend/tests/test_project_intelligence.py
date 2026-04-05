"""Tests for the Project Intelligence Agent — all 10 skills + 10 HTTP endpoints.

Run from apps/backend/:
    uv run pytest tests/test_project_intelligence.py -v
"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.ai.agents.specialized.project_intelligence_agent import (
    PrioritizedGap,
    ProjectIntelligenceAgent,
    ScanResult,
)
from src.api.main import app

# Repo root: test file is at apps/backend/tests/test_project_intelligence.py
# parents[0] = tests/   parents[1] = backend/   parents[2] = apps/   parents[3] = repo root
REPO_ROOT = Path(__file__).parents[3]

http_client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def use_repo_root(monkeypatch: pytest.MonkeyPatch) -> None:
    """Change CWD to repo root so relative paths in PI agent resolve correctly.

    The PI agent uses Path("docs/catalogs") which is relative to CWD.
    Tests run from apps/backend/ so we monkeypatch to the repo root.
    """
    monkeypatch.chdir(REPO_ROOT)


# ---------------------------------------------------------------------------
# UNIT TESTS: ProjectIntelligenceAgent (10 skills + init + execute dispatcher)
# ---------------------------------------------------------------------------


class TestProjectIntelligenceAgent:
    """Unit tests for all 10 skills of the ProjectIntelligenceAgent."""

    def test_agent_init(self) -> None:
        """Agent initializes with correct metadata and 1:10 law compliance."""
        agent = ProjectIntelligenceAgent()
        assert agent.NAME == "project_intelligence"
        assert agent.VERSION == "1.0.0"
        assert agent.SKILL_COUNT == 10
        assert agent.description != ""
        assert "codebase_audit" in agent.capabilities

    @pytest.mark.asyncio
    async def test_skill_1_scan_routes(self, use_repo_root: None) -> None:
        """Skill 1: scan_routes discovers route files from repo root."""
        agent = ProjectIntelligenceAgent()
        result = await agent.scan_routes()

        assert isinstance(result, ScanResult)
        assert result.skill == "scan_routes"
        assert isinstance(result.timestamp, str)
        assert result.items_found > 0  # routes dir exists with multiple .py files
        assert isinstance(result.gaps, list)
        assert "route file" in result.summary.lower() or "found" in result.summary.lower()

    @pytest.mark.asyncio
    async def test_skill_2_scan_pages(self, use_repo_root: None) -> None:
        """Skill 2: scan_pages discovers page.tsx files from repo root."""
        agent = ProjectIntelligenceAgent()
        result = await agent.scan_pages()

        assert isinstance(result, ScanResult)
        assert result.skill == "scan_pages"
        assert result.items_found > 0  # multiple page.tsx files exist
        assert isinstance(result.gaps, list)

    @pytest.mark.asyncio
    async def test_skill_3_scan_agents(self, use_repo_root: None) -> None:
        """Skill 3: scan_agents finds at least the PI agent itself."""
        agent = ProjectIntelligenceAgent()
        result = await agent.scan_agents()

        assert isinstance(result, ScanResult)
        assert result.skill == "scan_agents"
        assert result.items_found >= 1  # at minimum: project_intelligence_agent.py
        assert isinstance(result.gaps, list)

    @pytest.mark.asyncio
    async def test_skill_4_scan_packages(self, use_repo_root: None) -> None:
        """Skill 4: scan_packages reads package.json + pyproject.toml."""
        agent = ProjectIntelligenceAgent()
        result = await agent.scan_packages()

        assert isinstance(result, ScanResult)
        assert result.skill == "scan_packages"
        assert result.items_found > 0  # package.json + pyproject.toml both exist
        assert result.gaps == []  # no parse errors on valid manifest files

    @pytest.mark.asyncio
    async def test_skill_5_cross_ref(self, use_repo_root: None) -> None:
        """Skill 5: cross_ref returns dict with expected schema."""
        agent = ProjectIntelligenceAgent()
        result = await agent.cross_ref()

        assert isinstance(result, dict)
        assert result["skill"] == "cross_ref"
        assert "api_clients" in result
        assert "orphan_routes" in result
        assert "orphan_pages" in result
        assert "summary" in result
        assert "timestamp" in result
        assert isinstance(result["api_clients"], list)
        assert len(result["api_clients"]) > 0  # lib/api/ has multiple clients

    @pytest.mark.asyncio
    async def test_skill_6_dep_graph(self, use_repo_root: None) -> None:
        """Skill 6: dep_graph generates a text dependency graph from catalogs."""
        agent = ProjectIntelligenceAgent()
        result = await agent.dep_graph()

        assert isinstance(result, dict)
        assert result["skill"] == "dep_graph"
        assert "graph" in result
        assert "CCW ERP/CRM Dependency Graph" in result["graph"]
        assert "summary" in result
        assert "timestamp" in result

    @pytest.mark.asyncio
    async def test_skill_7_prioritize_default(self) -> None:
        """Skill 7: prioritize returns list sorted by score descending."""
        agent = ProjectIntelligenceAgent()
        gaps = await agent.prioritize()

        assert isinstance(gaps, list)
        assert len(gaps) >= 1
        for gap in gaps:
            assert isinstance(gap, PrioritizedGap)
            assert gap.score == gap.impact * gap.effort_inverse
            assert isinstance(gap.action, str)
            assert gap.impact >= 1
            assert gap.effort_inverse >= 1
        # Must be sorted descending
        scores = [g.score for g in gaps]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.asyncio
    async def test_skill_7_prioritize_with_custom_gaps(self) -> None:
        """Skill 7: custom gaps are merged into the priority matrix."""
        agent = ProjectIntelligenceAgent()
        custom_gaps = ["Missing authentication tests", "No rate limiting on search"]
        gaps = await agent.prioritize(gaps=custom_gaps)

        gap_texts = [g.gap for g in gaps]
        assert "Missing authentication tests" in gap_texts
        assert "No rate limiting on search" in gap_texts

    @pytest.mark.asyncio
    async def test_skill_8_prd_generate(self, use_repo_root: None) -> None:
        """Skill 8: prd_generate writes a PRD file and returns metadata."""
        agent = ProjectIntelligenceAgent()
        result = await agent.prd_generate(title="Sprint 1 Test PRD")

        assert isinstance(result, dict)
        assert result["skill"] == "prd_generate"
        assert "filename" in result
        assert "gaps_count" in result
        assert "timestamp" in result
        assert result["gaps_count"] >= 1

        # File must exist on disk and contain the title
        prd_path = Path(result["filename"])
        assert prd_path.exists(), f"PRD file not created at {prd_path}"
        content = prd_path.read_text(encoding="utf-8")
        assert "Sprint 1 Test PRD" in content
        assert "Gap Resolution Priorities" in content

    @pytest.mark.asyncio
    async def test_skill_9_issue_sync(self) -> None:
        """Skill 9: issue_sync returns Linear-ready issues with required fields."""
        agent = ProjectIntelligenceAgent()
        result = await agent.issue_sync()

        assert isinstance(result, dict)
        assert result["skill"] == "issue_sync"
        assert "issues" in result
        assert "count" in result
        assert "summary" in result
        assert result["count"] == len(result["issues"])
        assert result["count"] >= 1
        for issue in result["issues"]:
            assert "title" in issue
            assert "description" in issue
            assert "priority" in issue
            assert "labels" in issue
            assert issue["priority"] in ("high", "medium")
            assert "[GAP]" in issue["title"]

    @pytest.mark.asyncio
    async def test_skill_10_health(self, use_repo_root: None) -> None:
        """Skill 10: health verifies 1:10 compliance and all catalog files exist."""
        agent = ProjectIntelligenceAgent()
        result = await agent.health()

        assert isinstance(result, dict)
        assert result["skill"] == "health"
        assert result["agent"] == "project_intelligence"
        assert "healthy" in result
        assert "checks" in result
        assert result["1_10_compliant"] is True
        assert result["skill_count"] == 10
        # All infrastructure checks pass from repo root
        checks = result["checks"]
        assert checks["catalogs_dir"] is True
        assert checks["memory_dir"] is True
        assert checks["constitution"] is True
        assert checks["routes_catalog"] is True
        assert checks["pages_catalog"] is True
        assert checks["agents_catalog"] is True
        assert result["healthy"] is True

    @pytest.mark.asyncio
    async def test_execute_dispatcher_health(self) -> None:
        """execute() routes 'health' task to skill 10."""
        agent = ProjectIntelligenceAgent()
        result = await agent.execute("health")

        assert "skill" in result
        assert result["skill"] == "health"
        assert result["agent"] == "project_intelligence"

    @pytest.mark.asyncio
    async def test_execute_dispatcher_scan_routes(self, use_repo_root: None) -> None:
        """execute() routes 'scan_routes' task to skill 1."""
        agent = ProjectIntelligenceAgent()
        result = await agent.execute("scan_routes")

        assert result["skill"] == "scan_routes"
        assert "items_found" in result

    @pytest.mark.asyncio
    async def test_execute_dispatcher_unknown_falls_back_to_health(self) -> None:
        """execute() falls back to health check for unrecognised task strings."""
        agent = ProjectIntelligenceAgent()
        result = await agent.execute("completely_unknown_task_xyz")

        # Health is the fallback — verify it returns valid data
        assert isinstance(result, dict)
        assert "skill" in result or "agent" in result

    @pytest.mark.asyncio
    async def test_execute_dispatcher_prioritize_with_context(self) -> None:
        """execute() routes 'prioritize' with context.gaps forwarded to skill 7."""
        agent = ProjectIntelligenceAgent()
        result = await agent.execute("prioritize", context={"gaps": ["custom gap A"]})

        assert isinstance(result, list)
        gap_texts = [g["gap"] for g in result]
        assert "custom gap A" in gap_texts

    @pytest.mark.asyncio
    async def test_stream_yields_json(self) -> None:
        """stream() yields a single JSON chunk (no streaming implemented)."""
        import json

        agent = ProjectIntelligenceAgent()
        chunks = [chunk async for chunk in agent.stream("health")]

        assert len(chunks) == 1
        parsed = json.loads(chunks[0])
        assert isinstance(parsed, dict)


# ---------------------------------------------------------------------------
# HTTP TESTS: /api/ai/project-intelligence/* (10 endpoints)
# ---------------------------------------------------------------------------


class TestPIRoutes:
    """HTTP integration tests for all 10 /api/ai/project-intelligence/* endpoints."""

    def test_pi_health_endpoint(self) -> None:
        """GET /health → 200 with agent health dict."""
        response = http_client.get("/api/ai/project-intelligence/health")
        assert response.status_code == 200
        data = response.json()
        assert "healthy" in data
        assert "checks" in data
        assert "skill" in data
        assert data["skill"] == "health"
        assert data["1_10_compliant"] is True
        assert data["skill_count"] == 10

    def test_pi_scan_routes_endpoint(self) -> None:
        """POST /scan-routes → 200 with ScanResult schema."""
        response = http_client.post("/api/ai/project-intelligence/scan-routes")
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "scan_routes"
        assert "items_found" in data
        assert "gaps" in data
        assert "catalog_updated" in data
        assert "timestamp" in data
        assert "summary" in data
        assert isinstance(data["items_found"], int)

    def test_pi_scan_pages_endpoint(self) -> None:
        """POST /scan-pages → 200 with ScanResult schema."""
        response = http_client.post("/api/ai/project-intelligence/scan-pages")
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "scan_pages"
        assert "items_found" in data
        assert isinstance(data["gaps"], list)

    def test_pi_scan_agents_endpoint(self) -> None:
        """POST /scan-agents → 200 with ScanResult schema."""
        response = http_client.post("/api/ai/project-intelligence/scan-agents")
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "scan_agents"
        assert "items_found" in data
        assert "catalog_updated" in data

    def test_pi_scan_packages_endpoint(self) -> None:
        """POST /scan-packages → 200 with ScanResult schema."""
        response = http_client.post("/api/ai/project-intelligence/scan-packages")
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "scan_packages"
        assert "items_found" in data

    def test_pi_cross_ref_endpoint(self) -> None:
        """POST /cross-ref → 200 with orphan analysis."""
        response = http_client.post("/api/ai/project-intelligence/cross-ref")
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "cross_ref"
        assert "api_clients" in data
        assert "orphan_routes" in data
        assert "orphan_pages" in data
        assert "summary" in data

    def test_pi_dep_graph_endpoint(self) -> None:
        """POST /dep-graph → 200 with text dependency graph."""
        response = http_client.post("/api/ai/project-intelligence/dep-graph")
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "dep_graph"
        assert "graph" in data
        assert isinstance(data["graph"], str)
        assert len(data["graph"]) > 0

    def test_pi_prioritize_endpoint(self) -> None:
        """POST /prioritize → 200 with priority matrix list."""
        response = http_client.post("/api/ai/project-intelligence/prioritize")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        first = data[0]
        assert "gap" in first
        assert "score" in first
        assert "action" in first
        assert "impact" in first
        assert "effort_inverse" in first

    def test_pi_prd_generate_endpoint(self) -> None:
        """POST /prd-generate → 200 with PRD metadata."""
        response = http_client.post(
            "/api/ai/project-intelligence/prd-generate",
            json={"title": "HTTP Test PRD"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "prd_generate"
        assert "filename" in data
        assert "gaps_count" in data
        assert "summary" in data
        assert data["gaps_count"] >= 1

    def test_pi_issue_sync_endpoint(self) -> None:
        """POST /issue-sync → 200 with Linear-ready issues list."""
        response = http_client.post("/api/ai/project-intelligence/issue-sync")
        assert response.status_code == 200
        data = response.json()
        assert data["skill"] == "issue_sync"
        assert "issues" in data
        assert "count" in data
        assert isinstance(data["issues"], list)
        assert data["count"] >= 1
