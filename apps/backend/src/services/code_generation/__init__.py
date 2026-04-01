"""Code generation services for autonomous development.

This package provides AI-powered code generation capabilities including:
- Context analysis and codebase understanding
- LLM-powered code generation
- Automated test generation
- Documentation generation
- Code quality validation
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
from .quality_checker import QualityChecker
from .test_generator import TestGenerator

__all__ = [
    # Context Builder
    "CodeContext",
    "CodePattern",
    "ContextBuilder",
    "ProjectStructure",
    "StyleGuide",
    # Code Generator
    "CodeGenerationRequest",
    "CodeGenerationResult",
    "CodeGenerator",
    "GeneratedFile",
    "QualityReport",
    # Test Generator
    "TestGenerator",
    # Documentation Generator
    "DocGenerator",
    # Quality Checker
    "QualityChecker",
]
