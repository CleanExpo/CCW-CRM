"""
Toolshed API — Context bundle assembly and code pattern retrieval.

Inspired by Stripe's Minions framework: assembles task-specific context bundles
from the 6 catalog files before any agent runs, enabling one-shot execution.

Endpoints:
  POST /api/ai/toolshed/bundle        — Assemble context bundle for a task
  GET  /api/ai/toolshed/search        — Full-text search across all catalogs
  GET  /api/ai/toolshed/pattern       — Return canonical code pattern by type
  POST /api/ai/toolshed/verify        — Run type-check + lint + pytest quality gate
  POST /api/ai/toolshed/vault/sync    — Sync Obsidian vault with codebase
  GET  /api/ai/toolshed/vault/drift   — Detect documentation drift
  GET  /api/ai/toolshed/vault/query   — Query vault frontmatter metadata
"""
from __future__ import annotations

import asyncio
import re
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/ai/toolshed",
    tags=["Toolshed"],
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# toolshed.py lives at: apps/backend/src/api/routes/ai/toolshed.py
# parents[0] = ai/
# parents[1] = routes/
# parents[2] = api/
# parents[3] = src/
# parents[4] = backend/
# parents[5] = apps/
# parents[6] = D:\CCW-ERP-CRM (monorepo root)
_REPO_ROOT = Path(__file__).parents[6]
_CATALOGS_DIR = _REPO_ROOT / "docs" / "catalogs"

_CATALOG_FILES: dict[str, Path] = {
    "routes": _CATALOGS_DIR / "ROUTES.md",
    "pages": _CATALOGS_DIR / "PAGES.md",
    "agents": _CATALOGS_DIR / "AGENTS.md",
    "packages": _CATALOGS_DIR / "PACKAGES.md",
    "models": _CATALOGS_DIR / "MODELS.md",
    "integrations": _CATALOGS_DIR / "INTEGRATIONS.md",
}

# ---------------------------------------------------------------------------
# Code patterns — canonical implementations keyed by type
# ---------------------------------------------------------------------------

