"""Multi-file code generation for complete feature scaffolding.

Generates coordinated sets of files for a complete feature:
- Backend: FastAPI route + service + Pydantic models
- Frontend: React component + API client method
- Tests: unit + integration test files

Handles cross-file imports and dependency ordering automatically.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import anthropic
from pydantic import BaseModel, Field

from .context_builder import CodeContext, ContextBuilder
from .generator import CodeGenerator, CodeGenerationRequest, GeneratedFile, QualityReport
from .quality_checker import QualityChecker


# ============================================================================
# Data Models
# ============================================================================


class FeatureFile(BaseModel):
    """A single file in a multi-file feature."""

    role: str = Field(
        description="route, service, model, component, api_client, test_unit, test_integration"
    )
    file_path: str = Field(description="Relative path from project root")
    language: str = Field(description="python or typescript")
    content: str = Field(description="File content")
    syntax_valid: bool = Field(default=False)
    imports: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(
        default_factory=list,
        description="Other roles this file imports from",
    )


class FeatureRequest(BaseModel):
    """Request to generate a complete feature."""

    feature_name: str = Field(description="Short name, e.g. 'supplier_contacts'")
    description: str = Field(description="Natural language description of the feature")
    target_layers: list[str] = Field(
        default=["route", "service", "model", "test_unit"],
        description="Which layers to generate",
    )
    reference_module: str | None = Field(
        default=None,
        description="Existing module to use as style reference (e.g. 'products')",
    )
    extra_context: dict[str, Any] = Field(default_factory=dict)


class FeatureResult(BaseModel):
    """Result of multi-file feature generation."""

    feature_name: str
    files: list[FeatureFile] = Field(default_factory=list)
    generation_order: list[str] = Field(
        description="Roles in dependency order (generate models first, etc.)"
    )
    quality_reports: dict[str, QualityReport] = Field(default_factory=dict)
    import_map: dict[str, str] = Field(
        default_factory=dict,
        description="Maps role → actual file path for cross-file import resolution",
    )
    pr_ready: bool = Field(default=False)
    errors: list[str] = Field(default_factory=list)


# ============================================================================
# Multi-file Generator
# ============================================================================


@dataclass
class MultiFileGenerator:
    """Generates a complete feature across multiple coordinated files.

    Usage:
        gen = MultiFileGenerator(project_root=Path("/path/to/project"))
        result = await gen.generate_feature(FeatureRequest(
            feature_name="supplier_contacts",
            description="CRUD endpoints for supplier contact persons",
            target_layers=["route", "service", "model", "test_unit"],
            reference_module="customers",
        ))
        for f in result.files:
            Path(f.file_path).write_text(f.content)
    """

    project_root: Path
    anthropic_api_key: str | None = None
    model: str = "claude-sonnet-4-20250514"
    max_retries: int = 2

    # Generation order — models must precede services, services precede routes
    GENERATION_ORDER: list[str] = field(
        default_factory=lambda: [
            "model",
            "service",
            "route",
            "api_client",
            "component",
            "test_unit",
            "test_integration",
        ]
    )

    def __post_init__(self) -> None:
        import os

        api_key = self.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY must be set")
        self.client = anthropic.Anthropic(api_key=api_key)
        self.context_builder = ContextBuilder(project_root=self.project_root)
        self.quality_checker = QualityChecker(project_root=self.project_root)
        self._single_gen = CodeGenerator(
            project_root=self.project_root,
            anthropic_api_key=api_key,
            model=self.model,
        )

    # ========================================================================
    # Public API
    # ========================================================================

    async def generate_feature(self, request: FeatureRequest) -> FeatureResult:
        """Generate all files for a feature in dependency order.

        Steps:
        1. Plan file paths for each requested layer
        2. Build shared context from codebase + reference module
        3. Generate each file in dependency order, injecting previously
           generated files into subsequent prompts
        4. Resolve cross-file imports
        5. Run quality checks on each file
        """
        result = FeatureResult(
            feature_name=request.feature_name,
            generation_order=self._ordered_layers(request.target_layers),
        )

        # Step 1: plan file paths
        import_map = self._plan_file_paths(request)
        result.import_map = import_map

        # Step 2: build base codebase context once
        base_context = await self.context_builder.build_context(
            requirement=request.description,
            target_language="python",
            reference_files=self._reference_files(request),
        )

        # Collect generated content as we go so later files can reference them
        generated_so_far: dict[str, FeatureFile] = {}

        # Step 3: generate each layer in order
        for role in result.generation_order:
            if role not in request.target_layers:
                continue
            try:
                feature_file = await self._generate_layer(
                    role=role,
                    request=request,
                    base_context=base_context,
                    import_map=import_map,
                    generated_so_far=generated_so_far,
                )
                result.files.append(feature_file)
                generated_so_far[role] = feature_file

                # Quality check
                gf = GeneratedFile(
                    file_path=feature_file.file_path,
                    content=feature_file.content,
                    language=feature_file.language,
                    file_type="test" if "test" in role else "implementation",
                    syntax_valid=feature_file.syntax_valid,
                    imports=feature_file.imports,
                )
                report = await self.quality_checker.check_quality(gf)
                result.quality_reports[role] = report

            except Exception as exc:
                result.errors.append(f"{role}: {exc}")

        # Step 4: resolve cross-file imports across all generated files
        result.files = self._resolve_imports(result.files, import_map)

        result.pr_ready = (
            len(result.errors) == 0
            and all(f.syntax_valid for f in result.files)
            and any("test" in f.role for f in result.files)
        )
        return result

    # ========================================================================
    # Layer generation
    # ========================================================================

    async def _generate_layer(
        self,
        role: str,
        request: FeatureRequest,
        base_context: CodeContext,
        import_map: dict[str, str],
        generated_so_far: dict[str, FeatureFile],
    ) -> FeatureFile:
        """Generate a single layer file with full context."""
        language = "typescript" if role in ("component", "api_client") else "python"
        file_path = import_map[role]

        prompt = self._build_layer_prompt(
            role=role,
            request=request,
            base_context=base_context,
            import_map=import_map,
            generated_so_far=generated_so_far,
            language=language,
        )

        code = await self._call_llm(prompt, language)
        syntax_valid, imports = await self._validate_syntax(code, language)

        return FeatureFile(
            role=role,
            file_path=file_path,
            language=language,
            content=code,
            syntax_valid=syntax_valid,
            imports=imports,
            depends_on=self._layer_deps(role),
        )

    def _build_layer_prompt(
        self,
        role: str,
        request: FeatureRequest,
        base_context: CodeContext,
        import_map: dict[str, str],
        generated_so_far: dict[str, FeatureFile],
        language: str,
    ) -> str:
        """Build a generation prompt for one layer, including already-generated siblings."""
        style = (
            base_context.backend_style
            if language == "python"
            else base_context.frontend_style
        )
        framework = style.framework if style else ("FastAPI" if language == "python" else "Next.js")

        # Sibling code snippet for cross-file consistency
        siblings_section = ""
        for dep_role in self._layer_deps(role):
            if dep_role in generated_so_far:
                sibling = generated_so_far[dep_role]
                # First 60 lines of each sibling to keep prompt bounded
                preview = "\n".join(sibling.content.splitlines()[:60])
                siblings_section += (
                    f"\n### Already generated: {dep_role} ({sibling.file_path})\n"
                    f"```{sibling.language}\n{preview}\n```\n"
                )

        role_instructions = self._role_instructions(role, request, import_map)

        return f"""You are an expert {framework} developer generating production-quality code.

