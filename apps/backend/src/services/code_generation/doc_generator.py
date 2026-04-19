"""AI-powered documentation generator using Claude.

Automatically generates comprehensive documentation including docstrings,
inline comments, and API documentation for generated code.
"""

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import anthropic

from .generator import GeneratedFile

# ============================================================================
# Documentation Generator
# ============================================================================


@dataclass
class DocGenerator:
    """AI-powered documentation generator using Claude.

    Analyzes generated code and creates comprehensive documentation following
    project conventions and best practices.

    Usage:
        generator = DocGenerator(project_root=Path("/path/to/project"))
        documented_code = await generator.generate_documentation(
            generated_file=GeneratedFile(...)
        )
    """

    project_root: Path
    anthropic_api_key: str | None = None
    model: str = "claude-opus-4-6"  # Claude Opus 4-6
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
        self.prompts_dir = Path(__file__).parent / "prompts"

    # ========================================================================
    # Main API
    # ========================================================================

    async def generate_documentation(
        self,
        generated_file: GeneratedFile,
        existing_examples: list[str] | None = None,
    ) -> str:
        """Generate documentation for a code file.

        Args:
            generated_file: The generated code file to document
            existing_examples: Optional examples of existing documentation

        Returns:
            Code with documentation added (docstrings, comments)
        """
        # Analyze code to determine documentation needs
        doc_needs = await self._analyze_documentation_needs(
            code=generated_file.content, language=generated_file.language
        )

        if not doc_needs["needs_documentation"]:
            # Code is already well-documented or doesn't need docs
            return generated_file.content

        # Build documentation generation prompt
        prompt = await self._build_documentation_prompt(
            code=generated_file.content,
            language=generated_file.language,
            doc_needs=doc_needs,
            existing_examples=existing_examples or [],
        )

        # Generate documentation using LLM
        documented_code = await self._call_llm(prompt)

        # Validate that documented code is still syntactically valid
        syntax_valid = await self._validate_documented_code(
            code=documented_code, language=generated_file.language
        )

        if not syntax_valid:
            # If documentation broke the code, return original
            return generated_file.content

        return documented_code

    # ========================================================================
    # Code Analysis
    # ========================================================================

    async def _analyze_documentation_needs(self, code: str, language: str) -> dict[str, Any]:
        """Analyze code to determine what documentation is needed.

        Args:
            code: Source code to analyze
            language: "python" or "typescript"

        Returns:
            Dict with documentation needs (functions, classes, complexity)
        """
        if language == "python":
            return await self._analyze_python_documentation_needs(code)
        else:
            return await self._analyze_typescript_documentation_needs(code)

    async def _analyze_python_documentation_needs(self, code: str) -> dict[str, Any]:
        """Analyze Python code for documentation needs.

        Args:
            code: Python source code

        Returns:
            Dict with undocumented functions, classes, endpoints
        """
        needs = {
            "needs_documentation": False,
            "undocumented_functions": [],
            "undocumented_classes": [],
            "undocumented_endpoints": [],
            "complex_logic": False,
        }

        try:
            tree = ast.parse(code)

            for node in ast.walk(tree):
                # Check functions for docstrings
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    has_docstring = (
                        ast.get_docstring(node) is not None and len(ast.get_docstring(node)) > 0
                    )

                    if not has_docstring:
                        needs["undocumented_functions"].append(node.name)
                        needs["needs_documentation"] = True

                    # Check for endpoint decorators
                    is_endpoint = any(
                        (
                            isinstance(dec, ast.Call)
                            and isinstance(dec.func, ast.Attribute)
                            and isinstance(dec.func.value, ast.Name)
                            and dec.func.value.id == "router"
                        )
                        for dec in node.decorator_list
                    )

                    if is_endpoint and not has_docstring:
                        needs["undocumented_endpoints"].append(node.name)

                # Check classes for docstrings
                elif isinstance(node, ast.ClassDef):
                    has_docstring = (
                        ast.get_docstring(node) is not None and len(ast.get_docstring(node)) > 0
                    )

                    if not has_docstring:
                        needs["undocumented_classes"].append(node.name)
                        needs["needs_documentation"] = True

                # Check for complex logic (nested loops, many conditions)
                elif isinstance(node, ast.For):
                    # Check for nested loops
                    for child in ast.walk(node):
                        if child != node and isinstance(child, (ast.For, ast.While)):
                            needs["complex_logic"] = True
                            needs["needs_documentation"] = True
                            break

        except SyntaxError:
            pass

        return needs

    async def _analyze_typescript_documentation_needs(self, code: str) -> dict[str, Any]:
        """Analyze TypeScript code for documentation needs.

        Args:
            code: TypeScript source code

        Returns:
            Dict with undocumented components, functions
        """
        needs = {
            "needs_documentation": False,
            "undocumented_components": [],
            "undocumented_functions": [],
            "complex_logic": False,
        }

        # Find components without JSDoc
        component_pattern = (
            r"(?:export\s+)?(?:function|const)\s+([A-Z]\w+)\s*(?:=\s*)?\([^)]*\)\s*(?::\s*\w+\s*)?{"
        )
        components = re.findall(component_pattern, code)

        for comp in components:
            # Check if component has JSDoc above it
            jsdoc_pattern = rf"/\*\*[\s\S]*?\*/\s*(?:export\s+)?(?:function|const)\s+{comp}"
            if not re.search(jsdoc_pattern, code):
                needs["undocumented_components"].append(comp)
                needs["needs_documentation"] = True

        # Find functions without JSDoc
        function_pattern = r"(?:export\s+)?(?:function|const)\s+([a-z]\w+)\s*(?:=\s*)?\("
        functions = re.findall(function_pattern, code)

        for func in functions:
            jsdoc_pattern = rf"/\*\*[\s\S]*?\*/\s*(?:export\s+)?(?:function|const)\s+{func}"
            if not re.search(jsdoc_pattern, code):
                needs["undocumented_functions"].append(func)
                needs["needs_documentation"] = True

        # Check for complex logic (nested callbacks, many conditions)
        if code.count("if") > 3 or code.count("=>") > 5:
            needs["complex_logic"] = True
            needs["needs_documentation"] = True

        return needs

    # ========================================================================
    # Prompt Building
    # ========================================================================

    async def _build_documentation_prompt(
        self,
        code: str,
        language: str,
        doc_needs: dict[str, Any],
        existing_examples: list[str],
    ) -> str:
        """Build prompt for documentation generation.

        Args:
            code: Source code to document
            language: "python" or "typescript"
            doc_needs: Analysis of documentation needs
            existing_examples: Examples of existing documentation

        Returns:
            Rendered prompt for documentation generation
        """
        # Load template
        template_path = self.prompts_dir / "doc_generation.txt"
        template = template_path.read_text(encoding="utf-8")

        # Determine documentation style
        if language == "python":
            documentation_style = "Google-style docstrings for Python"
        else:
            documentation_style = "JSDoc for TypeScript/JavaScript"

        # Format existing examples
        examples_str = (
            "\n\n".join(existing_examples[:2])
            if existing_examples
            else "No existing examples provided. Follow standard conventions."
        )

        # Render template
        prompt = template.format(
            code_to_document=code,
            language=language,
            documentation_style=documentation_style,
            existing_examples=examples_str,
        )

        return prompt

    # ========================================================================
    # LLM Integration
    # ========================================================================

    async def _call_llm(self, prompt: str) -> str:
        """Call Claude API to generate documentation.

        Args:
            prompt: Rendered documentation generation prompt

        Returns:
            Code with documentation added
        """
        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    temperature=0.2,  # Low temperature for consistent documentation
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                )

                # Extract documented code from response
                documented_code = response.content[0].text.strip()

                # Remove markdown code fences if present
                documented_code = self._clean_generated_code(documented_code)

                return documented_code

            except anthropic.RateLimitError as e:
                if attempt < self.max_retries:
                    import asyncio

                    await asyncio.sleep(2**attempt)
                    continue
                raise Exception(f"Rate limit exceeded: {str(e)}")

            except anthropic.APIError as e:
                if attempt < self.max_retries:
                    continue
                raise Exception(f"API error: {str(e)}")

            except Exception as e:
                if attempt < self.max_retries:
                    continue
                raise Exception(f"Documentation generation failed: {str(e)}")

        raise Exception("Documentation generation failed after all retries")

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
    # Validation
    # ========================================================================

    async def _validate_documented_code(self, code: str, language: str) -> bool:
        """Validate that documented code is still syntactically valid.

        Args:
            code: Documented code
            language: "python" or "typescript"

        Returns:
            True if syntax is valid
        """
        if language == "python":
            try:
                ast.parse(code)
                return True
            except SyntaxError:
                return False
        else:
            # Basic TypeScript validation
            try:
                # Check balanced braces and parentheses
                if code.count("{") != code.count("}"):
                    return False
                if code.count("(") != code.count(")"):
                    return False
                return True
            except Exception:
                return False
