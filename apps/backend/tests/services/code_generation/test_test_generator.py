"""Tests for Test Generator.

Tests AI-powered test generation for Python and TypeScript code.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.services.code_generation.generator import GeneratedFile
from src.services.code_generation.test_generator import TestGenerator

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
    mock_response.content = [
        MagicMock(text="import pytest\n\ndef test_example():\n    assert True")
    ]
    mock_client.messages.create.return_value = mock_response
    return mock_client


@pytest.fixture
def test_generator(project_root, mock_anthropic_client):
    """TestGenerator instance with mocked client."""
    generator = TestGenerator(project_root=project_root, anthropic_api_key="test-key-123")
    generator.client = mock_anthropic_client
    return generator


# ============================================================================
# Initialization Tests
# ============================================================================


def test_test_generator_initialization(project_root):
    """Test TestGenerator initializes correctly."""
    generator = TestGenerator(project_root=project_root, anthropic_api_key="test-key")

    assert generator.project_root == project_root
    assert generator.model == "claude-opus-4-6"
    assert generator.max_retries == 2


def test_test_generator_requires_api_key(project_root):
    """Test that API key is required."""
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            TestGenerator(project_root=project_root)


# ============================================================================
# Code Analysis Tests - Python
# ============================================================================


@pytest.mark.asyncio
async def test_analyze_python_code_functions(test_generator):
    """Test analyzing Python code for functions."""
    code = """
def hello(name: str) -> str:
    return f"Hello, {name}!"

def goodbye(name: str) -> str:
    return f"Goodbye, {name}!"
"""

    targets = await test_generator._analyze_python_code(code)

    assert "hello" in targets["functions"]
    assert "goodbye" in targets["functions"]
    assert len(targets["async_functions"]) == 0
    assert len(targets["endpoints"]) == 0


@pytest.mark.asyncio
async def test_analyze_python_code_async_functions(test_generator):
    """Test analyzing Python async functions."""
    code = """
async def fetch_data() -> dict:
    return {"data": "value"}

async def save_data(data: dict) -> None:
    pass
"""

    targets = await test_generator._analyze_python_code(code)

    assert "fetch_data" in targets["async_functions"]
    assert "save_data" in targets["async_functions"]
    assert len(targets["functions"]) == 0


@pytest.mark.asyncio
async def test_analyze_python_code_endpoints(test_generator):
    """Test analyzing Python API endpoints."""
    code = """
from fastapi import APIRouter

router = APIRouter()

@router.get("/products")
async def get_products():
    return []

@router.post("/products")
async def create_product(data: dict):
    return data
"""

    targets = await test_generator._analyze_python_code(code)

    assert "get_products" in targets["endpoints"]
    assert "create_product" in targets["endpoints"]


@pytest.mark.asyncio
async def test_analyze_python_code_classes(test_generator):
    """Test analyzing Python classes."""
    code = """
class Product:
    def __init__(self, name: str):
        self.name = name

class Order:
    pass
"""

    targets = await test_generator._analyze_python_code(code)

    assert "Product" in targets["classes"]
    assert "Order" in targets["classes"]


# ============================================================================
# Code Analysis Tests - TypeScript
# ============================================================================


@pytest.mark.asyncio
async def test_analyze_typescript_code_components(test_generator):
    """Test analyzing TypeScript React components."""
    code = """
export function ProductForm() {
    return <div>Form</div>;
}

const OrderList = () => {
    return <ul></ul>;
};
"""

    targets = await test_generator._analyze_typescript_code(code)

    assert "ProductForm" in targets["components"]
    assert "OrderList" in targets["components"]


@pytest.mark.asyncio
async def test_analyze_typescript_code_hooks(test_generator):
    """Test analyzing TypeScript custom hooks."""
    code = """
export function useProducts() {
    const [products, setProducts] = useState([]);
    return products;
}

const useOrders = () => {
    return [];
};
"""

    targets = await test_generator._analyze_typescript_code(code)

    assert "useProducts" in targets["hooks"]
    assert "useOrders" in targets["hooks"]


@pytest.mark.asyncio
async def test_analyze_typescript_code_functions(test_generator):
    """Test analyzing TypeScript regular functions."""
    code = """