_PATTERNS: dict[str, str] = {
    "endpoint": """\
# Pattern: FastAPI Endpoint

```python
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db

router = APIRouter(prefix="/api", tags=["Module"])

@router.get("/items")
async def list_items(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
) -> dict:
    # async/await, Pydantic models, proper error handling
    ...
```

Rules:
- Always async
- Use Annotated for Depends
- Type hints required
- Pydantic models for request/response
- SQLAlchemy 2.0 async patterns
""",
    "component": """\
# Pattern: React Component (Next.js 15)

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({ field: z.string().min(1, "Required") });

export function MyComponent({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: { field: "" } });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await apiClient.post("/api/endpoint", values);
      toast({ title: "Success" });
      onSuccess?.();
      router.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="field"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Submit"}
        </Button>
      </form>
    </Form>
  );
}
```
""",
    "agent": """\
# Pattern: AI Agent (BaseAgent)

```python
from src.ai.base_agent import BaseAgent, TaskOutput

class MyAgent(BaseAgent):
    \"\"\"Domain-specific agent with exactly 10 skills.\"\"\"

    def __init__(self):
        super().__init__(
            name="my_agent",
            capabilities=["task_type_1", "task_type_2"],
        )

    async def execute(self, task: str, context: dict) -> TaskOutput:
        \"\"\"Execute task — one-shot, not iterative.\"\"\"
        try:
            result = await self._do_work(task, context)
            return TaskOutput(
                task_id=self.agent_id,
                agent_id=self.agent_id,
                status="completed",
                outputs=[{"result": result}],
                requires_verification=True,
            )
        except Exception as e:
            return TaskOutput(
                task_id=self.agent_id,
                agent_id=self.agent_id,
                status="failed",
                outputs=[{"error": str(e)}],
            )

    async def health(self) -> dict:
        return {"status": "healthy", "agent": self.name}
```

Rules:
- Exactly 10 skills — no more, no less (1:10 Agent:Skill Law)
- All methods async
- Returns TaskOutput pydantic model
- One-shot execution, not iterative loops
""",
    "integration": """\
# Pattern: Integration Client

```python
# config/[name]_settings.py
from pydantic_settings import BaseSettings, ConfigDict

class MyIntegrationSettings(BaseSettings):
    mode: str = "demo"  # demo | live
    api_key: str = ""
    model_config = ConfigDict(env_prefix="MYINT_")

# integrations/[name]/client.py
import httpx
import structlog

logger = structlog.get_logger(__name__)

class MyIntegrationClient:
    def __init__(self, settings: MyIntegrationSettings):
        self.settings = settings

    async def get_data(self) -> list[dict]:
        if self.settings.mode == "demo":
            return self._demo_data()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.example.com/data",
                headers={"Authorization": f"Bearer {self.settings.api_key}"},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    def _demo_data(self) -> list[dict]:
        return [{"id": "demo-1", "name": "Demo Item"}]
```

Pattern: config/settings.py -> integrations/[name]/client.py -> api/routes/integrations/[name].py
""",
    "page": """\
# Pattern: Next.js Page (App Router)

```typescript
// app/(dashboard)/my-page/page.tsx
import { Metadata } from "next";
import { apiClient } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "My Page | CCW ERP",
  description: "Page description",
};

export default async function MyPage() {
  // Server-side data fetch (preferred for SEO + performance)
  let data = [];
  try {
    data = await apiClient.get("/api/items");
  } catch (error) {
    // Handle gracefully — show empty state
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Page</h1>
      {/* Page content */}
    </div>
  );
}
```

Rules:
- Server components by default (no "use client" unless needed)
- Use apiClient for data fetching
- Handle errors gracefully
- Tailwind v4 utilities + design tokens (bg-primary, text-primary, etc.)
""",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read_catalog(name: str) -> str:
    """Read a catalog file, returning empty string if not found."""
    path = _CATALOG_FILES.get(name)
    if path is None or not path.exists():
        logger.warning("Catalog file not found", catalog=name, path=str(path) if path else "none")
        return ""
    return path.read_text(encoding="utf-8")


def _all_catalogs() -> dict[str, str]:
    """Read all 6 catalog files."""
    return {name: _read_catalog(name) for name in _CATALOG_FILES}


def _filter_relevant_sections(content: str, keywords: list[str], max_lines: int = 100) -> list[str]:
    """Extract lines/sections containing any keyword, with surrounding context."""
    if not keywords:
        return content.splitlines()[:50]

    lines = content.splitlines()
    relevant_indices: set[int] = set()

    for i, line in enumerate(lines):
        if any(kw.lower() in line.lower() for kw in keywords):
            # Include 3 lines before and 5 lines after each match
            for j in range(max(0, i - 3), min(len(lines), i + 6)):
                relevant_indices.add(j)

    if not relevant_indices:
        # No matches — return the catalog header (first 20 lines) so agent knows it exists
        return lines[:20]

    result: list[str] = []
    prev_idx = -2
    for idx in sorted(relevant_indices):
        if idx > prev_idx + 1:
            result.append("")  # blank separator between non-contiguous blocks
        result.append(lines[idx])
        prev_idx = idx

    return result[:max_lines]


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class BundleRequest(BaseModel):
    task: str = Field(description="Task description to assemble context for")
    include_patterns: bool = Field(default=True, description="Include relevant code patterns")
    max_lines_per_catalog: int = Field(default=100, ge=10, le=500, description="Max lines per catalog")


class BundleResponse(BaseModel):
    task: str
    keywords: list[str]
    catalogs: dict[str, list[str]] = Field(description="Filtered catalog sections by catalog name")
    patterns: list[str] = Field(description="Relevant code pattern types for this task")
    constraints: list[str] = Field(description="Active constraints from CONSTITUTION")
    suggested_path: str = Field(description="Suggested implementation sequence")


class SearchResult(BaseModel):
    catalog: str
    line_number: int
    line: str
    context: list[str] = Field(description="Surrounding lines for context")


class PatternResponse(BaseModel):
    pattern_type: str
    content: str
    available_patterns: list[str]


class VerifyRequest(BaseModel):
    run_frontend: bool = Field(default=True, description="Run TypeScript + ESLint checks")
    run_backend: bool = Field(default=True, description="Run pytest backend tests")


class VerifyResponse(BaseModel):
    typescript: bool
    eslint: bool
    backend_tests: bool
    overall: bool
    typescript_output: str
    eslint_output: str
    backend_tests_output: str
    summary: str


class VaultSyncRequest(BaseModel):
    entity_types: list[str] = Field(
        default=["routes", "pages", "models"],
        description="Entity types to sync: routes, pages, models, components, api-clients, integrations, all"
    )
    incremental: bool = Field(default=True, description="Incremental (git diff) or full scan")
    verify_only: bool = Field(default=False, description="Dry-run mode - show what would be generated")


class VaultSyncResponse(BaseModel):
    synced: dict[str, int] = Field(description="Count of files processed per entity type")
    created: list[str] = Field(description="File paths created")
    updated: list[str] = Field(description="File paths updated")
    skipped: list[str] = Field(description="File paths skipped (verify-only or no changes)")
    errors: list[str] = Field(description="Error messages")
    duration_ms: int = Field(description="Total duration in milliseconds")


class VaultDriftItem(BaseModel):
    type: str = Field(description="ghost | undocumented | stale | broken_link")
    entity_type: str = Field(description="routes | pages | models | etc")
    file_path: str | None = Field(description="File path if applicable")
    vault_doc: str | None = Field(description="Vault doc path if applicable")
    reason: str = Field(description="Human-readable reason")


class VaultDriftResponse(BaseModel):
    ghost_entries: list[VaultDriftItem] = Field(description="Documented but file doesn't exist")
    undocumented: list[VaultDriftItem] = Field(description="File exists but no vault entry")
    stale: list[VaultDriftItem] = Field(description="last_verified > 30 days ago")
    broken_links: list[VaultDriftItem] = Field(description="Wikilinks to non-existent entities")
    summary: str = Field(description="Human-readable summary")


class VaultQueryRequest(BaseModel):
    query: str = Field(description="Query expression (e.g., 'domain = CRM', 'status = Active')")
    entity_type: str | None = Field(default=None, description="Limit to: routes | pages | models | components")
    linked_to: str | None = Field(default=None, description="Find entities linking to this ID (e.g., 'ROUTE-086')")


class VaultQueryResponse(BaseModel):
    results: list[dict] = Field(description="Matching entities with their frontmatter")
    count: int = Field(description="Total result count")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/bundle")
async def assemble_bundle(request: BundleRequest) -> BundleResponse:
    """
    Assemble a task-specific context bundle from all 6 catalog files.

    Extracts keywords from the task description, filters relevant catalog
    sections, and returns a structured preamble that agents prepend to their
    working context before planning.

    This is the Stripe Minions 'toolshed' equivalent: call this BEFORE any
    planning step to inject codebase context into the agent's working memory.
    """
    task = request.task

    # Extract keywords — remove short stop words, keep meaningful tokens
    stop_words = {
        "a", "an", "the", "for", "to", "of", "in", "on", "at", "by", "with",
        "and", "or", "is", "are", "was", "be", "add", "new", "create",
        "implement", "build", "that", "this", "from", "into",
    }
    words = re.findall(r"\b\w{3,}\b", task.lower())
    keywords = [w for w in words if w not in stop_words][:20]

    logger.info("Assembling context bundle", task=task[:80], keyword_count=len(keywords))

    # Load and filter all catalogs
    catalogs_content = _all_catalogs()
    filtered_catalogs: dict[str, list[str]] = {}

    for name, content in catalogs_content.items():
        if not content:
            filtered_catalogs[name] = ["(catalog file not found)"]
            continue
        filtered_catalogs[name] = _filter_relevant_sections(
            content, keywords, max_lines=request.max_lines_per_catalog
        )

    # Determine relevant patterns from task keywords
    relevant_patterns: list[str] = []
    if request.include_patterns:
        pattern_triggers: dict[str, list[str]] = {
            "endpoint": ["endpoint", "route", "api", "backend", "fastapi", "http", "get", "post", "put", "delete"],
            "component": ["component", "frontend", "form", "button", "ui", "react", "tsx", "modal", "dialog"],
            "agent": ["agent", "skill", "orchestrat", "langgraph", "langchain", "ai"],
            "integration": ["integration", "client", "shopify", "cin7", "xero", "webhook", "sync", "bridge"],
            "page": ["page", "view", "screen", "dashboard", "layout", "nextjs", "next"],
        }
        task_lower = task.lower()
        for pattern_name, triggers in pattern_triggers.items():
            if any(t in task_lower for t in triggers):
                if pattern_name not in relevant_patterns:
                    relevant_patterns.append(pattern_name)

        if not relevant_patterns:
            # Default: most tasks touch both backend and frontend
            relevant_patterns = ["endpoint", "component"]

    # Constraints from CONSTITUTION (always included)
    constraints = [
        "NEVER modify demo_models.py — production schema risk",
        "NEVER modify middleware.ts or demo_auth.py — auth locked",
        "NEVER change existing API response shapes — breaks frontend",
        "Check docs/catalogs/ BEFORE adding any route, page, agent, model, or package",
        "Update the relevant catalog AFTER adding new items (same session)",
        "No new packages without explicit user approval",
        "Tech stack locked: Next.js 15, React 19, TypeScript 5.7, FastAPI Python 3.12, SQLAlchemy 2.0",
        "Each AI agent must have exactly 10 skills — no more, no less",
        "Run /toolshed before planning, /quality-gate before marking done",
    ]

    # Suggest implementation sequence based on task type
    task_lower = task.lower()
    if any(w in task_lower for w in ["endpoint", "route", "api", "backend"]):
        path = "Backend-first: create route → register in main.py (try/except block) → create frontend API client → wire to page/component"
    elif any(w in task_lower for w in ["page", "component", "frontend", "ui", "view", "form"]):
        path = "Frontend-first: create page/component → wire to existing API → add API client method if needed"
    elif any(w in task_lower for w in ["agent", "skill"]):
        path = "Agent-first: define agent class with 10 skills → create API route → register in main.py → update AGENTS catalog"
    elif any(w in task_lower for w in ["integration", "sync", "webhook", "bridge"]):
        path = "Integration pattern: config/settings.py → integrations/[name]/client.py → api/routes/integrations/[name].py → update INTEGRATIONS catalog"
    else:
        path = "Full-stack: backend route → register router → frontend API client → page/component → tests → quality-gate"

    return BundleResponse(
        task=task,
        keywords=keywords,
        catalogs=filtered_catalogs,
        patterns=relevant_patterns,
        constraints=constraints,
        suggested_path=path,
    )


@router.get("/search")
async def search_catalogs(
    q: str = Query(description="Search query (min 2 chars)", min_length=2),
    catalog: str | None = Query(
        default=None,
        description="Limit to one catalog: routes | pages | agents | packages | models | integrations",
    ),
    max_results: int = Query(default=20, ge=1, le=100),
) -> dict[str, list[SearchResult]]:
    """
    Full-text search across all 6 catalog files.

    Returns matching lines with surrounding context. Use this before adding
    anything new to verify it does not already exist in the codebase.
    """
    query_lower = q.lower()

    if catalog and catalog not in _CATALOG_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown catalog '{catalog}'. Valid: {list(_CATALOG_FILES.keys())}",
        )

    catalogs_to_search = {catalog: _CATALOG_FILES[catalog]} if catalog else _CATALOG_FILES
    results: dict[str, list[SearchResult]] = {}

    for name in catalogs_to_search:
        content = _read_catalog(name)
        if not content:
            continue

        lines = content.splitlines()
        catalog_results: list[SearchResult] = []

        for i, line in enumerate(lines):
            if query_lower in line.lower():
                ctx_start = max(0, i - 2)
                ctx_end = min(len(lines), i + 3)
                catalog_results.append(
                    SearchResult(
                        catalog=name,
                        line_number=i + 1,
                        line=line,
                        context=lines[ctx_start:ctx_end],
                    )
                )
                if len(catalog_results) >= max_results:
                    break

        if catalog_results:
            results[name] = catalog_results

    total = sum(len(v) for v in results.values())
    logger.info("Catalog search completed", query=q, total_matches=total)
    return results


