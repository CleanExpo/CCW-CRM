"""AI-powered code generator using Claude.

Generates production-quality code using Claude Sonnet 4.5 with context awareness,
following project patterns and conventions.
"""

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import anthropic
from pydantic import BaseModel, Field

from .context_builder import CodeContext, ContextBuilder

# ============================================================================
# Data Models
# ============================================================================


class CodeGenerationRequest(BaseModel):
    """Request for code generation."""

    requirement: str = Field(description="Natural language requirement")
    context: dict[str, Any] = Field(default_factory=dict, description="Additional context")
    target_language: str = Field(description="python or typescript")
    generation_type: str = Field(default="feature", description="feature, bug_fix, or refactor")
    reference_files: list[str] = Field(
        default_factory=list, description="Files to use as reference"
    )
    constraints: dict[str, Any] = Field(default_factory=dict, description="Generation constraints")


class GeneratedFile(BaseModel):
    """A generated code file."""

    file_path: str = Field(description="Relative path to file")
    content: str = Field(description="File content")
    language: str = Field(description="python or typescript")
    file_type: str = Field(
        default="implementation", description="implementation, test, or documentation"
    )
    syntax_valid: bool = Field(description="Whether syntax is valid")
    imports: list[str] = Field(default_factory=list, description="Imported modules")


class QualityReport(BaseModel):
    """Quality check results (placeholder for Task #73)."""

    linting_passed: bool = Field(default=True, description="Linting passed")
    linting_errors: list[str] = Field(default_factory=list)
    type_check_passed: bool = Field(default=True, description="Type check passed")
    type_errors: list[str] = Field(default_factory=list)
    formatting_applied: bool = Field(default=False, description="Code formatted")
    security_issues: list[str] = Field(default_factory=list)
    best_practices_violations: list[str] = Field(default_factory=list)


class CodeGenerationResult(BaseModel):
    """Result of code generation."""

    generated_files: list[GeneratedFile] = Field(description="Generated code files")
    tests: list[GeneratedFile] = Field(
        default_factory=list, description="Generated tests (Task #71)"
    )
    documentation: list[str] = Field(default_factory=list, description="Generated docs (Task #72)")
    quality_report: QualityReport = Field(description="Quality check results")
    pr_ready: bool = Field(default=False, description="Whether code is ready for PR")


# ============================================================================
# Code Generator
# ============================================================================


