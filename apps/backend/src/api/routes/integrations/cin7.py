"""Cin7 integration API endpoints.

Provides routes for managing Cin7 Core and Omni connections,
testing connectivity, and previewing data before sync.
"""

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.integrations.cin7.client import Cin7Client, get_cin7_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/cin7", tags=["Cin7 Integration"])


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
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Get current Cin7 integration status and configuration.

    Returns the current mode, sync toggles, and API endpoints configured.
    Does not make any external API calls.
    """
    return {
        "mode": settings.mode,
        "core_api_url": settings.core_api_url,
        "omni_api_url": settings.omni_api_url,
        "sync_config": {
            "products": settings.sync_products,
            "customers": settings.sync_customers,
            "sales": settings.sync_sales,
            "inventory": settings.sync_inventory,
        },
        "timeout": settings.api_timeout,
    }


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
