"""Settings API endpoints for account and company settings."""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.db.demo_models import Organization

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class CompanySettingsResponse(BaseModel):
    """Response schema for company settings."""

    id: UUID
    name: str
    slug: str
    is_active: bool

    class Config:
        from_attributes = True


class UpdateCompanyRequest(BaseModel):
    """Request schema for updating company settings."""

    name: str = Field(..., min_length=1, max_length=255)


@router.get("/company")
async def get_company_settings(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CompanySettingsResponse:
    """Get current organization settings."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return CompanySettingsResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        is_active=org.is_active,
    )


@router.put("/company")
async def update_company_settings(
    data: UpdateCompanyRequest,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CompanySettingsResponse:
    """Update organization name."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    old_name = org.name
    org.name = data.name

    # Regenerate slug from new name
    new_slug = data.name.lower().strip().replace(" ", "-")
    # Keep only alphanumeric and hyphens
    new_slug = "".join(c for c in new_slug if c.isalnum() or c == "-")
    org.slug = new_slug or org.slug

    await db.commit()
    await db.refresh(org)

    logger.info(
        "Company settings updated",
        org_id=str(org_id),
        old_name=old_name,
        new_name=org.name,
    )

    return CompanySettingsResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        is_active=org.is_active,
    )