@dataclass
class CodeGenerator:
    """AI-powered code generator using Claude.

    Usage:
        generator = CodeGenerator(project_root=Path("/path/to/project"))
        request = CodeGenerationRequest(
            requirement="Add a new product endpoint",
            target_language="python"
        )
        result = await generator.generate(request)
    """

    project_root: Path
    anthropic_api_key: str | None = None
    model: str = "claude-opus-4-6"  # Claude Opus 4-6
    fallback_model: str = "claude-haiku-4-20250910"  # Claude Haiku
    max_retries: int = 2

    def __post_init__(self):
        """Initialize Anthropic client."""
        from src.config.settings import get_settings
        api_key = self.anthropic_api_key or get_settings().anthropic_api_key
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable must be set or passed to constructor"
            )

        self.client = anthropic.Anthropic(api_key=api_key)
        self.context_builder = ContextBuilder(project_root=self.project_root)
        self.prompts_dir = Path(__file__).parent / "prompts"

        # Initialize test generator (lazy import to avoid circular dependency)
        from .test_generator import TestGenerator

        self.test_generator = TestGenerator(
            project_root=self.project_root, anthropic_api_key=api_key
        )

        # Initialize documentation generator
        from .doc_generator import DocGenerator

        self.doc_generator = DocGenerator(project_root=self.project_root, anthropic_api_key=api_key)

        # Initialize quality checker
        from .quality_checker import QualityChecker

        self.quality_checker = QualityChecker(project_root=self.project_root)

    # ========================================================================
    # Main API
    # ========================================================================

    async def generate(self, request: CodeGenerationRequest) -> CodeGenerationResult:
        """Generate code based on request.

        Args:
            request: Code generation request with requirement and context

        Returns:
            CodeGenerationResult with generated files and quality report
        """
        # Build context from codebase
        context = await self.context_builder.build_context(
            requirement=request.requirement,
            target_language=request.target_language,
            reference_files=request.reference_files,
        )

        # Load and render prompt template
        prompt = await self._build_prompt(request, context)

        # Generate code using LLM
        generated_code = await self._call_llm(
            prompt=prompt, target_language=request.target_language
        )

        # Validate syntax
        syntax_valid, imports = await self._validate_syntax(
            code=generated_code, language=request.target_language
        )

        # Create generated file (initial, without documentation)
        file_path = await self._infer_file_path(
            requirement=request.requirement,
            language=request.target_language,
            context=context,
        )

        generated_file = GeneratedFile(
            file_path=file_path,
            content=generated_code,
            language=request.target_language,
            file_type="implementation",
            syntax_valid=syntax_valid,
            imports=imports,
        )

        # Generate documentation (Task #72)
        documentation_list = []
        if syntax_valid:
            try:
                documented_code = await self.doc_generator.generate_documentation(
                    generated_file=generated_file
                )
                # Update generated file with documented code
                generated_file = GeneratedFile(
                    file_path=file_path,
                    content=documented_code,
                    language=request.target_language,
                    file_type="implementation",
                    syntax_valid=True,  # Already validated by doc generator
                    imports=imports,
                )
                # Add documentation summary
                documentation_list.append(f"Added comprehensive documentation to {file_path}")
            except Exception:
                # Documentation generation failure shouldn't block code generation
                pass

        # Generate tests (Task #71)
        tests = []
        if syntax_valid:
            try:
                generated_tests = await self.test_generator.generate_tests(
                    generated_file=generated_file, test_type="unit"
                )
                tests.extend(generated_tests)
            except Exception:
                # Test generation failure shouldn't block code generation
                # Log warning but continue
                pass

        # Run quality checks (Task #73)
        quality_report = await self.quality_checker.check_quality(generated_file)

        # Return result
        return CodeGenerationResult(
            generated_files=[generated_file],
            tests=tests,
            documentation=documentation_list,
            quality_report=quality_report,
            pr_ready=syntax_valid and len(tests) > 0,  # PR ready if code + tests valid
        )

    # ========================================================================
    # Prompt Engineering
    # ========================================================================

    async def _build_prompt(self, request: CodeGenerationRequest, context: CodeContext) -> str:
        """Build prompt from template with context injection.

        Args:
            request: Code generation request
            context: Codebase context from ContextBuilder

        Returns:
            Rendered prompt with context injected
        """
        # Load template
        template_file = (
            "python_generation.txt"
            if request.target_language == "python"
            else "typescript_generation.txt"
        )
        template_path = self.prompts_dir / template_file
        template = template_path.read_text(encoding="utf-8")

        # Extract style guide based on language
        style = (
            context.backend_style if request.target_language == "python" else context.frontend_style
        )

        # Build reference patterns section
        reference_patterns = await self._format_reference_patterns(
            context.patterns[:3]  # Top 3 patterns
        )

        # Build similar code section
        similar_code = await self._format_similar_code(
            context.similar_files[:2],
            context,  # Top 2 similar files
        )

        # Build dependencies section
        dependencies = "\n".join(style.common_imports[:10])  # Top 10 imports

        # Render template
        prompt = template.format(
            requirement=request.requirement,
            framework=style.framework,
            orm=getattr(style, "orm", "N/A"),
            validation=style.validation_library or "N/A",
            ui_library=getattr(style, "ui_library", "N/A"),
            form_library=getattr(style, "form_library", "N/A"),
            naming_convention=style.naming_convention,
            style_guide=self._format_style_guide(style),
            reference_patterns=reference_patterns,
            similar_code=similar_code,
            dependencies=dependencies,
        )

        return prompt

    async def _format_reference_patterns(self, patterns: list) -> str:
        """Format code patterns for prompt."""
        if not patterns:
            return "No specific patterns detected."

        formatted = []
        for pattern in patterns:
            formatted.append(
                f"**{pattern.pattern_type}** (confidence: {pattern.confidence:.0%}):\n"
            )
            for example in pattern.examples[:3]:  # Top 3 examples
                formatted.append(f"  - {example}\n")

        return "".join(formatted)

    async def _format_similar_code(self, file_paths: list[str], context: CodeContext) -> str:
        """Format similar code snippets for prompt."""
        if not file_paths:
            return "No similar code found."

        formatted = []
        for file_path in file_paths:
            full_path = self.project_root / file_path
            if not full_path.exists():
                continue

            try:
                content = full_path.read_text(encoding="utf-8")
                # Take first 50 lines as example
                lines = content.split("\n")[:50]
                snippet = "\n".join(lines)

                formatted.append(f"### {file_path}\n```\n{snippet}\n```\n\n")
            except Exception:
                continue

        return "".join(formatted) if formatted else "No similar code found."

    def _format_style_guide(self, style) -> str:
        """Format style guide for prompt."""
        guide = f"Language: {style.language}\n"
        guide += f"Framework: {style.framework}\n"
        if style.ui_library:
            guide += f"UI Library: {style.ui_library}\n"
        if style.form_library:
            guide += f"Form Library: {style.form_library}\n"
        if style.validation_library:
            guide += f"Validation: {style.validation_library}\n"
        guide += f"Naming: {style.naming_convention}\n"
        guide += f"Reference Files: {', '.join(style.reference_files[:3])}\n"
        return guide

    # ========================================================================
    # LLM Integration
    # ========================================================================

    async def _call_llm(self, prompt: str, target_language: str) -> str:
        """Call Claude API to generate code.

        Args:
            prompt: Rendered prompt with context
            target_language: "python" or "typescript"

        Returns:
            Generated code as string

        Raises:
            Exception: If API call fails after retries
        """
        # Determine if this is a simple task (use Haiku for cost optimization)
        is_simple = len(prompt) < 2000 and "simple" in prompt.lower()
        model = self.fallback_model if is_simple else self.model

        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.messages.create(
                    model=model,
                    max_tokens=4096,
                    temperature=0.2,  # Low temperature for consistent code generation
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                )

                # Extract code from response
                generated_code = response.content[0].text.strip()

                # Remove markdown code fences if present
                generated_code = self._clean_generated_code(generated_code)

                return generated_code

            except anthropic.RateLimitError as e:
                if attempt < self.max_retries:
                    # Exponential backoff
                    import asyncio

                    await asyncio.sleep(2**attempt)
                    continue
                raise Exception(f"Rate limit exceeded: {str(e)}")

            except anthropic.APIError as e:
                if attempt < self.max_retries:
                    # Try fallback model
                    model = self.fallback_model
                    continue
                raise Exception(f"API error: {str(e)}")

            except Exception as e:
                if attempt < self.max_retries:
                    continue
                raise Exception(f"Code generation failed: {str(e)}")

        raise Exception("Code generation failed after all retries")

    def _clean_generated_code(self, code: str) -> str:
        """Remove markdown formatting from generated code.

        Args:
            code: Generated code potentially with markdown fences

        Returns:
            Clean code without markdown
        """
        # Remove triple backticks with language specifier
        code = re.sub(r"```(?:python|typescript|tsx|ts|javascript|jsx)?\n", "", code)
        code = re.sub(r"\n```$", "", code)
        code = code.strip()
        return code

    # ========================================================================
    # Syntax Validation
    # ========================================================================

    async def _validate_syntax(self, code: str, language: str) -> tuple[bool, list[str]]:
        """Validate generated code syntax.

        Args:
            code: Generated code
            language: "python" or "typescript"

        Returns:
            Tuple of (syntax_valid, imports_list)
        """
        if language == "python":
            return await self._validate_python_syntax(code)
        else:
            return await self._validate_typescript_syntax(code)

    async def _validate_python_syntax(self, code: str) -> tuple[bool, list[str]]:
        """Validate Python syntax using AST parsing.

        Args:
            code: Python code

        Returns:
            Tuple of (syntax_valid, imports_list)
        """
        imports = []

        try:
            tree = ast.parse(code)

            # Extract imports
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.append(node.module)

            # Check for hardcoded secrets (basic scan)
            if self._has_hardcoded_secrets(code):
                return False, imports

            return True, imports

        except SyntaxError:
            return False, []

    async def _validate_typescript_syntax(self, code: str) -> tuple[bool, list[str]]:
        """Validate TypeScript syntax (basic validation).

        Args:
            code: TypeScript code

        Returns:
            Tuple of (syntax_valid, imports_list)
        """
        imports = []

        try:
            # Extract imports using regex
            import_pattern = r'import\s+(?:{[^}]+}|\w+)\s+from\s+["\']([^"\']+)["\']'
            matches = re.findall(import_pattern, code)
            imports.extend(matches)

            # Basic syntax checks
            # Check for balanced braces
            if code.count("{") != code.count("}"):
                return False, imports

            # Check for balanced parentheses
            if code.count("(") != code.count(")"):
                return False, imports

            # Check for hardcoded secrets
            if self._has_hardcoded_secrets(code):
                return False, imports

            return True, imports

        except Exception:
            return False, []

    def _has_hardcoded_secrets(self, code: str) -> bool:
        """Check for hardcoded secrets in code.

        Args:
            code: Code to scan

        Returns:
            True if potential secrets found
        """
        # Patterns for common secrets
        secret_patterns = [
            r'api[_-]?key\s*=\s*["\'][^"\']{10,}["\']',
            r'secret[_-]?key\s*=\s*["\'][^"\']{10,}["\']',
            r'password\s*=\s*["\'][^"\']{5,}["\']',
            r'token\s*=\s*["\'][^"\']{10,}["\']',
        ]

        for pattern in secret_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return True

        return False

    # ========================================================================
    # File Path Inference
    # ========================================================================

    async def _infer_file_path(self, requirement: str, language: str, context: CodeContext) -> str:
        """Infer appropriate file path for generated code.

        Args:
            requirement: Natural language requirement
            language: "python" or "typescript"
            context: Codebase context

        Returns:
            Relative file path
        """
        # Simple heuristics for MVP
        if language == "python":
            # Check if it's a route/endpoint
            if any(word in requirement.lower() for word in ["endpoint", "route", "api"]):
                return "apps/backend/src/api/routes/generated_endpoint.py"
            # Service/business logic
            elif any(word in requirement.lower() for word in ["service", "logic", "process"]):
                return "apps/backend/src/services/generated_service.py"
            # Default
            else:
                return "apps/backend/src/generated_module.py"

        else:  # TypeScript
            # Check if it's a component
            if any(
                word in requirement.lower() for word in ["component", "form", "dialog", "modal"]
            ):
                return "apps/web/components/generated/GeneratedComponent.tsx"
            # Page
            elif "page" in requirement.lower():
                return "apps/web/app/(dashboard)/generated/page.tsx"
            # Default
            else:
                return "apps/web/components/generated/GeneratedModule.tsx"
