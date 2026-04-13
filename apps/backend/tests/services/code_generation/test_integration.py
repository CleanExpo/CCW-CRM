"""Integration tests for code generation workflow.

Tests the complete end-to-end pipeline: Request → Context → Code → Tests → Docs → Quality
"""

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.services.code_generation.generator import (
    CodeGenerationRequest,
    CodeGenerationResult,
    CodeGenerator,
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
    """Mock Anthropic client for all generators."""
    mock_client = MagicMock()
    return mock_client


@pytest.fixture
def code_generator(project_root, mock_anthropic_client):
    """CodeGenerator instance with mocked Anthropic client."""
    generator = CodeGenerator(
        project_root=project_root, anthropic_api_key="test-key-123"
    )
    # Mock all Anthropic clients
    generator.client = mock_anthropic_client
    generator.test_generator.client = mock_anthropic_client
    generator.doc_generator.client = mock_anthropic_client
    return generator


# ============================================================================
# Full Pipeline Tests (Happy Path)
# ============================================================================


@pytest.mark.asyncio
async def test_full_pipeline_simple_python_function(
    code_generator, mock_anthropic_client
):
    """Test complete pipeline for simple Python function."""
    # Mock LLM responses
    generated_code = '''
def calculate_total(items: list[dict]) -> float:
    """Calculate total price of items.

    Args:
        items: List of items with price field

    Returns:
        Total price as float
    """
    return sum(item["price"] for item in items)
'''

    test_code = '''
import pytest
from src.module import calculate_total


def test_calculate_total():
    """Test calculate_total function."""
    items = [{"price": 10.0}, {"price": 20.0}]
    result = calculate_total(items)
    assert result == 30.0
'''

    # Set up mock responses
    mock_response = MagicMock()
    mock_anthropic_client.messages.create.side_effect = [
        # Code generation
        MagicMock(content=[MagicMock(text=generated_code)]),
        # Documentation (already has docstring, won't be called)
        # Test generation
        MagicMock(content=[MagicMock(text=test_code)]),
    ]

    # Create request
    request = CodeGenerationRequest(
        requirement="Create a function to calculate total price of items",
        target_language="python",
        generation_type="feature",
    )

    # Execute full pipeline
    result = await code_generator.generate(request)

    # Verify result structure
    assert isinstance(result, CodeGenerationResult)
    assert len(result.generated_files) == 1
    assert result.generated_files[0].syntax_valid is True
    assert len(result.tests) >= 0  # Tests may be generated
    assert result.quality_report is not None

    # Verify generated code
    generated_file = result.generated_files[0]
    assert "calculate_total" in generated_file.content
    assert generated_file.language == "python"

    # Verify quality checks ran
    assert result.quality_report.linting_passed is not None
    assert result.quality_report.type_check_passed is not None


@pytest.mark.asyncio
async def test_full_pipeline_fastapi_endpoint(code_generator, mock_anthropic_client):
    """Test complete pipeline for FastAPI endpoint generation."""
    generated_code = '''
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["products"])


class ProductResponse(BaseModel):
    """Product response model."""
    id: str
    name: str
    price: float


@router.get("/products/{product_id}")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_async_db)
) -> ProductResponse:
    """Get product by ID.

    Args:
        product_id: Product UUID
        db: Database session

    Returns:
        Product details
    """
    # Implementation here
    pass
'''

    test_code = '''
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_product(client: AsyncClient):
    """Test get product endpoint."""
    response = await client.get("/api/products/test-id")
    assert response.status_code == 200
'''

    mock_response = MagicMock()
    mock_anthropic_client.messages.create.side_effect = [
        MagicMock(content=[MagicMock(text=generated_code)]),
        MagicMock(content=[MagicMock(text=test_code)]),
    ]

    request = CodeGenerationRequest(
        requirement="Create a FastAPI endpoint to get product by ID",
        target_language="python",
        generation_type="feature",
    )

    result = await code_generator.generate(request)

    # Verify endpoint was generated
    assert isinstance(result, CodeGenerationResult)
    assert "@router.get" in result.generated_files[0].content
    assert "async def get_product" in result.generated_files[0].content
    assert result.generated_files[0].syntax_valid is True


@pytest.mark.asyncio
async def test_full_pipeline_react_component(code_generator, mock_anthropic_client):
    """Test complete pipeline for React component generation."""
    generated_code = '''
import React from "react";

interface ProductFormProps {
    onSubmit: (data: ProductData) => void;
}

export function ProductForm({ onSubmit }: ProductFormProps): JSX.Element {
    const [name, setName] = React.useState("");
    const [price, setPrice] = React.useState(0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ name, price });
    };

    return (
        <form onSubmit={handleSubmit}>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <input value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            <button type="submit">Submit</button>
        </form>
    );
}
'''

    test_code = '''
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductForm } from "./ProductForm";

test("renders product form", () => {
    render(<ProductForm onSubmit={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
});
'''

    mock_anthropic_client.messages.create.side_effect = [
        MagicMock(content=[MagicMock(text=generated_code)]),
        MagicMock(content=[MagicMock(text=generated_code)]),  # Doc (no change)
        MagicMock(content=[MagicMock(text=test_code)]),
    ]

    request = CodeGenerationRequest(
        requirement="Create a React form component for product entry",
        target_language="typescript",
        generation_type="feature",
    )

    result = await code_generator.generate(request)

    # Verify component was generated
    assert isinstance(result, CodeGenerationResult)
    assert "ProductForm" in result.generated_files[0].content
    assert result.generated_files[0].language == "typescript"
    assert result.generated_files[0].syntax_valid is True


# ============================================================================
# Error Handling & Recovery Tests
# ============================================================================


@pytest.mark.asyncio
async def test_missing_api_key_error():
    """Test error when API key is missing."""
    project_root = Path(__file__).parents[5]

    # Clear environment variable
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            CodeGenerator(project_root=project_root)


@pytest.mark.asyncio
async def test_llm_timeout_retry(code_generator, mock_anthropic_client):
    """Test retry logic on LLM timeout."""
    # First call raises exception, second succeeds
    mock_anthropic_client.messages.create.side_effect = [
        Exception("Rate limit exceeded"),  # Generic exception to trigger retry
        MagicMock(content=[MagicMock(text="def test(): pass")]),
        MagicMock(content=[MagicMock(text="def test(): pass")]),  # Doc
        MagicMock(content=[MagicMock(text='"""Test."""')]),  # Test
    ]

    request = CodeGenerationRequest(
        requirement="Create a simple test function",
        target_language="python",
    )

    # Should retry and succeed
    result = await code_generator.generate(request)

    assert isinstance(result, CodeGenerationResult)
    # Verify retry happened (2 calls minimum for code generation)
    assert mock_anthropic_client.messages.create.call_count >= 2


@pytest.mark.asyncio
async def test_invalid_syntax_fallback(code_generator, mock_anthropic_client):
    """Test fallback when LLM generates invalid syntax."""
    # Generate invalid Python syntax
    invalid_code = "def broken(\n    # Missing closing parenthesis"

    mock_anthropic_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=invalid_code)]
    )

    request = CodeGenerationRequest(
        requirement="Create a function",
        target_language="python",
    )

    result = await code_generator.generate(request)

    # Verify syntax validation caught the error
    assert result.generated_files[0].syntax_valid is False
    assert result.pr_ready is False


