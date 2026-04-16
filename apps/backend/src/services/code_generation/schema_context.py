"""Enhanced context: DB schema awareness + API contract analysis.

Extends the base ContextBuilder with:
1. SQLAlchemy model introspection — extracts table names, columns, relationships,
   enums so the generator can reference real schema instead of guessing.
2. API contract analysis — scans existing FastAPI routes to extract endpoint
   patterns, response models, and auth dependency usage.
3. Dependency graph — maps which files import which so the generator knows
   what's available without inventing phantom modules.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import BaseModel, Field

# ============================================================================
# Data Models
# ============================================================================


class ColumnInfo(BaseModel):
    """A SQLAlchemy column extracted from models."""

    name: str
    type: str = Field(description="Python type string, e.g. 'str', 'int', 'UUID'")
    nullable: bool = True
    primary_key: bool = False
    foreign_key: str | None = None
    unique: bool = False


class ModelInfo(BaseModel):
    """An SQLAlchemy model extracted from the codebase."""

    class_name: str
    table_name: str
    columns: list[ColumnInfo] = Field(default_factory=list)
    relationships: list[str] = Field(
        default_factory=list,
        description="Names of related model classes",
    )
    enums_used: list[str] = Field(default_factory=list)
    file_path: str = ""


class EndpointInfo(BaseModel):
    """A FastAPI endpoint extracted from a route file."""

    method: str = Field(description="GET, POST, PUT, DELETE, PATCH")
    path: str
    function_name: str
    response_model: str | None = None
    has_auth: bool = False
    path_params: list[str] = Field(default_factory=list)
    query_params: list[str] = Field(default_factory=list)


class RouteModuleInfo(BaseModel):
    """All endpoints from a single FastAPI route file."""

    file_path: str
    prefix: str
    endpoints: list[EndpointInfo] = Field(default_factory=list)
    pydantic_models: list[str] = Field(
        default_factory=list,
        description="Pydantic models defined in or imported by this route file",
    )


class DependencyEdge(BaseModel):
    """An import relationship between two project files."""

    importer: str = Field(description="File doing the importing")
    imported: str = Field(description="Module being imported")
    symbols: list[str] = Field(
        default_factory=list,
        description="Specific symbols imported",
    )


class SchemaContext(BaseModel):
    """Full schema + contract context for the project."""

    models: list[ModelInfo] = Field(default_factory=list)
    route_modules: list[RouteModuleInfo] = Field(default_factory=list)
    dependency_graph: list[DependencyEdge] = Field(default_factory=list)
    enums: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Enum name → list of values",
    )

    def get_model(self, class_name: str) -> ModelInfo | None:
        return next((m for m in self.models if m.class_name == class_name), None)

    def get_route_module(self, prefix: str) -> RouteModuleInfo | None:
        return next((r for r in self.route_modules if r.prefix == prefix), None)

    def summary(self) -> str:
        """Compact text summary for injection into LLM prompts."""
        lines = ["## Database Models"]
        for m in self.models:
            col_summary = ", ".join(
                f"{c.name}:{c.type}" for c in m.columns[:8]
            )
            lines.append(f"- **{m.class_name}** (table: {m.table_name}): {col_summary}")
            if m.relationships:
                lines.append(f"  Relationships: {', '.join(m.relationships)}")

        lines.append("\n## API Endpoints")
        for rm in self.route_modules:
            for ep in rm.endpoints[:6]:
                auth = " 🔒" if ep.has_auth else " ⚠️ no-auth"
                lines.append(f"- {ep.method} {rm.prefix}{ep.path}{auth} → {ep.function_name}")

        lines.append("\n## Available Enums")
        for name, values in self.enums.items():
            lines.append(f"- {name}: {', '.join(values[:6])}")

        return "\n".join(lines)


# ============================================================================
# Schema Context Builder
# ============================================================================


@dataclass
class SchemaContextBuilder:
    """Analyses the project to extract DB schema + API contract information.

    Usage:
        builder = SchemaContextBuilder(project_root=Path("/path/to/project"))
        ctx = await builder.build()
        print(ctx.summary())
    """

    project_root: Path
    models_dir: Path = field(init=False)
    routes_dir: Path = field(init=False)

    def __post_init__(self) -> None:
        self.models_dir = self.project_root / "apps/backend/src/db"
        self.routes_dir = self.project_root / "apps/backend/src/api/routes"

    async def build(self) -> SchemaContext:
        """Build full schema context from the project."""
        models, enums = self._extract_models()
        route_modules = self._extract_routes()
        dep_graph = self._build_dependency_graph()

        return SchemaContext(
            models=models,
            route_modules=route_modules,
            dependency_graph=dep_graph,
            enums=enums,
        )

    # ========================================================================
    # Model extraction
    # ========================================================================

    def _extract_models(self) -> tuple[list[ModelInfo], dict[str, list[str]]]:
        """Parse all Python model files and extract SQLAlchemy model info."""
        models: list[ModelInfo] = []
        enums: dict[str, list[str]] = {}

        model_files = list(self.models_dir.glob("*.py"))
        for py_file in model_files:
            if py_file.name.startswith("__"):
                continue
            try:
                source = py_file.read_text(encoding="utf-8")
                file_models, file_enums = self._parse_model_file(
                    source, str(py_file.relative_to(self.project_root))
                )
                models.extend(file_models)
                enums.update(file_enums)
            except Exception:
                continue

        return models, enums

    def _parse_model_file(
        self, source: str, file_path: str
    ) -> tuple[list[ModelInfo], dict[str, list[str]]]:
        """Parse a single model file."""
        models: list[ModelInfo] = []
        enums: dict[str, list[str]] = {}

        try:
            tree = ast.parse(source)
        except SyntaxError:
            return models, enums

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                # Check for SQLAlchemy Base subclasses
                bases = [self._node_name(b) for b in node.bases]
                is_model = any(
                    b in ("Base", "DeclarativeBase", "Model") or "Base" in b
                    for b in bases
                )
                is_enum = any(
                    b in ("str", "Enum", "IntEnum") for b in bases
                ) or "enum" in [self._node_name(b).lower() for b in node.bases]

                if is_enum:
                    values = []
                    for item in node.body:
                        if isinstance(item, ast.Assign):
                            for target in item.targets:
                                if isinstance(target, ast.Name):
                                    values.append(target.id)
                    if values:
                        enums[node.name] = values

                elif is_model:
                    model = self._parse_model_class(node, file_path)
                    if model:
                        models.append(model)

        return models, enums

    def _parse_model_class(self, node: ast.ClassDef, file_path: str) -> ModelInfo | None:
        """Extract column/relationship info from an SQLAlchemy model class."""
        table_name = node.name.lower() + "s"
        columns: list[ColumnInfo] = []
        relationships: list[str] = []

        for item in node.body:
            # __tablename__ = "..."
            if isinstance(item, ast.Assign):
                for target in item.targets:
                    if isinstance(target, ast.Name) and target.id == "__tablename__":
                        if isinstance(item.value, ast.Constant):
                            table_name = str(item.value.value)

            # col: Mapped[type] = mapped_column(...)
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                col_name = item.target.id
                if col_name.startswith("_"):
                    continue
                col_type = self._extract_mapped_type(item.annotation)
                nullable = "Optional" in ast.unparse(item.annotation) if item.annotation else True
                pk = self._has_primary_key(item.value) if item.value else False
                fk = self._extract_foreign_key(item.value) if item.value else None
                # Detect relationship
                if item.value and "relationship" in ast.unparse(item.value):
                    relationships.append(col_name)
                else:
                    columns.append(ColumnInfo(
                        name=col_name,
                        type=col_type,
                        nullable=nullable,
                        primary_key=pk,
                        foreign_key=fk,
                    ))

        return ModelInfo(
            class_name=node.name,
            table_name=table_name,
            columns=columns,
            relationships=relationships,
            file_path=file_path,
        )

    def _extract_mapped_type(self, annotation: ast.expr | None) -> str:
        if annotation is None:
            return "Any"
        src = ast.unparse(annotation)
        # Extract inner type from Mapped[X] or Optional[X]
        inner = re.search(r"Mapped\[(?:Optional\[)?([^\[\]]+)\]", src)
        if inner:
            return inner.group(1).split(".")[-1]
        return src.split(".")[-1]

    def _has_primary_key(self, value: ast.expr | None) -> bool:
        if value is None:
            return False
        return "primary_key" in ast.unparse(value)

    def _extract_foreign_key(self, value: ast.expr | None) -> str | None:
        if value is None:
            return None
        src = ast.unparse(value)
        fk_match = re.search(r'ForeignKey\(["\']([^"\']+)["\']', src)
        return fk_match.group(1) if fk_match else None

    def _node_name(self, node: ast.expr) -> str:
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            return node.attr
        return ast.unparse(node)

    # ========================================================================
    # Route extraction
    # ========================================================================

    def _extract_routes(self) -> list[RouteModuleInfo]:
        """Parse all FastAPI route files."""
        route_modules: list[RouteModuleInfo] = []

        route_files = list(self.routes_dir.glob("*.py"))
        for py_file in route_files:
            if py_file.name.startswith("__"):
                continue
            try:
                source = py_file.read_text(encoding="utf-8")
                module = self._parse_route_file(
                    source, str(py_file.relative_to(self.project_root))
                )
                if module:
                    route_modules.append(module)
            except Exception:
                continue

        return route_modules

    def _parse_route_file(self, source: str, file_path: str) -> RouteModuleInfo | None:
        """Extract endpoints from a FastAPI route file."""
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return None

        # Find router prefix
        prefix = "/" + Path(file_path).stem.replace("_", "-")
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func_src = ast.unparse(node.func)
                if "APIRouter" in func_src:
                    for kw in node.keywords:
                        if kw.arg == "prefix" and isinstance(kw.value, ast.Constant):
                            prefix = str(kw.value.value)

        endpoints: list[EndpointInfo] = []
        pydantic_models: list[str] = []

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                for decorator in node.decorator_list:
                    dec_src = ast.unparse(decorator)
                    method_match = re.search(
                        r"router\.(get|post|put|delete|patch)\(['\"]([^'\"]*)['\"]",
                        dec_src,
                    )
                    if method_match:
                        method = method_match.group(1).upper()
                        path = method_match.group(2)
                        has_auth = "get_current_user" in ast.unparse(node)
                        path_params = re.findall(r"\{(\w+)\}", path)
                        resp_match = re.search(r"response_model=([^\s,)]+)", dec_src)

                        endpoints.append(EndpointInfo(
                            method=method,
                            path=path,
                            function_name=node.name,
                            response_model=resp_match.group(1) if resp_match else None,
                            has_auth=has_auth,
                            path_params=path_params,
                        ))

            # Collect Pydantic model names
            if isinstance(node, ast.ClassDef):
                bases = [self._node_name(b) for b in node.bases]
                if any("BaseModel" in b or "Schema" in b for b in bases):
                    pydantic_models.append(node.name)

        return RouteModuleInfo(
            file_path=file_path,
            prefix=prefix,
            endpoints=endpoints,
            pydantic_models=pydantic_models,
        )

    # ========================================================================
    # Dependency graph
    # ========================================================================

    def _build_dependency_graph(self) -> list[DependencyEdge]:
        """Scan backend Python files and build import edges."""
        edges: list[DependencyEdge] = []
        backend_src = self.project_root / "apps/backend/src"

        for py_file in backend_src.rglob("*.py"):
            if "__pycache__" in str(py_file):
                continue
            try:
                source = py_file.read_text(encoding="utf-8")
                tree = ast.parse(source)
                rel_path = str(py_file.relative_to(self.project_root))
                for node in ast.walk(tree):
                    if isinstance(node, ast.ImportFrom) and node.module:
                        if node.module.startswith("src."):
                            symbols = [alias.name for alias in node.names]
                            edges.append(DependencyEdge(
                                importer=rel_path,
                                imported=node.module,
                                symbols=symbols,
                            ))
            except Exception:
                continue

        return edges
