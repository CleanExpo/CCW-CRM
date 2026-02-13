"""
Shopify Real-Time Inventory Sync (ISS-010).

Handles bidirectional inventory synchronization:
- ERP → Shopify: Update Shopify when ERP stock changes
- Shopify → ERP: Update ERP when Shopify stock changes (via webhooks)

Features:
- Automatic retry with exponential backoff
- Conflict resolution
- Audit trail
- Bulk sync support
"""

import asyncio
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product
from src.db.shopify_extended_models import ShopifyInventorySync
from src.db.shopify_models import ShopifyProductMapping
from src.integrations.shopify.client import ShopifyClient

logger = structlog.get_logger(__name__)

# PHASE 2 - Task 2.3: Background worker state
_background_worker_running = False


class InventorySyncService:
    """
    Manages bidirectional inventory synchronization between ERP and Shopify (ISS-010).

    Features:
    - Real-time sync on stock changes
    - Automatic retry with exponential backoff
    - Conflict resolution (ERP as source of truth)
    - Audit trail for all sync operations
    - Batch sync support
    """

    def __init__(self, client: ShopifyClient):
        """Initialize with Shopify client.

        Args:
            client: Shopify API client instance
        """
        self.client = client
        self.max_retries = 3
        self.base_delay = 1.0  # seconds

    async def _retry_with_backoff(self, func, *args, **kwargs):
        """Retry a function with exponential backoff.

        Args:
            func: Async function to retry
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns:
            Function result

        Raises:
            Exception: If all retries fail, raises the last exception
        """
        last_exception = None

        for attempt in range(self.max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    # Calculate delay with exponential backoff
                    delay = self.base_delay * (2 ** attempt)
                    logger.warning(
                        "retry_attempt",
                        attempt=attempt + 1,
                        max_retries=self.max_retries,
                        delay=delay,
                        error=str(e),
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        "retry_exhausted",
                        attempts=self.max_retries,
                        error=str(e),
                    )

        # All retries failed, raise the last exception
        raise last_exception

    async def sync_stock_to_shopify(
        self,
        db: AsyncSession,
        product_id: UUID,
        shopify_product_id: str,
        shopify_inventory_item_id: str,
        shopify_location_id: str,
        triggered_by: str = "manual",
    ) -> dict[str, Any]:
        """
        Sync ERP stock level to Shopify (ERP → Shopify).

        PHASE 2: Enhanced Shopify Integration - Task 2.2: Multi-Location Aggregation
        Aggregates stock across Brisbane, Sydney, and Melbourne locations before syncing.

        Args:
            db: Database session
            product_id: Product UUID
            shopify_product_id: Shopify product ID
            shopify_inventory_item_id: Shopify inventory item ID
            shopify_location_id: Shopify location ID
            triggered_by: Trigger source (manual, webhook, scheduled)

        Returns:
            Sync result
        """
        # PHASE 2 - Task 2.2: Get multi-location stock and aggregate
        from src.db.inventory_models import ProductStockByLocation

        # Get stock from all locations
        stock_query = select(ProductStockByLocation).where(
            ProductStockByLocation.product_id == product_id
        )
        stock_result = await db.execute(stock_query)
        stock_records = stock_result.scalars().all()

        if not stock_records:
            logger.error("No stock records found for product", product_id=str(product_id))
            return {"success": False, "error": "No stock records found"}

        # Aggregate stock across all locations (Brisbane, Sydney, Melbourne)
        total_stock = sum(record.stock for record in stock_records)
        total_available = sum(record.available for record in stock_records)

        # Log location breakdown for debugging
        location_breakdown = {
            record.location: {
                "stock": record.stock,
                "reserved": record.reserved or 0,
                "available": record.available,
            }
            for record in stock_records
        }

        logger.info(
            "Multi-location stock aggregated for Shopify sync",
            product_id=str(product_id),
            total_stock=total_stock,
            total_available=total_available,
            locations=location_breakdown,
        )

        # Verify product exists (for logging purposes)
        product_result = await db.execute(select(Product).where(Product.id == product_id))
        product = product_result.scalar_one_or_none()

        if not product:
            logger.error("Product not found for sync", product_id=str(product_id))
            return {"success": False, "error": "Product not found"}

        try:
            # Get current Shopify inventory level
            shopify_inventory = await self.client.get_inventory_level(
                inventory_item_id=shopify_inventory_item_id,
                location_id=shopify_location_id,
            )

            old_quantity = shopify_inventory.get("available", 0)
            # PHASE 2 - Task 2.2: Use aggregated total stock instead of single location
            new_quantity = total_stock
            quantity_delta = new_quantity - old_quantity

            # Update Shopify inventory
            if quantity_delta != 0:
                await self.client.adjust_inventory_level(
                    inventory_item_id=shopify_inventory_item_id,
                    location_id=shopify_location_id,
                    available_adjustment=quantity_delta,
                )

                logger.info(
                    "Inventory synced to Shopify (multi-location aggregated)",
                    product_id=str(product_id),
                    old_qty=old_quantity,
                    new_qty=new_quantity,
                    delta=quantity_delta,
                    total_locations=len(stock_records),
                )

            # Create sync log
            sync_log = ShopifyInventorySync(
                product_id=product_id,
                shopify_product_id=shopify_product_id,
                shopify_inventory_item_id=shopify_inventory_item_id,
                direction="erp_to_shopify",
                sync_type="stock_level",
                old_quantity=old_quantity,
                new_quantity=new_quantity,
                quantity_delta=quantity_delta,
                status="completed",
                triggered_by=triggered_by,
                synced_at=datetime.now(UTC),
            )

            db.add(sync_log)
            await db.commit()

            return {
                "success": True,
                "old_quantity": old_quantity,
                "new_quantity": new_quantity,
                "delta": quantity_delta,
            }

        except Exception as e:
            logger.error(
                "Failed to sync inventory to Shopify",
                product_id=str(product_id),
                error=str(e),
            )

            # Create failed sync log
            sync_log = ShopifyInventorySync(
                product_id=product_id,
                shopify_product_id=shopify_product_id,
                shopify_inventory_item_id=shopify_inventory_item_id,
                direction="erp_to_shopify",
                sync_type="stock_level",
                status="failed",
                error_message=str(e),
                triggered_by=triggered_by,
                synced_at=datetime.now(UTC),
            )

            db.add(sync_log)

            # PHASE 2 - Task 2.3: Add to retry queue for automatic retry
            from datetime import timedelta

            from src.db.shopify_extended_models import ShopifyInventorySyncQueue

            # Calculate next retry time (exponential backoff: 1min, 2min, 4min, 8min, 16min)
            retry_delay_minutes = 2 ** 0  # Start with 1 minute (2^0 = 1)
            next_retry_at = datetime.now(UTC) + timedelta(minutes=retry_delay_minutes)

            queue_item = ShopifyInventorySyncQueue(
                product_id=product_id,
                shopify_product_id=shopify_product_id,
                shopify_inventory_item_id=shopify_inventory_item_id,
                shopify_location_id=shopify_location_id,
                sync_direction="erp_to_shopify",
                triggered_by=triggered_by,
                retry_count=0,
                max_retries=5,
                next_retry_at=next_retry_at,
                last_error=str(e),
                status="pending",
                sync_metadata={
                    "total_stock": total_stock,
                    "total_available": total_available,
                    "location_count": len(stock_records),
                },
            )

            db.add(queue_item)
            await db.commit()

            logger.info(
                "Failed sync added to retry queue",
                product_id=str(product_id),
                next_retry_at=next_retry_at.isoformat(),
            )

            return {"success": False, "error": str(e), "queued_for_retry": True}

    async def sync_stock_from_shopify(
        self,
        db: AsyncSession,
        product_id: UUID,
        shopify_product_id: str,
        new_shopify_quantity: int,
        triggered_by: str = "webhook",
    ) -> dict[str, Any]:
        """
        Sync Shopify stock level to ERP (Shopify → ERP).

        This is typically triggered by Shopify webhooks.

        Args:
            db: Database session
            product_id: Product UUID
            shopify_product_id: Shopify product ID
            new_shopify_quantity: New quantity from Shopify
            triggered_by: Trigger source

        Returns:
            Sync result
        """
        # Get current ERP stock
        result = await db.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()

        if not product:
            logger.error("Product not found for sync", product_id=str(product_id))
            return {"success": False, "error": "Product not found"}

        try:
            old_quantity = product.stock
            quantity_delta = new_shopify_quantity - old_quantity

            # Update ERP stock
            product.stock = new_shopify_quantity

            logger.info(
                "Inventory synced from Shopify",
                product_id=str(product_id),
                old_qty=old_quantity,
                new_qty=new_shopify_quantity,
                delta=quantity_delta,
            )

            # Create sync log
            sync_log = ShopifyInventorySync(
                product_id=product_id,
                shopify_product_id=shopify_product_id,
                direction="shopify_to_erp",
                sync_type="stock_level",
                old_quantity=old_quantity,
                new_quantity=new_shopify_quantity,
                quantity_delta=quantity_delta,
                status="completed",
                triggered_by=triggered_by,
                synced_at=datetime.now(UTC),
            )

            db.add(sync_log)
            await db.commit()

            return {
                "success": True,
                "old_quantity": old_quantity,
                "new_quantity": new_shopify_quantity,
                "delta": quantity_delta,
            }

        except Exception as e:
            logger.error(
                "Failed to sync inventory from Shopify",
                product_id=str(product_id),
                error=str(e),
            )

            # Create failed sync log
            sync_log = ShopifyInventorySync(
                product_id=product_id,
                shopify_product_id=shopify_product_id,
                direction="shopify_to_erp",
                sync_type="stock_level",
                status="failed",
                error_message=str(e),
                triggered_by=triggered_by,
                synced_at=datetime.now(UTC),
            )

            db.add(sync_log)
            await db.commit()

            return {"success": False, "error": str(e)}

    async def bulk_sync_to_shopify(
        self,
        db: AsyncSession,
        product_ids: list[UUID] | None = None,
    ) -> dict[str, Any]:
        """
        Bulk sync multiple products to Shopify (ISS-010).

        If product_ids is None, syncs all mapped products.

        Args:
            db: Database session
            product_ids: List of product UUIDs, or None for all mapped products

        Returns:
            Bulk sync results
        """
        # Get product mappings
        if product_ids:
            stmt = select(ShopifyProductMapping).where(
                ShopifyProductMapping.product_id.in_(product_ids)
            )
        else:
            stmt = select(ShopifyProductMapping).where(
                ShopifyProductMapping.shopify_product_id.isnot(None)
            )

        result = await db.execute(stmt)
        mappings = result.scalars().all()

        results = {
            "total": len(mappings),
            "successful": 0,
            "failed": 0,
            "skipped": 0,
            "errors": [],
        }

        for mapping in mappings:
            try:
                # Check if we have all required Shopify IDs
                if not all([
                    mapping.shopify_product_id,
                    mapping.shopify_inventory_item_id,
                ]):
                    logger.warning(
                        "Product mapping incomplete",
                        product_id=str(mapping.product_id)
                    )
                    results["skipped"] += 1
                    continue

                # Get location ID from environment/config
                from src.config.settings import get_shopify_settings
                settings = get_shopify_settings()

                sync_result = await self.sync_stock_to_shopify(
                    db=db,
                    product_id=mapping.product_id,
                    shopify_product_id=str(mapping.shopify_product_id),
                    shopify_inventory_item_id=str(mapping.shopify_inventory_item_id),
                    shopify_location_id=settings.inventory_location_id,
                    triggered_by="bulk_sync",
                )

                if sync_result["success"]:
                    results["successful"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(
                        f"Product {mapping.product_id}: {sync_result.get('error')}"
                    )

            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"Product {mapping.product_id}: {str(e)}")
                logger.error(
                    "Bulk sync failed for product",
                    product_id=str(mapping.product_id),
                    error=str(e)
                )

        logger.info(
            "Bulk inventory sync complete",
            total=results["total"],
            successful=results["successful"],
            failed=results["failed"],
            skipped=results["skipped"],
        )

        return results

    async def get_sync_history(
        self,
        db: AsyncSession,
        product_id: UUID,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Get inventory sync history for a product.

        Args:
            db: Database session
            product_id: Product UUID
            limit: Maximum number of records to return

        Returns:
            List of sync records
        """
        result = await db.execute(
            select(ShopifyInventorySync)
            .where(ShopifyInventorySync.product_id == product_id)
            .order_by(ShopifyInventorySync.synced_at.desc())
            .limit(limit)
        )
        sync_records = result.scalars().all()

        return [
            {
                "id": str(record.id),
                "direction": record.direction,
                "sync_type": record.sync_type,
                "old_quantity": record.old_quantity,
                "new_quantity": record.new_quantity,
                "delta": record.quantity_delta,
                "status": record.status,
                "triggered_by": record.triggered_by,
                "synced_at": record.synced_at.isoformat(),
                "error": record.error_message,
            }
            for record in sync_records
        ]

    async def resolve_sync_conflict(
        self,
        db: AsyncSession,
        product_id: UUID,
        shopify_product_id: int,
        resolution: str = "erp_wins",
    ) -> dict[str, Any]:
        """
        Resolve inventory sync conflict (ISS-010).

        When ERP and Shopify have different quantities, decide which is correct.

        Args:
            db: Database session
            product_id: Product UUID
            shopify_product_id: Shopify product ID
            resolution: Resolution strategy ('erp_wins' or 'shopify_wins')

        Returns:
            Resolution result
        """
        try:
            # Get product and mapping
            product_stmt = select(Product).where(Product.id == product_id)
            product_result = await db.execute(product_stmt)
            product = product_result.scalar_one_or_none()

            if not product:
                return {"success": False, "error": "Product not found"}

            mapping_stmt = select(ShopifyProductMapping).where(
                ShopifyProductMapping.product_id == product_id
            )
            mapping_result = await db.execute(mapping_stmt)
            mapping = mapping_result.scalar_one_or_none()

            if not mapping:
                return {"success": False, "error": "Product mapping not found"}

            # Get Shopify inventory level
            shopify_data = await self.client.get(f"/products/{shopify_product_id}.json")
            if not shopify_data or "product" not in shopify_data:
                return {"success": False, "error": "Could not fetch Shopify product"}

            variants = shopify_data["product"].get("variants", [])
            if not variants:
                return {"success": False, "error": "No variants found"}

            shopify_quantity = variants[0].get("inventory_quantity", 0)
            erp_quantity = product.stock or 0

            if resolution == "erp_wins":
                # Use ERP quantity as source of truth, update Shopify
                logger.info(
                    "Resolving conflict: ERP wins",
                    product_id=str(product_id),
                    erp_quantity=erp_quantity,
                    shopify_quantity=shopify_quantity,
                )

                # Get location ID
                from src.config.settings import get_shopify_settings
                settings = get_shopify_settings()

                sync_result = await self.sync_stock_to_shopify(
                    db=db,
                    product_id=product_id,
                    shopify_product_id=str(shopify_product_id),
                    shopify_inventory_item_id=str(mapping.shopify_inventory_item_id),
                    shopify_location_id=settings.inventory_location_id,
                    triggered_by="conflict_resolution",
                )

                return {
                    "success": True,
                    "resolution": "erp_wins",
                    "erp_quantity": erp_quantity,
                    "shopify_quantity": shopify_quantity,
                    "sync_result": sync_result,
                }

            elif resolution == "shopify_wins":
                # Use Shopify quantity as source of truth, update ERP
                logger.info(
                    "Resolving conflict: Shopify wins",
                    product_id=str(product_id),
                    erp_quantity=erp_quantity,
                    shopify_quantity=shopify_quantity,
                )

                sync_result = await self.sync_stock_from_shopify(
                    db=db,
                    product_id=product_id,
                    shopify_product_id=str(shopify_product_id),
                    new_shopify_quantity=shopify_quantity,
                    triggered_by="conflict_resolution",
                )

                return {
                    "success": True,
                    "resolution": "shopify_wins",
                    "erp_quantity": erp_quantity,
                    "shopify_quantity": shopify_quantity,
                    "sync_result": sync_result,
                }

            else:
                return {
                    "success": False,
                    "error": f"Unknown resolution strategy: {resolution}"
                }

        except Exception as e:
            logger.error(
                "Conflict resolution failed",
                product_id=str(product_id),
                error=str(e),
            )
            return {"success": False, "error": str(e)}


# PHASE 2 - Task 2.3: Background Worker for Sync Queue Processing


async def process_sync_queue_item(
    db: AsyncSession,
    queue_item: "ShopifyInventorySyncQueue",
    sync_service: "InventorySyncService",
) -> bool:
    """
    Process a single item from the sync queue.

    Args:
        db: Database session
        queue_item: Queue item to process
        sync_service: Initialized sync service

    Returns:
        True if sync succeeded, False otherwise
    """

    # Update status to processing
    queue_item.status = "processing"
    await db.commit()

    try:
        # Attempt sync
        sync_result = await sync_service.sync_stock_to_shopify(
            db=db,
            product_id=queue_item.product_id,
            shopify_product_id=queue_item.shopify_product_id,
            shopify_inventory_item_id=queue_item.shopify_inventory_item_id,
            shopify_location_id=queue_item.shopify_location_id,
            triggered_by=f"retry_{queue_item.retry_count + 1}",
        )

        if sync_result["success"]:
            # Mark as completed
            queue_item.status = "completed"
            queue_item.completed_at = datetime.now(UTC)
            await db.commit()

            logger.info(
                "Sync queue item processed successfully",
                queue_item_id=str(queue_item.id),
                product_id=str(queue_item.product_id),
                retry_count=queue_item.retry_count,
            )
            return True
        else:
            # Sync failed, schedule retry or mark as failed
            return False

    except Exception as e:
        logger.error(
            "Sync queue item processing failed",
            queue_item_id=str(queue_item.id),
            product_id=str(queue_item.product_id),
            error=str(e),
        )
        queue_item.last_error = str(e)
        return False


async def process_sync_queue_batch(db: AsyncSession) -> dict[str, int]:
    """
    Process a batch of items from the sync queue.

    PHASE 2 - Task 2.3: Background worker batch processor
    Runs every 5 minutes to retry failed syncs with exponential backoff.

    Args:
        db: Database session

    Returns:
        Processing statistics
    """
    from src.config.shopify_settings import get_shopify_settings
    from src.db.shopify_extended_models import ShopifyInventorySyncQueue
    from src.integrations.shopify.client import get_shopify_client

    # Query for items ready to retry
    query = (
        select(ShopifyInventorySyncQueue)
        .where(
            ShopifyInventorySyncQueue.status == "pending",
            ShopifyInventorySyncQueue.next_retry_at <= datetime.now(UTC),
            ShopifyInventorySyncQueue.retry_count < ShopifyInventorySyncQueue.max_retries,
        )
        .limit(50)  # Process max 50 items per batch
        .order_by(ShopifyInventorySyncQueue.next_retry_at.asc())
    )

    result = await db.execute(query)
    queue_items = result.scalars().all()

    if not queue_items:
        logger.debug("No items in sync queue ready for retry")
        return {"total": 0, "successful": 0, "failed": 0, "retrying": 0}

    logger.info("Processing sync queue batch", item_count=len(queue_items))

    # Initialize sync service
    shopify_settings = get_shopify_settings()
    shopify_client = get_shopify_client(shopify_settings)
    sync_service = InventorySyncService(shopify_client)

    stats = {
        "total": len(queue_items),
        "successful": 0,
        "failed": 0,
        "retrying": 0,
    }

    async with shopify_client:
        for queue_item in queue_items:
            success = await process_sync_queue_item(db, queue_item, sync_service)

            if success:
                stats["successful"] += 1
            else:
                # Increment retry count
                queue_item.retry_count += 1

                if queue_item.retry_count >= queue_item.max_retries:
                    # Max retries exceeded, mark as failed
                    queue_item.status = "failed"
                    stats["failed"] += 1

                    logger.warning(
                        "Sync queue item failed after max retries",
                        queue_item_id=str(queue_item.id),
                        product_id=str(queue_item.product_id),
                        retry_count=queue_item.retry_count,
                    )
                else:
                    # Schedule next retry with exponential backoff
                    from datetime import timedelta

                    retry_delay_minutes = 2 ** queue_item.retry_count  # 1, 2, 4, 8, 16 minutes
                    queue_item.next_retry_at = datetime.now(UTC) + timedelta(
                        minutes=retry_delay_minutes
                    )
                    queue_item.status = "pending"
                    stats["retrying"] += 1

                    logger.info(
                        "Sync queue item scheduled for retry",
                        queue_item_id=str(queue_item.id),
                        product_id=str(queue_item.product_id),
                        retry_count=queue_item.retry_count,
                        next_retry_at=queue_item.next_retry_at.isoformat(),
                    )

                await db.commit()

    logger.info(
        "Sync queue batch processing complete",
        total=stats["total"],
        successful=stats["successful"],
        failed=stats["failed"],
        retrying=stats["retrying"],
    )

    return stats


async def start_sync_queue_worker():
    """
    Start the background worker for processing the sync queue.

    PHASE 2 - Task 2.3: Background worker lifecycle
    Runs every 5 minutes to process pending sync queue items.
    """
    global _background_worker_running
    from src.config.database import get_async_db

    if _background_worker_running:
        logger.warning("Sync queue worker already running, skipping start")
        return

    _background_worker_running = True
    logger.info("Starting Shopify inventory sync queue worker (5 minute interval)")

    while _background_worker_running:
        try:
            # Process queue batch
            async for db in get_async_db():
                try:
                    await process_sync_queue_batch(db)
                finally:
                    await db.close()

        except Exception as e:
            logger.error("Sync queue worker error", error=str(e))

        # Wait 5 minutes before next batch
        await asyncio.sleep(300)  # 5 minutes


async def stop_sync_queue_worker():
    """Stop the background worker."""
    global _background_worker_running
    _background_worker_running = False
    logger.info("Stopping Shopify inventory sync queue worker")