export function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + item.price, 0);
}

const formatDate = (date: Date): string => {
    return date.toISOString();
};
"""

    targets = await test_generator._analyze_typescript_code(code)

    assert "calculateTotal" in targets["functions"]
    assert "formatDate" in targets["functions"]


# ============================================================================
# Test Generation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_generate_tests_python_function(test_generator, mock_anthropic_client):
    """Test generating tests for Python function."""
    source_file = GeneratedFile(
        file_path="apps/backend/src/module.py",
        content="def add(a: int, b: int) -> int:\n    return a + b",
        language="python",
        syntax_valid=True,
    )

    mock_anthropic_client.messages.create.return_value.content[0].text = """
import pytest

def test_add_success():
    result = add(2, 3)
    assert result == 5

def test_add_negative():
    result = add(-1, 1)
    assert result == 0
"""

    tests = await test_generator.generate_tests(source_file)

    assert len(tests) == 1
    assert tests[0].language == "python"
    assert tests[0].file_type == "test"
    assert "test_add_success" in tests[0].content


@pytest.mark.asyncio
async def test_generate_tests_python_endpoint(test_generator, mock_anthropic_client):
    """Test generating tests for Python API endpoint."""
    source_file = GeneratedFile(
        file_path="apps/backend/src/api/routes/products.py",
        content="""
@router.get("/products")
async def get_products():
    return []
""",
        language="python",
        syntax_valid=True,
    )

    mock_anthropic_client.messages.create.return_value.content[0].text = """
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_products(client: AsyncClient):
    response = await client.get("/products")
    assert response.status_code == 200
"""

    tests = await test_generator.generate_tests(source_file)

    assert len(tests) == 1
    assert "@pytest.mark.asyncio" in tests[0].content


@pytest.mark.asyncio
async def test_generate_tests_typescript_component(test_generator, mock_anthropic_client):
    """Test generating tests for TypeScript component."""
    source_file = GeneratedFile(
        file_path="apps/web/components/ProductForm.tsx",
        content="""
export function ProductForm() {
    return <form>Product Form</form>;
}
""",
        language="typescript",
        syntax_valid=True,
    )

    mock_anthropic_client.messages.create.return_value.content[0].text = """
import { render, screen } from '@testing-library/react';
import { ProductForm } from './ProductForm';

describe('ProductForm', () => {
    it('renders form', () => {
        render(<ProductForm />);
        expect(screen.getByText('Product Form')).toBeInTheDocument();
    });
});
"""

    tests = await test_generator.generate_tests(source_file)

    assert len(tests) == 1
    assert tests[0].language == "typescript"
    assert "describe" in tests[0].content


@pytest.mark.asyncio
async def test_generate_tests_no_testable_code(test_generator):
    """Test handling code with no testable elements."""
    source_file = GeneratedFile(
        file_path="apps/backend/src/config.py",
        content="API_KEY = 'value'",
        language="python",
        syntax_valid=True,
    )

    tests = await test_generator.generate_tests(source_file)

    # Should return empty list for non-testable code
    assert len(tests) == 0


# ============================================================================
# Prompt Building Tests
# ============================================================================


@pytest.mark.asyncio
async def test_build_test_prompt_python(test_generator):
    """Test building test generation prompt for Python."""
    code = "def test(): pass"
    targets = {"functions": ["test"], "async_functions": [], "endpoints": []}

    prompt = await test_generator._build_test_prompt(
        code=code,
        language="python",
        test_type="unit",
        test_targets=targets,
        existing_patterns=[],
    )

    assert isinstance(prompt, str)
    assert "pytest" in prompt
    assert "def test(): pass" in prompt


@pytest.mark.asyncio
async def test_build_test_prompt_typescript(test_generator):
    """Test building test generation prompt for TypeScript."""
    code = "function Component() { return null; }"
    targets = {"components": ["Component"], "functions": [], "hooks": []}

    prompt = await test_generator._build_test_prompt(
        code=code,
        language="typescript",
        test_type="component",
        test_targets=targets,
        existing_patterns=[],
    )

    assert isinstance(prompt, str)
    assert "Vitest" in prompt
    assert "React Testing Library" in prompt


# ============================================================================
# Syntax Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_validate_test_syntax_python_valid(test_generator):
    """Test validating valid Python test syntax."""
    tests = """
