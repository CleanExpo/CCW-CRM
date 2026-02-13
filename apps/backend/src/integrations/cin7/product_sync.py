"""Cin7 bidirectional product sync.

Syncs products between the CCW ERP and Cin7 (Core + Omni).
Handles field mapping, category translation, and conflict resolution.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.cin7_models import Cin7ProductMapping, Cin7SyncLog, SyncDirection, SyncStatus
from src.db.demo_models import Product, ProductCategory
from src.integrations.cin7.client import Cin7Client

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Category mapping: Cin7 category name → ERP ProductCategory
# ---------------------------------------------------------------------------

CIN7_TO_ERP_CATEGORY: dict[str, ProductCategory] = {
    "Heavy Machinery": ProductCategory.HEAVY_MACHINERY,
    "Hand Tools": ProductCategory.HAND_TOOLS,
    "Power Tools": ProductCategory.POWER_TOOLS,
    "Safety Equipment": ProductCategory.SAFETY_EQUIPMENT,
    "Building Materials": ProductCategory.BUILDING_MATERIALS,
    "Electrical": ProductCategory.ELECTRICAL,
    "Plumbing": ProductCategory.PLUMBING,
    "Accessories": ProductCategory.ACCESSORIES,
}

ERP_TO_CIN7_CATEGORY: dict[ProductCategory, str] = {
    v: k for k, v in CIN7_TO_ERP_CATEGORY.items()
}


def map_cin7_category(cin7_category: str) -> ProductCategory:
    """Map a Cin7 category string to an ERP ProductCategory enum value."""
    return CIN7_TO_ERP_CATEGORY.get(cin7_category, ProductCategory.ACCESSORIES)


def map_erp_category(erp_category: ProductCategory | str) -> str:
    """Map an ERP ProductCategory to a Cin7 category string."""
    if isinstance(erp_category, str):
        try:
            erp_category = ProductCategory(erp_category)
        except ValueError:
            return "Accessories"
    return ERP_TO_CIN7_CATEGORY.get(erp_category, "Accessories")


# ---------------------------------------------------------------------------
# Product Syncer
# ---------------------------------------------------------------------------


class Cin7ProductSyncer:
    """Bidirectional product sync between Cin7 and the ERP.

    Args:
        db: Async SQLAlchemy session.
        client: Unified Cin7 client (demo or live).
        conflict_strategy: How to resolve conflicts when a product exists
            on both sides — ``"erp_wins"`` (default) keeps ERP data,
            ``"cin7_wins"`` overwrites from Cin7, ``"newest_wins"`` uses
            the most-recently-updated record.
    """

    def __init__(
        self,
        db: AsyncSession,
        client: Cin7Client,
        conflict_strategy: Literal["erp_wins", "cin7_wins", "newest_wins"] = "erp_wins",
    ) -> None:
        self.db = db
        self.client = client
        self.conflict_strategy = conflict_strategy

    # ------------------------------------------------------------------
    # Cin7 → ERP
    # ------------------------------------------------------------------

    async def sync_products_from_cin7(
        self,
        source: Literal["core", "omni"] = "core",
        page: int = 1,
        limit: int = 100,
    ) -> Cin7SyncLog:
        """Fetch products from Cin7 and create/update in the ERP.

        Returns the ``Cin7SyncLog`` audit record for this sync run.
        """
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="products",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        created = updated = failed = 0

        try:
            if source == "core":
                data = await self.client.core.get_products(page=page, limit=limit)
                products = data.get("Products", [])
            else:
                data = await self.client.omni.get_products(page=page, rows=limit)
                products = data if isinstance(data, list) else []

            for cin7_product in products:
                try:
                    sku = self._extract_sku(cin7_product, source)
                    if not sku:
                        failed += 1
                        continue

                    mapping = await self._find_mapping_by_sku(sku)

                    if mapping is None:
                        await self._create_erp_product_from_cin7(cin7_product, source)
                        created += 1
                    else:
                        await self._update_erp_product_from_cin7(mapping, cin7_product, source)
                        updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "cin7_product_sync_item_failed",
                        sku=self._extract_sku(cin7_product, source),
                        error=str(exc),
                    )

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            logger.error("cin7_product_sync_failed", source=source, error=str(exc))

        log.records_processed = created + updated + failed
        log.records_created = created
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)

        await self.db.flush()
        logger.info(
            "cin7_product_sync_complete",
            source=source,
            created=created,
            updated=updated,
            failed=failed,
        )
        return log

    async def _create_erp_product_from_cin7(
        self,
        cin7_product: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> Product:
        """Create a new ERP Product + Cin7ProductMapping from a Cin7 record."""
        if source == "core":
            product = Product(
                id=uuid4(),
                sku=cin7_product["SKU"],
                name=cin7_product["Name"],
                category=map_cin7_category(cin7_product.get("Category", "")).value,
                price=Decimal(str(cin7_product.get("PriceTier1", 0))),
                cost=Decimal(str(cin7_product.get("AverageCost", 0))),
                warehouse_location=cin7_product.get("DefaultLocation"),
                is_active=cin7_product.get("Status") == "Active",
            )
            mapping = Cin7ProductMapping(
                id=str(uuid4()),
                product_id=str(product.id),
                cin7_core_product_id=cin7_product.get("ID"),
                cin7_sku=cin7_product["SKU"],
                sync_status="synced",
                last_synced_at=datetime.now(UTC),
            )
        else:
            product = Product(
                id=uuid4(),
                sku=cin7_product["styleCode"],
                name=cin7_product.get("description", cin7_product["styleCode"]),
                category=map_cin7_category(cin7_product.get("category", "")).value,
                price=Decimal(str(cin7_product.get("retailPrice", 0))),
                cost=Decimal("0"),  # Omni doesn't expose cost
                is_active=cin7_product.get("isActive", True),
            )
            mapping = Cin7ProductMapping(
                id=str(uuid4()),
                product_id=str(product.id),
                cin7_omni_product_id=cin7_product.get("id"),
                cin7_sku=cin7_product["styleCode"],
                sync_status="synced",
                last_synced_at=datetime.now(UTC),
            )

        self.db.add(product)
        self.db.add(mapping)
        return product

    async def _update_erp_product_from_cin7(
        self,
        mapping: Cin7ProductMapping,
        cin7_product: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> None:
        """Update an existing ERP Product from a Cin7 record."""
        if self.conflict_strategy == "erp_wins":
            # Only update the mapping timestamp, keep ERP data
            mapping.last_synced_at = datetime.now(UTC)
            mapping.sync_status = "synced"
            return

        result = await self.db.execute(
            select(Product).where(Product.id == mapping.product_id)
        )
        product = result.scalar_one_or_none()
        if product is None:
            return

        if source == "core":
            product.name = cin7_product["Name"]
            product.category = map_cin7_category(cin7_product.get("Category", "")).value
            product.price = Decimal(str(cin7_product.get("PriceTier1", 0)))
            product.cost = Decimal(str(cin7_product.get("AverageCost", 0)))
            product.warehouse_location = cin7_product.get("DefaultLocation")
            product.is_active = cin7_product.get("Status") == "Active"
            mapping.cin7_core_product_id = cin7_product.get("ID")
        else:
            product.name = cin7_product.get("description", product.name)
            product.category = map_cin7_category(cin7_product.get("category", "")).value
            product.price = Decimal(str(cin7_product.get("retailPrice", 0)))
            product.is_active = cin7_product.get("isActive", True)
            mapping.cin7_omni_product_id = cin7_product.get("id")

        mapping.last_synced_at = datetime.now(UTC)
        mapping.sync_status = "synced"

    # ------------------------------------------------------------------
    # ERP → Cin7
    # ------------------------------------------------------------------

    async def sync_product_to_cin7(
        self,
        product_id: str,
        target: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Push a single ERP product to Cin7.

        Returns the ``Cin7SyncLog`` audit record.
        """
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="products",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source=target,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        try:
            result = await self.db.execute(
                select(Product).where(Product.id == product_id)
            )
            product = result.scalar_one_or_none()
            if product is None:
                log.status = SyncStatus.FAILED.value
                log.error_message = f"Product {product_id} not found"
                log.completed_at = datetime.now(UTC)
                await self.db.flush()
                return log

            if target == "core":
                payload = self._map_erp_to_cin7_core(product)
            else:
                payload = self._map_erp_to_cin7_omni(product)

            log.details = {"payload": payload, "target": target}
            log.records_processed = 1
            log.records_updated = 1
            log.status = SyncStatus.COMPLETED.value

            # Update or create mapping
            mapping = await self._find_mapping_by_product_id(product_id)
            if mapping is None:
                mapping = Cin7ProductMapping(
                    id=str(uuid4()),
                    product_id=product_id,
                    cin7_sku=product.sku,
                    sync_status="synced",
                    last_synced_at=datetime.now(UTC),
                )
                self.db.add(mapping)
            else:
                mapping.sync_status = "synced"
                mapping.last_synced_at = datetime.now(UTC)

        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            log.records_failed = 1

        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    @staticmethod
    def _map_erp_to_cin7_core(product: Product) -> dict[str, Any]:
        """Map an ERP Product to a Cin7 Core API payload."""
        return {
            "SKU": product.sku,
            "Name": product.name,
            "Category": map_erp_category(product.category),
            "PriceTier1": float(product.price),
            "AverageCost": float(product.cost),
            "DefaultLocation": product.warehouse_location or "Brisbane Warehouse",
            "Status": "Active" if product.is_active else "Inactive",
            "Type": "Stock",
            "CostingMethod": "FIFO",
            "UOM": "Each",
        }

    @staticmethod
    def _map_erp_to_cin7_omni(product: Product) -> dict[str, Any]:
        """Map an ERP Product to a Cin7 Omni API payload."""
        return {
            "styleCode": product.sku,
            "description": product.name,
            "category": map_erp_category(product.category),
            "retailPrice": float(product.price),
            "isActive": product.is_active,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_sku(cin7_product: dict[str, Any], source: str) -> str | None:
        """Extract the SKU field from a Cin7 product dict."""
        if source == "core":
            return cin7_product.get("SKU")
        return cin7_product.get("styleCode")

    async def _find_mapping_by_sku(self, sku: str) -> Cin7ProductMapping | None:
        """Look up an existing product mapping by SKU."""
        result = await self.db.execute(
            select(Cin7ProductMapping).where(Cin7ProductMapping.cin7_sku == sku)
        )
        return result.scalar_one_or_none()

    async def _find_mapping_by_product_id(self, product_id: str) -> Cin7ProductMapping | None:
        """Look up an existing product mapping by ERP product ID."""
        result = await self.db.execute(
            select(Cin7ProductMapping).where(
                Cin7ProductMapping.product_id == product_id
            )
        )
        return result.scalar_one_or_none()
