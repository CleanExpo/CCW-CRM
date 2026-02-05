"""Tests for Code Generator.

Tests AI-powered code generation with Claude, including prompt engineering,
syntax validation, and error handling.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.services.code_generation.generator import (
    CodeGenerationRequest,
    CodeGenerationResult,
    CodeGenerator,
    GeneratedFile,
    QualityReport,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def project_root():
    """Project root directory."""
    return Path(__file__).parents[5]


@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="# Generated code\nprint('Hello, World!')")]
    mock_client.messages.create.return_value = mock_response
    return mock_client


@pytest.fixture
def code_generator(project_root, mock_anthropic_client):
    """CodeGenerator instance with mocked client."""
    generator = CodeGenerator(project_root=project_root, anthropic_api_key="test-key-123")
    generator.client = mock_anthropic_client
    return generator


# ============================================================================
# Initialization Tests
# ============================================================================


def test_code_generator_initialization(project_root):
    """Test CodeGenerator initializes correctly."""
    generator = CodeGenerator(project_root=project_root, anthropic_api_key="test-key")

    assert generator.project_root == project_root
    assert generator.model == "claude-opus-4-6"
    assert generator.fallback_model == "claude-haiku-4-20250910"
    assert generator.max_retries == 2


def test_code_generator_requires_api_key(project_root):
    """Test that API key is required."""
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            CodeGenerator(project_root=project_root)


def test_code_generator_uses_env_var_api_key(project_root):
    """Test that API key can come from environment variable."""
    with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "env-key-123"}):
        generator = CodeGenerator(project_root=project_root)
        # Should not raise


# ============================================================================
# Data Model Tests
# ============================================================================


def test_code_generation_request_validation():
    """Test CodeGenerationRequest Pydantic validation."""
    request = CodeGenerationRequest(
        requirement="Add a product endpoint",
        target_language="python",
        generation_type="feature",
    )

    assert request.requirement == "Add a product endpoint"
    assert request.target_language == "python"
    assert request.generation_type == "feature"
    assert request.context == {}
    assert request.reference_files == []


def test_generated_file_validation():
    """Test GeneratedFile Pydantic validation."""
    file = GeneratedFile(
        file_path="test.py",
        content="print('hello')",
        language="python",
        syntax_valid=True,
        imports=["os", "sys"],
    )

    assert file.file_path == "test.py"
    assert file.syntax_valid is True
    assert len(file.imports) == 2


def test_quality_report_validation():
    """Test QualityReport Pydantic validation."""
    report = QualityReport(
        linting_passed=True,
        type_check_passed=True,
        security_issues=[],
    )

    assert report.linting_passed is True
    assert report.type_check_passed is True


def test_code_generation_result_validation():
    """Test CodeGenerationResult Pydantic validation."""
    file = GeneratedFile(
        file_path="test.py",
        content="code",
        language="python",
        syntax_valid=True,
    )
    report = QualityReport()

    result = CodeGenerationResult(generated_files=[file], quality_report=report, pr_ready=True)

    assert len(result.generated_files) == 1
    assert result.pr_ready is True


# ============================================================================
# Code Generation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_generate_python_code(code_generator, mock_anthropic_client):
    """Test generating Python code."""
    request = CodeGenerationRequest(
        requirement="Create a product endpoint",
        target_language="python",
    )

    # Mock valid Python code response
    mock_anthropic_client.messages.create.return_value.content[0].text = """
from fastapi import APIRouter

router = APIRouter()

@router.get("/products")
async def get_products():
    return {"products": []}
"""

    result = await code_generator.generate(request)

    assert isinstance(result, CodeGenerationResult)
    assert len(result.generated_files) == 1
    assert result.generated_files[0].language == "python"
    assert result.generated_files[0].syntax_valid is True


@pytest.mark.asyncio
async def test_generate_typescript_code(code_generator, mock_anthropic_client):
    """Test generating TypeScript code."""
    request = CodeGenerationRequest(
        requirement="Create a product form component",
        target_language="typescript",
    )

    # Mock valid TypeScript code response
    mock_anthropic_client.messages.create.return_value.content[0].text = """
"use client";

import { useState } from "react";

