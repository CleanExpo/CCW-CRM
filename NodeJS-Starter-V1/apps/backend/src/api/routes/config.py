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
