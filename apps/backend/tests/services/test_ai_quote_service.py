"""Tests for AI Quote Service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal

from src.services.ai_quote_service import (
    AIQuoteService,
    QuoteGenerationResult,
    ProductMatch,
    CustomerMatch,
)
from src.db.demo_models import Product, Customer


@pytest.fixture
def mock_db():
    """Mock database session."""
    return AsyncMock()


@pytest.fixture
def mock_anthropic():
    """Mock Anthropic client."""
    with patch("src.services.ai_quote_service.AsyncAnthropic") as mock:
        yield mock


@pytest.fixture
def sample_products():
    """Sample products for testing."""
    return [
        Product(
            id="product-1",
            sku="DRILL-001",
            name="Power Drill Pro",
            category="POWER_TOOLS",
            price=Decimal("99.99"),
            stock=50,
            is_active=True,
        ),
        Product(
            id="product-2",
            sku="HELMET-001",
            name="Safety Helmet",
            category="SAFETY_EQUIPMENT",
            price=Decimal("25.00"),
            stock=100,
            is_active=True,
        ),
    ]


@pytest.fixture
def sample_customers():
    """Sample customers for testing."""
    return [
        Customer(
            id="customer-1",
            customer_number="CUST-001",
            company_name="ABC Corp",
            contact_name="John Smith",
            email="john@abc.com",
            is_active=True,
        )
    ]


@pytest.fixture(autouse=True)
def mock_api_key_configured():
    """Ensure ANTHROPIC_API_KEY is seen as configured in all tests."""
    with patch("src.services.ai_quote_service.settings") as mock_settings:
        mock_settings.anthropic_api_key = "test-api-key"
        mock_settings.quote_validity_days = 30
        yield mock_settings


@pytest.mark.asyncio
async def test_generate_quote_success(mock_db, mock_anthropic, sample_products, sample_customers):
    """Test successful quote generation."""
    # Mock database queries
    mock_db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=lambda: MagicMock(all=lambda: sample_products)),  # products catalog
            MagicMock(scalars=lambda: MagicMock(all=lambda: sample_customers)),  # customers list
            MagicMock(scalar_one_or_none=lambda: sample_customers[0]),  # customer validation
            MagicMock(scalar_one_or_none=lambda: sample_products[0]),  # product validation
        ]
    )

    # Mock Anthropic API response
    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(
            text="""```json
{
  "customer": {
    "company_name": "ABC Corp",
    "contact_name": "John Smith",
    "email": "john@abc.com",
    "customer_id": "00000000-0000-0000-0000-000000000001",
    "customer_number": "CUST-001",
    "confidence": 0.95,
    "is_new_customer": false
  },
  "line_items": [
    {
      "product_id": "00000000-0000-0000-0000-000000000002",
      "sku": "DRILL-001",
      "name": "Power Drill Pro",
      "category": "POWER_TOOLS",
      "quantity": 5,
      "unit_price": "99.99",
      "line_total": "499.95",
      "confidence": 0.9,
      "alternatives": []
    }
  ],
  "notes": "Requested by John Smith",
  "discount_percentage": 0,
  "warnings": [],
  "suggestions": ["Consider bulk discount for large orders"]
}
```"""
        )
    ]

    mock_client = mock_anthropic.return_value
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    # Test
    service = AIQuoteService(mock_db)
    result = await service.generate_quote("Create a quote for ABC Corp with 5 power drills")

    # Assertions
    assert isinstance(result, QuoteGenerationResult)
    assert result.customer.company_name == "ABC Corp"
    assert len(result.line_items) == 1
    assert result.line_items[0].quantity == 5
    assert result.total == "499.95"
    assert result.confidence_score > 0.8


@pytest.mark.asyncio
async def test_generate_quote_missing_api_key(mock_db):
    """Test error when API key is missing."""
    with patch("src.services.ai_quote_service.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""

        service = AIQuoteService(mock_db)

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY not configured"):
            await service.generate_quote("Create a quote")


@pytest.mark.asyncio
async def test_generate_quote_short_prompt(mock_db):
    """Test error for prompts that are too short."""
    service = AIQuoteService(mock_db)

    with pytest.raises(ValueError, match="at least 10 characters"):
        await service.generate_quote("short")


@pytest.mark.asyncio
async def test_suggest_products(mock_db, sample_products):
    """Test product suggestions."""
    # Mock database query
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sample_products[0]]
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = AIQuoteService(mock_db)
    results = await service.suggest_products("drill", limit=5)

    assert len(results) == 1
    assert results[0]["name"] == "Power Drill Pro"
    assert results[0]["sku"] == "DRILL-001"


@pytest.mark.asyncio
async def test_suggest_customers(mock_db, sample_customers):
    """Test customer suggestions."""
    # Mock database query
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sample_customers[0]]
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = AIQuoteService(mock_db)
    results = await service.suggest_customers("ABC", limit=5)

    assert len(results) == 1
    assert results[0]["company_name"] == "ABC Corp"
    assert results[0]["contact_name"] == "John Smith"


@pytest.mark.asyncio
async def test_validate_and_enrich_stock_warning(mock_db, sample_products):
    """Test stock availability warnings."""
    product_uuid = "00000000-0000-0000-0000-000000000001"
    # Mock product query with low stock
    low_stock_product = Product(
        id=product_uuid,
        sku="DRILL-001",
        name="Power Drill Pro",
        category="POWER_TOOLS",
        price=Decimal("99.99"),
        stock=2,  # Low stock
        is_active=True,
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = low_stock_product
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = AIQuoteService(mock_db)

    parsed_data = {
        "customer": {
            "company_name": "ABC Corp",
            "contact_name": "John",
            "email": "john@abc.com",
            "customer_id": None,
            "customer_number": None,
            "confidence": 0.8,
            "is_new_customer": False,
        },
        "line_items": [
            {
                "product_id": product_uuid,
                "sku": "DRILL-001",
                "name": "Power Drill Pro",
                "category": "POWER_TOOLS",
                "quantity": 5,  # Exceeds stock
                "unit_price": "99.99",
                "line_total": "499.95",
                "confidence": 0.9,
                "alternatives": [],
            }
        ],
        "notes": None,
        "discount_percentage": 0,
        "warnings": [],
        "suggestions": [],
    }

    result = await service._validate_and_enrich(parsed_data)

    # Should have stock warning
    assert any("stock" in w.lower() for w in result.warnings)