export function ProductForm() {
    const [name, setName] = useState("");
    return <div>Form</div>;
}
"""

    result = await code_generator.generate(request)

    assert isinstance(result, CodeGenerationResult)
    assert len(result.generated_files) == 1
    assert result.generated_files[0].language == "typescript"


@pytest.mark.asyncio
async def test_generate_with_reference_files(code_generator, mock_anthropic_client):
    """Test code generation with specific reference files."""
    request = CodeGenerationRequest(
        requirement="Create an orders endpoint",
        target_language="python",
        reference_files=["apps/backend/src/api/routes/orders.py"],
    )

    mock_anthropic_client.messages.create.return_value.content[0].text = "def test(): pass"

    result = await code_generator.generate(request)

    assert isinstance(result, CodeGenerationResult)
    # Context builder should have been called with reference files
    assert len(result.generated_files) > 0


# ============================================================================
# Prompt Building Tests
# ============================================================================


@pytest.mark.asyncio
async def test_build_prompt_python(code_generator):
    """Test building Python generation prompt."""
    from src.services.code_generation.context_builder import (
        CodeContext,
        ProjectStructure,
        StyleGuide,
    )

    request = CodeGenerationRequest(requirement="Add endpoint", target_language="python")

    context = CodeContext(
        structure=ProjectStructure.from_project_root(code_generator.project_root),
        patterns=[],
        backend_style=StyleGuide(
            language="python",
            framework="FastAPI",
            naming_convention="snake_case",
        ),
        frontend_style=StyleGuide(
            language="typescript",
            framework="Next.js",
            naming_convention="PascalCase",
        ),
    )

    prompt = await code_generator._build_prompt(request, context)

    assert isinstance(prompt, str)
    assert "FastAPI" in prompt
    assert "Add endpoint" in prompt
    assert "snake_case" in prompt


@pytest.mark.asyncio
async def test_build_prompt_typescript(code_generator):
    """Test building TypeScript generation prompt."""
    from src.services.code_generation.context_builder import (
        CodeContext,
        ProjectStructure,
        StyleGuide,
    )

    request = CodeGenerationRequest(requirement="Add form", target_language="typescript")

    context = CodeContext(
        structure=ProjectStructure.from_project_root(code_generator.project_root),
        patterns=[],
        backend_style=StyleGuide(
            language="python",
            framework="FastAPI",
            naming_convention="snake_case",
        ),
        frontend_style=StyleGuide(
            language="typescript",
            framework="Next.js",
            ui_library="shadcn/ui",
            naming_convention="PascalCase",
        ),
    )

    prompt = await code_generator._build_prompt(request, context)

    assert isinstance(prompt, str)
    assert "Next.js" in prompt
    assert "shadcn/ui" in prompt
    assert "Add form" in prompt


# ============================================================================
# Syntax Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_validate_python_syntax_valid(code_generator):
    """Test validating valid Python syntax."""
    code = """
import os
from typing import List

def hello(name: str) -> str:
    return f"Hello, {name}!"
"""

    valid, imports = await code_generator._validate_python_syntax(code)

    assert valid is True
    assert "os" in imports
    assert "typing" in imports


@pytest.mark.asyncio
async def test_validate_python_syntax_invalid(code_generator):
    """Test validating invalid Python syntax."""
    code = """
