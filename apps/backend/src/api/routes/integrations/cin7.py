"""Cin7 integration API endpoints.

Provides routes for managing Cin7 Core and Omni connections,
testing connectivity, and previewing data before sync.
"""

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.config.database import get_async_db
from src.db.cin7_models import Cin7Connection
from src.integrations.cin7.client import get_cin7_client
from src.integrations.cin7.inventory_sync import Cin7InventorySyncer
from src.integrations.cin7.product_sync import sync_price_tiers

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/cin7", tags=["Cin7 Integration"])

_DEMO_CREDENTIAL_PREFIXES = ("demo_", "")


class Cin7ConfigureRequest(BaseModel):
    """Credentials to configure the Cin7 integration."""

    core_account_id: str = Field(min_length=1, description="Cin7 Core account ID")
    core_application_key: str = Field(min_length=1, description="Cin7 Core application key")
    omni_username: str | None = Field(default=None, description="Cin7 Omni username (optional)")
    omni_api_key: str | None = Field(default=None, description="Cin7 Omni API key (optional)")


class Cin7StatusResponse(BaseModel):
    """Current Cin7 connection status returned to the frontend."""

    connected: bool
    mode: Literal["demo", "live", "not_configured"]
    core_connected: bool
    omni_connected: bool
    last_sync: str | None = None
    message: str | None = None


def _is_real_credential(value: str | None) -> bool:
    """Return True if value looks like a real (non-demo) credential."""
    if not value:
        return False
    return not any(value.startswith(prefix) for prefix in _DEMO_CREDENTIAL_PREFIXES)


