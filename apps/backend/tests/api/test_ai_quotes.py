"""Tests for AI Quotes API endpoints."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture
def client():
    """Test client."""
    return TestClient(app)


@pytest.fixture
def mock_ai_service():
    """Mock AI Quote Service."""
    with patch("src.api.routes.ai_quotes.AIQuoteService") as mock:
        yield mock


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/api/ai/quotes/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ai-quotes"
    assert "api_key_configured" in data


def test_generate_quote_success(client, mock_ai_service):
    """Test successful quote generation."""
    # Mock service response
    mock_service_instance = mock_ai_service.return_value
    mock_service_instance.generate_quote = AsyncMock(
        return_value={
            "customer": {
                "company_name": "ABC Corp",
                "contact_name": "John Smith",
                "email": "john@abc.com",
                "customer_id": "customer-1",
                "customer_number": "CUST-001",
                "confidence": 0.95,
                "is_new_customer": False,
            },
            "line_items": [
                {
                    "product_id": "product-1",
                    "sku": "DRILL-001",
                    "name": "Power Drill",
                    "category": "POWER_TOOLS",
                    "quantity": 5,
                    "unit_price": "99.99",
                    "line_total": "499.95",
                    "confidence": 0.9,
                    "alternatives": [],
                }
            ],
            "notes": None,
            "discount_percentage": 0,
            "subtotal": "499.95",
            "discount_amount": "0.00",
            "total": "499.95",
            "valid_until": "2024-04-01T00:00:00Z",
            "confidence_score": 0.92,
            "warnings": [],
            "suggestions": [],
        }
    )

    response = client.post(
        "/api/ai/quotes/generate",
        json={
            "prompt": "Create a quote for ABC Corp with 5 power drills",
            "user_context": None,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["customer"]["company_name"] == "ABC Corp"
    assert len(data["data"]["line_items"]) == 1


def test_generate_quote_short_prompt(client):
    """Test error for short prompt."""
    response = client.post(
        "/api/ai/quotes/generate",
        json={"prompt": "short", "user_context": None},
    )

    assert response.status_code == 422  # Validation error


def test_parse_prompt_success(client, mock_ai_service):
    """Test prompt parsing (preview mode)."""
    mock_service_instance = mock_ai_service.return_value
    mock_service_instance.parse_prompt_preview = AsyncMock(
        return_value={
            "customer": {"company_name": "ABC Corp", "confidence": 0.8},
            "line_items": [],
            "total": "0.00",
            "confidence": 0.7,
            "warnings": [],
        }
    )

    response = client.post(
        "/api/ai/quotes/parse-prompt",
        json={"prompt": "Create a quote for ABC Corp"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["customer"]["company_name"] == "ABC Corp"


def test_suggest_products_success(client, mock_ai_service):
    """Test product suggestions."""
    mock_service_instance = mock_ai_service.return_value
    mock_service_instance.suggest_products = AsyncMock(
        return_value=[
            {
                "id": "product-1",
                "sku": "DRILL-001",
                "name": "Power Drill",
                "category": "POWER_TOOLS",
                "price": "99.99",
                "stock": 50,
            }
        ]
    )

    response = client.post(
        "/api/ai/quotes/suggest-products",
        json={"query": "drill", "limit": 5},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["name"] == "Power Drill"


def test_suggest_customers_success(client, mock_ai_service):
    """Test customer suggestions."""
    mock_service_instance = mock_ai_service.return_value
    mock_service_instance.suggest_customers = AsyncMock(
        return_value=[
            {
                "id": "customer-1",
                "customer_number": "CUST-001",
                "company_name": "ABC Corp",
                "contact_name": "John Smith",
                "email": "john@abc.com",
            }
        ]
    )

    response = client.post(
        "/api/ai/quotes/suggest-customers",
        json={"query": "ABC", "limit": 5},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["company_name"] == "ABC Corp"
