"""Shopify inventory sync logic.

Handles syncing inventory from ERP to Shopify.
Updates Shopify inventory levels when stock changes in the ERP.
"""

import uuid
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product
from src.db.shopify_models import ShopifyProductMapping
from src.integrations.shopify.client import ShopifyClient

logger = structlog.get_logger(__name__)


class ShopifyInventorySyncer:
    """Sync inventory from ERP to Shopify."""

    def __init__(self, db: AsyncSession, client: ShopifyClient) -> None:
        """Initialize syncer.

        Args:
            db: Database session
            client: Shopify API client
        """
        self.db = db
        self.client = client

    async def sync_product_inventory(
        self,
        product_id: uuid.UUID,
        location_id: int | None = None,
    ) -> dict[str, Any]:
        """Sync a single product's inventory to Shopify.

        Args:
            product_id: ERP product ID
            location_id: Shopify location ID (uses first location if not specified)

        Returns:
            Sync result dict

        Raises:
            ValueError: If product not found or not mapped to Shopify
        """
        logger.info("syncing_product_inventory", product_id=product_id)

        # Get product
        stmt = select(Product).where(Product.id == product_id)
        result = await self.db.execute(stmt)
        product = result.scalars().first()

        if not product:
            raise ValueError(f"Product {product_id} not found")

        # Get Shopify mapping
        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_id
        )
        result = await self.db.execute(stmt)
        mapping = result.scalars().first()

        if not mapping:
            raise ValueError(f"Product {product_id} not mapped to Shopify")

        # Get location if not specified
        if location_id is None:
            locations_data = await self.client.get_locations()
            locations = locations_data.get("locations", [])
            if not locations:
                raise ValueError("No Shopify locations found")
            location_id = locations[0]["id"]

        # Update inventory in Shopify
        try:
            await self.client.update_inventory(
                inventory_item_id=mapping.shopify_inventory_item_id,
                location_id=location_id,
                available=product.stock,
            )

            # Update mapping
            mapping.last_synced_at = datetime.utcnow()
            mapping.sync_status = "synced"
            mapping.sync_error = None
            await self.db.commit()

            logger.info(
                "inventory_synced",
                product_id=product_id,
                shopify_product_id=mapping.shopify_product_id,
                stock=product.stock,
            )

            return {
                "success": True,
                "product_id": str(product_id),
                "sku": product.sku,
                "stock": product.stock,
                "shopify_product_id": mapping.shopify_product_id,
                "synced_at": mapping.last_synced_at.isoformat(),
            }

        except Exception as e:
            logger.error(
                "inventory_sync_failed",
                product_id=product_id,
                error=str(e),
            )

            # Update mapping with error
            mapping.sync_status = "failed"
            mapping.sync_error = str(e)
            await self.db.commit()

            return {
                "success": False,
                "product_id": str(product_id),
                "sku": product.sku,
                "error": str(e),
            }

    async def sync_all_inventory(
        self,
        location_id: int | None = None,
    ) -> dict[str, Any]:
        """Sync inventory for all mapped products to Shopify.

        Args:
            location_id: Shopify location ID (uses first location if not specified)

        Returns:
            Sync summary dict
        """
        logger.info("syncing_all_inventory")

        # Get all product mappings
        stmt = select(ShopifyProductMapping)
        result = await self.db.execute(stmt)
        mappings = result.scalars().all()

        if not mappings:
            logger.warning("no_product_mappings_found")
            return {
                "success": True,
                "total": 0,
                "synced": 0,
                "failed": 0,
                "results": [],
            }

        # Get location if not specified
        if location_id is None:
            locations_data = await self.client.get_locations()
            locations = locations_data.get("locations", [])
            if locations:
                location_id = locations[0]["id"]
            else:
                raise ValueError("No Shopify locations found")

        results = []
        synced_count = 0
        failed_count = 0

        for mapping in mappings:
            try:
                result = await self.sync_product_inventory(
                    product_id=mapping.product_id,
                    location_id=location_id,
                )
                results.append(result)
                if result["success"]:
                    synced_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(
                    "sync_failed_for_product",
                    product_id=mapping.product_id,
                    error=str(e),
                )
                results.append({
                    "success": False,
                    "product_id": str(mapping.product_id),
                    "error": str(e),
                })
                failed_count += 1

        logger.info(
            "bulk_sync_completed",
            total=len(mappings),
            synced=synced_count,
            failed=failed_count,
        )

        return {
            "success": True,
            "total": len(mappings),
            "synced": synced_count,
            "failed": failed_count,
            "results": results,
        }

    async def create_product_mapping(
        self,
        product_id: uuid.UUID,
        shopify_product_id: int,
        shopify_variant_id: int,
        shopify_inventory_item_id: int,
    ) -> ShopifyProductMapping:
        """Create a new product mapping.

        Args:
            product_id: ERP product ID
            shopify_product_id: Shopify product ID
            shopify_variant_id: Shopify variant ID
            shopify_inventory_item_id: Shopify inventory item ID

        Returns:
            Created mapping instance
        """
        # Check if mapping already exists
        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.product_id == product_id
        )
        result = await self.db.execute(stmt)
        existing_mapping = result.scalars().first()

        if existing_mapping:
            # Update existing mapping
            existing_mapping.shopify_product_id = shopify_product_id
            existing_mapping.shopify_variant_id = shopify_variant_id
            existing_mapping.shopify_inventory_item_id = shopify_inventory_item_id
            existing_mapping.sync_status = "pending"
            await self.db.commit()
            return existing_mapping

        # Create new mapping
        mapping = ShopifyProductMapping(
            id=uuid.uuid4(),
            product_id=product_id,
            shopify_product_id=shopify_product_id,
            shopify_variant_id=shopify_variant_id,
            shopify_inventory_item_id=shopify_inventory_item_id,
            sync_status="pending",
        )

        self.db.add(mapping)
        await self.db.commit()

        logger.info(
            "mapping_created",
            product_id=product_id,
            shopify_product_id=shopify_product_id,
        )

        return mapping

    async def sync_product_to_shopify(
        self,
        product_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Sync product details (name, price, etc.) to Shopify.

        Creates or updates the product in Shopify and creates a mapping.

        Args:
            product_id: ERP product ID

        Returns:
            Sync result dict
        """
        logger.info("syncing_product_to_shopify", product_id=product_id)

        # Get product
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
                # Update existing product
                result_data = await self.client.update_product(
                    product_id=mapping.shopify_product_id,
                    product_data=product_data,
                )
            else:
                # Create new product
                result_data = await self.client.create_product(product_data)

            shopify_product = result_data.get("product", {})
            shopify_variant = shopify_product.get("variants", [{}])[0]

            # Create or update mapping
            if not mapping:
                mapping = await self.create_product_mapping(
                    product_id=product_id,
                    shopify_product_id=shopify_product["id"],
                    shopify_variant_id=shopify_variant["id"],
                    shopify_inventory_item_id=shopify_variant.get(
                        "inventory_item_id"
                    ),
                )

            mapping.shopify_data = shopify_product
            mapping.last_synced_at = datetime.utcnow()
            mapping.sync_status = "synced"
            await self.db.commit()

            logger.info(
                "product_synced_to_shopify",
                product_id=product_id,
                shopify_product_id=shopify_product["id"],
            )

            return {
                "success": True,
                "product_id": str(product_id),
                "sku": product.sku,
                "shopify_product_id": shopify_product["id"],
                "shopify_variant_id": shopify_variant["id"],
            }

        except Exception as e:
            logger.error(
                "product_sync_failed",
                product_id=product_id,
                error=str(e),
            )

            if mapping:
                mapping.sync_status = "failed"
                mapping.sync_error = str(e)
                await self.db.commit()

            return {
                "success": False,
                "product_id": str(product_id),
                "sku": product.sku,
                "error": str(e),
            }