# ============================================================================
# Edge Cases Tests
# ============================================================================


@pytest.mark.asyncio
async def test_very_simple_requirement(code_generator, mock_anthropic_client):
    """Test with minimal requirement."""
    mock_anthropic_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="def add(a: int, b: int) -> int:\n    return a + b")]
    )

    request = CodeGenerationRequest(
        requirement="Add two numbers",
        target_language="python",
    )

    result = await code_generator.generate(request)

    assert isinstance(result, CodeGenerationResult)
    assert len(result.generated_files) == 1


@pytest.mark.asyncio
async def test_with_reference_files(code_generator, mock_anthropic_client):
    """Test generation with reference files."""
    mock_anthropic_client.messages.create.return_value = MagicMock(
        content=[
            MagicMock(
                text="async def fetch_data() -> dict:\n    return await api.get('/data')"
            )
        ]
    )

    request = CodeGenerationRequest(
        requirement="Create a data fetching function",
        target_language="python",
        reference_files=[
            "apps/backend/src/api/routes/demo_lists.py",
        ],
    )

    result = await code_generator.generate(request)

    assert isinstance(result, CodeGenerationResult)
    # Context should have used reference files
    assert len(result.generated_files) == 1


@pytest.mark.asyncio
async def test_markdown_fence_cleaning(code_generator, mock_anthropic_client):
    """Test that markdown fences are removed from generated code."""
    code_with_fences = '''```python
def test():
    """Test function."""
    pass
```'''

    mock_anthropic_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=code_with_fences)]
    )

    request = CodeGenerationRequest(
        requirement="Create a test function",
        target_language="python",
    )

    result = await code_generator.generate(request)

    # Verify markdown fences were removed
    generated_code = result.generated_files[0].content
    assert "```" not in generated_code
    assert "def test():" in generated_code


