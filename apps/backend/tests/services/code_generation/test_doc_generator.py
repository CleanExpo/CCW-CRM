"""Tests for Documentation Generator.

Tests AI-powered documentation generation for Python and TypeScript code.
"""

import pytest
from pathlib import Path
from unittest.mock import MagicMock
from src.services.code_generation.doc_generator import DocGenerator
from src.services.code_generation.generator import GeneratedFile


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
    mock_response.content = [MagicMock(text='def test():\n    """Test function."""\n    pass')]
    mock_client.messages.create.return_value = mock_response
    return mock_client


@pytest.fixture
def doc_generator(project_root, mock_anthropic_client):
    """DocGenerator instance with mocked client."""
    generator = DocGenerator(
        project_root=project_root, anthropic_api_key="test-key-123"
    )
    generator.client = mock_anthropic_client
    return generator


# ============================================================================
# Initialization Tests
# ============================================================================


def test_doc_generator_initialization(project_root):
    """Test DocGenerator initializes correctly."""
    generator = DocGenerator(
        project_root=project_root, anthropic_api_key="test-key"
    )

    assert generator.project_root == project_root
    assert generator.model == "claude-sonnet-4-20250514"
    assert generator.max_retries == 2


def test_doc_generator_requires_api_key(project_root):
    """Test that API key is required."""
    from unittest.mock import patch

    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            DocGenerator(project_root=project_root)


# ============================================================================
# Documentation Needs Analysis - Python
# ============================================================================


@pytest.mark.asyncio
async def test_analyze_python_documentation_needs_undocumented_function(
    doc_generator,
):
    """Test analyzing Python code with undocumented function."""
    code = """
def calculate_total(items):
    return sum(item.price for item in items)
"""

    needs = await doc_generator._analyze_python_documentation_needs(code)

    assert needs["needs_documentation"] is True
    assert "calculate_total" in needs["undocumented_functions"]


@pytest.mark.asyncio
async def test_analyze_python_documentation_needs_documented_function(
    doc_generator,
):
    """Test analyzing Python code with documented function."""
    code = '''
def calculate_total(items):
    """Calculate total price of items."""
    return sum(item.price for item in items)
'''

    needs = await doc_generator._analyze_python_documentation_needs(code)

    assert needs["needs_documentation"] is False
    assert len(needs["undocumented_functions"]) == 0


@pytest.mark.asyncio
async def test_analyze_python_documentation_needs_undocumented_class(
    doc_generator,
):
    """Test analyzing Python code with undocumented class."""
    code = """
class Product:
    def __init__(self, name):
        self.name = name
"""

    needs = await doc_generator._analyze_python_documentation_needs(code)

    assert needs["needs_documentation"] is True
    assert "Product" in needs["undocumented_classes"]


@pytest.mark.asyncio
async def test_analyze_python_documentation_needs_endpoint(doc_generator):
    """Test analyzing Python API endpoint without documentation."""
    code = """
@router.get("/products")
async def get_products():
    return []
"""

    needs = await doc_generator._analyze_python_documentation_needs(code)

    assert needs["needs_documentation"] is True
    assert "get_products" in needs["undocumented_endpoints"]


@pytest.mark.asyncio
async def test_analyze_python_documentation_needs_complex_logic(doc_generator):
    """Test detecting complex logic that needs comments."""
    code = """
def process_orders(orders):
    for order in orders:
        for item in order.items:
            # Nested loop - complex logic
            item.process()
"""

    needs = await doc_generator._analyze_python_documentation_needs(code)

    assert needs["complex_logic"] is True
    assert needs["needs_documentation"] is True


# ============================================================================
# Documentation Needs Analysis - TypeScript
# ============================================================================


@pytest.mark.asyncio
async def test_analyze_typescript_documentation_needs_undocumented_component(
    doc_generator,
):
    """Test analyzing TypeScript component without documentation."""
    code = """
export function ProductForm() {
    return <form>Product Form</form>;
}
"""

    needs = await doc_generator._analyze_typescript_documentation_needs(code)

    assert needs["needs_documentation"] is True
    assert "ProductForm" in needs["undocumented_components"]


