"""Settings API endpoints for account and company settings."""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.db.approvals_models import ApprovalThreshold
from src.db.demo_models import Organization
from src.db.security_models import SecuritySettings

DEFAULT_THRESHOLD_SCOPE = "default"
DEFAULT_SESSION_TIMEOUT_MINUTES = 60

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


class ApprovalThresholdResponse(BaseModel):
    """Response for an approval threshold."""

    scope: str
    amount_aud: Decimal


class UpdateApprovalThresholdRequest(BaseModel):
    """Request to set/update an approval threshold."""

    amount_aud: Decimal = Field(..., ge=0, description="Threshold in AUD (POs at or above this go to approvals queue)")
    scope: str = Field(default=DEFAULT_THRESHOLD_SCOPE, max_length=100)


@router.get("/approval-thresholds")
async def list_approval_thresholds(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[ApprovalThresholdResponse]:
    """List all configured approval thresholds."""
    result = await db.execute(select(ApprovalThreshold).order_by(ApprovalThreshold.scope))
    rows = result.scalars().all()
    return [ApprovalThresholdResponse(scope=r.scope, amount_aud=r.amount_aud) for r in rows]


@router.put("/approval-thresholds")
async def upsert_approval_threshold(
    data: UpdateApprovalThresholdRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ApprovalThresholdResponse:
    """Create or update an approval threshold for a given scope.

    POs with total below the threshold auto-approve; at or above, they
    land in the approvals queue for human review.
    """
    result = await db.execute(
        select(ApprovalThreshold).where(ApprovalThreshold.scope == data.scope)
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = ApprovalThreshold(scope=data.scope, amount_aud=data.amount_aud)
        db.add(row)
    else:
        row.amount_aud = data.amount_aud

    await db.commit()
    await db.refresh(row)

    logger.info(
        "Approval threshold updated",
        scope=row.scope,
        amount_aud=str(row.amount_aud),
    )

    return ApprovalThresholdResponse(scope=row.scope, amount_aud=row.amount_aud)


class SecuritySettingsResponse(BaseModel):
    """Current security policy for the organisation."""

    session_timeout_minutes: int = Field(..., ge=1, le=1440)


class UpdateSecuritySettingsRequest(BaseModel):
    """Request to update the security policy."""

    session_timeout_minutes: int = Field(
        ..., ge=1, le=1440, description="Idle timeout in minutes (1 min to 24 h)"
    )


@router.get("/security")
async def get_security_settings(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SecuritySettingsResponse:
    """Return the current security settings (singleton row, defaults if absent)."""
    result = await db.execute(select(SecuritySettings))
    row = result.scalars().first()
    return SecuritySettingsResponse(
        session_timeout_minutes=row.session_timeout_minutes
        if row is not None
        else DEFAULT_SESSION_TIMEOUT_MINUTES,
    )


@router.put("/security")
async def update_security_settings(
    data: UpdateSecuritySettingsRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SecuritySettingsResponse:
    """Upsert the singleton security settings row."""
    result = await db.execute(select(SecuritySettings))
    row = result.scalars().first()

    if row is None:
        row = SecuritySettings(session_timeout_minutes=data.session_timeout_minutes)
        db.add(row)
    else:
        row.session_timeout_minutes = data.session_timeout_minutes

    await db.commit()
    await db.refresh(row)

    logger.info(
        "Security settings updated",
        session_timeout_minutes=row.session_timeout_minutes,
    )

    return SecuritySettingsResponse(
        session_timeout_minutes=row.session_timeout_minutes,
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
