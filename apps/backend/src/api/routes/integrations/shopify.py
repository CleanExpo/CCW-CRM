"""Shopify integration API endpoints.

Provides API routes for managing Shopify connection, importing orders,
and syncing inventory.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.config.shopify_settings import ShopifySettings, get_shopify_settings
from src.db.shopify_models import ShopifyConnection
from src.integrations.shopify.client import get_shopify_client
from src.integrations.shopify.inventory import ShopifyInventorySyncer
from src.integrations.shopify.orders import ShopifyOrderImporter
from src.integrations.shopify.webhooks import ShopifyWebhookHandler

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/shopify", tags=["Shopify Integration"])


# Connection Management Endpoints


@router.get("/test")
async def test_shopify_authentication(
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Test Shopify API authentication (ISS-008 diagnostic endpoint).

    Returns detailed shop information if authentication succeeds.
    Provides troubleshooting guidance if authentication fails.

    This endpoint is specifically designed to diagnose ISS-008 (401 Unauthorized errors).
    """
    logger.info("testing_shopify_authentication")

    if settings.is_demo_mode:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Demo mode active",
                "message": "Set SHOPIFY_MODE=live in .env to test real authentication",
                "shop_domain": settings.shop_domain,
                "mode": settings.mode,
            },
        )

    try:
        async with get_shopify_client() as client:
            shop_data = await client.get_shop_info()
            shop_info = shop_data.get("shop", {})

            return {
                "status": "success",
                "message": "Shopify authentication successful",
                "shop": {
                    "name": shop_info.get("name"),
                    "email": shop_info.get("email"),
                    "domain": shop_info.get("domain"),
                    "shop_owner": shop_info.get("shop_owner"),
                    "country": shop_info.get("country_name"),
                    "currency": shop_info.get("currency"),
                    "plan": shop_info.get("plan_display_name"),
                    "created_at": shop_info.get("created_at"),
                },
                "api_version": settings.api_version,
                "admin_api_url": settings.admin_api_url,
            }

    except ValueError as e:
        error_msg = str(e)

        # Check for 401 errors
        if "401" in error_msg:
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "Shopify authentication failed",
                    "message": error_msg,
                    "troubleshooting": {
                        "possible_causes": [
                            "Invalid or expired access token",
                            "Insufficient API scopes",
                            "Wrong shop domain",
                            "API access disabled",
                        ],
                        "fix_steps": [
                            "1. Go to Shopify Admin > Settings > Apps and sales channels",
                            "2. Click 'Develop apps' > Select your app or create new one",
                            "3. Click 'Configure Admin API scopes'",
                            "4. Enable required scopes: read_products, write_products, read_orders, read_inventory",
                            "5. Save and install/reinstall the app",
                            "6. Generate a new Admin API access token",
                            "7. Update SHOPIFY_ACCESS_TOKEN in .env",
                        ],
                    },
                    "current_config": {
                        "shop_domain": settings.shop_domain,
                        "api_version": settings.api_version,
                        "admin_api_url": settings.admin_api_url,
                    },
                },
            ) from e

        # Check for 404 errors
        elif "404" in error_msg:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "Shop not found",
                    "message": error_msg,
                    "troubleshooting": {
                        "possible_causes": [
                            "Incorrect shop domain",
                            "Wrong API version",
                        ],
                        "fix_steps": [
                            "1. Verify SHOPIFY_SHOP_DOMAIN is correct (e.g., your-store.myshopify.com)",
                            "2. Check SHOPIFY_API_VERSION (try 2024-01 or 2023-10)",
                        ],
                    },
                    "current_config": {
                        "shop_domain": settings.shop_domain,
                        "api_version": settings.api_version,
                    },
                },
            ) from e

        # Other errors
        else:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Shopify API error",
                    "message": error_msg,
                },
            ) from e