@pytest.mark.asyncio
async def test_analyze_typescript_documentation_needs_documented_component(
    doc_generator,
):
    """Test analyzing TypeScript component with JSDoc."""
    code = """
/**
 * Product form component
 */
export function ProductForm() {
    return <form>Product Form</form>;
}
"""

    needs = await doc_generator._analyze_typescript_documentation_needs(code)

    assert needs["needs_documentation"] is False
    assert len(needs["undocumented_components"]) == 0


@pytest.mark.asyncio
async def test_analyze_typescript_documentation_needs_undocumented_function(
    doc_generator,
):
    """Test analyzing TypeScript function without documentation."""
    code = """
export function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + item.price, 0);
}
"""

    needs = await doc_generator._analyze_typescript_documentation_needs(code)

    assert needs["needs_documentation"] is True
    assert "calculateTotal" in needs["undocumented_functions"]


@pytest.mark.asyncio
async def test_analyze_typescript_documentation_needs_complex_logic(doc_generator):
    """Test detecting complex TypeScript logic."""
    code = """
function process(data) {
    if (data) {
        if (data.items) {
            if (data.items.length > 0) {
                if (data.items[0].valid) {
                    return true;
                }
            }
        }
    }
    return false;
}
"""

    needs = await doc_generator._analyze_typescript_documentation_needs(code)

    assert needs["complex_logic"] is True
    assert needs["needs_documentation"] is True


# ============================================================================
# Documentation Generation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_generate_documentation_python_function(
    doc_generator, mock_anthropic_client
):
    """Test generating documentation for Python function."""
    source_file = GeneratedFile(
        file_path="apps/backend/src/module.py",
        content="def add(a, b):\n    return a + b",
        language="python",
        syntax_valid=True,
    )

    documented_code = '''
def add(a, b):
    """Add two numbers.

    Args:
        a: First number
        b: Second number

    Returns:
        Sum of a and b
    """
    return a + b
'''

    mock_anthropic_client.messages.create.return_value.content[0].text = (
        documented_code
    )

    result = await doc_generator.generate_documentation(source_file)

    assert '"""' in result
    assert "Args:" in result or "Add two numbers" in result


@pytest.mark.asyncio
async def test_generate_documentation_typescript_component(
    doc_generator, mock_anthropic_client
):
    """Test generating documentation for TypeScript component."""
    source_file = GeneratedFile(
        file_path="apps/web/components/ProductForm.tsx",
        content="export function ProductForm() { return <div />; }",
        language="typescript",
        syntax_valid=True,
    )

    documented_code = """
/**
 * Product form component
 * @component
 * @returns Product form UI
 */
export function ProductForm() {
    return <div />;
}
"""

    mock_anthropic_client.messages.create.return_value.content[0].text = (
        documented_code
    )

    result = await doc_generator.generate_documentation(source_file)

    assert "/**" in result
    assert "@component" in result or "Product form" in result


@pytest.mark.asyncio
async def test_generate_documentation_already_documented(doc_generator):
    """Test that well-documented code is returned unchanged."""
    source_file = GeneratedFile(
        file_path="apps/backend/src/module.py",
        content='''def add(a, b):\n    """Add numbers."""\n    return a + b''',
        language="python",
        syntax_valid=True,
    )

    result = await doc_generator.generate_documentation(source_file)

    # Should return original code since it's already documented
    assert result == source_file.content


@pytest.mark.asyncio
async def test_generate_documentation_invalid_syntax_fallback(
    doc_generator, mock_anthropic_client
):
    """Test fallback to original code if documentation breaks syntax."""
    source_file = GeneratedFile(
        file_path="apps/backend/src/module.py",
        content="def test():\n    pass",
        language="python",
        syntax_valid=True,
    )

    # Mock returns invalid Python syntax
    mock_anthropic_client.messages.create.return_value.content[0].text = (
        "def broken(\n    # Missing closing parenthesis"
    )

    result = await doc_generator.generate_documentation(source_file)

    # Should return original code since documented version is invalid
    assert result == source_file.content