## Feature
Name: {request.feature_name}
Description: {request.description}

## Your task
Generate the **{role}** layer file.
Target path: `{import_map.get(role, 'auto')}`
Language: {language}

{role_instructions}

## Project conventions
Framework: {framework}
Naming: {style.naming_convention if style else 'snake_case'}
Common imports: {', '.join((style.common_imports[:8] if style else []))}

## Already generated files (import from these for consistency)
{siblings_section if siblings_section else "This is the first file — establish the data models."}

## Rules
- Follow existing project patterns exactly
- Include all necessary imports
- Add type hints to every function
- No hardcoded secrets or credentials
- Output ONLY the file content — no markdown fences, no explanation

Generate {import_map.get(role, role)} now:"""

    def _role_instructions(
        self, role: str, request: FeatureRequest, import_map: dict[str, str]
    ) -> str:
        name = request.feature_name
        camel = "".join(w.capitalize() for w in name.split("_"))
        route_path = name.replace("_", "-")

        instructions = {
            "model": (
                f"Create SQLAlchemy 2.0 async model(s) for `{name}`.\n"
                "Include: UUID primary key, created_at/updated_at timestamps, "
                "appropriate columns, relationships, and Pydantic response schemas."
            ),
            "service": (
                f"Create a service class `{camel}Service` with async methods: "
                "list (paginated), get_by_id, create, update, delete.\n"
                "Use AsyncSession from SQLAlchemy. Raise HTTPException on not-found."
            ),
            "route": (
                f"Create a FastAPI APIRouter at prefix `/api/{route_path}`.\n"
                "Endpoints: GET / (list), GET /{{id}}, POST /, PUT /{{id}}, DELETE /{{id}}.\n"
                "All endpoints must have `Depends(get_current_user)` for auth.\n"
                "Import from the service layer — no direct DB queries in routes."
            ),
            "api_client": (
                f"Create TypeScript API client functions for `{name}` CRUD operations.\n"
                "Use `apiClient` from `@/lib/api/client`. Export typed functions: "
                f"list{camel}, get{camel}ById, create{camel}, update{camel}, delete{camel}.\n"
                "Include TypeScript interfaces for request/response types."
            ),
            "component": (
                f"Create a React `{camel}Form` component (TypeScript, 'use client').\n"
                "Use React Hook Form + Zod validation + shadcn/ui components.\n"
                "Support mode='create' | mode='edit', include loading state and toast feedback."
            ),
            "test_unit": (
                f"Create pytest unit tests for the `{camel}Service` class.\n"
                "Use AsyncMock for the database session. Test: list, get_by_id (found + not-found), "
                "create, update, delete. Aim for >80% branch coverage."
            ),
            "test_integration": (
                f"Create pytest integration tests for the `/api/{route_path}` endpoints.\n"
                "Use FastAPI TestClient. Test each endpoint: success path + 401 unauth + 404 not-found.\n"
                "Mock `get_current_user` to return a test user."
            ),
        }
        return instructions.get(role, f"Generate the {role} layer for {name}.")

    # ========================================================================
    # File path planning
    # ========================================================================

    def _plan_file_paths(self, request: FeatureRequest) -> dict[str, str]:
        """Return a role → relative file path mapping."""
        name = request.feature_name
        camel = "".join(w.capitalize() for w in name.split("_"))
        return {
            "model": f"apps/backend/src/db/{name}_models.py",
            "service": f"apps/backend/src/services/{name}_service.py",
            "route": f"apps/backend/src/api/routes/{name}.py",
            "api_client": f"apps/web/lib/api/{name}.ts",
            "component": f"apps/web/app/(dashboard)/{name}/components/{camel}Form.tsx",
            "test_unit": f"apps/backend/tests/unit/test_{name}_service.py",
            "test_integration": f"apps/backend/tests/integration/test_{name}_routes.py",
        }

    def _reference_files(self, request: FeatureRequest) -> list[str]:
        """Return reference files based on the chosen reference module."""
        ref = request.reference_module or "products"
        camel = "".join(w.capitalize() for w in ref.split("_"))
        return [
            f"apps/backend/src/api/routes/{ref}.py",
            f"apps/backend/src/db/demo_models.py",
            f"apps/web/app/(dashboard)/{ref}/components/{camel}Form.tsx",
        ]

    # ========================================================================
    # Import resolution
    # ========================================================================

    def _resolve_imports(
        self, files: list[FeatureFile], import_map: dict[str, str]
    ) -> list[FeatureFile]:
        """Fix placeholder import paths in generated files using actual file paths."""
        # Build module name mapping: role → importable python module path
        py_module_map = {
            role: path.replace("/", ".").removesuffix(".py")
            for role, path in import_map.items()
            if path.endswith(".py")
        }

        updated = []
        for ff in files:
            content = ff.content
            # Replace any PLACEHOLDER_<ROLE> strings inserted by prompts
            for role, module_path in py_module_map.items():
                placeholder = f"PLACEHOLDER_{role.upper()}"
                content = content.replace(placeholder, module_path)
            updated.append(ff.model_copy(update={"content": content}))
        return updated

    # ========================================================================
    # Dependency graph
    # ========================================================================

    def _ordered_layers(self, target_layers: list[str]) -> list[str]:
        """Return target_layers sorted by generation order."""
        order_index = {role: i for i, role in enumerate(self.GENERATION_ORDER)}
        return sorted(target_layers, key=lambda r: order_index.get(r, 99))

    def _layer_deps(self, role: str) -> list[str]:
        """Return the roles a layer depends on (must be generated first)."""
        deps = {
            "model": [],
            "service": ["model"],
            "route": ["model", "service"],
            "api_client": [],
            "component": ["api_client"],
            "test_unit": ["model", "service"],
            "test_integration": ["model", "service", "route"],
        }
        return deps.get(role, [])

    # ========================================================================
    # LLM + Validation helpers
    # ========================================================================

    async def _call_llm(self, prompt: str, language: str) -> str:
        """Call Claude API with retry logic."""
        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=8192,
                    temperature=0.1,
                    messages=[{"role": "user", "content": prompt}],
                )
                code = response.content[0].text.strip()
                return self._clean_code(code)
            except anthropic.RateLimitError:
                if attempt < self.max_retries:
                    await asyncio.sleep(2**attempt)
                    continue
                raise
            except Exception:
                if attempt < self.max_retries:
                    continue
                raise
        raise RuntimeError("LLM call failed after all retries")

    def _clean_code(self, raw: str) -> str:
        """Strip markdown fences from LLM output."""
        raw = re.sub(r"^```[a-zA-Z]*\n", "", raw)
        raw = re.sub(r"\n```$", "", raw)
        return raw.strip()

    async def _validate_syntax(
        self, code: str, language: str
    ) -> tuple[bool, list[str]]:
        """Check syntax validity and extract imports."""
        if language == "python":
            return self._validate_python(code)
        return self._validate_typescript(code)

    def _validate_python(self, code: str) -> tuple[bool, list[str]]:
        import ast as _ast

        try:
            tree = _ast.parse(code)
            imports: list[str] = []
            for node in _ast.walk(tree):
                if isinstance(node, _ast.Import):
                    imports.extend(alias.name for alias in node.names)
                elif isinstance(node, _ast.ImportFrom):
                    if node.module:
                        imports.append(node.module)
            return True, imports
        except SyntaxError:
            return False, []

    def _validate_typescript(self, code: str) -> tuple[bool, list[str]]:
        """Basic TS validation — check for unmatched braces."""
        depth = 0
        for ch in code:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            if depth < 0:
                return False, []
        imports: list[str] = re.findall(r"from ['\"]([^'\"]+)['\"]", code)
        return depth == 0, imports
