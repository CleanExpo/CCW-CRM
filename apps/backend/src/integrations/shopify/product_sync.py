"""
Bidirectional Product Sync for Shopify Integration (ISS-009).

Handles syncing products in both directions:
- ERP → Shopify: Create/update products in Shopify
- Shopify → ERP: Import products from Shopify to ERP
- Conflict Resolution: Handle concurrent updates in both systems
"""

import uuid
from datetime import datetime
from typing import Any, Literal

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product, ProductCategory
from src.db.shopify_models import ShopifyProductMapping, ShopifyProductSyncLog
from src.integrations.shopify.client import ShopifyClient

logger = structlog.get_logger(__name__)

# Conflict resolution strategies
ConflictStrategy = Literal["erp_wins", "shopify_wins", "newest_wins", "manual"]


class ProductSyncConflict(Exception):
    """Raised when a product sync conflict is detected."""

    def __init__(
        self,
        message: str,
        product_id: uuid.UUID,
        erp_updated_at: datetime,
        shopify_updated_at: datetime,
    ):
        super().__init__(message)
        self.product_id = product_id
        self.erp_updated_at = erp_updated_at
        self.shopify_updated_at = shopify_updated_at


class BidirectionalProductSyncer:
    """Handles bidirectional product synchronization between ERP and Shopify."""

    def __init__(
        self,
        db: AsyncSession,
        client: ShopifyClient,
        conflict_strategy: ConflictStrategy = "newest_wins",
    ) -> None:
        """Initialize syncer.

        Args:
            db: Database session
            client: Shopify API client
            conflict_strategy: How to resolve conflicts (default: newest_wins)
        """
        self.db = db
        self.client = client
        self.conflict_strategy = conflict_strategy

    async def sync_from_shopify(
        self,
        shopify_product_id: int,
        force: bool = False,
    ) -> dict[str, Any]:
        """
        Sync a product from Shopify to ERP (Shopify → ERP direction).

        Args:
            shopify_product_id: Shopify product ID
            force: Force sync even if conflict detected

        Returns:
            Sync result dict with status and details

        Raises:
            ProductSyncConflict: If conflict detected and not forced
        """
        logger.info("syncing_from_shopify", shopify_product_id=shopify_product_id)

        # Get product data from Shopify
        try:
            shopify_data = await self.client.get_products(limit=250)
            shopify_products = shopify_data.get("products", [])

            # Find the specific product
            shopify_product = next(
                (p for p in shopify_products if p["id"] == shopify_product_id),
                None,
            )

            if not shopify_product:
                # Try direct API call
                shopify_product_data = await self.client._request(
                    "GET",
                    f"/products/{shopify_product_id}.json",
                )
                shopify_product = shopify_product_data.get("product")

            if not shopify_product:
                raise ValueError(f"Shopify product {shopify_product_id} not found")

        except Exception as e:
            logger.error(
                "failed_to_fetch_shopify_product",
                shopify_product_id=shopify_product_id,
                error=str(e),
            )
            return {
                "success": False,
                "action": "fetch_failed",
                "error": str(e),
            }

        # Check if mapping exists
        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.shopify_product_id == shopify_product_id
        )
        result = await self.db.execute(stmt)
        mapping = result.scalars().first()

        if mapping:
            # Product exists in ERP - check for conflicts
            return await self._update_erp_product_from_shopify(
                mapping,
                shopify_product,
                force=force,
            )
        else:
            # New product from Shopify - create in ERP
            return await self._create_erp_product_from_shopify(shopify_product)

    async def _create_erp_product_from_shopify(
        self,
        shopify_product: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a new product in ERP from Shopify data."""
        logger.info(
            "creating_erp_product_from_shopify",
            shopify_product_id=shopify_product["id"],
        )

        # Extract variant data (assume single variant for simplicity)
        variant = shopify_product.get("variants", [{}])[0]

        # Map Shopify category to ERP category
        product_type = shopify_product.get("product_type", "Equipment")
        category = self._map_shopify_category_to_erp(product_type)

        # Create ERP product
        product_id = uuid.uuid4()
        product = Product(
            id=product_id,
            sku=variant.get("sku") or f"SHOP-{shopify_product['id']}",
            name=shopify_product["title"],
            description=shopify_product.get("body_html", ""),
            category=category,
            price=float(variant.get("price", 0)),
            stock=variant.get("inventory_quantity", 0),
            is_active=shopify_product.get("status") == "active",
        )

        self.db.add(product)

        # Create mapping
        mapping = ShopifyProductMapping(
            id=uuid.uuid4(),
            product_id=product_id,
            shopify_product_id=shopify_product["id"],
            shopify_variant_id=variant["id"],
            shopify_inventory_item_id=variant.get("inventory_item_id"),
            shopify_data=shopify_product,
            sync_status="synced",
            last_synced_at=datetime.utcnow(),
            sync_direction="from_shopify",
        )

        self.db.add(mapping)

        # Log sync
        await self._log_sync(
            product_id=product_id,
            shopify_product_id=shopify_product["id"],
            direction="from_shopify",
            action="created",
            status="success",
        )

        await self.db.commit()

        logger.info(
            "erp_product_created_from_shopify",
            product_id=product_id,
            shopify_product_id=shopify_product["id"],
        )

        return {
            "success": True,
            "action": "created",
            "product_id": str(product_id),
            "shopify_product_id": shopify_product["id"],
            "sku": product.sku,
            "name": product.name,
        }

    async def _update_erp_product_from_shopify(
        self,
        mapping: ShopifyProductMapping,
        shopify_product: dict[str, Any],
        force: bool = False,
    ) -> dict[str, Any]:
        """Update existing ERP product with Shopify data."""
        logger.info(
            "updating_erp_product_from_shopify",
            product_id=mapping.product_id,
            shopify_product_id=shopify_product["id"],
        )

        # Get ERP product
        stmt = select(Product).where(Product.id == mapping.product_id)
        result = await self.db.execute(stmt)
        product = result.scalars().first()

        if not product:
            logger.error(
                "erp_product_not_found",
                product_id=mapping.product_id,
            )
            return {
                "success": False,
                "action": "product_not_found",
                "product_id": str(mapping.product_id),
            }

        # Check for conflicts
        shopify_updated_at = datetime.fromisoformat(
            shopify_product["updated_at"].replace("Z", "+00:00")
        )
        erp_updated_at = product.updated_at

        # If both updated since last sync, we have a conflict
        last_sync = mapping.last_synced_at or datetime.min.replace(tzinfo=None)
        if not force and erp_updated_at > last_sync and shopify_updated_at.replace(tzinfo=None) > last_sync:
            # Conflict detected
            conflict = ProductSyncConflict(
                message="Product updated in both systems since last sync",
                product_id=mapping.product_id,
                erp_updated_at=erp_updated_at,
                shopify_updated_at=shopify_updated_at.replace(tzinfo=None),
            )

            # Apply conflict resolution strategy
            if self.conflict_strategy == "erp_wins":
                logger.info(
                    "conflict_resolved_erp_wins",
                    product_id=mapping.product_id,
                )
                # Don't update ERP, return early
                return {
                    "success": True,
                    "action": "conflict_erp_wins",
                    "product_id": str(mapping.product_id),
                    "conflict_resolution": "erp_wins",
                }
            elif self.conflict_strategy == "shopify_wins":
                logger.info(
                    "conflict_resolved_shopify_wins",
                    product_id=mapping.product_id,
                )
                # Continue with update (Shopify wins)
            elif self.conflict_strategy == "newest_wins":
                if erp_updated_at > shopify_updated_at.replace(tzinfo=None):
                    logger.info(
                        "conflict_resolved_erp_newer",
                        product_id=mapping.product_id,
                    )
                    return {
                        "success": True,
                        "action": "conflict_erp_newer",
                        "product_id": str(mapping.product_id),
                        "conflict_resolution": "newest_wins (ERP)",
                    }
                # Shopify is newer, continue with update
            elif self.conflict_strategy == "manual":
                # Don't resolve automatically
                logger.warning(
                    "conflict_requires_manual_resolution",
                    product_id=mapping.product_id,
                )
                await self._log_sync(
                    product_id=mapping.product_id,
                    shopify_product_id=shopify_product["id"],
                    direction="from_shopify",
                    action="conflict",
                    status="failed",
                    error_message=str(conflict),
                )
                await self.db.commit()

                return {
                    "success": False,
                    "action": "conflict_manual_required",
                    "product_id": str(mapping.product_id),
                    "conflict": {
                        "erp_updated_at": erp_updated_at.isoformat(),
                        "shopify_updated_at": shopify_updated_at.isoformat(),
                    },
                }

        # Update ERP product with Shopify data
        variant = shopify_product.get("variants", [{}])[0]

        product.name = shopify_product["title"]
        product.description = shopify_product.get("body_html", "")
        product.price = float(variant.get("price", product.price))
        product.stock = variant.get("inventory_quantity", product.stock)
        product.is_active = shopify_product.get("status") == "active"

        # Update mapping
        mapping.shopify_data = shopify_product
        mapping.last_synced_at = datetime.utcnow()
        mapping.sync_status = "synced"
        mapping.sync_direction = "from_shopify"

        # Log sync
        await self._log_sync(
            product_id=mapping.product_id,
            shopify_product_id=shopify_product["id"],
            direction="from_shopify",
            action="updated",
            status="success",
        )

        await self.db.commit()

        logger.info(
            "erp_product_updated_from_shopify",
            product_id=mapping.product_id,
            shopify_product_id=shopify_product["id"],
        )

        return {
            "success": True,
            "action": "updated",
            "product_id": str(mapping.product_id),
            "shopify_product_id": shopify_product["id"],
            "sku": product.sku,
            "name": product.name,
        }

    async def sync_to_shopify(
        self,
        product_id: uuid.UUID,
        force: bool = False,
    ) -> dict[str, Any]:
        """
        Sync a product from ERP to Shopify (ERP → Shopify direction).

        Args:
            product_id: ERP product ID
            force: Force sync even if conflict detected

        Returns:
            Sync result dict with status and details
        """
        logger.info("syncing_to_shopify", product_id=product_id)

        # Get ERP product
        stmt = select(Product).where(Product.id == product_id)
        result = await self.db.execute(stmt)
        product = result.scalars().first()

        if not product:
            raise ValueError(f"Product {product_id} not found")

        # Check for existing mapping
        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_id
        )
        result = await self.db.execute(stmt)
        mapping = result.scalars().first()

        product_data = {
            "title": product.name,
            "body_html": product.description or "",
            "vendor": "CCW Equipment",
            "product_type": product.category.value if product.category else "Equipment",
            "status": "active" if product.is_active else "draft",
            "tags": f"erp-sync,{product.category.value if product.category else ''}",
            "variants": [
                {
                    "sku": product.sku,
                    "price": str(product.price),
                    "inventory_management": "shopify",
                    "inventory_quantity": product.stock,
                }
            ],
        }

        try:
            if mapping:
                # Check for conflicts if not forcing
                if not force and mapping.shopify_data:
                    shopify_updated_at = datetime.fromisoformat(
                        mapping.shopify_data["updated_at"].replace("Z", "+00:00")
                    ).replace(tzinfo=None)
                    last_sync = mapping.last_synced_at or datetime.min
                    erp_updated_at = product.updated_at

                    if shopify_updated_at > last_sync and erp_updated_at > last_sync:
                        # Conflict - handle based on strategy
                        if self.conflict_strategy == "erp_wins":
                            pass  # Continue with update
                        elif self.conflict_strategy == "shopify_wins":
                            return {
                                "success": True,
                                "action": "conflict_shopify_wins",
                                "product_id": str(product_id),
                            }
                        elif self.conflict_strategy == "newest_wins":
                            if shopify_updated_at > erp_updated_at:
                                return {
                                    "success": True,
                                    "action": "conflict_shopify_newer",
                                    "product_id": str(product_id),
                                }

                # Update existing product
                result_data = await self.client.update_product(
                    product_id=mapping.shopify_product_id,
                    product_data=product_data,
                )
                action = "updated"
            else:
                # Create new product
                result_data = await self.client.create_product(product_data)
                action = "created"

            shopify_product = result_data.get("product", {})
            shopify_variant = shopify_product.get("variants", [{}])[0]

            # Create or update mapping
            if not mapping:
                mapping = ShopifyProductMapping(
                    id=uuid.uuid4(),
                    product_id=product_id,
                    shopify_product_id=shopify_product["id"],
                    shopify_variant_id=shopify_variant["id"],
                    shopify_inventory_item_id=shopify_variant.get("inventory_item_id"),
                )
                self.db.add(mapping)

            mapping.shopify_data = shopify_product
            mapping.last_synced_at = datetime.utcnow()
            mapping.sync_status = "synced"
            mapping.sync_direction = "to_shopify"

            # Log sync
            await self._log_sync(
                product_id=product_id,
                shopify_product_id=shopify_product["id"],
                direction="to_shopify",
                action=action,
                status="success",
            )

            await self.db.commit()

            logger.info(
                "product_synced_to_shopify",
                product_id=product_id,
                shopify_product_id=shopify_product["id"],
                action=action,
            )

            return {
                "success": True,
                "action": action,
                "product_id": str(product_id),
                "sku": product.sku,
                "shopify_product_id": shopify_product["id"],
                "shopify_variant_id": shopify_variant["id"],
            }

        except Exception as e:
            logger.error(
                "product_sync_to_shopify_failed",
                product_id=product_id,
                error=str(e),
            )

            if mapping:
                mapping.sync_status = "failed"
                mapping.sync_error = str(e)

            # Log failed sync
            await self._log_sync(
                product_id=product_id,
                shopify_product_id=mapping.shopify_product_id if mapping else None,
                direction="to_shopify",
                action="failed",
                status="failed",
                error_message=str(e),
            )

            await self.db.commit()

            return {
                "success": False,
                "product_id": str(product_id),
                "sku": product.sku,
                "error": str(e),
            }

    async def _log_sync(
        self,
        product_id: uuid.UUID,
        shopify_product_id: int | None,
        direction: str,
        action: str,
        status: str,
        error_message: str | None = None,
    ) -> None:
        """Log a sync operation to the database."""
        sync_log = ShopifyProductSyncLog(
            id=uuid.uuid4(),
            product_id=product_id,
            shopify_product_id=shopify_product_id,
            sync_direction=direction,
            sync_action=action,
            sync_status=status,
            error_message=error_message,
            synced_at=datetime.utcnow(),
        )

        self.db.add(sync_log)
        await self.db.flush()

    def _map_shopify_category_to_erp(self, product_type: str) -> ProductCategory:
        """Map Shopify product_type to ERP ProductCategory."""
        # Mapping dictionary
        category_map = {
            "heavy machinery": ProductCategory.HEAVY_MACHINERY,
            "hand tools": ProductCategory.HAND_TOOLS,
            "power tools": ProductCategory.POWER_TOOLS,
            "safety equipment": ProductCategory.SAFETY_EQUIPMENT,
            "building materials": ProductCategory.BUILDING_MATERIALS,
            "electrical": ProductCategory.ELECTRICAL,
            "plumbing": ProductCategory.PLUMBING,
            "accessories": ProductCategory.ACCESSORIES,
        }

        # Try to match by lowercase
        category_key = product_type.lower()
        return category_map.get(category_key, ProductCategory.ACCESSORIES)

    async def get_sync_status(
        self,
        product_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Get sync status for a product or all products."""
        if product_id:
            # Single product status
            stmt = select(ShopifyProductMapping).where(
                ShopifyProductMapping.product_id == product_id
            )
            result = await self.db.execute(stmt)
            mapping = result.scalars().first()

            if not mapping:
                return {
                    "product_id": str(product_id),
                    "mapped": False,
                    "sync_status": "not_mapped",
                }

            return {
                "product_id": str(product_id),
                "mapped": True,
                "shopify_product_id": mapping.shopify_product_id,
                "sync_status": mapping.sync_status,
                "sync_direction": mapping.sync_direction,
                "last_synced_at": (
                    mapping.last_synced_at.isoformat() if mapping.last_synced_at else None
                ),
                "sync_error": mapping.sync_error,
            }
        else:
            # All products status
            stmt = select(ShopifyProductMapping)
            result = await self.db.execute(stmt)
            mappings = result.scalars().all()

            return {
                "total_mapped": len(mappings),
                "synced": sum(1 for m in mappings if m.sync_status == "synced"),
                "pending": sum(1 for m in mappings if m.sync_status == "pending"),
                "failed": sum(1 for m in mappings if m.sync_status == "failed"),
                "mappings": [
                    {
                        "product_id": str(m.product_id),
                        "shopify_product_id": m.shopify_product_id,
                        "sync_status": m.sync_status,
                        "last_synced_at": (
                            m.last_synced_at.isoformat() if m.last_synced_at else None
                        ),
                    }
                    for m in mappings
                ],
            }


# ---------------------------------------------------------------------------
# UNI-1866: standalone helper — push local variants to an existing Shopify product
# ---------------------------------------------------------------------------

async def sync_variants_to_shopify(
    shopify_client: ShopifyClient,
    shopify_product_id: str,
    variants: list[dict],
) -> dict:
    """Push a variants list to an existing Shopify product.

    Args:
        shopify_client: Authenticated Shopify API client.
        shopify_product_id: Shopify product ID (string).
        variants: List of variant dicts with keys:
            sku, title, price, inventory_quantity, option1, option2, option3.

    Returns:
        {"synced": <count>, "shopify_product_id": <id>}
    """
    await shopify_client.update_product(
        product_id=int(shopify_product_id),
        product_data={"variants": variants},
    )
    return {"synced": len(variants), "shopify_product_id": shopify_product_id}