# ============================================================================
# Prompt Building Tests
# ============================================================================


@pytest.mark.asyncio
async def test_build_documentation_prompt_python(doc_generator):
    """Test building documentation prompt for Python."""
    code = "def test(): pass"
    needs = {"needs_documentation": True, "undocumented_functions": ["test"]}

    prompt = await doc_generator._build_documentation_prompt(
        code=code, language="python", doc_needs=needs, existing_examples=[]
    )

    assert isinstance(prompt, str)
    assert "Google-style" in prompt
    assert "def test(): pass" in prompt


@pytest.mark.asyncio
async def test_build_documentation_prompt_typescript(doc_generator):
    """Test building documentation prompt for TypeScript."""
    code = "function test() {}"
    needs = {"needs_documentation": True, "undocumented_functions": ["test"]}

    prompt = await doc_generator._build_documentation_prompt(
        code=code, language="typescript", doc_needs=needs, existing_examples=[]
    )

    assert isinstance(prompt, str)
    assert "JSDoc" in prompt
    assert "function test() {}" in prompt


# ============================================================================
# Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_validate_documented_code_python_valid(doc_generator):
    """Test validating valid documented Python code."""
    code = '''
def test():
    """Test function."""
    pass
'''

    valid = await doc_generator._validate_documented_code(code, "python")

    assert valid is True


@pytest.mark.asyncio
async def test_validate_documented_code_python_invalid(doc_generator):
    """Test validating invalid documented Python code."""
    code = """
def broken(
    # Missing closing parenthesis
"""

    valid = await doc_generator._validate_documented_code(code, "python")

    assert valid is False


@pytest.mark.asyncio
async def test_validate_documented_code_typescript_valid(doc_generator):
    """Test validating valid documented TypeScript code."""
    code = """
/**
 * Test function
 */
function test() {
    return true;
}
"""

    valid = await doc_generator._validate_documented_code(code, "typescript")

    assert valid is True


@pytest.mark.asyncio
async def test_validate_documented_code_typescript_unbalanced(doc_generator):
    """Test detecting unbalanced braces in documented TypeScript."""
    code = """
/**
 * Broken function
 */
function broken() {
    if (true) {
        // Missing closing brace
    }
"""

    valid = await doc_generator._validate_documented_code(code, "typescript")

    assert valid is False


# ============================================================================
# Helper Method Tests
# ============================================================================


def test_clean_generated_code_removes_fences(doc_generator):
    """Test cleaning markdown fences from documentation."""
    code = """```python
def test():
    \"\"\"Test.\"\"\"
    pass
```"""

    cleaned = doc_generator._clean_generated_code(code)

    assert '"""Test."""' in cleaned
    assert "```" not in cleaned


def test_clean_generated_code_handles_no_fences(doc_generator):
    """Test cleaning code without fences."""
    code = 'def test():\n    """Test."""\n    pass'

    cleaned = doc_generator._clean_generated_code(code)

    assert cleaned == code.strip()


# ============================================================================
# LLM Integration Tests
# ============================================================================


@pytest.mark.asyncio
async def test_call_llm_success(doc_generator, mock_anthropic_client):
    """Test successful LLM call for documentation."""
    mock_anthropic_client.messages.create.return_value.content[0].text = (
        '"""Documentation."""'
    )

    result = await doc_generator._call_llm("Generate documentation")

    assert result == '"""Documentation."""'
    mock_anthropic_client.messages.create.assert_called_once()


@pytest.mark.asyncio
async def test_call_llm_retries_on_error(doc_generator, mock_anthropic_client):
    """Test retry logic on API error."""
    # First call raises error, second succeeds
    mock_anthropic_client.messages.create.side_effect = [
        Exception("API error"),
        MagicMock(content=[MagicMock(text='"""Docs."""')]),
    ]

    result = await doc_generator._call_llm("Generate documentation")

    assert result == '"""Docs."""'
    assert mock_anthropic_client.messages.create.call_count == 2
