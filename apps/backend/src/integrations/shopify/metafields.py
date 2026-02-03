"""
Shopify Metafield Management.

Handles syncing of custom CCW product metadata to Shopify metafields.
Namespace: 'ccw_custom' for all CCW-specific fields.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product
from src.db.shopify_extended_models import ShopifyMetafield
from src.integrations.shopify.client import get_shopify_client

logger = structlog.get_logger(__name__)


class MetafieldManager:
    """
    Manages Shopify metafields for CCW custom data.

    Supported metafields:
    - ccw_custom.australian_compliance: Compliance certifications
    - ccw_custom.specifications: Technical specifications (JSON)
    - ccw_custom.warehouse_location: Internal warehouse location
    - ccw_custom.supplier_info: Supplier information
    - ccw_custom.maintenance_guide: Maintenance instructions URL
    - ccw_custom.stock_alert_threshold: Low stock alert threshold
    - ccw_custom.dimensions: Product dimensions (JSON)
    - ccw_custom.weight_kg: Product weight in kilograms
    - ccw_custom.brand: Brand name
    - ccw_custom.certification_expiry: Certification expiration date
    """

    CCW_NAMESPACE = "ccw_custom"

    METAFIELD_DEFINITIONS = {
        "australian_compliance": {
            "type": "single_line_text_field",
            "description": "Australian compliance certifications",
        },
        "specifications": {
            "type": "json",
            "description": "Technical specifications",
        },
        "warehouse_location": {
            "type": "single_line_text_field",
            "description": "Internal warehouse location code",
        },
        "supplier_info": {
            "type": "multi_line_text_field",
            "description": "Supplier information",
        },
        "maintenance_guide": {
            "type": "url",
            "description": "Maintenance guide URL",
        },
        "stock_alert_threshold": {
            "type": "number_integer",
            "description": "Low stock alert threshold",
        },
        # PHASE: Enhanced Shopify Integration - New Metafields (Task 1.1)
        "dimensions": {
            "type": "json",
            "description": "Product dimensions (length, width, height, unit)",
        },
        "weight_kg": {
            "type": "number_decimal",
            "description": "Product weight in kilograms",
        },
        "brand": {
            "type": "single_line_text_field",
            "description": "Brand name",
        },
        "certification_expiry": {
            "type": "date",
            "description": "Certification expiration date (ISO 8601 format: YYYY-MM-DD)",
        },
    }

    def __init__(self):
        self.client = get_shopify_client()

    async def sync_product_metafields(
        self,
        db: AsyncSession,
        product_id: UUID,
        shopify_product_id: str,
    ) -> dict[str, Any]:
        """
        Sync all custom metafields for a product to Shopify.

        Args:
            db: Database session
            product_id: Product UUID
            shopify_product_id: Shopify product ID

        Returns:
            Sync result with success status and synced metafields
        """
        # Get product from database
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()

        if not product:
            logger.error("Product not found", product_id=str(product_id))
            return {"success": False, "error": "Product not found"}

        synced_metafields = []
        errors = []

        # Prepare metafields from product data
        metafields_to_sync = self._extract_metafields_from_product(product)

        for key, value in metafields_to_sync.items():
            try:
                # Check if metafield already exists in database
                metafield_result = await db.execute(
                    select(ShopifyMetafield).where(
                        ShopifyMetafield.product_id == product_id,
                        ShopifyMetafield.namespace == self.CCW_NAMESPACE,
                        ShopifyMetafield.key == key,
                    )
                )
                existing_metafield = metafield_result.scalar_one_or_none()

                # Sync to Shopify
                shopify_response = await self._sync_metafield_to_shopify(
                    shopify_product_id=shopify_product_id,
                    key=key,
                    value=value,
                    value_type=self.METAFIELD_DEFINITIONS[key]["type"],
                    existing_shopify_metafield_id=(
                        existing_metafield.shopify_metafield_id if existing_metafield else None
                    ),
                )

                # Update or create database record
                if existing_metafield:
                    existing_metafield.value = str(value)
                    existing_metafield.is_synced = True
                    existing_metafield.last_synced_at = datetime.now(UTC)
                    existing_metafield.sync_error = None
                    existing_metafield.shopify_metafield_id = shopify_response.get("id")
                else:
                    new_metafield = ShopifyMetafield(
                        product_id=product_id,
                        shopify_product_id=shopify_product_id,
                        shopify_metafield_id=shopify_response.get("id"),
                        namespace=self.CCW_NAMESPACE,
                        key=key,
                        value=str(value),
                        value_type=self.METAFIELD_DEFINITIONS[key]["type"],
                        is_synced=True,
                        last_synced_at=datetime.now(UTC),
                    )
                    db.add(new_metafield)

                synced_metafields.append(key)
                logger.info(
                    "Metafield synced",
                    product_id=str(product_id),
                    key=key,
                    shopify_metafield_id=shopify_response.get("id"),
                )

            except Exception as e:
                error_msg = f"Failed to sync metafield {key}: {str(e)}"
                errors.append(error_msg)
                logger.error("Metafield sync failed", product_id=str(product_id), key=key, error=str(e))

                # Update database with error
                if existing_metafield:
                    existing_metafield.is_synced = False
                    existing_metafield.sync_error = str(e)

        await db.commit()

        return {
            "success": len(errors) == 0,
            "synced_count": len(synced_metafields),
            "synced_metafields": synced_metafields,
            "errors": errors,
        }

    def _extract_metafields_from_product(self, product: Product) -> dict[str, Any]:
        """
        Extract metafield data from product model.

        Args:
            product: Product model instance

        Returns:
            Dictionary of metafield key-value pairs
        """
        metafields = {}

        # Warehouse location
        if product.warehouse_location:
            metafields["warehouse_location"] = product.warehouse_location

        # Australian compliance (example - would come from product attributes)
        # metafields["australian_compliance"] = "AS/NZS 60335.1:2011"

        # Specifications (could be extracted from product.description or separate field)
        # metafields["specifications"] = {
        #     "power": "2000W",
        #     "voltage": "240V",
        #     "weight": "3.5kg"
        # }

        # Stock alert threshold
        if product.stock < 10:  # Example threshold
            metafields["stock_alert_threshold"] = 10

        # PHASE: Enhanced Shopify Integration - New Metafields (Task 1.1)

        # Dimensions - Extract from product category or use default
        # For heavy machinery, use larger default dimensions
        if product.category in ["heavy_machinery", "power_tools"]:
            metafields["dimensions"] = {
                "length": 120,
                "width": 80,
                "height": 100,
                "unit": "cm",
            }
        elif product.category in ["hand_tools", "accessories"]:
            metafields["dimensions"] = {
                "length": 30,
                "width": 20,
                "height": 10,
                "unit": "cm",
            }
        else:
            metafields["dimensions"] = {
                "length": 50,
                "width": 40,
                "height": 30,
                "unit": "cm",
            }

        # Weight - Estimate based on category
        if product.category == "heavy_machinery":
            metafields["weight_kg"] = 150.0
        elif product.category == "power_tools":
            metafields["weight_kg"] = 5.0
        elif product.category in ["hand_tools", "accessories"]:
            metafields["weight_kg"] = 1.5
        elif product.category == "building_materials":
            metafields["weight_kg"] = 25.0
        else:
            metafields["weight_kg"] = 10.0

        # Brand - Extract from product name (first word) or use "CCW"
        # Example: "DeWalt Drill" → brand = "DeWalt"
        if product.name:
            first_word = product.name.split()[0] if " " in product.name else product.name
            # Check if first word looks like a brand (capitalized, not generic)
            generic_words = {
                "the",
                "a",
                "an",
                "industrial",
                "heavy",
                "professional",
                "commercial",
            }
            if first_word.lower() not in generic_words and first_word[0].isupper():
                metafields["brand"] = first_word
            else:
                metafields["brand"] = "CCW"
        else:
            metafields["brand"] = "CCW"

        # Certification expiry - Set to 1 year from product creation
        # In production, this would come from a dedicated certification tracking system
        from datetime import timedelta

        if product.created_at:
            expiry_date = product.created_at + timedelta(days=365)
            metafields["certification_expiry"] = expiry_date.strftime("%Y-%m-%d")

        return metafields

    async def _sync_metafield_to_shopify(
        self,
        shopify_product_id: str,
        key: str,
        value: Any,
        value_type: str,
        existing_shopify_metafield_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Sync a single metafield to Shopify via API.

        Args:
            shopify_product_id: Shopify product ID
            key: Metafield key
            value: Metafield value
            value_type: Shopify metafield type
            existing_shopify_metafield_id: Existing metafield ID (for updates)

        Returns:
            Shopify API response
        """
        metafield_data = {
            "namespace": self.CCW_NAMESPACE,
            "key": key,
            "value": str(value),
            "type": value_type,
        }

        if existing_shopify_metafield_id:
            # Update existing metafield
            response = await self.client.update_product_metafield(
                product_id=shopify_product_id,
                metafield_id=existing_shopify_metafield_id,
                metafield_data=metafield_data,
            )
        else:
            # Create new metafield
            response = await self.client.create_product_metafield(
                product_id=shopify_product_id,
                metafield_data=metafield_data,
            )

        return response

    async def bulk_sync_metafields(
        self,
        db: AsyncSession,
        product_ids: list[UUID],
    ) -> dict[str, Any]:
        """
        Bulk sync metafields for multiple products.

        Args:
            db: Database session
            product_ids: List of product UUIDs

        Returns:
            Bulk sync results
        """
        results = {
            "total": len(product_ids),
            "successful": 0,
            "failed": 0,
            "errors": [],
        }

        for product_id in product_ids:
            try:
                # Get Shopify product ID for this product
                # (This would come from shopify_products table in real implementation)
                # For now, skip products without Shopify ID

                # Placeholder - would need to get from shopify_products table
                shopify_product_id = None

                if not shopify_product_id:
                    logger.warning("Product not linked to Shopify", product_id=str(product_id))
                    continue

                result = await self.sync_product_metafields(
                    db=db,
                    product_id=product_id,
                    shopify_product_id=shopify_product_id,
                )

                if result["success"]:
                    results["successful"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].extend(result.get("errors", []))

            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"Product {product_id}: {str(e)}")
                logger.error("Bulk sync failed for product", product_id=str(product_id), error=str(e))

        logger.info(
            "Bulk metafield sync complete",
            total=results["total"],
            successful=results["successful"],
            failed=results["failed"],
        )

        return results

    async def delete_product_metafields(
        self,
        db: AsyncSession,
        product_id: UUID,
        shopify_product_id: str,
    ) -> dict[str, Any]:
        """
        Delete all CCW custom metafields for a product from Shopify.

        Args:
            db: Database session
            product_id: Product UUID
            shopify_product_id: Shopify product ID

        Returns:
            Deletion result
        """
        # Get all metafields for this product
        result = await db.execute(
            select(ShopifyMetafield).where(
                ShopifyMetafield.product_id == product_id,
                ShopifyMetafield.namespace == self.CCW_NAMESPACE,
            )
        )
        metafields = result.scalars().all()

        deleted_count = 0
        errors = []

        for metafield in metafields:
            if metafield.shopify_metafield_id:
                try:
                    await self.client.delete_product_metafield(
                        product_id=shopify_product_id,
                        metafield_id=metafield.shopify_metafield_id,
                    )

                    # Delete from database
                    await db.delete(metafield)
                    deleted_count += 1

                    logger.info(
                        "Metafield deleted",
                        product_id=str(product_id),
                        key=metafield.key,
                        shopify_metafield_id=metafield.shopify_metafield_id,
                    )

                except Exception as e:
                    errors.append(f"Failed to delete {metafield.key}: {str(e)}")
                    logger.error(
                        "Metafield deletion failed",
                        product_id=str(product_id),
                        key=metafield.key,
                        error=str(e),
                    )

        await db.commit()

        return {
            "success": len(errors) == 0,
            "deleted_count": deleted_count,
            "errors": errors,
        }


# Singleton instance
_metafield_manager: MetafieldManager | None = None


def get_metafield_manager() -> MetafieldManager:
    """Get MetafieldManager singleton."""
    global _metafield_manager
    if _metafield_manager is None:
        _metafield_manager = MetafieldManager()
    return _metafield_manager
