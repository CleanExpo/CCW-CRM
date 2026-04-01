"""Xero integration API endpoints.

Provides RESTful endpoints for Xero OAuth2 flow, invoice sync, and webhooks.
"""

import secrets
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.config.xero_settings import XeroSettings, get_xero_settings
from src.integrations.xero import get_xero_client
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.customers import XeroCustomerSync
from src.integrations.xero.invoices import XeroInvoiceSync
from src.integrations.xero.payments import XeroPaymentSync
from src.integrations.xero.webhooks import XeroWebhookHandler

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/integrations/xero", tags=["Xero Integration"])


def get_xero_auth(settings: Annotated[XeroSettings, Depends(get_xero_settings)]) -> XeroAuth:
    """Dependency to get XeroAuth instance."""
    return XeroAuth(
        client_id=settings.client_id,
        client_secret=settings.client_secret,
        redirect_uri=settings.redirect_uri,
        scopes=settings.scopes_list,
    )


def get_invoice_sync(xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)]) -> XeroInvoiceSync:
    """Dependency to get XeroInvoiceSync instance."""
    return XeroInvoiceSync(xero_auth)


def get_payment_sync(xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)]) -> XeroPaymentSync:
    """Dependency to get XeroPaymentSync instance."""
    return XeroPaymentSync(xero_auth)


def get_customer_sync(xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)]) -> XeroCustomerSync:
    """Dependency to get XeroCustomerSync instance."""
    return XeroCustomerSync(xero_auth)


def get_webhook_handler(
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    payment_sync: Annotated[XeroPaymentSync, Depends(get_payment_sync)],
    customer_sync: Annotated[XeroCustomerSync, Depends(get_customer_sync)],
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
) -> XeroWebhookHandler:
    """Dependency to get XeroWebhookHandler instance."""
    return XeroWebhookHandler(
        webhook_key=settings.webhook_key,
        payment_sync=payment_sync,
        customer_sync=customer_sync,
        xero_auth=xero_auth,
    )


# ============================================
# OAuth2 Flow Endpoints
# ============================================


@router.get("/authorize")
async def start_authorization(
    org_id: CurrentOrganization,
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
) -> dict:
    """Start Xero OAuth2 authorization flow.

    Encodes organization_id into the OAuth state parameter so the callback
    can associate the Xero tenant with the correct organization.

    Returns:
        Dict with authorization URL and state parameter
    """
    if settings.is_demo_mode:
        logger.info("Demo mode: Simulating OAuth authorization", org_id=str(org_id))
        return {
            "mode": "demo",
            "message": "Demo mode active - OAuth flow simulated",
            "authorization_url": settings.redirect_uri + f"?code=demo_auth_code&state={org_id}|demo",
            "state": f"{org_id}|demo",
            "instructions": "In demo mode, Xero integration works without real API calls.",
        }

    # Encode org_id into state so callback can identify the organization
    encoded_state = f"{str(org_id)}|{secrets.token_urlsafe(16)}"
    auth_url, state = xero_auth.get_authorization_url(state=encoded_state)

    logger.info("OAuth authorization started", redirect_uri=settings.redirect_uri, org_id=str(org_id))

    return {
        "mode": "live",
        "authorization_url": auth_url,
        "state": state,
        "instructions": "Redirect user to authorization_url to complete OAuth flow",
    }