import pytest

def test_example():
    assert True
"""

    valid, imports = await test_generator._validate_test_syntax(tests, "python")

    assert valid is True
    assert "pytest" in imports


@pytest.mark.asyncio
async def test_validate_test_syntax_python_invalid(test_generator):
    """Test validating invalid Python test syntax."""
    tests = """
def broken_test(
    # Missing closing parenthesis
"""

    valid, imports = await test_generator._validate_test_syntax(tests, "python")

    assert valid is False


@pytest.mark.asyncio
async def test_validate_test_syntax_typescript_valid(test_generator):
    """Test validating valid TypeScript test syntax."""
    tests = """
import { describe, it, expect } from 'vitest';

describe('test', () => {
    it('works', () => {
        expect(true).toBe(true);
    });
});
"""

    valid, imports = await test_generator._validate_test_syntax(tests, "typescript")

    assert valid is True
    assert "vitest" in imports


@pytest.mark.asyncio
async def test_validate_test_syntax_typescript_unbalanced(test_generator):
    """Test detecting unbalanced braces in TypeScript tests."""
    tests = """
describe('test', () => {
    it('broken', () => {
        // Missing closing brace
    }
"""

    valid, imports = await test_generator._validate_test_syntax(tests, "typescript")

    assert valid is False


# ============================================================================
# File Path Inference Tests
# ============================================================================


def test_infer_test_file_path_python(test_generator):
    """Test inferring test file path for Python."""
    source_file = "apps/backend/src/services/module.py"

    test_path = test_generator._infer_test_file_path(source_file, "python")

    assert "tests" in test_path
    assert "test_module.py" in test_path
    assert "src" not in test_path


def test_infer_test_file_path_typescript_component(test_generator):
    """Test inferring test file path for TypeScript component."""
    source_file = "apps/web/components/ProductForm.tsx"

    test_path = test_generator._infer_test_file_path(source_file, "typescript")

    assert "__tests__" in test_path
    assert "ProductForm.test.tsx" in test_path


def test_infer_test_file_path_typescript_page(test_generator):
    """Test inferring test file path for TypeScript page."""
    source_file = "apps/web/app/(dashboard)/products/page.tsx"

    test_path = test_generator._infer_test_file_path(source_file, "typescript")

    assert "__tests__" in test_path
    assert "page.test.tsx" in test_path


# ============================================================================
# LLM Integration Tests
# ============================================================================


@pytest.mark.asyncio
async def test_call_llm_removes_markdown(test_generator, mock_anthropic_client):
    """Test that LLM removes markdown code fences."""
    mock_anthropic_client.messages.create.return_value.content[0].text = """```python
def test_example():
    assert True
```"""

    result = await test_generator._call_llm("Generate tests")

    assert result == "def test_example():\n    assert True"
    assert "```" not in result


@pytest.mark.asyncio
async def test_call_llm_retries_on_error(test_generator, mock_anthropic_client):
    """Test retry logic on API error."""
    # First call raises error, second succeeds
    mock_anthropic_client.messages.create.side_effect = [
        Exception("API error"),
        MagicMock(content=[MagicMock(text="def test(): pass")]),
    ]

    result = await test_generator._call_llm("Generate tests")

    assert result == "def test(): pass"
    assert mock_anthropic_client.messages.create.call_count == 2


# ============================================================================
# Helper Method Tests
# ============================================================================


def test_clean_generated_code_removes_fences(test_generator):
    """Test cleaning markdown fences from test code."""
    code = """```python
def test_example():
    pass
```"""

    cleaned = test_generator._clean_generated_code(code)

    assert cleaned == "def test_example():\n    pass"
    assert "```" not in cleaned


def test_clean_generated_code_handles_no_fences(test_generator):
    """Test cleaning code without fences."""
    code = "def test_example():\n    pass"

    cleaned = test_generator._clean_generated_code(code)

    assert cleaned == "def test_example():\n    pass"