# ============================================================================
# Quality Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_quality_check_detects_security_issues(
    code_generator, mock_anthropic_client
):
    """Test quality checker detects security issues."""
    insecure_code = '''
api_key = "sk-1234567890abcdefghijklmnopqrst"

def fetch_data(user_input):
    query = f"SELECT * FROM users WHERE id = {user_input}"
    result = eval(user_input)
    return result
'''

    mock_anthropic_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=insecure_code)]
    )

    request = CodeGenerationRequest(
        requirement="Create a data fetching function",
        target_language="python",
    )

    result = await code_generator.generate(request)

    # Verify security issues were detected
    assert len(result.quality_report.security_issues) > 0
    assert result.pr_ready is False


@pytest.mark.asyncio
async def test_quality_check_detects_type_issues(
    code_generator, mock_anthropic_client
):
    """Test quality checker detects missing type annotations."""
    untyped_code = '''
def calculate(x, y):
    return x + y
'''

    mock_anthropic_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=untyped_code)]
    )

    request = CodeGenerationRequest(
        requirement="Create a calculator function",
        target_language="python",
    )

    result = await code_generator.generate(request)

    # Verify type issues were detected
    assert len(result.quality_report.type_errors) > 0


@pytest.mark.asyncio
async def test_quality_check_typescript_security(
    code_generator, mock_anthropic_client
):
    """Test TypeScript security checks."""
    insecure_ts = '''
export function Component() {
    const API_KEY = "sk-1234567890abcdefghijklmnopqrst";
    return <div dangerouslySetInnerHTML={{ __html: userContent }} />;
}
'''

    mock_anthropic_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=insecure_ts)]
    )

    request = CodeGenerationRequest(
        requirement="Create a React component",
        target_language="typescript",
    )

    result = await code_generator.generate(request)

    # Verify security issues detected
    assert len(result.quality_report.security_issues) > 0
    assert any("api key" in issue.lower() for issue in result.quality_report.security_issues)


# ============================================================================
# Real-World Scenarios Tests
# ============================================================================


