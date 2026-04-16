"""Xero Payroll API routes — STP Phase 2 (UNI-1860)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.config.xero_settings import XeroSettings, get_xero_settings
from src.db.models import User
from src.integrations.xero import get_xero_client
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.payroll import get_leave_balances, get_payroll_employees, submit_pay_event

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/payroll", tags=["Payroll / STP Phase 2"], dependencies=[Depends(get_current_user)])


def get_xero_auth(settings: Annotated[XeroSettings, Depends(get_xero_settings)]) -> XeroAuth:
    return XeroAuth(
        client_id=settings.client_id,
        client_secret=settings.client_secret,
        redirect_uri=settings.redirect_uri,
        scopes=settings.scopes_list,
    )


class PayRunSubmit(BaseModel):
    organization_id: UUID
    pay_run_data: dict


async def _resolve_xero_client(
    organization_id: UUID,
    db: AsyncSession,
    xero_auth: XeroAuth,
    settings: XeroSettings,
):
    """Get an authenticated Xero client for the given org, raising 503 if unavailable."""
    connection = await xero_auth.get_active_connection(db, organization_id)
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active Xero connection for this organisation",
        )
    return get_xero_client(
        access_token=connection.access_token,
        tenant_id=connection.tenant_id,
        demo_mode=settings.is_demo_mode,
    )


@router.get("/employees")
async def list_employees(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    _user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    """Return employees from Xero Payroll."""
    client = await _resolve_xero_client(org_id, db, xero_auth, settings)
    return await get_payroll_employees(client)


@router.post("/pay-events")
async def submit_pay_run(
    body: PayRunSubmit,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    _user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Submit a pay run with STP Phase 2 income type disaggregation."""
    client = await _resolve_xero_client(body.organization_id, db, xero_auth, settings)
    return await submit_pay_event(client, body.pay_run_data)


@router.get("/employees/{employee_id}/leave-balances")
async def employee_leave_balances(
    employee_id: str,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    _user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Return leave balances for an employee from Xero Payroll."""
    client = await _resolve_xero_client(org_id, db, xero_auth, settings)
    return await get_leave_balances(client, employee_id)
