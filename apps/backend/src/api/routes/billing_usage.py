"""Usage tracking and metering API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.rbac import require_permission
from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.services.usage_metering import UsageMeteringService, get_usage_service

router = APIRouter(prefix="/api/billing/usage", tags=["Billing Usage"])


class UsageResponse(BaseModel):
    """Current usage metrics."""

    locations: int
    users: int
    products: int
    orders: int
    quotes: int
    ai_quotes: int


class UsageLimitsResponse(BaseModel):
    """Usage limits check response."""

    within_limits: bool
    warnings: list[str]
    exceeded: list[str]


@router.get("", response_model=UsageResponse)
@require_permission("billing:read")
async def get_current_usage(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    usage_service: Annotated[UsageMeteringService, Depends(get_usage_service)],
) -> UsageResponse:
    """Get current usage metrics for the organization."""
    usage = await usage_service.get_current_usage(org_id, db)
    return UsageResponse(**usage)


@router.get("/limits", response_model=UsageLimitsResponse)
@require_permission("billing:read")
async def check_usage_limits(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    usage_service: Annotated[UsageMeteringService, Depends(get_usage_service)],
) -> UsageLimitsResponse:
    """Check if organization is within usage limits."""
    result = await usage_service.check_usage_limits(org_id, db)
    return UsageLimitsResponse(**result)


@router.post("/report")
@require_permission("billing:manage")
async def report_usage(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    usage_service: Annotated[UsageMeteringService, Depends(get_usage_service)],
) -> dict:
    """Report usage to Stripe (admin/cron only)."""
    return await usage_service.report_usage_to_stripe(org_id, db)