@router.get("/scopes")
async def check_shopify_scopes(
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Check which Shopify API scopes are accessible (ISS-008 diagnostic endpoint).

    Tests access to common API endpoints to verify scope permissions.
    Useful for diagnosing permission issues after authentication succeeds.
    """
    logger.info("checking_shopify_scopes")

    if settings.is_demo_mode:
        raise HTTPException(
            status_code=503,
            detail="Demo mode active. Set SHOPIFY_MODE=live to test scopes.",
        )

    scopes_result = {
        "read_products": {"accessible": False, "error": None},
        "read_orders": {"accessible": False, "error": None},
        "read_inventory": {"accessible": False, "error": None},
    }

    try:
        async with get_shopify_client() as client:
            # Test read_products scope
            try:
                await client.get_products(limit=1)
                scopes_result["read_products"]["accessible"] = True
            except ValueError as e:
                scopes_result["read_products"]["error"] = str(e)

            # Test read_orders scope
            try:
                await client.get_orders(limit=1)
                scopes_result["read_orders"]["accessible"] = True
            except ValueError as e:
                scopes_result["read_orders"]["error"] = str(e)

            # Test read_inventory scope
            try:
                await client.get_locations()
                scopes_result["read_inventory"]["accessible"] = True
            except ValueError as e:
                scopes_result["read_inventory"]["error"] = str(e)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error checking scopes: {str(e)}",
        ) from e

    # Summary
    accessible_count = sum(
        1 for scope in scopes_result.values() if scope["accessible"]
    )
    total_count = len(scopes_result)

    return {
        "status": "success" if accessible_count == total_count else "partial",
        "accessible_scopes": accessible_count,
        "total_scopes": total_count,
        "scopes": scopes_result,
        "recommendation": (
            "All required scopes are accessible!"
            if accessible_count == total_count
            else "Some scopes are missing. Update API scopes in Shopify Admin."
        ),
    }


@router.get("/config")
async def get_shopify_config(
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Get current Shopify configuration (ISS-008 diagnostic endpoint).

    Returns configuration info for debugging without exposing full credentials.
    """
    logger.info("getting_shopify_config")

    # Show first 10 characters of access token for verification
    token_preview = (
        settings.access_token[:10] + "..." if len(settings.access_token) > 10 else "***"
    )

    return {
        "mode": settings.mode,
        "is_demo_mode": settings.is_demo_mode,
        "is_live_mode": settings.is_live_mode,
        "shop_domain": settings.shop_domain,
        "shop_url": settings.shop_url,
        "admin_api_url": settings.admin_api_url,
        "api_version": settings.api_version,
        "access_token_preview": token_preview,
        "sync_inventory": settings.sync_inventory,
        "inventory_location_id": settings.inventory_location_id,
    }


@router.get("/status")
async def get_connection_status(
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get Shopify connection status.

    Returns connection details and mode (demo/live).
    """
    logger.info("checking_shopify_status")

    if settings.is_demo_mode:
        return {
            "connected": True,
            "mode": "demo",
            "shop_domain": settings.shop_domain,
            "shop_name": "Demo Equipment Store",
            "message": "Running in demo mode - no real Shopify connection",
        }

    # Check for active connection in database
    stmt = select(ShopifyConnection).where(ShopifyConnection.is_active is True)
    result = await db.execute(stmt)
    connection = result.scalars().first()

    if not connection:
        return {
            "connected": False,
            "mode": "live",
            "message": "No active Shopify connection found",
        }

    return {
        "connected": True,
        "mode": "live",
        "shop_domain": connection.shop_domain,
        "shop_name": connection.shop_name,
        "last_order_sync": (
            connection.last_order_sync.isoformat()
            if connection.last_order_sync
            else None
        ),
        "last_inventory_sync": (
            connection.last_inventory_sync.isoformat()
            if connection.last_inventory_sync
            else None
        ),
    }


@router.post("/connect")
async def connect_shopify(
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Connect to Shopify store.

    In demo mode, simulates connection. In live mode, validates credentials.
    """
    logger.info("connecting_to_shopify")

    if settings.is_demo_mode:
        return {
            "success": True,
            "mode": "demo",
            "shop_domain": settings.shop_domain,
            "message": "Demo mode activated - simulating Shopify connection",
        }

    # Validate credentials by fetching shop info
    client = get_shopify_client(settings)

    try:
        async with client:
            shop_data = await client.get_shop_info()
            shop = shop_data.get("shop", {})

        # Store or update connection
        stmt = select(ShopifyConnection).where(
            ShopifyConnection.shop_domain == settings.shop_domain
        )
        result = await db.execute(stmt)
        connection = result.scalars().first()

        if connection:
            # Update existing
            connection.is_active = True
            connection.shop_name = shop.get("name", settings.shop_domain)
            connection.shop_id = shop.get("id")
            connection.currency = shop.get("currency")
            connection.timezone = shop.get("timezone")
            connection.email = shop.get("email")
            connection.phone = shop.get("phone")
        else:
            # Create new connection
            from uuid import uuid4

            connection = ShopifyConnection(
                id=uuid4(),
                shop_domain=settings.shop_domain,
                shop_name=shop.get("name", settings.shop_domain),
                access_token=settings.access_token,
                api_key=settings.api_key,
                api_secret=settings.api_secret,
                webhook_secret=settings.webhook_secret,
                api_version=settings.api_version,
                is_active=True,
                shop_id=shop.get("id"),
                currency=shop.get("currency"),
                timezone=shop.get("timezone"),
                email=shop.get("email"),
                phone=shop.get("phone"),
            )
            db.add(connection)

        await db.commit()

        return {
            "success": True,
            "mode": "live",
            "shop_domain": connection.shop_domain,
            "shop_name": connection.shop_name,
        }

    except Exception as e:
        logger.error("shopify_connection_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to Shopify: {str(e)}",
        ) from e


@router.post("/disconnect")
async def disconnect_shopify(
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Disconnect from Shopify store."""
    logger.info("disconnecting_shopify")

    if settings.is_demo_mode:
        return {
            "success": True,
            "mode": "demo",
            "message": "Demo mode connection disconnected",
        }

    # Deactivate connection
    stmt = select(ShopifyConnection).where(
        ShopifyConnection.shop_domain == settings.shop_domain
    )
    result = await db.execute(stmt)
    connection = result.scalars().first()

    if connection:
        connection.is_active = False
        await db.commit()

    return {"success": True, "message": "Shopify connection disconnected"}


# Order Import Endpoints


@router.post("/import-order/{order_id}")
async def import_order(
    order_id: int,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Import a single order from Shopify by ID.

    Args:
        order_id: Shopify order ID to import
    """
    logger.info("importing_order", order_id=order_id)

    client = get_shopify_client(settings)
    importer = ShopifyOrderImporter(db, client)

    try:
        async with client:
            order = await importer.import_order(order_id)

        return {
            "success": True,
            "mode": "demo" if settings.is_demo_mode else "live",
            "order_id": str(order.id),
            "order_number": order.order_number,
            "customer_id": str(order.customer_id),
            "total": float(order.total),
            "status": order.status.value,
            "shopify_order_id": order_id,
        }

    except Exception as e:
        logger.error("order_import_failed", order_id=order_id, error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to import order: {str(e)}",
        ) from e


@router.post("/import-orders")
async def import_recent_orders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    max_orders: int = 50,
    created_after: str | None = None,
) -> dict:
    """Import recent orders from Shopify.

    Args:
        max_orders: Maximum number of orders to import (default: 50)
        created_after: ISO 8601 date to filter orders (optional)
    """
    logger.info("importing_recent_orders", max_orders=max_orders)

    client = get_shopify_client(settings)
    importer = ShopifyOrderImporter(db, client)

    try:
        async with client:
            orders = await importer.import_recent_orders(
                limit=max_orders,
                created_after=created_after,
            )

        return {
            "success": True,
            "mode": "demo" if settings.is_demo_mode else "live",
            "imported_count": len(orders),
            "orders": [
                {
                    "id": str(order.id),
                    "order_number": order.order_number,
                    "total": float(order.total),
                    "status": order.status.value,
                }
                for order in orders
            ],
        }

    except Exception as e:
        logger.error("bulk_import_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to import orders: {str(e)}",
        ) from e


# Inventory Sync Endpoints


@router.post("/sync-inventory/{product_id}")
async def sync_product_inventory(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Sync a single product's inventory to Shopify.

    Args:
        product_id: ERP product ID (UUID string)
    """
    logger.info("syncing_product_inventory", product_id=product_id)

    client = get_shopify_client(settings)
    syncer = ShopifyInventorySyncer(db, client)

    try:
        from uuid import UUID

        product_uuid = UUID(product_id)

        async with client:
            result = await syncer.sync_product_inventory(product_uuid)

        return {
            **result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "inventory_sync_failed",
            product_id=product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to sync inventory: {str(e)}",
        ) from e


@router.post("/sync-all-inventory")
async def sync_all_inventory(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Sync inventory for all mapped products to Shopify."""
    logger.info("syncing_all_inventory")

    client = get_shopify_client(settings)
    syncer = ShopifyInventorySyncer(db, client)

    try:
        async with client:
            result = await syncer.sync_all_inventory()

        return {
            **result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except Exception as e:
        logger.error("bulk_inventory_sync_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to sync inventory: {str(e)}",
        ) from e


@router.post("/sync-product/{product_id}")
async def sync_product_to_shopify(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Sync product details (name, price, etc.) to Shopify.

    Creates or updates the product in Shopify.

    Args:
        product_id: ERP product ID (UUID string)
    """
    logger.info("syncing_product_to_shopify", product_id=product_id)

    client = get_shopify_client(settings)
    syncer = ShopifyInventorySyncer(db, client)

    try:
        from uuid import UUID

        product_uuid = UUID(product_id)

        async with client:
            result = await syncer.sync_product_to_shopify(product_uuid)

        return {
            **result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "product_sync_failed",
            product_id=product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to sync product: {str(e)}",
        ) from e


# Webhook Endpoint


@router.post("/webhooks")
async def handle_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    x_shopify_topic: Annotated[str | None, Header()] = None,
    x_shopify_shop_domain: Annotated[str | None, Header()] = None,
    x_shopify_webhook_id: Annotated[str | None, Header()] = None,
    x_shopify_hmac_sha256: Annotated[str | None, Header()] = None,
) -> dict:
    """Handle incoming Shopify webhooks.

    Verifies webhook signature and processes the webhook payload.
    """
    logger.info(
        "webhook_received",
        topic=x_shopify_topic,
        shop=x_shopify_shop_domain,
    )

    # Get raw body for signature verification
    body = await request.body()

    # Verify webhook signature (only in live mode)
    if not settings.is_demo_mode and x_shopify_hmac_sha256:
        client = get_shopify_client(settings)
        if not client.verify_webhook(body, x_shopify_hmac_sha256):
            logger.warning("webhook_signature_verification_failed")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse JSON payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.error("webhook_payload_parse_failed", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from e

    # Process webhook
    client = get_shopify_client(settings)
    handler = ShopifyWebhookHandler(db, client)

    try:
        result = await handler.handle_webhook(
            topic=x_shopify_topic or "unknown",
            shop_domain=x_shopify_shop_domain or settings.shop_domain,
            payload=payload,
            webhook_id=x_shopify_webhook_id,
            headers=dict(request.headers),
        )

        return result

    except Exception as e:
        logger.error("webhook_processing_failed", error=str(e))
        # Return 200 to prevent Shopify from retrying
        # Error is logged in database
        return {"success": False, "error": str(e)}
