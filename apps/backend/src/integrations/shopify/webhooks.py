"""Shopify webhook handlers.

Processes incoming webhooks from Shopify for real-time order and inventory updates.
"""

import uuid
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.shopify_models import ShopifyWebhookLog
from src.integrations.shopify.client import ShopifyClient
from src.integrations.shopify.orders import ShopifyOrderImporter
from src.integrations.shopify.product_sync import BidirectionalProductSyncer

logger = structlog.get_logger(__name__)


class ShopifyWebhookHandler:
    """Handle incoming Shopify webhooks."""

    def __init__(self, db: AsyncSession, client: ShopifyClient) -> None:
        """Initialize webhook handler.

        Args:
            db: Database session
            client: Shopify API client
        """
        self.db = db
        self.client = client

    async def handle_webhook(
        self,
        topic: str,
        shop_domain: str,
        payload: dict[str, Any],
        webhook_id: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Handle a Shopify webhook.

        Args:
            topic: Webhook topic (e.g., "orders/create")
            shop_domain: Shopify shop domain
            payload: Webhook payload
            webhook_id: Shopify webhook ID (if available)
            headers: Request headers

        Returns:
            Processing result dict
        """
        logger.info(
            "webhook_received",
            topic=topic,
            shop_domain=shop_domain,
            webhook_id=webhook_id,
        )

        # Log webhook
        webhook_log = await self._log_webhook(
            topic=topic,
            shop_domain=shop_domain,
            payload=payload,
            webhook_id=webhook_id,
            headers=headers,
        )

        # Route to appropriate handler
        try:
            if topic == "orders/create":
                result = await self._handle_order_create(payload)
            elif topic == "orders/updated":
                result = await self._handle_order_updated(payload)
            elif topic == "orders/cancelled":
                result = await self._handle_order_cancelled(payload)
            elif topic == "products/create":
                result = await self._handle_product_create(payload)
            elif topic == "products/update":
                result = await self._handle_product_update(payload)
            elif topic == "inventory_levels/update":
                result = await self._handle_inventory_update(payload)
            else:
                logger.warning("unhandled_webhook_topic", topic=topic)
                result = {"handled": False, "reason": f"Unknown topic: {topic}"}

            # Mark webhook as processed
            webhook_log.processed = True
            webhook_log.processed_at = datetime.utcnow()
            await self.db.commit()

            logger.info(
                "webhook_processed",
                topic=topic,
                webhook_id=webhook_id,
                result=result,
            )

            return {"success": True, "result": result}

        except Exception as e:
            logger.error(
                "webhook_processing_failed",
                topic=topic,
                webhook_id=webhook_id,
                error=str(e),
            )

            # Log error
            webhook_log.processing_error = str(e)
            await self.db.commit()

            return {"success": False, "error": str(e)}

    async def _log_webhook(
        self,
        topic: str,
        shop_domain: str,
        payload: dict[str, Any],
        webhook_id: str | None,
        headers: dict[str, str] | None,
    ) -> ShopifyWebhookLog:
        """Log webhook to database.

        Args:
            topic: Webhook topic
            shop_domain: Shopify shop domain
            payload: Webhook payload
            webhook_id: Shopify webhook ID
            headers: Request headers

        Returns:
            Created webhook log instance
        """
        webhook_log = ShopifyWebhookLog(
            id=uuid.uuid4(),
            topic=topic,
            shopify_webhook_id=webhook_id,
            shop_domain=shop_domain,
            payload=payload,
            headers=headers or {},
            processed=False,
        )

        self.db.add(webhook_log)
        await self.db.flush()

        return webhook_log

    async def _handle_order_create(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle orders/create webhook.

        Args:
            payload: Order data from Shopify

        Returns:
            Processing result
        """
        logger.info("handling_order_create", order_id=payload.get("id"))

        importer = ShopifyOrderImporter(self.db, self.client)
        order = await importer.import_order(payload["id"])

        return {
            "handled": True,
            "action": "order_imported",
            "order_id": str(order.id),
            "order_number": order.order_number,
        }

    async def _handle_order_updated(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle orders/updated webhook.

        Args:
            payload: Order data from Shopify

        Returns:
            Processing result
        """
        logger.info("handling_order_updated", order_id=payload.get("id"))

        # Re-import order (will update existing)
        importer = ShopifyOrderImporter(self.db, self.client)
        order = await importer.import_order(payload["id"])

        return {
            "handled": True,
            "action": "order_updated",
            "order_id": str(order.id),
        }

    async def _handle_order_cancelled(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle orders/cancelled webhook.

        Args:
            payload: Order data from Shopify

        Returns:
            Processing result
        """
        logger.info("handling_order_cancelled", order_id=payload.get("id"))

        # Re-import order (status will be updated to cancelled)
        importer = ShopifyOrderImporter(self.db, self.client)
        order = await importer.import_order(payload["id"])

        return {
            "handled": True,
            "action": "order_cancelled",
            "order_id": str(order.id),
        }

    async def _handle_product_create(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle products/create webhook (ISS-009: Shopify → ERP sync).

        Args:
            payload: Product data from Shopify

        Returns:
            Processing result
        """
        logger.info("handling_product_create", product_id=payload.get("id"))

        # Sync from Shopify to ERP (ISS-009)
        syncer = BidirectionalProductSyncer(self.db, self.client)

        try:
            # Sync the product from Shopify to ERP
            result = await syncer.sync_from_shopify(
                shopify_product_id=payload["id"],
                force=False,  # Don't force - respect conflict resolution
            )

            return {
                "handled": True,
                "action": "product_synced_from_shopify",
                "shopify_product_id": payload.get("id"),
                "result": result,
            }

        except Exception as e:
            logger.error(
                "product_create_sync_failed",
                shopify_product_id=payload.get("id"),
                error=str(e),
            )
            return {
                "handled": False,
                "action": "sync_failed",
                "shopify_product_id": payload.get("id"),
                "error": str(e),
            }

    async def _handle_product_update(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle products/update webhook (ISS-009: Shopify → ERP sync).

        Args:
            payload: Product data from Shopify

        Returns:
            Processing result
        """
        logger.info("handling_product_update", product_id=payload.get("id"))

        # Sync from Shopify to ERP (ISS-009)
        syncer = BidirectionalProductSyncer(self.db, self.client)

        try:
            # Sync the updated product from Shopify to ERP
            result = await syncer.sync_from_shopify(
                shopify_product_id=payload["id"],
                force=False,  # Don't force - use conflict resolution
            )

            return {
                "handled": True,
                "action": "product_synced_from_shopify",
                "shopify_product_id": payload.get("id"),
                "result": result,
            }

        except Exception as e:
            logger.error(
                "product_update_sync_failed",
                shopify_product_id=payload.get("id"),
                error=str(e),
            )
            return {
                "handled": False,
                "action": "sync_failed",
                "shopify_product_id": payload.get("id"),
                "error": str(e),
            }

    async def _handle_inventory_update(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle inventory_levels/update webhook.

        Args:
            payload: Inventory level data from Shopify

        Returns:
            Processing result
        """
        logger.info(
            "handling_inventory_update",
            inventory_item_id=payload.get("inventory_item_id"),
        )

        # For now, just log - inventory is managed from ERP to Shopify
        # In a full implementation, you might sync Shopify inventory back to ERP

        return {
            "handled": True,
            "action": "inventory_logged",
            "inventory_item_id": payload.get("inventory_item_id"),
        }