@router.get("/pattern")
async def get_pattern(
    type: str = Query(description="Pattern type: endpoint | component | agent | integration | page"),
) -> PatternResponse:
    """
    Return the canonical code pattern for a given implementation type.

    Use this to get the exact pattern to follow when implementing a new
    endpoint, React component, AI agent, integration client, or Next.js page.
    """
    pattern_type = type.lower()

    if pattern_type not in _PATTERNS:
        raise HTTPException(
            status_code=404,
            detail=f"Pattern '{pattern_type}' not found. Available: {list(_PATTERNS.keys())}",
        )

    return PatternResponse(
        pattern_type=pattern_type,
        content=_PATTERNS[pattern_type],
        available_patterns=list(_PATTERNS.keys()),
    )


@router.post("/verify")
async def verify_quality(request: VerifyRequest) -> VerifyResponse:
    """
    Run type-check + lint (frontend) and pytest (backend) quality gates.

    Implements the Stripe Minions 'quality gate' discipline: agents call this
    before marking any task complete. Target: pass within 2 attempts max.

    Uses asyncio.create_subprocess_exec to avoid blocking the event loop.
    """
    repo_root = str(_REPO_ROOT)

    typescript_passed = True
    eslint_passed = True
    backend_passed = True
    ts_output = "(skipped — run_frontend=false)"
    lint_output = "(skipped — run_frontend=false)"
    backend_output = "(skipped — run_backend=false)"

    # --- Frontend: TypeScript type-check ---
    if request.run_frontend:
        try:
            ts_proc = await asyncio.create_subprocess_exec(
                "pnpm", "turbo", "run", "type-check",
                cwd=repo_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            ts_stdout, _ = await asyncio.wait_for(ts_proc.communicate(), timeout=120)
            ts_output = ts_stdout.decode("utf-8", errors="replace")[-3000:]
            typescript_passed = ts_proc.returncode == 0
        except TimeoutError:
            ts_output = "TIMEOUT after 120s"
            typescript_passed = False
        except Exception as exc:
            ts_output = f"ERROR: {exc}"
            typescript_passed = False

        # --- Frontend: ESLint ---
        try:
            lint_proc = await asyncio.create_subprocess_exec(
                "pnpm", "turbo", "run", "lint",
                cwd=repo_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            lint_stdout, _ = await asyncio.wait_for(lint_proc.communicate(), timeout=120)
            lint_output = lint_stdout.decode("utf-8", errors="replace")[-3000:]
            eslint_passed = lint_proc.returncode == 0
        except TimeoutError:
            lint_output = "TIMEOUT after 120s"
            eslint_passed = False
        except Exception as exc:
            lint_output = f"ERROR: {exc}"
            eslint_passed = False

    # --- Backend: pytest ---
    if request.run_backend:
        backend_dir = str(_REPO_ROOT / "apps" / "backend")
        try:
            test_proc = await asyncio.create_subprocess_exec(
                "uv", "run", "pytest", "-x", "-q", "--tb=short",
                cwd=backend_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            test_stdout, _ = await asyncio.wait_for(test_proc.communicate(), timeout=180)
            backend_output = test_stdout.decode("utf-8", errors="replace")[-4000:]
            backend_passed = test_proc.returncode == 0
        except TimeoutError:
            backend_output = "TIMEOUT after 180s"
            backend_passed = False
        except Exception as exc:
            backend_output = f"ERROR: {exc}"
            backend_passed = False

    overall = typescript_passed and eslint_passed and backend_passed

    def _status(ok: bool) -> str:
        return "PASS" if ok else "FAIL"

    summary = (
        f"Quality Gate Result:\n"
        f"  TypeScript:    {_status(typescript_passed)}\n"
        f"  ESLint:        {_status(eslint_passed)}\n"
        f"  Backend tests: {_status(backend_passed)}\n"
        f"  Overall:       {'READY TO COMMIT' if overall else 'FIX REQUIRED'}"
    )

    logger.info(
        "Quality gate check completed",
        overall=overall,
        typescript=typescript_passed,
        eslint=eslint_passed,
        backend=backend_passed,
    )

    return VerifyResponse(
        typescript=typescript_passed,
        eslint=eslint_passed,
        backend_tests=backend_passed,
        overall=overall,
        typescript_output=ts_output,
        eslint_output=lint_output,
        backend_tests_output=backend_output,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Vault Endpoints
# ---------------------------------------------------------------------------

from .toolshed_vault import detect_vault_drift, query_vault, sync_vault


@router.post("/vault/sync")
async def sync_obsidian_vault(request: VaultSyncRequest) -> VaultSyncResponse:
    """
    Sync Obsidian vault with codebase by running vault-generator.py.

    Generates markdown documentation with frontmatter from source code (routes,
    pages, models, components). Preserves HUMAN-CURATED content blocks while
    updating AUTO-GENERATED sections.

    Use --incremental for fast sync (git diff) or --full for complete rescan.
    """
    result = await sync_vault(
        entity_types=request.entity_types,
        incremental=request.incremental,
        verify_only=request.verify_only,
    )

    return VaultSyncResponse(**result)


@router.get("/vault/drift")
async def check_vault_drift() -> VaultDriftResponse:
    """
    Detect documentation drift by comparing vault docs vs filesystem.

    Returns:
    - Ghost entries: Documented but file doesn't exist
    - Undocumented: File exists but no vault entry
    - Stale: last_verified > 30 days ago
    - Broken links: Wikilinks to non-existent entities

    Run this before starting work to identify missing documentation.
    """
    result = detect_vault_drift()

    return VaultDriftResponse(
        ghost_entries=[VaultDriftItem(**item) for item in result["ghost_entries"]],
        undocumented=[VaultDriftItem(**item) for item in result["undocumented"]],
        stale=[VaultDriftItem(**item) for item in result["stale"]],
        broken_links=[VaultDriftItem(**item) for item in result["broken_links"]],
        summary=result["summary"],
    )


@router.get("/vault/query")
async def query_vault_metadata(
    query: str = Query(description="Query expression (e.g., 'domain = CRM')"),
    entity_type: str | None = Query(default=None, description="Limit to entity type"),
    linked_to: str | None = Query(default=None, description="Find entities linking to this ID"),
) -> VaultQueryResponse:
    """
    Query vault frontmatter metadata (Dataview-style queries).

    Examples:
    - GET /vault/query?query=domain%20=%20CRM
    - GET /vault/query?query=status%20=%20Active&entity_type=routes
    - GET /vault/query?linked_to=ROUTE-086

    Returns matching entities with their frontmatter metadata.
    """
    result = query_vault(query, entity_type, linked_to)

    return VaultQueryResponse(**result)