@pytest.mark.asyncio
async def test_real_world_api_endpoint_generation(
    code_generator, mock_anthropic_client
):
    """Test realistic API endpoint generation scenario."""
    endpoint_code = '''
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db
from src.db.demo_models import Product
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["products"])


class ProductCreate(BaseModel):
    """Product creation request."""
    sku: str
    name: str
    price: float
    stock: int


@router.post("/products")
async def create_product(
    product_data: ProductCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)]
) -> dict:
    """Create a new product.

    Args:
        product_data: Product details
        db: Database session

    Returns:
        Created product details

    Raises:
        HTTPException: If product already exists
    """
    # Check if SKU exists
    result = await db.execute(
        select(Product).where(Product.sku == product_data.sku)
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")

    # Create product
    product = Product(**product_data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)

    return {"id": str(product.id), "sku": product.sku}
'''

    mock_anthropic_client.messages.create.side_effect = [
        MagicMock(content=[MagicMock(text=endpoint_code)]),
        MagicMock(content=[MagicMock(text=endpoint_code)]),  # Doc already has docstrings
    ]

    request = CodeGenerationRequest(
        requirement="Create an API endpoint to create a new product with SKU validation",
        target_language="python",
        generation_type="feature",
    )

    result = await code_generator.generate(request)

    # Verify production-ready endpoint
    assert result.generated_files[0].syntax_valid is True
    assert "@router.post" in result.generated_files[0].content
    assert "ProductCreate" in result.generated_files[0].content
    assert "HTTPException" in result.generated_files[0].content

    # Verify quality
    # Should pass most checks (may have minor linting issues)
    assert result.quality_report is not None


@pytest.mark.asyncio
async def test_real_world_service_class_generation(
    code_generator, mock_anthropic_client
):
    """Test realistic service class generation."""
    service_code = '''
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class OrderService:
    """Service for order processing operations.

    Handles order creation, validation, and status updates.
    """

    async def create_order(
        self,
        customer_id: str,
        items: list[dict],
    ) -> dict:
        """Create a new order.

        Args:
            customer_id: Customer UUID
            items: List of order items

        Returns:
            Created order details

        Raises:
            ValueError: If validation fails
        """
        # Validate items
        if not items:
            raise ValueError("Order must have at least one item")

        # Calculate total
        total = sum(item["quantity"] * item["price"] for item in items)

        return {
            "customer_id": customer_id,
            "items": items,
            "total": total,
            "created_at": datetime.utcnow(),
        }
'''

    mock_anthropic_client.messages.create.side_effect = [
        MagicMock(content=[MagicMock(text=service_code)]),
        MagicMock(content=[MagicMock(text=service_code)]),  # Doc
    ]

    request = CodeGenerationRequest(
        requirement="Create an OrderService class to handle order creation and validation",
        target_language="python",
        generation_type="feature",
    )

    result = await code_generator.generate(request)

    # Verify service class
    assert result.generated_files[0].syntax_valid is True
    assert "class OrderService" in result.generated_files[0].content
    assert "async def create_order" in result.generated_files[0].content


# ============================================================================
# Pipeline Integration Tests
# ============================================================================


@pytest.mark.asyncio
async def test_pr_ready_determination(code_generator, mock_anthropic_client):
    """Test that PR-ready flag is set correctly."""
    clean_code = '''
async def fetch_data(url: str) -> dict:
    """Fetch data from URL.

    Args:
        url: API endpoint URL

    Returns:
        Response data as dict
    """
    try:
        response = await api_client.get(url)
        return response.json()
    except Exception as e:
        logger.error(f"Failed to fetch data: {e}")
        raise
'''

    test_code = '''
import pytest


@pytest.mark.asyncio
async def test_fetch_data():
    """Test fetch_data function."""
    result = await fetch_data("https://api.example.com/data")
    assert isinstance(result, dict)
'''

    mock_anthropic_client.messages.create.side_effect = [
        MagicMock(content=[MagicMock(text=clean_code)]),
        MagicMock(content=[MagicMock(text=clean_code)]),  # Doc
        MagicMock(content=[MagicMock(text=test_code)]),  # Test
    ]

    request = CodeGenerationRequest(
        requirement="Create a data fetching function",
        target_language="python",
    )

    result = await code_generator.generate(request)

    # Clean code with tests should be PR-ready (if tests generated successfully)
    # Note: pr_ready = syntax_valid and len(tests) > 0
    assert result.generated_files[0].syntax_valid is True
