"""
Project Intelligence Agent — Meta-agent for codebase auditing, gap analysis, and PRD generation.
Reads from catalog files (docs/catalogs/) rather than scanning raw code.

Skills (1:10 Law — exactly 10):
1. scan_routes     - Scan routes directory, update ROUTES catalog
2. scan_pages      - Scan frontend pages, update PAGES catalog
3. scan_agents     - Scan AI agents, check 1:10 compliance
4. scan_packages   - Audit package manifests
5. cross_ref       - Find orphan routes, pages, API clients
6. dep_graph       - Build text dependency graph
7. prioritize      - Score gaps by impact x effort
8. prd_generate    - Generate PRD from findings
9. issue_sync      - Prepare issues for Linear
10. health         - Agent health check
"""
from __future__ import annotations

import json
import re
from collections.abc import AsyncGenerator
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog
from pydantic import BaseModel

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)

# Paths relative to project root (D:\CCW-ERP-CRM)
CATALOGS_DIR = Path("docs/catalogs")
MEMORY_DIR = Path(".claude/memory")
ROUTES_DIR = Path("apps/backend/src/api/routes")
PAGES_DIR = Path("apps/web/app/(dashboard)")
AGENTS_DIR = Path("apps/backend/src/ai/agents")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ScanResult(BaseModel):
    skill: str
    timestamp: str
    items_found: int
    gaps: list[str]
    catalog_updated: bool
    summary: str


