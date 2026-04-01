"""Configuration routes for business settings."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.config.settings import Settings, get_settings

router = APIRouter(prefix="/api/config", tags=["Configuration"])


class BusinessConfig(BaseModel):
    """Business configuration response model."""
    tax_rate: float
    tax_name: str
    quote_validity_days: int


@router.get("/business", response_model=BusinessConfig)
async def get_business_config(
    settings: Annotated[Settings, Depends(get_settings)]
) -> BusinessConfig:
    """
    Get business configuration settings.

    Returns configurable business settings like tax rate, tax name,
    and quote validity period. These settings are used across the
    application for consistent calculations.

    Returns:
        BusinessConfig: Business configuration settings
    """
    return BusinessConfig(
        tax_rate=float(settings.tax_rate),
        tax_name=settings.tax_name,
        quote_validity_days=settings.quote_validity_days,
    )


@router.get("/settings")
async def get_settings_info(settings: Annotated[Settings, Depends(get_settings)]) -> dict:
    """Get all application settings (non-sensitive only)."""
    return {
        "environment": settings.environment,
        "debug": settings.debug,
        "ai_provider": settings.ai_provider,
        "tax_rate": settings.tax_rate,
        "locations": ["brisbane", "sydney", "melbourne"],
    }


@router.get("/frontend-config")
async def get_frontend_config(settings: Annotated[Settings, Depends(get_settings)]) -> dict:
    """Get configuration for frontend application."""
    return {
        "api_url": settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000",
        "environment": settings.environment,
        "features": {
            "ai_enabled": True,
            "xero_integration": bool(getattr(settings, 'xero_client_id', None)),
            "shopify_integration": bool(getattr(settings, 'shopify_api_key', None)),
        },
    }


@router.get("/tax-rate")
async def get_tax_rate_info(settings: Annotated[Settings, Depends(get_settings)]) -> dict:
    """Get current tax rate."""
    return {
        "rate": settings.tax_rate,
        "rate_decimal": settings.tax_rate_decimal,
        "description": "GST (Goods and Services Tax)",
    }


@router.get("/ai-providers")
async def get_ai_providers_list(settings: Annotated[Settings, Depends(get_settings)]) -> dict:
    """Get available AI providers and current selection."""
    return {
        "current": settings.ai_provider,
        "available": ["ollama", "anthropic", "google"],
        "ollama_url": settings.ollama_base_url if settings.ai_provider == "ollama" else None,
    }


@router.get("/locations")
async def get_warehouse_locations() -> dict:
    """Get available warehouse/store locations."""
    return {
        "locations": [
            {"code": "brisbane", "name": "Brisbane Warehouse", "state": "QLD"},
            {"code": "sydney", "name": "Sydney Warehouse", "state": "NSW"},
            {"code": "melbourne", "name": "Melbourne Warehouse", "state": "VIC"},
        ]
    }