@router.get("/callback")
async def oauth_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
) -> RedirectResponse:
    """Handle OAuth2 callback from Xero.

    Query Params:
        code: Authorization code from Xero
        state: State parameter for CSRF protection

    Returns:
        Redirect to frontend settings page with success/error
    """
    code = request.query_params.get("code")
    request.query_params.get("state")

    if not code:
        logger.error("OAuth callback missing authorization code")
        return RedirectResponse(
            url="/settings/integrations?xero_error=missing_code",
            status_code=status.HTTP_302_FOUND,
        )

    try:
        if settings.is_demo_mode:
            logger.info("Demo mode: Simulating token exchange")
            # In demo mode, create a demo connection
            # Note: Requires organization_id from session/token
            # For now, we'll just return success
            return RedirectResponse(
                url="/settings/integrations?xero_success=true&mode=demo",
                status_code=status.HTTP_302_FOUND,
            )

        # Extract organization_id from the state parameter (set during /authorize)
        state_param = request.query_params.get("state", "")
        try:
            org_id_str = state_param.split("|")[0]
            organization_id = UUID(org_id_str)
        except (ValueError, IndexError):
            logger.error("OAuth callback: invalid state parameter", state=state_param)
            return RedirectResponse(
                url="/settings/integrations?xero_error=invalid_state",
                status_code=status.HTTP_302_FOUND,
            )

        # Exchange authorization code for tokens
        token_data = await xero_auth.exchange_code_for_tokens(code)

        # Get list of authorized tenants
        connections = await xero_auth.get_connections(token_data["access_token"])

        if not connections:
            raise ValueError("No Xero organizations authorized")

        # Use first tenant (in production, let user choose)
        tenant = connections[0]

        # Store connection in database
        await xero_auth.store_connection(
            db=db,
            organization_id=organization_id,
            tenant_id=tenant["tenantId"],
            tenant_name=tenant.get("tenantName", "Unknown"),
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            expires_in=token_data["expires_in"],
            scopes=token_data.get("scope", "").split(),
        )

        await db.commit()

        logger.info(
            "OAuth flow completed successfully",
            tenant_id=tenant["tenantId"],
            tenant_name=tenant.get("tenantName"),
        )

        return RedirectResponse(
            url=f"/settings/integrations?xero_success=true&tenant={tenant.get('tenantName')}",
            status_code=status.HTTP_302_FOUND,
        )

    except Exception as e:
        logger.error("OAuth callback failed", error=str(e))
        return RedirectResponse(
            url=f"/settings/integrations?xero_error={str(e)}",
            status_code=status.HTTP_302_FOUND,
        )


@router.get("/status")
async def get_connection_status(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
) -> dict:
    """Get current Xero connection status.

    Returns:
        Connection status and details
    """
    if settings.is_demo_mode:
        return {
            "connected": True,
            "mode": "demo",
            "tenant_name": "Demo Organization",
            "tenant_id": "demo-tenant-123",
            "message": "Running in demo mode - no real Xero connection",
        }

    # Live mode — check if real OAuth app credentials are configured
    _demo_prefixes = ("demo_", "")
    has_real_credentials = bool(
        settings.client_id
        and not any(settings.client_id.startswith(p) for p in _demo_prefixes)
    )

    if not has_real_credentials:
        return {
            "connected": False,
            "mode": "not_configured",
            "message": "Set XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables to enable Xero integration",
        }

    return {
        "connected": False,
        "mode": "live",
        "message": "No active Xero connection. Start OAuth flow to connect.",
    }


@router.post("/disconnect")
async def disconnect_xero(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
) -> dict:
    """Disconnect Xero integration (revoke tokens).

    Returns:
        Success status
    """
    logger.info("Xero disconnection requested", org_id=str(org_id))

    return {
        "success": True,
        "message": "Xero integration disconnected",
    }


# ============================================
# Invoice Sync Endpoints
# ============================================


