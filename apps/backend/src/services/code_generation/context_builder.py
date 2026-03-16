"""Context builder for AI code generation.

Analyzes the codebase to extract:
- Project structure and file organization
- Code patterns and conventions
- Style guide and framework usage
- Dependencies and imports
- Reference code examples
"""

import ast
import re
from collections import defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

from pydantic import BaseModel, Field

# ============================================================================
# Data Models
# ============================================================================


class ProjectStructure(BaseModel):
    """Analyzed project directory structure."""

    backend_routes: str = Field(description="API routes directory")
    backend_models: str = Field(description="Database models directory")
    backend_services: str = Field(description="Services/business logic directory")
    backend_tests: str = Field(description="Backend tests directory")
    frontend_pages: str = Field(description="Frontend pages directory")
    frontend_components: str = Field(description="Frontend components directory")
    frontend_tests: str = Field(description="Frontend tests directory")
    root_dir: str = Field(description="Project root directory")

    @classmethod
    def from_project_root(cls, root: Path) -> "ProjectStructure":
        """Auto-detect project structure from root directory."""
        return cls(
            backend_routes=str(root / "apps/backend/src/api/routes"),
            backend_models=str(root / "apps/backend/src/db"),
            backend_services=str(root / "apps/backend/src/services"),
            backend_tests=str(root / "apps/backend/tests"),
            frontend_pages=str(root / "apps/web/app/(dashboard)"),
            frontend_components=str(root / "apps/web/components"),
            frontend_tests=str(root / "apps/web/__tests__"),
            root_dir=str(root),
        )


class CodePattern(BaseModel):
    """Detected code pattern from existing files."""

    pattern_type: str = Field(description="Type: import, naming, structure, etc.")
    examples: list[str] = Field(description="Example code snippets")
    frequency: int = Field(description="How often this pattern appears")
    confidence: float = Field(description="Confidence score 0-1")


class StyleGuide(BaseModel):
    """Extracted style guide and conventions."""

    language: str = Field(description="python or typescript")
    framework: str = Field(description="Main framework (FastAPI, Next.js, etc.)")
    ui_library: str | None = Field(default=None, description="UI library if applicable")
    form_library: str | None = Field(default=None, description="Form library if applicable")
    validation_library: str | None = Field(
        default=None, description="Validation library"
    )
    common_imports: list[str] = Field(
        default_factory=list, description="Most common imports"
    )
    naming_convention: str = Field(
        description="snake_case, camelCase, PascalCase, etc."
    )
    reference_files: list[str] = Field(
        default_factory=list, description="Example files to follow"
    )


class CodeContext(BaseModel):
    """Complete context for code generation."""

    structure: ProjectStructure = Field(description="Project structure")
    patterns: list[CodePattern] = Field(description="Detected patterns")
    backend_style: StyleGuide = Field(description="Backend style guide")
    frontend_style: StyleGuide = Field(description="Frontend style guide")
    similar_files: list[str] = Field(
        default_factory=list, description="Similar reference files"
    )
    dependencies: dict[str, list[str]] = Field(
        default_factory=dict, description="File dependencies"
    )


# ============================================================================
# Context Builder
# ============================================================================