def broken_function(
    # Missing closing parenthesis
    return "broken"
"""

    valid, imports = await code_generator._validate_python_syntax(code)

    assert valid is False


@pytest.mark.asyncio
async def test_validate_typescript_syntax_valid(code_generator):
    """Test validating valid TypeScript syntax."""
    code = """
import { useState } from "react";

export function Component() {
    const [value, setValue] = useState("");
    return <div>{value}</div>;
}
"""

    valid, imports = await code_generator._validate_typescript_syntax(code)

    assert valid is True
    assert "react" in imports


@pytest.mark.asyncio
async def test_validate_typescript_syntax_unbalanced_braces(code_generator):
    """Test detecting unbalanced braces in TypeScript."""
    code = """
function broken() {
    if (true) {
        return "missing closing brace";
    }
// Missing closing brace for function
"""

    valid, imports = await code_generator._validate_typescript_syntax(code)

    assert valid is False


@pytest.mark.asyncio
async def test_detect_hardcoded_secrets_api_key(code_generator):
    """Test detecting hardcoded API keys."""
    code = 'api_key = "sk-1234567890abcdefghij"'

    has_secrets = code_generator._has_hardcoded_secrets(code)

    assert has_secrets is True


@pytest.mark.asyncio
async def test_detect_hardcoded_secrets_password(code_generator):
    """Test detecting hardcoded passwords."""
    code = 'password = "super_secret_123"'

    has_secrets = code_generator._has_hardcoded_secrets(code)

    assert has_secrets is True


@pytest.mark.asyncio
async def test_no_false_positive_for_safe_code(code_generator):
    """Test no false positives for safe code."""
    code = """
api_key = os.getenv("API_KEY")
password = config.get("password")
"""

    has_secrets = code_generator._has_hardcoded_secrets(code)

    assert has_secrets is False


# ============================================================================
# LLM Integration Tests
# ============================================================================


@pytest.mark.asyncio
async def test_call_llm_success(code_generator, mock_anthropic_client):
    """Test successful LLM call."""
    mock_anthropic_client.messages.create.return_value.content[0].text = "def test(): pass"

    result = await code_generator._call_llm(prompt="Generate code", target_language="python")

    assert result == "def test(): pass"
    mock_anthropic_client.messages.create.assert_called_once()


@pytest.mark.asyncio
async def test_call_llm_removes_markdown(code_generator, mock_anthropic_client):
    """Test that LLM removes markdown code fences."""
    mock_anthropic_client.messages.create.return_value.content[0].text = """```python
def test():
    pass
```"""

    result = await code_generator._call_llm(prompt="Generate code", target_language="python")

    assert result == "def test():\n    pass"
    assert "```" not in result


@pytest.mark.asyncio
async def test_call_llm_uses_fallback_for_simple_tasks(code_generator, mock_anthropic_client):
    """Test that simple tasks use Haiku model."""
    mock_anthropic_client.messages.create.return_value.content[0].text = "code"

    await code_generator._call_llm(prompt="Simple code generation task", target_language="python")

    # Should use fallback model for simple tasks
    call_args = mock_anthropic_client.messages.create.call_args
    assert call_args[1]["model"] == code_generator.fallback_model


@pytest.mark.asyncio
async def test_call_llm_retries_on_rate_limit(code_generator, mock_anthropic_client):
    """Test retry logic on rate limit error."""
    import anthropic

    # First call raises rate limit, second succeeds
    mock_anthropic_client.messages.create.side_effect = [
        anthropic.RateLimitError("Rate limited", response=MagicMock(), body=None),
        MagicMock(content=[MagicMock(text="def test(): pass")]),
    ]

    result = await code_generator._call_llm(prompt="Generate code", target_language="python")

    assert result == "def test(): pass"
    assert mock_anthropic_client.messages.create.call_count == 2


# ============================================================================
# File Path Inference Tests
# ============================================================================


@pytest.mark.asyncio
async def test_infer_file_path_python_endpoint(code_generator):
    """Test inferring file path for Python endpoint."""
    from src.services.code_generation.context_builder import (
        CodeContext,
        ProjectStructure,
        StyleGuide,
    )

    context = CodeContext(
        structure=ProjectStructure.from_project_root(code_generator.project_root),
        patterns=[],
        backend_style=StyleGuide(
            language="python", framework="FastAPI", naming_convention="snake_case"
        ),
        frontend_style=StyleGuide(
            language="typescript", framework="Next.js", naming_convention="PascalCase"
        ),
    )

    path = await code_generator._infer_file_path(
        requirement="Add API endpoint for products",
        language="python",
        context=context,
    )

    assert "routes" in path
    assert path.endswith(".py")


@pytest.mark.asyncio
async def test_infer_file_path_typescript_component(code_generator):
    """Test inferring file path for TypeScript component."""
    from src.services.code_generation.context_builder import (
        CodeContext,
        ProjectStructure,
        StyleGuide,
    )

    context = CodeContext(
        structure=ProjectStructure.from_project_root(code_generator.project_root),
        patterns=[],
        backend_style=StyleGuide(
            language="python", framework="FastAPI", naming_convention="snake_case"
        ),
        frontend_style=StyleGuide(
            language="typescript", framework="Next.js", naming_convention="PascalCase"
        ),
    )

    path = await code_generator._infer_file_path(
        requirement="Create form component",
        language="typescript",
        context=context,
    )

    assert "components" in path
    assert path.endswith(".tsx")


# ============================================================================
# Helper Method Tests
# ============================================================================


def test_clean_generated_code_removes_fences(code_generator):
    """Test cleaning markdown fences from code."""
    code = """```python
def test():
    pass
```"""

    cleaned = code_generator._clean_generated_code(code)

    assert cleaned == "def test():\n    pass"


def test_clean_generated_code_handles_no_fences(code_generator):
    """Test cleaning code without fences."""
    code = "def test():\n    pass"

    cleaned = code_generator._clean_generated_code(code)

    assert cleaned == "def test():\n    pass"
