"""AI-powered test generator using Claude.

Automatically generates comprehensive unit, integration, and component tests
for generated code using Claude with project-specific patterns.
"""

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import anthropic

from .generator import GeneratedFile

# ============================================================================
# Test Generator
# ============================================================================


@dataclass
class TestGenerator:
    """AI-powered test generator using Claude.

    Analyzes generated code and creates comprehensive tests following
    project conventions and best practices.

    Usage:
        generator = TestGenerator(project_root=Path("/path/to/project"))
        tests = await generator.generate_tests(
            generated_file=GeneratedFile(...),
            test_type="unit"
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

    async def generate_tests(
        self,
        generated_file: GeneratedFile,
        test_type: str = "unit",
        existing_patterns: list[str] | None = None,
    ) -> list[GeneratedFile]:
        """Generate tests for a generated code file.

        Args:
            generated_file: The generated code file to create tests for
            test_type: "unit", "integration", or "component"
            existing_patterns: Optional list of existing test patterns

        Returns:
            List of GeneratedFile objects containing test code
        """
        # Analyze code to determine what to test
        test_targets = await self._analyze_code(
            code=generated_file.content, language=generated_file.language
        )

        # Check if there are any testable elements
        has_testable_elements = any(len(targets) > 0 for targets in test_targets.values())

        if not has_testable_elements:
            # No testable code found
            return []

        # Build test generation prompt
        prompt = await self._build_test_prompt(
            code=generated_file.content,
            language=generated_file.language,
            test_type=test_type,
            test_targets=test_targets,
            existing_patterns=existing_patterns or [],
        )

        # Generate tests using LLM
        generated_tests = await self._call_llm(prompt)

        # Validate syntax
        syntax_valid, imports = await self._validate_test_syntax(
            tests=generated_tests, language=generated_file.language
        )

        # Determine test file path
        test_file_path = self._infer_test_file_path(
            source_file=generated_file.file_path, language=generated_file.language
        )

        # Create test file
        test_file = GeneratedFile(
            file_path=test_file_path,
            content=generated_tests,
            language=generated_file.language,
            file_type="test",
            syntax_valid=syntax_valid,
            imports=imports,
        )

        return [test_file]

    # ========================================================================
    # Code Analysis
    # ========================================================================

    async def _analyze_code(self, code: str, language: str) -> dict[str, Any]:
        """Analyze code to identify what needs testing.

        Args:
            code: Source code to analyze
            language: "python" or "typescript"

        Returns:
            Dictionary of test targets (functions, endpoints, components)
        """
        if language == "python":
            return await self._analyze_python_code(code)
        else:
            return await self._analyze_typescript_code(code)

    async def _analyze_python_code(self, code: str) -> dict[str, Any]:
        """Analyze Python code to find testable elements.

        Args:
            code: Python source code

        Returns:
            Dict with functions, endpoints, classes
        """
        targets = {
            "functions": [],
            "async_functions": [],
            "endpoints": [],
            "classes": [],
        }

        try:
            tree = ast.parse(code)

            for node in ast.walk(tree):
                # Find function definitions (both sync and async)
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    func_name = node.name
                    is_async = isinstance(node, ast.AsyncFunctionDef)

                    # Check if it's an API endpoint (@router.get, @router.post, etc.)
                    is_endpoint = False
                    for dec in node.decorator_list:
                        # Handle both @router.get and @router.get("/path")
                        if isinstance(dec, ast.Call):
                            # Decorator with arguments like @router.get("/path")
                            if (
                                isinstance(dec.func, ast.Attribute)
                                and isinstance(dec.func.value, ast.Name)
                                and dec.func.value.id == "router"
                                and dec.func.attr in ["get", "post", "put", "delete", "patch"]
                            ):
                                is_endpoint = True
                                break
                        elif isinstance(dec, ast.Attribute):
                            # Decorator without arguments like @router.get
                            if (
                                isinstance(dec.value, ast.Name)
                                and dec.value.id == "router"
                                and dec.attr in ["get", "post", "put", "delete", "patch"]
                            ):
                                is_endpoint = True
                                break

                    if is_endpoint:
                        targets["endpoints"].append(func_name)
                    elif is_async:
                        targets["async_functions"].append(func_name)
                    else:
                        targets["functions"].append(func_name)

                # Find class definitions
                elif isinstance(node, ast.ClassDef):
                    targets["classes"].append(node.name)

        except SyntaxError:
            pass

        return targets

    async def _analyze_typescript_code(self, code: str) -> dict[str, Any]:
        """Analyze TypeScript code to find testable elements.

        Args:
            code: TypeScript source code

        Returns:
            Dict with components, functions, hooks
        """
        targets = {
            "components": [],
            "functions": [],
            "hooks": [],
        }

        # Find React components (function components)
        component_pattern = r"(?:export\s+)?(?:function|const)\s+([A-Z]\w+)\s*(?:=\s*\([^)]*\)\s*=>|\([^)]*\))\s*(?::\s*\w+\s*)?{[^}]*(?:return|<)"
        components = re.findall(component_pattern, code)
        targets["components"].extend(components)

        # Find custom hooks
        hook_pattern = r"(?:export\s+)?(?:function|const)\s+(use[A-Z]\w+)"
        hooks = re.findall(hook_pattern, code)
        targets["hooks"].extend(hooks)

        # Find regular functions (both function declarations and arrow functions)
        function_declarations = re.findall(r"(?:export\s+)?function\s+([a-z]\w+)\s*\(", code)
        arrow_functions = re.findall(r"(?:export\s+)?const\s+([a-z]\w+)\s*=\s*\(", code)
        functions = function_declarations + arrow_functions
        # Filter out components and hooks
        functions = [
            f
            for f in functions
            if f not in components and f not in hooks and not f.startswith("use")
        ]
        targets["functions"].extend(functions)

        return targets

    # ========================================================================
    # Prompt Building
    # ========================================================================

    async def _build_test_prompt(
        self,
        code: str,
        language: str,
        test_type: str,
        test_targets: dict[str, Any],
        existing_patterns: list[str],
    ) -> str:
        """Build prompt for test generation.

        Args:
            code: Source code to test
            language: "python" or "typescript"
            test_type: "unit", "integration", or "component"
            test_targets: Analyzed test targets
            existing_patterns: Existing test patterns to follow

        Returns:
            Rendered prompt for test generation
        """
        # Load template
        template_path = self.prompts_dir / "test_generation.txt"
        template = template_path.read_text(encoding="utf-8")

        # Determine testing framework
        if language == "python":
            testing_framework = "pytest (async support with pytest-asyncio)"
            naming_convention = "snake_case (test_function_name_scenario)"
        else:
            testing_framework = "Vitest + React Testing Library"
            naming_convention = "describe/it blocks with descriptive strings"

        # Format existing patterns
        patterns_str = (
            "\n".join(existing_patterns[:3])
            if existing_patterns
            else "No existing patterns provided"
        )

        # Render template
        prompt = template.format(
            code_to_test=code,
            language=language,
            test_type=test_type,
            testing_framework=testing_framework,
            naming_convention=naming_convention,
            existing_patterns=patterns_str,
        )

        return prompt

    # ========================================================================
    # LLM Integration
    # ========================================================================

    async def _call_llm(self, prompt: str) -> str:
        """Call Claude API to generate tests.

        Args:
            prompt: Rendered test generation prompt

        Returns:
            Generated test code as string
        """
        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    temperature=0.3,  # Slightly higher for diverse test cases
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                )

                # Extract test code from response
                generated_tests = response.content[0].text.strip()

                # Remove markdown code fences if present
                generated_tests = self._clean_generated_code(generated_tests)

                return generated_tests

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
                raise Exception(f"Test generation failed: {str(e)}")

        raise Exception("Test generation failed after all retries")

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

    async def _validate_test_syntax(self, tests: str, language: str) -> tuple[bool, list[str]]:
        """Validate generated test syntax.

        Args:
            tests: Generated test code
            language: "python" or "typescript"

        Returns:
            Tuple of (syntax_valid, imports_list)
        """
        imports = []

        if language == "python":
            try:
                tree = ast.parse(tests)

                # Extract imports
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            imports.append(alias.name)
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            imports.append(node.module)

                return True, imports

            except SyntaxError:
                return False, []

        else:  # TypeScript
            try:
                # Extract imports using regex
                import_pattern = r'import\s+(?:{[^}]+}|\w+)\s+from\s+["\']([^"\']+)["\']'
                matches = re.findall(import_pattern, tests)
                imports.extend(matches)

                # Basic syntax checks
                if tests.count("{") != tests.count("}"):
                    return False, imports
                if tests.count("(") != tests.count(")"):
                    return False, imports

                return True, imports

            except Exception:
                return False, []

    # ========================================================================
    # File Path Inference
    # ========================================================================

    def _infer_test_file_path(self, source_file: str, language: str) -> str:
        """Infer test file path from source file path.

        Args:
            source_file: Source code file path
            language: "python" or "typescript"

        Returns:
            Test file path
        """
        source_path = Path(source_file)

        if language == "python":
            # Python: apps/backend/src/module.py -> apps/backend/tests/test_module.py
            if "src" in source_path.parts:
                # Replace src with tests and add test_ prefix
                parts = list(source_path.parts)
                src_index = parts.index("src")
                parts[src_index] = "tests"
                parts[-1] = f"test_{parts[-1]}"
                return str(Path(*parts))
            else:
                return f"apps/backend/tests/test_{source_path.name}"

        else:  # TypeScript
            # TypeScript: apps/web/components/Component.tsx -> apps/web/__tests__/components/Component.test.tsx
            if "components" in source_path.parts or "app" in source_path.parts:
                # Add __tests__ directory and .test suffix
                stem = source_path.stem
                suffix = source_path.suffix
                parent_parts = list(source_path.parent.parts)

                # Find apps/web and add __tests__ after it
                if "web" in parent_parts:
                    web_index = parent_parts.index("web")
                    parent_parts.insert(web_index + 1, "__tests__")

                return str(Path(*parent_parts) / f"{stem}.test{suffix}")
            else:
                return f"apps/web/__tests__/{source_path.stem}.test{source_path.suffix}"