@dataclass
class ContextBuilder:
    """Analyzes codebase to build context for AI code generation.

    Usage:
        builder = ContextBuilder(project_root=Path("/path/to/project"))
        context = await builder.build_context(
            requirement="Add a new product endpoint",
            target_language="python"
        )
    """

    project_root: Path
    structure: ProjectStructure = field(init=False)

    def __post_init__(self):
        """Initialize project structure."""
        self.structure = ProjectStructure.from_project_root(self.project_root)

    # ========================================================================
    # Main API
    # ========================================================================

    async def build_context(
        self,
        requirement: str,
        target_language: str = "python",
        reference_files: list[str] | None = None,
    ) -> CodeContext:
        """Build complete context for code generation.

        Args:
            requirement: Natural language description of what to build
            target_language: "python" or "typescript"
            reference_files: Optional list of specific files to analyze

        Returns:
            CodeContext with project structure, patterns, and style guide
        """
        # Analyze structure
        structure = self.structure

        # Detect patterns
        patterns = await self._detect_patterns(target_language)

        # Extract style guides
        backend_style = await self._extract_backend_style()
        frontend_style = await self._extract_frontend_style()

        # Find similar code
        similar_files = await self._find_similar_files(requirement, target_language)

        # Build dependency graph
        dependencies = await self._build_dependencies(
            reference_files or similar_files[:5]
        )

        return CodeContext(
            structure=structure,
            patterns=patterns,
            backend_style=backend_style,
            frontend_style=frontend_style,
            similar_files=similar_files,
            dependencies=dependencies,
        )

    # ========================================================================
    # Pattern Detection
    # ========================================================================

    async def _detect_patterns(self, language: str) -> list[CodePattern]:
        """Detect common code patterns in the codebase.

        Args:
            language: "python" or "typescript"

        Returns:
            List of detected patterns
        """
        patterns = []

        if language == "python":
            # Analyze backend files
            routes_dir = Path(self.structure.backend_routes)
            if routes_dir.exists():
                patterns.extend(await self._detect_python_patterns(routes_dir))

        elif language == "typescript":
            # Analyze frontend files
            components_dir = Path(self.structure.frontend_components)
            if components_dir.exists():
                patterns.extend(await self._detect_typescript_patterns(components_dir))

        return patterns

    async def _detect_python_patterns(self, directory: Path) -> list[CodePattern]:
        """Detect Python-specific patterns.

        Analyzes:
        - Common imports (FastAPI, Pydantic, SQLAlchemy)
        - Route decorator patterns
        - Async/await usage
        - Type hints
        """
        patterns = []
        import_counts: dict[str, int] = defaultdict(int)
        route_patterns: list[str] = []

        # Scan Python files
        for py_file in directory.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            try:
                content = py_file.read_text(encoding="utf-8")

                # Count imports
                for line in content.split("\n"):
                    if line.startswith("from ") or line.startswith("import "):
                        import_counts[line.strip()] += 1

                # Detect route patterns
                if "@router." in content:
                    route_matches = re.findall(
                        r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)',
                        content,
                    )
                    for method, path in route_matches:
                        route_patterns.append(f"@router.{method}('{path}')")

            except Exception:
                continue

        # Top imports pattern
        if import_counts:
            top_imports = sorted(import_counts.items(), key=lambda x: x[1], reverse=True)[
                :10
            ]
            patterns.append(
                CodePattern(
                    pattern_type="common_imports",
                    examples=[imp for imp, _ in top_imports],
                    frequency=sum(count for _, count in top_imports),
                    confidence=0.9,
                )
            )

        # Route patterns
        if route_patterns:
            patterns.append(
                CodePattern(
                    pattern_type="route_decorators",
                    examples=route_patterns[:5],
                    frequency=len(route_patterns),
                    confidence=0.85,
                )
            )

        return patterns

    async def _detect_typescript_patterns(self, directory: Path) -> list[CodePattern]:
        """Detect TypeScript/React patterns.

        Analyzes:
        - Common imports (React, Next.js, shadcn/ui)
        - Component structure (use client, hooks, etc.)
        - Form patterns (React Hook Form, Zod)
        """
        patterns = []
        import_counts: dict[str, int] = defaultdict(int)
        component_features: list[str] = []

        # Scan TypeScript/TSX files
        for ts_file in directory.rglob("*.tsx"):
            try:
                content = ts_file.read_text(encoding="utf-8")

                # Count imports
                for line in content.split("\n"):
                    if line.strip().startswith("import "):
                        import_counts[line.strip()] += 1

                # Detect component features
                if '"use client"' in content:
                    component_features.append("use client")
                if "useForm" in content:
                    component_features.append("React Hook Form")
                if "zodResolver" in content:
                    component_features.append("Zod validation")

            except Exception:
                continue

        # Top imports
        if import_counts:
            top_imports = sorted(import_counts.items(), key=lambda x: x[1], reverse=True)[
                :10
            ]
            patterns.append(
                CodePattern(
                    pattern_type="common_imports",
                    examples=[imp for imp, _ in top_imports],
                    frequency=sum(count for _, count in top_imports),
                    confidence=0.9,
                )
            )

        # Component features
        if component_features:
            patterns.append(
                CodePattern(
                    pattern_type="component_features",
                    examples=list(set(component_features)),
                    frequency=len(component_features),
                    confidence=0.8,
                )
            )

        return patterns

    # ========================================================================
    # Style Guide Extraction
    # ========================================================================

    async def _extract_backend_style(self) -> StyleGuide:
        """Extract backend style guide from reference files."""
        # Reference files that demonstrate best practices
        reference_files = [
            "demo_lists.py",
            "orders.py",
            "translations.py",
            "autonomy_metrics.py",
        ]

        common_imports = [
            "from typing import Annotated",
            "from fastapi import APIRouter, Depends, Query",
            "from sqlalchemy.ext.asyncio import AsyncSession",
            "from pydantic import BaseModel, Field",
        ]

        return StyleGuide(
            language="python",
            framework="FastAPI",
            validation_library="Pydantic v2",
            common_imports=common_imports,
            naming_convention="snake_case",
            reference_files=reference_files,
        )

    async def _extract_frontend_style(self) -> StyleGuide:
        """Extract frontend style guide from reference files."""
        # Reference files
        reference_files = [
            "login-form.tsx",
            "OrderForm.tsx",
            "ProductForm.tsx",
        ]

        common_imports = [
            'import { useState } from "react"',
            'import { useForm } from "react-hook-form"',
            'import { zodResolver } from "@hookform/resolvers/zod"',
            'import * as z from "zod"',
            'import { Button } from "@/components/ui/button"',
        ]

        return StyleGuide(
            language="typescript",
            framework="Next.js 15 + React 19",
            ui_library="shadcn/ui",
            form_library="React Hook Form",
            validation_library="Zod",
            common_imports=common_imports,
            naming_convention="PascalCase (components), camelCase (functions)",
            reference_files=reference_files,
        )

    # ========================================================================
    # Similar Code Finding
    # ========================================================================

    async def _find_similar_files(
        self, requirement: str, language: str, max_results: int = 5
    ) -> list[str]:
        """Find files similar to the requirement using text similarity.

        Args:
            requirement: Natural language description
            language: "python" or "typescript"
            max_results: Maximum number of results to return

        Returns:
            List of file paths sorted by similarity
        """
        candidates = []

        # Determine search directory
        if language == "python":
            search_dir = Path(self.structure.backend_routes)
            extensions = [".py"]
        else:
            search_dir = Path(self.structure.frontend_components)
            extensions = [".tsx", ".ts"]

        if not search_dir.exists():
            return []

        # Scan files
        for ext in extensions:
            for file in search_dir.rglob(f"*{ext}"):
                if file.name.startswith("__"):
                    continue

                try:
                    content = file.read_text(encoding="utf-8")
                    # Calculate similarity based on file name and content
                    filename_similarity = SequenceMatcher(
                        None, requirement.lower(), file.name.lower()
                    ).ratio()
                    content_similarity = SequenceMatcher(
                        None, requirement.lower(), content[:500].lower()
                    ).ratio()

                    # Weighted average (filename more important)
                    similarity = filename_similarity * 0.6 + content_similarity * 0.4

                    candidates.append((str(file.relative_to(self.project_root)), similarity))
                except Exception:
                    continue

        # Sort by similarity and return top results
        candidates.sort(key=lambda x: x[1], reverse=True)
        return [path for path, _ in candidates[:max_results]]

    # ========================================================================
    # Dependency Analysis
    # ========================================================================

    async def _build_dependencies(self, files: list[str]) -> dict[str, list[str]]:
        """Build dependency graph for given files.

        Args:
            files: List of file paths (relative to project root)

        Returns:
            Dict mapping file path to list of imported modules
        """
        dependencies: dict[str, list[str]] = {}

        for file_path in files:
            full_path = self.project_root / file_path
            if not full_path.exists():
                continue

            try:
                if full_path.suffix == ".py":
                    deps = await self._extract_python_imports(full_path)
                elif full_path.suffix in [".ts", ".tsx"]:
                    deps = await self._extract_typescript_imports(full_path)
                else:
                    deps = []

                dependencies[file_path] = deps
            except Exception:
                dependencies[file_path] = []

        return dependencies

    async def _extract_python_imports(self, file_path: Path) -> list[str]:
        """Extract Python import statements.

        Args:
            file_path: Path to Python file

        Returns:
            List of imported module names
        """
        imports = []

        try:
            content = file_path.read_text(encoding="utf-8")
            tree = ast.parse(content)

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.append(node.module)
        except Exception:
            pass

        return imports

    async def _extract_typescript_imports(self, file_path: Path) -> list[str]:
        """Extract TypeScript/JavaScript import statements.

        Args:
            file_path: Path to TypeScript file

        Returns:
            List of imported module names
        """
        imports = []

        try:
            content = file_path.read_text(encoding="utf-8")

            # Match import statements
            import_pattern = r'import\s+(?:{[^}]+}|\w+)\s+from\s+["\']([^"\']+)["\']'
            matches = re.findall(import_pattern, content)
            imports.extend(matches)
        except Exception:
            pass

        return imports