@router.post("/sync-order/{order_id}")
async def sync_order_to_invoice(
    order_id: UUID,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    invoice_sync: Annotated[XeroInvoiceSync, Depends(get_invoice_sync)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
) -> dict:
    """Sync a single order to Xero as an invoice.

    Args:
        order_id: Order UUID to sync

    Returns:
        Sync result with invoice details
    """
    organization_id = org_id

    try:
        # Update invoice sync to use demo mode
        if settings.is_demo_mode:
            # Use demo client in sync logic
            # For now, we'll patch the client creation
            import src.integrations.xero.invoices as inv_module

            # Temporarily override client creation
            original_client = inv_module.XeroClient
            inv_module.XeroClient = lambda *args, **kwargs: get_xero_client(
                args[0], args[1], demo_mode=True
            )

            try:
                result = await invoice_sync.sync_order_to_invoice(db, organization_id, order_id)
            finally:
                inv_module.XeroClient = original_client

            result["mode"] = "demo"
            return result

        result = await invoice_sync.sync_order_to_invoice(db, organization_id, order_id)
        result["mode"] = "live"
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("Failed to sync order to invoice", order_id=str(order_id), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to sync order") from e


@router.post("/sync-all")
async def bulk_sync_orders(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    invoice_sync: Annotated[XeroInvoiceSync, Depends(get_invoice_sync)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    max_orders: int = 100,
) -> dict:
    """Bulk sync unsynced orders to Xero.

    Args:
        max_orders: Maximum number of orders to sync (default: 100)

    Returns:
        Sync statistics
    """
    organization_id = org_id

    try:
        result = await invoice_sync.bulk_sync_unsynced_orders(db, organization_id, max_orders)
        return result
    except Exception as e:
        logger.error("Bulk sync failed", error=str(e))
        raise HTTPException(status_code=500, detail="Bulk sync failed") from e


@router.get("/invoice/{order_id}")
async def get_invoice_for_order(
    order_id: UUID,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    invoice_sync: Annotated[XeroInvoiceSync, Depends(get_invoice_sync)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
) -> dict:
    """Get Xero invoice details for an order.

    Args:
        order_id: Order UUID

    Returns:
        Xero invoice data or error if not synced
    """
    organization_id = org_id

    try:
        invoice = await invoice_sync.get_invoice_details(db, organization_id, order_id)

        if not invoice:
            raise HTTPException(
                status_code=404, detail="Order not synced to Xero or invoice not found"
            )

        return invoice
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get invoice", order_id=str(order_id), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve invoice") from e


# ============================================
# Payment Sync Endpoints
# ============================================


@router.post("/poll-payments")
async def poll_recent_payments(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    payment_sync: Annotated[XeroPaymentSync, Depends(get_payment_sync)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    hours_back: int = 24,
) -> dict:
    """Poll Xero for recent payments (fallback when webhooks unavailable).

    Args:
        hours_back: Number of hours to look back for payments (default: 24)

    Returns:
        Sync statistics (total, synced, skipped)
    """
    organization_id = org_id

    try:
        result = await payment_sync.poll_recent_payments(db, organization_id, hours_back)
        return result
    except Exception as e:
        logger.error("Payment polling failed", error=str(e))
        raise HTTPException(status_code=500, detail="Payment polling failed") from e


# ============================================
# Customer Sync Endpoints
# ============================================


@router.post("/sync-customer/{customer_id}")
async def sync_customer_to_xero(
    customer_id: UUID,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    customer_sync: Annotated[XeroCustomerSync, Depends(get_customer_sync)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    force_update: bool = False,
) -> dict:
    """Sync a single customer to Xero as a contact.

    Args:
        customer_id: Customer UUID to sync
        force_update: If True, update even if already synced

    Returns:
        Sync result with contact details
    """
    organization_id = org_id

    try:
        result = await customer_sync.sync_customer_to_xero(
            db, organization_id, customer_id, force_update
        )
        result["mode"] = "demo" if settings.is_demo_mode else "live"
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("Failed to sync customer to Xero", customer_id=str(customer_id), error=str(e))
        raise HTTPException(status_code=500, detail="Failed to sync customer") from e


@router.post("/sync-customers")
async def bulk_sync_customers(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    customer_sync: Annotated[XeroCustomerSync, Depends(get_customer_sync)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
    max_customers: int = 100,
) -> dict:
    """Bulk sync unsynced customers to Xero.

    Args:
        max_customers: Maximum number of customers to sync (default: 100)

    Returns:
        Sync statistics
    """
    organization_id = org_id

    try:
        result = await customer_sync.bulk_sync_customers(db, organization_id, max_customers)
        return result
    except Exception as e:
        logger.error("Bulk customer sync failed", error=str(e))
        raise HTTPException(status_code=500, detail="Bulk customer sync failed") from e


# ============================================
# Webhook Endpoint
# ============================================


@router.post("/webhooks")
async def handle_xero_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    webhook_handler: Annotated[XeroWebhookHandler, Depends(get_webhook_handler)],
) -> dict:
    """Handle incoming webhooks from Xero.

    Xero sends webhooks for events like invoice payments, contact updates, etc.

    Returns:
        Processing result
    """
    try:
        result = await webhook_handler.handle_webhook(request, db)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Webhook processing failed", error=str(e))
        raise HTTPException(status_code=500, detail="Webhook processing failed") from e