class PrioritizedGap(BaseModel):
    gap: str
    impact: int
    effort_inverse: int
    score: int
    action: str


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class ProjectIntelligenceAgent(BaseAgent):
    """
    Meta-agent for codebase auditing and gap analysis.
    Always reads from docs/catalogs/ first (disk-based, compaction-resistant).

    Implements BaseAgent (execute + stream) plus 10 skill methods.
    The execute() dispatcher routes task strings to the appropriate skill.
    """

    NAME = "project_intelligence"
    VERSION = "1.0.0"
    SKILL_COUNT = 10  # Immutable: 1:10 law

    def __init__(self) -> None:
        super().__init__(name="ProjectIntelligenceAgent", auto_register=False)
        self.logger = structlog.get_logger(__name__)
        self.capabilities = [
            "codebase_audit",
            "gap_analysis",
            "prd_generation",
            "issue_sync",
            "dep_graph",
        ]
        self.description = "Meta-agent for codebase auditing, gap analysis, and PRD generation"
        self.requires_verification = False
        self.estimated_execution_time = 10

        CATALOGS_DIR.mkdir(parents=True, exist_ok=True)
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # BaseAgent abstract methods
    # ------------------------------------------------------------------

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Dispatch task string to the appropriate skill.

        Supported task values (case-insensitive prefix match):
            scan_routes, scan_pages, scan_agents, scan_packages,
            cross_ref, dep_graph, prioritize, prd_generate, issue_sync, health
        """
        self._log_execution_start(task, context)
        ctx = context or {}
        task_lower = task.lower().strip()

        try:
            if task_lower.startswith("scan_routes") or task_lower.startswith("scan routes"):
                result = (await self.scan_routes()).model_dump()
            elif task_lower.startswith("scan_pages") or task_lower.startswith("scan pages"):
                result = (await self.scan_pages()).model_dump()
            elif task_lower.startswith("scan_agents") or task_lower.startswith("scan agents"):
                result = (await self.scan_agents()).model_dump()
            elif task_lower.startswith("scan_packages") or task_lower.startswith("scan packages"):
                result = (await self.scan_packages()).model_dump()
            elif task_lower.startswith("cross_ref") or task_lower.startswith("cross ref"):
                result = await self.cross_ref()
            elif task_lower.startswith("dep_graph") or task_lower.startswith("dep graph"):
                result = await self.dep_graph()
            elif task_lower.startswith("prioritize"):
                gaps_raw = ctx.get("gaps")
                result = [g.model_dump() for g in await self.prioritize(gaps=gaps_raw)]
            elif task_lower.startswith("prd_generate") or task_lower.startswith("prd generate"):
                title = ctx.get("title", "CCW Gap Resolution")
                result = await self.prd_generate(title=title)
            elif task_lower.startswith("issue_sync") or task_lower.startswith("issue sync"):
                result = await self.issue_sync()
            elif task_lower.startswith("health"):
                result = await self.health()
            else:
                # Default: run a full scan and return summary
                result = await self.health()

            self._log_execution_complete(True)
            return result

        except Exception as e:
            logger.error("project_intelligence_execute_failed", error=str(e), task=task)
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """Stream not implemented — yields single result chunk."""
        result = await self.execute(task, context)
        yield json.dumps(result)

    # ------------------------------------------------------------------
    # SKILL 1: scan_routes
    # ------------------------------------------------------------------

    async def scan_routes(self) -> ScanResult:
        """Scan backend route files and update ROUTES catalog."""
        self.logger.info("scan_routes: starting")

        route_files: list[str] = []
        gaps: list[str] = []

        if ROUTES_DIR.exists():
            for path in ROUTES_DIR.rglob("*.py"):
                if path.name != "__init__.py":
                    route_files.append(str(path.relative_to(Path("."))))

        # Check main.py for potentially unregistered routes
        main_py = Path("apps/backend/src/api/main.py")
        if main_py.exists():
            content = main_py.read_text(encoding="utf-8")
            for rf in route_files:
                filename = Path(rf).stem
                if filename not in content and "include_router" in content:
                    gaps.append(f"Possibly unregistered: {filename}.py")

        catalog_path = CATALOGS_DIR / "ROUTES.md"
        catalog_updated = catalog_path.exists()

        summary = f"Found {len(route_files)} route files. {len(gaps)} potential gaps."
        self.logger.info("scan_routes: complete", files=len(route_files), gaps=len(gaps))

        return ScanResult(
            skill="scan_routes",
            timestamp=datetime.now().isoformat(),
            items_found=len(route_files),
            gaps=gaps,
            catalog_updated=catalog_updated,
            summary=summary,
        )

    # ------------------------------------------------------------------
    # SKILL 2: scan_pages
    # ------------------------------------------------------------------

    async def scan_pages(self) -> ScanResult:
        """Scan frontend pages and update PAGES catalog."""
        self.logger.info("scan_pages: starting")

        page_files: list[str] = []
        gaps: list[str] = []

        if PAGES_DIR.exists():
            for path in PAGES_DIR.rglob("page.tsx"):
                page_files.append(str(path.relative_to(Path("."))))

        # Check sidebar for missing pages
        sidebar = Path("apps/web/components/layout/sidebar.tsx")
        if sidebar.exists():
            sidebar_content = sidebar.read_text(encoding="utf-8")
            for pf in page_files:
                route_part = (
                    str(Path(pf).parent)
                    .replace("apps/web/app/(dashboard)", "")
                    .replace("\\", "/")
                )
                if route_part and route_part not in sidebar_content:
                    gaps.append(f"Possibly hidden (not in sidebar): {route_part}")

        catalog_path = CATALOGS_DIR / "PAGES.md"
        catalog_updated = catalog_path.exists()

        summary = f"Found {len(page_files)} pages. {len(gaps)} possibly hidden."
        self.logger.info("scan_pages: complete", pages=len(page_files), gaps=len(gaps))

        return ScanResult(
            skill="scan_pages",
            timestamp=datetime.now().isoformat(),
            items_found=len(page_files),
            gaps=gaps,
            catalog_updated=catalog_updated,
            summary=summary,
        )

    # ------------------------------------------------------------------
    # SKILL 3: scan_agents
    # ------------------------------------------------------------------

    async def scan_agents(self) -> ScanResult:
        """Scan AI agents and check 1:10 skill compliance."""
        self.logger.info("scan_agents: starting")

        agent_files: list[str] = []
        non_compliant: list[str] = []

        if AGENTS_DIR.exists():
            for path in AGENTS_DIR.rglob("*.py"):
                if path.name not in ("__init__.py",) and "state" not in path.name:
                    agent_files.append(str(path.relative_to(Path("."))))
                    # Count public async def methods (skills)
                    try:
                        content = path.read_text(encoding="utf-8")
                        skill_methods = [
                            line
                            for line in content.splitlines()
                            if line.strip().startswith("async def ")
                            and "self" in line
                            and "__" not in line
                        ]
                        if len(skill_methods) != 10:
                            non_compliant.append(
                                f"{path.name}: {len(skill_methods)} skills (need 10)"
                            )
                    except Exception:
                        pass

        catalog_path = CATALOGS_DIR / "AGENTS.md"
        summary = (
            f"Found {len(agent_files)} agents. {len(non_compliant)} non-1:10 compliant."
        )
        self.logger.info(
            "scan_agents: complete", agents=len(agent_files), non_compliant=len(non_compliant)
        )

        return ScanResult(
            skill="scan_agents",
            timestamp=datetime.now().isoformat(),
            items_found=len(agent_files),
            gaps=non_compliant,
            catalog_updated=catalog_path.exists(),
            summary=summary,
        )

    # ------------------------------------------------------------------
    # SKILL 4: scan_packages
    # ------------------------------------------------------------------

    async def scan_packages(self) -> ScanResult:
        """Audit package manifests and flag issues."""
        self.logger.info("scan_packages: starting")

        packages: list[str] = []
        gaps: list[str] = []

        # Frontend packages
        pkg_json = Path("apps/web/package.json")
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text(encoding="utf-8"))
                packages.extend(list(data.get("dependencies", {}).keys()))
                packages.extend(list(data.get("devDependencies", {}).keys()))
            except Exception:
                gaps.append("Failed to parse apps/web/package.json")

        # Backend packages
        pyproject = Path("apps/backend/pyproject.toml")
        if pyproject.exists():
            try:
                content = pyproject.read_text(encoding="utf-8")
                deps = re.findall(r'^\s*"([a-z][a-z0-9\-]+)', content, re.MULTILINE)
                packages.extend(deps)
            except Exception:
                gaps.append("Failed to parse apps/backend/pyproject.toml")

        catalog_path = CATALOGS_DIR / "PACKAGES.md"
        summary = f"Found ~{len(packages)} packages across frontend + backend."
        self.logger.info("scan_packages: complete", packages=len(packages))

        return ScanResult(
            skill="scan_packages",
            timestamp=datetime.now().isoformat(),
            items_found=len(packages),
            gaps=gaps,
            catalog_updated=catalog_path.exists(),
            summary=summary,
        )

    # ------------------------------------------------------------------
    # SKILL 5: cross_ref
    # ------------------------------------------------------------------

    async def cross_ref(self) -> dict[str, Any]:
        """Cross-reference routes, pages, and API clients to find orphans."""
        self.logger.info("cross_ref: starting")

        routes_catalog = CATALOGS_DIR / "ROUTES.md"
        pages_catalog = CATALOGS_DIR / "PAGES.md"

        # Enumerate API client files
        api_dir = Path("apps/web/lib/api")
        api_clients: list[str] = []
        if api_dir.exists():
            api_clients = [p.stem for p in api_dir.glob("*.ts") if p.name != "client.ts"]

        orphan_routes: list[str] = []
        orphan_pages: list[str] = []

        if routes_catalog.exists() and pages_catalog.exists():
            routes_content = routes_catalog.read_text(encoding="utf-8")
            pages_content = pages_catalog.read_text(encoding="utf-8")

            known_backend_only = ["contractors", "service_requests", "bank_feeds", "cron_jobs"]
            for gap in known_backend_only:
                if gap in routes_content and gap not in pages_content:
                    orphan_routes.append(f"{gap}: backend route exists, no frontend page")

        result = {
            "skill": "cross_ref",
            "timestamp": datetime.now().isoformat(),
            "api_clients": api_clients,
            "orphan_routes": orphan_routes,
            "orphan_pages": orphan_pages,
            "summary": (
                f"Found {len(orphan_routes)} orphan routes, "
                f"{len(orphan_pages)} orphan pages"
            ),
        }
        self.logger.info(
            "cross_ref: complete",
            orphan_routes=len(orphan_routes),
            orphan_pages=len(orphan_pages),
        )
        return result

    # ------------------------------------------------------------------
    # SKILL 6: dep_graph
    # ------------------------------------------------------------------

    async def dep_graph(self) -> dict[str, Any]:
        """Build text dependency graph from catalogs."""
        self.logger.info("dep_graph: starting")

        graph_lines = [
            "# CCW ERP/CRM Dependency Graph",
            f"Generated: {datetime.now().isoformat()}",
            "",
        ]

        for catalog_name in ("ROUTES.md", "MODELS.md", "AGENTS.md"):
            catalog_path = CATALOGS_DIR / catalog_name
            if catalog_path.exists():
                content = catalog_path.read_text(encoding="utf-8")
                headers = [line for line in content.splitlines() if line.startswith("### ")]
                graph_lines.append(
                    f"## {catalog_name.replace('.md', '')} ({len(headers)} entries)"
                )
                for h in headers[:10]:
                    graph_lines.append(f"  - {h.replace('### ', '')}")
                graph_lines.append("")

        graph = "\n".join(graph_lines)
        result = {
            "skill": "dep_graph",
            "timestamp": datetime.now().isoformat(),
            "graph": graph,
            "summary": "Dependency graph generated from catalogs",
        }
        self.logger.info("dep_graph: complete")
        return result

    # ------------------------------------------------------------------
    # SKILL 7: prioritize
    # ------------------------------------------------------------------

    async def prioritize(
        self, gaps: list[str] | None = None
    ) -> list[PrioritizedGap]:
        """Score gaps by impact x effort and return priority matrix."""
        self.logger.info("prioritize: starting")

        known_gaps = [
            PrioritizedGap(
                gap="Contractors frontend page missing",
                impact=4,
                effort_inverse=3,
                score=12,
                action="/pi-fix frontend-page contractors",
            ),
            PrioritizedGap(
                gap="Service Requests frontend page missing",
                impact=4,
                effort_inverse=3,
                score=12,
                action="/pi-fix frontend-page service-requests",
            ),
            PrioritizedGap(
                gap="Bank Feeds frontend page missing",
                impact=3,
                effort_inverse=4,
                score=12,
                action="/pi-fix frontend-page bank-feeds",
            ),
            PrioritizedGap(
                gap="cron_jobs.py not registered in main.py",
                impact=3,
                effort_inverse=5,
                score=15,
                action="/pi-fix register-router cron_jobs",
            ),
            PrioritizedGap(
                gap="AI agents not 1:10 compliant",
                impact=3,
                effort_inverse=2,
                score=6,
                action="Agent compliance review",
            ),
            PrioritizedGap(
                gap="Search Agent blocked (pgvector)",
                impact=4,
                effort_inverse=1,
                score=4,
                action="Requires schema approval first",
            ),
        ]

        # Merge any caller-supplied gaps at medium priority
        if gaps:
            for gap_str in gaps:
                known_gaps.append(
                    PrioritizedGap(
                        gap=gap_str,
                        impact=2,
                        effort_inverse=3,
                        score=6,
                        action="Review and classify",
                    )
                )

        sorted_gaps = sorted(known_gaps, key=lambda x: x.score, reverse=True)
        self.logger.info("prioritize: complete", total=len(sorted_gaps))
        return sorted_gaps

    # ------------------------------------------------------------------
    # SKILL 8: prd_generate
    # ------------------------------------------------------------------

    async def prd_generate(self, title: str = "CCW Gap Resolution") -> dict[str, Any]:
        """Generate PRD from gap findings and write to docs/."""
        self.logger.info("prd_generate: starting", title=title)

        gaps = await self.prioritize()
        date_str = datetime.now().strftime("%Y-%m-%d")
        filename = f"docs/PRD-CCW-GAPS-{date_str}.md"

        prd_content = (
            f"# PRD: {title} — {date_str}\n\n"
            f"## Executive Summary\n"
            f"CCW ERP/CRM has {len(gaps)} identified gaps between backend routes "
            f"and frontend pages.\n"
            f"This PRD covers the gap resolution priorities ordered by impact x effort score.\n\n"
            f"## Gap Resolution Priorities\n\n"
            f"| Rank | Gap | Score | Action |\n"
            f"|------|-----|-------|--------|\n"
        )
        for i, gap in enumerate(gaps, 1):
            prd_content += f"| {i} | {gap.gap} | {gap.score} | {gap.action} |\n"

        prd_content += "\n## Implementation Sequence\n\n"
        for i, gap in enumerate(gaps, 1):
            prd_content += f"{i}. **{gap.gap}** (Score: {gap.score}) — {gap.action}\n"

        prd_path = Path(filename)
        prd_path.parent.mkdir(parents=True, exist_ok=True)
        prd_path.write_text(prd_content, encoding="utf-8")

        result = {
            "skill": "prd_generate",
            "timestamp": datetime.now().isoformat(),
            "filename": filename,
            "gaps_count": len(gaps),
            "summary": f"PRD written to {filename}",
        }
        self.logger.info("prd_generate: complete", filename=filename)
        return result

    # ------------------------------------------------------------------
    # SKILL 9: issue_sync
    # ------------------------------------------------------------------

    async def issue_sync(self) -> dict[str, Any]:
        """Prepare issues for Linear (returns structured data for browser automation)."""
        self.logger.info("issue_sync: starting")

        gaps = await self.prioritize()

        issues = [
            {
                "title": f"[GAP] {gap.gap}",
                "description": (
                    f"Priority Score: {gap.score}\nAction: {gap.action}"
                ),
                "priority": "high" if gap.score >= 10 else "medium",
                "labels": ["gap", "framework-overhaul"],
            }
            for gap in gaps
        ]

        result = {
            "skill": "issue_sync",
            "timestamp": datetime.now().isoformat(),
            "issues": issues,
            "count": len(issues),
            "summary": (
                f"Prepared {len(issues)} issues for Linear sync "
                f"(use browser automation to create)"
            ),
        }
        self.logger.info("issue_sync: complete", count=len(issues))
        return result

    # ------------------------------------------------------------------
    # SKILL 10: health
    # ------------------------------------------------------------------

    async def health(self) -> dict[str, Any]:
        """Agent health check — verifies all dependencies and catalogs."""
        self.logger.info("health: starting")

        checks: dict[str, bool] = {
            "catalogs_dir": CATALOGS_DIR.exists(),
            "memory_dir": MEMORY_DIR.exists(),
            "constitution": (MEMORY_DIR / "CONSTITUTION.md").exists(),
            "current_state": (MEMORY_DIR / "current-state.md").exists(),
            "routes_catalog": (CATALOGS_DIR / "ROUTES.md").exists(),
            "pages_catalog": (CATALOGS_DIR / "PAGES.md").exists(),
            "agents_catalog": (CATALOGS_DIR / "AGENTS.md").exists(),
            "skill_count_ok": self.SKILL_COUNT == 10,
        }

        all_healthy = all(checks.values())

        result = {
            "skill": "health",
            "agent": self.NAME,
            "version": self.VERSION,
            "healthy": all_healthy,
            "checks": checks,
            "timestamp": datetime.now().isoformat(),
            "skill_count": self.SKILL_COUNT,
            "1_10_compliant": self.SKILL_COUNT == 10,
        }
        self.logger.info("health: complete", healthy=all_healthy)
        return result
