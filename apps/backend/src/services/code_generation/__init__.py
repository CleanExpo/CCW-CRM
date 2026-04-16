"""Code generation services for autonomous development.

This package provides AI-powered code generation capabilities including:
- Context analysis and codebase understanding
- LLM-powered single-file code generation
- Multi-file feature generation (Phase B2)
- Incremental updates to existing files (Phase B2)
- DB schema + API contract context (Phase B2)
- Pre-defined code templates (Phase B2)
- Automated test generation
- Documentation generation
- Code quality validation (Ruff, mypy, ESLint, coverage)
"""

from .context_builder import (
    CodeContext,
    CodePattern,
    ContextBuilder,
    ProjectStructure,
    StyleGuide,
)
from .doc_generator import DocGenerator
from .generator import (
    CodeGenerationRequest,
    CodeGenerationResult,
    CodeGenerator,
    GeneratedFile,
    QualityReport,
)
from .incremental_updater import (
    IncrementalUpdater,
    UpdateRequest,
    UpdateResult,
)
from .multi_file_generator import (
    FeatureFile,
    FeatureRequest,
    FeatureResult,
    MultiFileGenerator,
)
from .quality_checker import CoverageReport, QualityChecker
from .schema_context import (
    ColumnInfo,
    DependencyEdge,
    EndpointInfo,
    ModelInfo,
    RouteModuleInfo,
    SchemaContext,
    SchemaContextBuilder,
)
from .template_system import (
    RenderedTemplate,
    TemplateKind,
    TemplateSystem,
    TemplateVars,
)
from .test_generator import TestGenerator

__all__ = [
    # Context Builder
    "CodeContext",
    "CodePattern",
    "ContextBuilder",
    "ProjectStructure",
    "StyleGuide",
    # Single-file Generator
    "CodeGenerationRequest",
    "CodeGenerationResult",
    "CodeGenerator",
    "GeneratedFile",
    "QualityReport",
    # Multi-file Generator (Phase B2)
    "FeatureFile",
    "FeatureRequest",
    "FeatureResult",
    "MultiFileGenerator",
    # Incremental Updater (Phase B2)
    "IncrementalUpdater",
    "UpdateRequest",
    "UpdateResult",
    # Schema Context (Phase B2)
    "ColumnInfo",
    "DependencyEdge",
    "EndpointInfo",
    "ModelInfo",
    "RouteModuleInfo",
    "SchemaContext",
    "SchemaContextBuilder",
    # Template System (Phase B2)
    "RenderedTemplate",
    "TemplateKind",
    "TemplateSystem",
    "TemplateVars",
    # Test Generator
    "TestGenerator",
    # Documentation Generator
    "DocGenerator",
    # Quality Checker (extended Phase B2)
    "CoverageReport",
    "QualityChecker",
]
