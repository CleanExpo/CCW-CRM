"""Xero Tracking Categories API endpoints.

UNI-1853: Expose tracking categories from Xero and allow assigning them
to locally-tracked invoices (Orders with a xero_invoice_id).
"""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.config.xero_settings import XeroSettings, get_xero_settings
from src.db.demo_models import Order
from src.integrations.xero import get_xero_client
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.tracking import assign_tracking_to_invoice, get_tracking_categories

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api", tags=["Xero Tracking"], dependencies=[Depends(get_current_user)])


def _get_xero_auth(settings: Annotated[XeroSettings, Depends(get_xero_settings)]) -> XeroAuth:
    return XeroAuth(
        client_id=settings.client_id,
        client_secret=settings.client_secret,
        redirect_uri=settings.redirect_uri,
        scopes=settings.scopes_list,
    )


async def _get_xero_client(
    org_id: CurrentOrganization,
    db: AsyncSession,
    xero_auth: XeroAuth,
):
    connection = await xero_auth.get_active_connection(db, org_id)
    if not connection:
        raise HTTPException(status_code=400, detail="No active Xero connection for this organisation")
    demo_mode = connection.access_token.startswith("demo_")
    return get_xero_client(
        access_token=connection.access_token,
        tenant_id=connection.tenant_id,
        demo_mode=demo_mode,
    )


class TrackingAssignRequest(BaseModel):
    tracking_category_id: str
    tracking_option_id: str


@router.get("/xero/tracking-categories")
async def list_tracking_categories(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(_get_xero_auth)],
) -> list[dict]:
    """Return all Xero tracking categories with their options."""
    xero_client = await _get_xero_client(org_id, db, xero_auth)
    try:
        return await get_tracking_categories(xero_client)
    finally:
        await xero_client.close()


@router.post("/invoices/{invoice_id}/xero-tracking")
async def assign_xero_tracking(
    invoice_id: UUID,
    body: TrackingAssignRequest,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(_get_xero_auth)],
) -> dict:
    """Assign a Xero tracking category option to all line items of an invoice."""
    result = await db.execute(select(Order).where(Order.id == invoice_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not order.xero_invoice_id:
        raise HTTPException(status_code=400, detail="Invoice has not been synced to Xero yet")

    xero_client = await _get_xero_client(org_id, db, xero_auth)
    try:
        await assign_tracking_to_invoice(
            xero_client,
            xero_invoice_id=order.xero_invoice_id,
            tracking_category_id=body.tracking_category_id,
            tracking_option_id=body.tracking_option_id,
        )
    finally:
        await xero_client.close()

    return {
        "success": True,
        "xero_invoice_id": order.xero_invoice_id,
        "tracking_category_id": body.tracking_category_id,
        "tracking_option_id": body.tracking_option_id,
    }