async def _get_active_connection(db: AsyncSession) -> Cin7Connection | None:
    """Fetch the default active Cin7Connection record, or None."""
    result = await db.execute(
        select(Cin7Connection).where(
            Cin7Connection.account_name == "default",
            Cin7Connection.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def _build_status(
    conn: Cin7Connection | None,
    settings: Cin7Settings,
) -> Cin7StatusResponse:
    """Build a Cin7StatusResponse from DB record + env settings."""
    if conn and _is_real_credential(conn.core_account_id):
        return Cin7StatusResponse(
            connected=True,
            mode="live",
            core_connected=bool(conn.core_account_id and conn.core_application_key),
            omni_connected=_is_real_credential(conn.omni_api_key),
            last_sync=conn.last_sync_at.isoformat() if conn.last_sync_at else None,
        )
    if settings.mode == "demo":
        return Cin7StatusResponse(
            connected=True,
            mode="demo",
            core_connected=True,
            omni_connected=True,
            message="Demo mode active — no real API calls",
        )
    return Cin7StatusResponse(
        connected=False,
        mode="not_configured",
        core_connected=False,
        omni_connected=False,
        message="Enter your Cin7 credentials to connect",
    )


@router.get("/test")
async def test_cin7_connection(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Test Cin7 API connectivity for both Core and Omni.

    In demo mode, returns mock connection status.
    In live mode, makes real API calls to verify credentials.
    """
    logger.info("testing_cin7_connection", mode=settings.mode)

    async with get_cin7_client(settings) as client:
        result = await client.test_connection()
        return {
            "status": "success",
            "mode": settings.mode,
            "connections": result,
        }


@router.get("/status")
async def get_cin7_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> Cin7StatusResponse:
    """Get current Cin7 connection status.

    Checks the database for saved credentials first, then falls back to
    environment variable mode (demo/live). Returns a status suitable for
    the frontend connection card.
    """
    conn = await _get_active_connection(db)
    return await _build_status(conn, settings)


@router.post("/configure")
async def configure_cin7(
    request: Cin7ConfigureRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> Cin7StatusResponse:
    """Save Cin7 API credentials to the database.

    Creates or updates the default Cin7Connection record with the supplied
    credentials. Call POST /connect after this to activate the integration.
    """
    logger.info("configuring_cin7_credentials")

    result = await db.execute(
        select(Cin7Connection).where(Cin7Connection.account_name == "default")
    )
    conn = result.scalar_one_or_none()

    if conn:
        conn.core_account_id = request.core_account_id
        conn.core_application_key = request.core_application_key
        conn.omni_username = request.omni_username
        conn.omni_api_key = request.omni_api_key
        conn.is_active = True
        conn.updated_at = datetime.now(UTC)
        conn.connection_type = "both" if request.omni_api_key else "core"
    else:
        conn = Cin7Connection(
            account_name="default",
            connection_type="both" if request.omni_api_key else "core",
            core_account_id=request.core_account_id,
            core_application_key=request.core_application_key,
            omni_username=request.omni_username,
            omni_api_key=request.omni_api_key,
            is_active=True,
        )
        db.add(conn)

    await db.commit()
    await db.refresh(conn)

    logger.info("cin7_credentials_saved", connection_type=conn.connection_type)
    return Cin7StatusResponse(
        connected=True,
        mode="live",
        core_connected=True,
        omni_connected=bool(request.omni_api_key),
        message="Credentials saved. Cin7 integration is now active.",
    )


@router.post("/connect")
async def connect_cin7(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> Cin7StatusResponse:
    """Activate the Cin7 connection.

    In demo mode, enables the demo integration without credentials.
    In live mode, requires saved credentials (call POST /configure first).
    """
    logger.info("connecting_cin7", mode=settings.mode)

    result = await db.execute(
        select(Cin7Connection).where(Cin7Connection.account_name == "default")
    )
    conn = result.scalar_one_or_none()

    if conn and _is_real_credential(conn.core_account_id):
        conn.is_active = True
        await db.commit()
        return Cin7StatusResponse(
            connected=True,
            mode="live",
            core_connected=True,
            omni_connected=_is_real_credential(conn.omni_api_key),
            message="Cin7 integration connected",
        )

    if settings.mode == "demo":
        return Cin7StatusResponse(
            connected=True,
            mode="demo",
            core_connected=True,
            omni_connected=True,
            message="Demo mode active",
        )

    raise HTTPException(
        status_code=400,
        detail="No credentials configured. Use POST /api/integrations/cin7/configure first.",
    )


@router.post("/disconnect")
async def disconnect_cin7(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, str]:
    """Deactivate the Cin7 connection.

    Marks the saved connection as inactive. Credentials are preserved and
    can be re-activated by calling POST /connect.
    """
    logger.info("disconnecting_cin7")

    result = await db.execute(
        select(Cin7Connection).where(Cin7Connection.account_name == "default")
    )
    conn = result.scalar_one_or_none()

    if conn:
        conn.is_active = False
        await db.commit()

    return {"status": "disconnected"}


@router.get("/locations")
async def get_cin7_locations(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Fetch warehouse/branch locations from both Cin7 APIs.

    Useful for verifying credentials and mapping locations to ERP warehouses.
    """
    logger.info("fetching_cin7_locations", mode=settings.mode)

    try:
        async with get_cin7_client(settings) as client:
            core_locations = await client.core.get_locations()
            omni_branches = await client.omni.get_branches()

            return {
                "core_locations": core_locations,
                "omni_branches": omni_branches,
            }
    except Exception as e:
        logger.error("cin7_locations_fetch_failed", error=str(e))
        raise HTTPException(
            status_code=502,
            detail={"error": "Failed to fetch locations from Cin7", "message": str(e)},
        ) from e


@router.get("/products/preview")
async def preview_cin7_products(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    source: str = "core",
    page: int = 1,
    limit: int = 10,
) -> dict[str, Any]:
    """Preview products from Cin7 without syncing.

    Args:
        source: Which API to fetch from — "core" or "omni"
        page: Page number (default: 1)
        limit: Products per page (default: 10, max: 100)
    """
    logger.info("previewing_cin7_products", source=source, page=page, limit=limit)

    if source not in ("core", "omni"):
        raise HTTPException(
            status_code=400,
            detail="source must be 'core' or 'omni'",
        )

    limit = min(limit, 100)

    try:
        async with get_cin7_client(settings) as client:
            if source == "core":
                data = await client.core.get_products(page=page, limit=limit)
                return {
                    "source": "cin7_core",
                    "total": data.get("Total", 0),
                    "page": data.get("Page", page),
                    "products": data.get("Products", []),
                }
            else:
                data = await client.omni.get_products(page=page, rows=limit)
                return {
                    "source": "cin7_omni",
                    "total": len(data) if isinstance(data, list) else 0,
                    "page": page,
                    "products": data if isinstance(data, list) else [],
                }
    except Exception as e:
        logger.error("cin7_products_preview_failed", source=source, error=str(e))
        raise HTTPException(
            status_code=502,
            detail={
                "error": f"Failed to fetch products from Cin7 {source}",
                "message": str(e),
            },
        ) from e


@router.get("/customers/preview")
async def preview_cin7_customers(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    source: str = "core",
    page: int = 1,
    limit: int = 10,
) -> dict[str, Any]:
    """Preview customers/contacts from Cin7 without syncing.

    Args:
        source: Which API to fetch from — "core" or "omni"
        page: Page number
        limit: Records per page (max 100)
    """
    logger.info("previewing_cin7_customers", source=source, page=page, limit=limit)

    if source not in ("core", "omni"):
        raise HTTPException(
            status_code=400,
            detail="source must be 'core' or 'omni'",
        )

    limit = min(limit, 100)

    try:
        async with get_cin7_client(settings) as client:
            if source == "core":
                data = await client.core.get_customers(page=page, limit=limit)
                return {
                    "source": "cin7_core",
                    "total": data.get("Total", 0),
                    "page": data.get("Page", page),
                    "customers": data.get("CustomerList", []),
                }
            else:
                data = await client.omni.get_contacts(page=page, rows=limit)
                return {
                    "source": "cin7_omni",
                    "total": len(data) if isinstance(data, list) else 0,
                    "page": page,
                    "contacts": data if isinstance(data, list) else [],
                }
    except Exception as e:
        logger.error("cin7_customers_preview_failed", source=source, error=str(e))
        raise HTTPException(
            status_code=502,
            detail={
                "error": f"Failed to fetch customers from Cin7 {source}",
                "message": str(e),
            },
        ) from e


class MultiLocationStockRequest(BaseModel):
    """Optional body for sync-multi-location-stock."""

    location_codes: list[str] | None = Field(
        default=None,
        description="Filter to specific location names or IDs. Null syncs all locations.",
    )


@router.post("/sync-price-tiers")
async def sync_cin7_price_tiers(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Sync price tiers from Cin7 Core products.

    Reads PriceTier1/2/3 fields and maps them to retail/wholesale/special tiers.
    Returns a list of {product_id, sku, tiers_synced} for every product processed.
    """
    logger.info("cin7_sync_price_tiers_triggered", mode=settings.mode)
    try:
        async with get_cin7_client(settings) as client:
            result = await sync_price_tiers(client)
        return {"status": "ok", "synced": len(result), "results": result}
    except Exception as e:
        logger.error("cin7_sync_price_tiers_failed", error=str(e))
        raise HTTPException(status_code=502, detail={"error": str(e)}) from e


@router.post("/sync-multi-location-stock")
async def sync_cin7_multi_location_stock(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    body: MultiLocationStockRequest | None = None,
) -> dict[str, Any]:
    """Sync per-location stock levels from Cin7 Core.

    Fetches all warehouse locations (optionally filtered by location_codes),
    then pulls availability data per location.
    Returns {locations_synced, total_products, errors}.
    """
    location_codes = body.location_codes if body else None
    logger.info("cin7_sync_multi_location_stock_triggered", location_codes=location_codes)
    try:
        async with get_cin7_client(settings) as client:
            syncer = Cin7InventorySyncer(client)
            result = await syncer.sync_multi_location_stock(location_codes=location_codes)
        return {"status": "ok", **result}
    except Exception as e:
        logger.error("cin7_sync_multi_location_stock_failed", error=str(e))
        raise HTTPException(status_code=502, detail={"error": str(e)}) from e


@router.get("/inventory/preview")
async def preview_cin7_inventory(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    source: str = "core",
    sku: str | None = None,
) -> dict[str, Any]:
    """Preview stock availability from Cin7 without syncing.

    Args:
        source: Which API to fetch from — "core" or "omni"
        sku: Optional SKU filter
    """
    logger.info("previewing_cin7_inventory", source=source, sku=sku)

    if source not in ("core", "omni"):
        raise HTTPException(
            status_code=400,
            detail="source must be 'core' or 'omni'",
        )

    try:
        async with get_cin7_client(settings) as client:
            if source == "core":
                data = await client.core.get_product_availability(sku=sku)
                return {
                    "source": "cin7_core",
                    "total": data.get("Total", 0),
                    "availability": data.get("ProductAvailabilityList", []),
                }
            else:
                data = await client.omni.get_stock(sku=sku)
                return {
                    "source": "cin7_omni",
                    "total": len(data) if isinstance(data, list) else 0,
                    "stock": data if isinstance(data, list) else [],
                }
    except Exception as e:
        logger.error("cin7_inventory_preview_failed", source=source, error=str(e))
        raise HTTPException(
            status_code=502,
            detail={
                "error": f"Failed to fetch inventory from Cin7 {source}",
                "message": str(e),
            },
        ) from e
