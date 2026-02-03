"""Shopify integration API endpoints.

Provides API routes for managing Shopify connection, importing orders,
and syncing inventory.

PHASE: Enhanced Shopify Integration - Task 1.3: Bulk metafield sync endpoints.
"""

from datetime import datetime
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
from src.integrations.shopify.inventory_sync import InventorySyncService
from src.integrations.shopify.orders import ShopifyOrderImporter
from src.integrations.shopify.product_sync import BidirectionalProductSyncer
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


# Bidirectional Product Sync Endpoints (ISS-009)


@router.post("/sync-from-shopify/{shopify_product_id}")
async def sync_product_from_shopify(
    shopify_product_id: int,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    force: bool = False,
) -> dict:
    """Sync a product from Shopify to ERP (Shopify → ERP direction).

    Args:
        shopify_product_id: Shopify product ID
        force: Force sync even if conflict detected

    Returns:
        Sync result
    """
    logger.info(
        "syncing_from_shopify",
        shopify_product_id=shopify_product_id,
        force=force,
    )

    client = get_shopify_client(settings)
    syncer = BidirectionalProductSyncer(db, client)

    try:
        async with client:
            result = await syncer.sync_from_shopify(
                shopify_product_id=shopify_product_id,
                force=force,
            )

        return {
            **result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except Exception as e:
        logger.error(
            "sync_from_shopify_failed",
            shopify_product_id=shopify_product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to sync from Shopify: {str(e)}",
        ) from e


@router.post("/sync-to-shopify/{product_id}")
async def sync_product_to_shopify_bidirectional(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    force: bool = False,
) -> dict:
    """Sync a product from ERP to Shopify (ERP → Shopify direction).

    Args:
        product_id: ERP product ID (UUID string)
        force: Force sync even if conflict detected

    Returns:
        Sync result
    """
    logger.info("syncing_to_shopify_bidirectional", product_id=product_id, force=force)

    client = get_shopify_client(settings)
    syncer = BidirectionalProductSyncer(db, client)

    try:
        from uuid import UUID

        product_uuid = UUID(product_id)

        async with client:
            result = await syncer.sync_to_shopify(
                product_id=product_uuid,
                force=force,
            )

        return {
            **result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "sync_to_shopify_failed",
            product_id=product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to sync to Shopify: {str(e)}",
        ) from e


@router.get("/sync-status")
async def get_all_sync_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Get sync status for all mapped products (ISS-009 dashboard).

    Returns:
        Sync status summary and list of all product mappings
    """
    logger.info("getting_all_sync_status")

    client = get_shopify_client(settings)
    syncer = BidirectionalProductSyncer(db, client)

    try:
        async with client:
            status = await syncer.get_sync_status()

        return {
            **status,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except Exception as e:
        logger.error("get_sync_status_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to get sync status: {str(e)}",
        ) from e


@router.get("/sync-status/{product_id}")
async def get_product_sync_status(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Get sync status for a specific product (ISS-009 dashboard).

    Args:
        product_id: ERP product ID (UUID string)

    Returns:
        Product sync status details
    """
    logger.info("getting_product_sync_status", product_id=product_id)

    client = get_shopify_client(settings)
    syncer = BidirectionalProductSyncer(db, client)

    try:
        from uuid import UUID

        product_uuid = UUID(product_id)

        async with client:
            status = await syncer.get_sync_status(product_id=product_uuid)

        return {
            **status,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "get_product_sync_status_failed",
            product_id=product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to get sync status: {str(e)}",
        ) from e


# Real-Time Inventory Sync Endpoints (ISS-010)


@router.post("/inventory/sync-to-shopify/{product_id}")
async def sync_inventory_to_shopify_realtime(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Sync inventory from ERP to Shopify (ERP → Shopify direction).

    Real-time inventory synchronization with automatic retry logic.

    Args:
        product_id: ERP product ID (UUID string)

    Returns:
        Sync result with audit trail
    """
    logger.info("syncing_inventory_to_shopify", product_id=product_id)

    client = get_shopify_client(settings)
    sync_service = InventorySyncService(client)

    try:
        from uuid import UUID

        product_uuid = UUID(product_id)

        # Get product mapping to get Shopify IDs
        from sqlalchemy import select
        from src.db.shopify_models import ShopifyProductMapping

        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_uuid
        )
        result = await db.execute(stmt)
        mapping = result.scalar_one_or_none()

        if not mapping:
            raise HTTPException(
                status_code=404,
                detail=f"Product {product_id} not mapped to Shopify",
            )

        async with client:
            sync_result = await sync_service.sync_stock_to_shopify(
                db=db,
                product_id=product_uuid,
                shopify_product_id=mapping.shopify_product_id,
                shopify_inventory_item_id=mapping.shopify_inventory_item_id,
                shopify_location_id=settings.inventory_location_id,
                triggered_by="manual",
            )

        return {
            **sync_result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "inventory_sync_to_shopify_failed",
            product_id=product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to sync inventory: {str(e)}",
        ) from e


@router.post("/inventory/sync-from-shopify/{shopify_product_id}")
async def sync_inventory_from_shopify_realtime(
    shopify_product_id: int,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    new_quantity: int | None = None,
) -> dict:
    """Sync inventory from Shopify to ERP (Shopify → ERP direction).

    Real-time inventory synchronization triggered by manual action or webhook.

    Args:
        shopify_product_id: Shopify product ID
        new_quantity: New quantity from Shopify (if not provided, fetches from API)

    Returns:
        Sync result with audit trail
    """
    logger.info(
        "syncing_inventory_from_shopify",
        shopify_product_id=shopify_product_id,
        new_quantity=new_quantity,
    )

    client = get_shopify_client(settings)
    sync_service = InventorySyncService(client)

    try:
        # Get product mapping
        from sqlalchemy import select
        from src.db.shopify_models import ShopifyProductMapping

        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.shopify_product_id == shopify_product_id
        )
        result = await db.execute(stmt)
        mapping = result.scalar_one_or_none()

        if not mapping:
            raise HTTPException(
                status_code=404,
                detail=f"Shopify product {shopify_product_id} not mapped to ERP",
            )

        # If no quantity provided, fetch from Shopify API
        if new_quantity is None:
            async with client:
                product_data = await client.get(f"/products/{shopify_product_id}.json")
                if product_data and "product" in product_data:
                    variants = product_data["product"].get("variants", [])
                    if variants:
                        new_quantity = variants[0].get("inventory_quantity", 0)
                else:
                    raise ValueError("Could not fetch product data from Shopify")

        async with client:
            sync_result = await sync_service.sync_stock_from_shopify(
                db=db,
                product_id=mapping.product_id,
                shopify_product_id=shopify_product_id,
                new_shopify_quantity=new_quantity,
                triggered_by="manual",
            )

        return {
            **sync_result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "inventory_sync_from_shopify_failed",
            shopify_product_id=shopify_product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to sync inventory: {str(e)}",
        ) from e


@router.get("/inventory/sync-history/{product_id}")
async def get_inventory_sync_history(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    limit: int = 50,
) -> dict:
    """Get inventory sync history for a product.

    Returns audit trail of all inventory sync operations.

    Args:
        product_id: ERP product ID (UUID string)
        limit: Maximum number of records to return (default: 50)

    Returns:
        List of sync history records
    """
    logger.info("getting_inventory_sync_history", product_id=product_id, limit=limit)

    client = get_shopify_client(settings)
    sync_service = InventorySyncService(client)

    try:
        from uuid import UUID

        product_uuid = UUID(product_id)

        async with client:
            history = await sync_service.get_sync_history(
                db=db,
                product_id=product_uuid,
                limit=limit,
            )

        return {
            "product_id": product_id,
            "history": history,
            "count": len(history),
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "get_inventory_sync_history_failed",
            product_id=product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to get sync history: {str(e)}",
        ) from e


@router.post("/inventory/resolve-conflict/{product_id}")
async def resolve_inventory_conflict(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    resolution: str = "erp_wins",
) -> dict:
    """Resolve inventory sync conflict for a product.

    Args:
        product_id: ERP product ID (UUID string)
        resolution: Conflict resolution strategy ("erp_wins" or "shopify_wins")

    Returns:
        Conflict resolution result
    """
    logger.info(
        "resolving_inventory_conflict",
        product_id=product_id,
        resolution=resolution,
    )

    if resolution not in ["erp_wins", "shopify_wins"]:
        raise HTTPException(
            status_code=400,
            detail="Resolution must be 'erp_wins' or 'shopify_wins'",
        )

    client = get_shopify_client(settings)
    sync_service = InventorySyncService(client)

    try:
        from uuid import UUID

        product_uuid = UUID(product_id)

        # Get product mapping
        from sqlalchemy import select
        from src.db.shopify_models import ShopifyProductMapping

        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_uuid
        )
        result = await db.execute(stmt)
        mapping = result.scalar_one_or_none()

        if not mapping:
            raise HTTPException(
                status_code=404,
                detail=f"Product {product_id} not mapped to Shopify",
            )

        async with client:
            resolve_result = await sync_service.resolve_sync_conflict(
                db=db,
                product_id=product_uuid,
                shopify_product_id=mapping.shopify_product_id,
                resolution=resolution,
            )

        return {
            **resolve_result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(
            "resolve_inventory_conflict_failed",
            product_id=product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to resolve conflict: {str(e)}",
        ) from e


@router.post("/inventory/bulk-sync-to-shopify")
async def bulk_sync_inventory_to_shopify(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
    product_ids: list[str] | None = None,
) -> dict:
    """Bulk sync inventory from ERP to Shopify.

    If product_ids not provided, syncs all mapped products.

    Args:
        product_ids: List of ERP product IDs (UUID strings), or None for all

    Returns:
        Bulk sync results
    """
    logger.info("bulk_syncing_inventory_to_shopify", product_ids=product_ids)

    client = get_shopify_client(settings)
    sync_service = InventorySyncService(client)

    try:
        from uuid import UUID

        product_uuids = None
        if product_ids:
            product_uuids = [UUID(pid) for pid in product_ids]

        async with client:
            bulk_result = await sync_service.bulk_sync_to_shopify(
                db=db,
                product_ids=product_uuids,
            )

        return {
            **bulk_result,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("bulk_inventory_sync_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to bulk sync inventory: {str(e)}",
        ) from e


@router.post("/inventory/reconcile")
async def reconcile_inventory(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Reconcile inventory between ERP and Shopify.

    Compares inventory levels in both systems and reports discrepancies.
    Does not make changes - returns a report for review.

    Returns:
        Reconciliation report with discrepancies
    """
    logger.info("reconciling_inventory")

    client = get_shopify_client(settings)

    try:
        from sqlalchemy import select
        from src.db.shopify_models import ShopifyProductMapping
        from src.db.models.prd import Product

        # Get all mapped products
        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.shopify_product_id.isnot(None)
        )
        result = await db.execute(stmt)
        mappings = result.scalars().all()

        discrepancies = []
        matched = 0
        errors = []

        async with client:
            for mapping in mappings:
                try:
                    # Get ERP stock
                    product_stmt = select(Product).where(Product.id == mapping.product_id)
                    product_result = await db.execute(product_stmt)
                    product = product_result.scalar_one_or_none()

                    if not product:
                        errors.append({
                            "product_id": str(mapping.product_id),
                            "error": "Product not found in ERP",
                        })
                        continue

                    erp_stock = product.stock or 0

                    # Get Shopify stock
                    shopify_data = await client.get(
                        f"/products/{mapping.shopify_product_id}.json"
                    )

                    if not shopify_data or "product" not in shopify_data:
                        errors.append({
                            "product_id": str(mapping.product_id),
                            "shopify_product_id": mapping.shopify_product_id,
                            "error": "Could not fetch from Shopify",
                        })
                        continue

                    variants = shopify_data["product"].get("variants", [])
                    if not variants:
                        errors.append({
                            "product_id": str(mapping.product_id),
                            "shopify_product_id": mapping.shopify_product_id,
                            "error": "No variants found",
                        })
                        continue

                    shopify_stock = variants[0].get("inventory_quantity", 0)

                    # Check for discrepancy
                    if erp_stock != shopify_stock:
                        discrepancies.append({
                            "product_id": str(mapping.product_id),
                            "sku": product.sku,
                            "name": product.name,
                            "shopify_product_id": mapping.shopify_product_id,
                            "erp_stock": erp_stock,
                            "shopify_stock": shopify_stock,
                            "difference": erp_stock - shopify_stock,
                        })
                    else:
                        matched += 1

                except Exception as e:
                    errors.append({
                        "product_id": str(mapping.product_id),
                        "error": str(e),
                    })

        return {
            "total_mapped": len(mappings),
            "matched": matched,
            "discrepancies_count": len(discrepancies),
            "discrepancies": discrepancies,
            "errors_count": len(errors),
            "errors": errors,
            "mode": "demo" if settings.is_demo_mode else "live",
        }

    except Exception as e:
        logger.error("inventory_reconciliation_failed", error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Failed to reconcile inventory: {str(e)}",
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


# PHASE: Enhanced Shopify Integration - Task 1.3: Bulk Metafield Sync
# Metafield Sync Endpoints


@router.post("/metafields/sync-all")
async def sync_all_metafields(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Bulk sync metafields for all products mapped to Shopify.

    PHASE: Enhanced Shopify Integration - Task 1.3
    Syncs custom metafields (dimensions, weight, brand, certification_expiry) for all
    products that have Shopify mappings. Publishes SSE events for real-time progress.

    Returns:
        Summary of sync results including successful and failed products.
    """
    from src.db.shopify_models import ShopifyProductMapping
    from src.integrations.shopify.metafields import get_metafield_manager
    from src.services.sse_service import sse_service

    logger.info("bulk_metafield_sync_started")

    # Get all products with Shopify mappings
    mapping_query = select(ShopifyProductMapping).where(
        ShopifyProductMapping.sync_status.in_(["synced", "pending"])
    )
    result = await db.execute(mapping_query)
    mappings = result.scalars().all()

    if not mappings:
        logger.info("no_shopify_mappings_found")
        return {
            "success": True,
            "total": 0,
            "successful": 0,
            "failed": 0,
            "errors": [],
            "message": "No products mapped to Shopify",
        }

    logger.info("shopify_mappings_found", count=len(mappings))

    # Initialize results
    results = {
        "total": len(mappings),
        "successful": 0,
        "failed": 0,
        "errors": [],
        "synced_products": [],
    }

    # Publish SSE event: Bulk sync started
    await sse_service.publish("shopify-metafield-sync", {
        "event_type": "bulk_sync_started",
        "total_products": len(mappings),
        "timestamp": datetime.now().isoformat(),
    })

    # Get metafield manager
    metafield_manager = get_metafield_manager()

    # Process each product
    for idx, mapping in enumerate(mappings):
        try:
            # Publish SSE event: Processing product
            await sse_service.publish("shopify-metafield-sync", {
                "event_type": "sync_progress",
                "product_id": str(mapping.product_id),
                "shopify_product_id": str(mapping.shopify_product_id),
                "progress": idx + 1,
                "total": len(mappings),
                "percent": round(((idx + 1) / len(mappings)) * 100, 1),
                "timestamp": datetime.now().isoformat(),
            })

            # Sync metafields for this product
            sync_result = await metafield_manager.sync_product_metafields(
                db=db,
                product_id=mapping.product_id,
                shopify_product_id=str(mapping.shopify_product_id),
            )

            if sync_result["success"]:
                results["successful"] += 1
                results["synced_products"].append({
                    "product_id": str(mapping.product_id),
                    "shopify_product_id": str(mapping.shopify_product_id),
                    "synced_count": sync_result.get("synced_count", 0),
                    "synced_metafields": sync_result.get("synced_metafields", []),
                })

                logger.info(
                    "product_metafields_synced",
                    product_id=str(mapping.product_id),
                    synced_count=sync_result.get("synced_count", 0),
                )
            else:
                results["failed"] += 1
                error_msg = f"Product {mapping.product_id}: {', '.join(sync_result.get('errors', []))}"
                results["errors"].append(error_msg)

                logger.error(
                    "product_metafield_sync_failed",
                    product_id=str(mapping.product_id),
                    errors=sync_result.get("errors", []),
                )

        except Exception as e:
            results["failed"] += 1
            error_msg = f"Product {mapping.product_id}: {str(e)}"
            results["errors"].append(error_msg)

            logger.error(
                "metafield_sync_exception",
                product_id=str(mapping.product_id),
                error=str(e),
            )

    # Publish SSE event: Bulk sync completed
    await sse_service.publish("shopify-metafield-sync", {
        "event_type": "bulk_sync_completed",
        "total": results["total"],
        "successful": results["successful"],
        "failed": results["failed"],
        "timestamp": datetime.now().isoformat(),
    })

    logger.info(
        "bulk_metafield_sync_completed",
        total=results["total"],
        successful=results["successful"],
        failed=results["failed"],
    )

    return {
        "success": results["failed"] == 0,
        **results,
        "message": (
            f"Synced {results['successful']} of {results['total']} products. "
            f"{results['failed']} failed."
        ),
    }


@router.post("/metafields/sync/{product_id}")
async def sync_product_metafields(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[ShopifySettings, Depends(get_shopify_settings)],
) -> dict:
    """Sync metafields for a single product.

    PHASE: Enhanced Shopify Integration - Task 1.3
    Manually triggers metafield sync for a specific product.

    Args:
        product_id: ERP product UUID

    Returns:
        Sync result with synced metafield count and errors.
    """
    from uuid import UUID
    from src.db.shopify_models import ShopifyProductMapping
    from src.integrations.shopify.metafields import get_metafield_manager
    from src.services.sse_service import sse_service

    logger.info("manual_metafield_sync", product_id=product_id)

    # Convert string to UUID
    try:
        product_uuid = UUID(product_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid product_id format: {product_id}",
        ) from e

    # Check if product has Shopify mapping
    mapping_query = select(ShopifyProductMapping).where(
        ShopifyProductMapping.product_id == product_uuid
    )
    mapping_result = await db.execute(mapping_query)
    shopify_mapping = mapping_result.scalar_one_or_none()

    if not shopify_mapping:
        raise HTTPException(
            status_code=404,
            detail=f"Product {product_id} is not mapped to Shopify",
        )

    # Publish SSE event: Sync started
    await sse_service.publish("shopify-metafield-sync", {
        "event_type": "sync_started",
        "product_id": product_id,
        "shopify_product_id": str(shopify_mapping.shopify_product_id),
        "timestamp": datetime.now().isoformat(),
    })

    # Sync metafields
    metafield_manager = get_metafield_manager()
    sync_result = await metafield_manager.sync_product_metafields(
        db=db,
        product_id=product_uuid,
        shopify_product_id=str(shopify_mapping.shopify_product_id),
    )

    # Publish SSE event: Sync completed
    await sse_service.publish("shopify-metafield-sync", {
        "event_type": "sync_completed" if sync_result["success"] else "sync_failed",
        "product_id": product_id,
        "shopify_product_id": str(shopify_mapping.shopify_product_id),
        "synced_count": sync_result.get("synced_count", 0),
        "synced_metafields": sync_result.get("synced_metafields", []),
        "errors": sync_result.get("errors", []),
        "timestamp": datetime.now().isoformat(),
    })

    logger.info(
        "manual_metafield_sync_completed",
        product_id=product_id,
        success=sync_result["success"],
        synced_count=sync_result.get("synced_count", 0),
    )

    return sync_result
