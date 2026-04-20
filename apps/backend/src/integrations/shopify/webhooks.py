"""Shopify webhook handlers.

Processes incoming webhooks from Shopify for real-time order and inventory updates.

ISS-036: Enhanced with proper transaction boundaries to prevent data loss on crashes.
- Uses WebhookService for idempotency and retry support
- Transaction commits only on successful processing
- Failed webhooks queued for automatic retry with exponential backoff
"""

import os
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.demo_models import Order
from src.db.shopify_models import ShopifyOrderMapping, ShopifyProductMapping, ShopifyWebhookLog
from src.integrations.shopify.client import ShopifyClient
from src.integrations.shopify.inventory_sync import InventorySyncService
from src.integrations.shopify.orders import ShopifyOrderImporter
from src.integrations.shopify.product_sync import BidirectionalProductSyncer
from src.integrations.xero import get_xero_client
from src.integrations.xero.credit_notes import push_credit_note
from src.services.webhook_service import (
    WebhookProcessingError,
    WebhookService,
)

logger = structlog.get_logger(__name__)


class ShopifyWebhookHandler:
    """Handle incoming Shopify webhooks with transaction safety.

    ISS-036: This handler now uses WebhookService for:
    - Idempotency (prevents duplicate processing via X-Shopify-Webhook-Id)
    - Transaction boundaries (commits only on success)
    - Retry mechanism (failed webhooks queued for retry)
    - Dead letter queue (max retries exceeded → manual intervention)
    """

    def __init__(self, db: AsyncSession, client: ShopifyClient) -> None:
        """Initialize webhook handler.

        Args:
            db: Database session
            client: Shopify API client
        """
        self.db = db
        self.client = client
        self.webhook_service = WebhookService(db)

    async def handle_webhook(
        self,
        topic: str,
        shop_domain: str,
        payload: dict[str, Any],
        webhook_id: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Handle a Shopify webhook with transaction safety.

        ISS-036: Now uses WebhookService for reliable processing:
        1. Check idempotency (skip if already processed)
        2. Create webhook event record
        3. Process in transaction
        4. Commit only on success, schedule retry on failure

        Args:
            topic: Webhook topic (e.g., "orders/create")
            shop_domain: Shopify shop domain
            payload: Webhook payload
            webhook_id: Shopify webhook ID (from X-Shopify-Webhook-Id header)
            headers: Request headers

        Returns:
            Processing result dict
        """
        logger.info(
            "shopify_webhook_received",
            topic=topic,
            shop_domain=shop_domain,
            webhook_id=webhook_id,
        )

        # Generate event_id for idempotency (use Shopify's webhook ID if available)
        if webhook_id:
            event_id = webhook_id
        else:
            timestamp = datetime.now(UTC).timestamp()
            event_id = f"{shop_domain}_{topic}_{payload.get('id', 'unknown')}_{timestamp}"

        # Create handler wrapper that routes to topic-specific handlers
        async def process_shopify_webhook(
            webhook_payload: dict[str, Any],
            db: AsyncSession,
        ) -> dict[str, Any]:
            """Inner handler for Shopify webhook processing."""
            # Also log to legacy ShopifyWebhookLog for backward compatibility
            await self._log_webhook_legacy(
                topic=topic,
                shop_domain=shop_domain,
                payload=webhook_payload,
                webhook_id=webhook_id,
                headers=headers,
            )

            # Route to topic-specific handler
            if topic == "orders/create":
                return await self._handle_order_create(webhook_payload)
            elif topic == "orders/updated":
                return await self._handle_order_updated(webhook_payload)
            elif topic == "orders/cancelled":
                return await self._handle_order_cancelled(webhook_payload)
            elif topic == "products/create":
                return await self._handle_product_create(webhook_payload)
            elif topic == "products/update":
                return await self._handle_product_update(webhook_payload)
            elif topic == "inventory_levels/update":
                return await self._handle_inventory_update(webhook_payload)
            elif topic == "refunds/create":
                return await self._handle_refund_create(webhook_payload)
            else:
                logger.warning("unhandled_webhook_topic", topic=topic)
                return {"handled": False, "reason": f"Unknown topic: {topic}"}

        # Process webhook with transaction safety (ISS-036)
        result = await self.webhook_service.process_webhook(
            source="shopify",
            event_type=topic,
            event_id=event_id,
            payload=payload,
            handler=process_shopify_webhook,
            headers=headers,
            max_retries=3,
        )

        # Transform result for backward compatibility
        if result["status"] == "success":
            return {"success": True, "result": result.get("result", {})}
        elif result["status"] == "duplicate":
            return {"success": True, "result": {"skipped": True, "reason": "duplicate"}}
        else:
            # Return 200 to prevent Shopify from retrying immediately
            # Webhook service handles retry scheduling
            return {
                "success": False,
                "error": result.get("error", "Processing failed"),
                "will_retry": result.get("will_retry", False),
                "next_retry_at": result.get("next_retry_at"),
            }

    async def _log_webhook_legacy(
        self,
        topic: str,
        shop_domain: str,
        payload: dict[str, Any],
        webhook_id: str | None,
        headers: dict[str, str] | None,
    ) -> ShopifyWebhookLog:
        """Log webhook to legacy ShopifyWebhookLog table for backward compatibility.

        Note: Primary tracking is now in webhook_events table via WebhookService.
        This maintains the existing audit trail in shopify_webhook_logs.

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

    async def _handle_refund_create(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle refunds/create webhook (UNI-1817: Shopify Refunds + Xero Credit Note Sync).

        Args:
            payload: Refund data from Shopify

        Returns:
            Processing result (always succeeds — Xero failures are logged, not raised)
        """
        refund_id = payload.get("id")
        shopify_order_id = payload.get("order_id")
        transactions = payload.get("transactions", [])
        amount = transactions[0].get("amount") if transactions else None

        logger.info(
            "handling_refund_create",
            refund_id=refund_id,
            shopify_order_id=shopify_order_id,
            amount=amount,
        )

        if not shopify_order_id or amount is None:
            logger.warning(
                "refund_missing_fields",
                refund_id=refund_id,
                shopify_order_id=shopify_order_id,
            )
            return {"handled": False, "reason": "missing order_id or transaction amount"}

        # Look up the ShopifyOrderMapping to get the internal Order
        stmt = (
            select(ShopifyOrderMapping)
            .where(ShopifyOrderMapping.shopify_order_id == shopify_order_id)
        )
        result = await self.db.execute(stmt)
        mapping = result.scalar_one_or_none()

        if not mapping:
            logger.warning("refund_no_order_mapping", shopify_order_id=shopify_order_id)
            return {"handled": False, "reason": "no order mapping found"}

        # Load Order with customer eagerly
        order_stmt = (
            select(Order)
            .options(selectinload(Order.customer))
            .where(Order.id == mapping.order_id)
        )
        order_result = await self.db.execute(order_stmt)
        order = order_result.scalar_one_or_none()

        if not order or not order.xero_invoice_id:
            logger.info(
                "refund_skipping_xero",
                order_id=str(mapping.order_id),
                reason="no xero_invoice_id",
            )
            return {"handled": True, "xero_synced": False, "reason": "order not in Xero"}

        contact_id = order.customer.xero_contact_id if order.customer else None
        if not contact_id:
            logger.info(
                "refund_skipping_xero",
                order_id=str(order.id),
                reason="customer has no xero_contact_id",
            )
            return {"handled": True, "xero_synced": False, "reason": "customer not in Xero"}

        try:
            xero_client = get_xero_client(
                access_token=os.environ.get("XERO_ACCESS_TOKEN", ""),
                tenant_id=os.environ.get("XERO_TENANT_ID", ""),
            )
            credit_note = await push_credit_note(
                xero_client=xero_client,
                contact_id=contact_id,
                amount=amount,
                description=f"Shopify refund for order {order.order_number}",
                reference=f"SHOPIFY-REFUND-{refund_id}",
            )
            return {
                "handled": True,
                "xero_synced": True,
                "credit_note_id": credit_note.get("CreditNoteID"),
            }
        except Exception as e:
            logger.warning(
                "refund_xero_credit_note_failed",
                refund_id=refund_id,
                order_id=str(order.id),
                error=str(e),
            )
            return {"handled": True, "xero_synced": False, "reason": f"Xero error: {e}"}

    async def _handle_product_create(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle products/create webhook (ISS-009: Shopify → ERP sync).

        Args:
            payload: Product data from Shopify

        Returns:
            Processing result

        Raises:
            WebhookProcessingError: On sync failure (triggers retry)
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
            # ISS-036: Raise WebhookProcessingError to trigger retry
            raise WebhookProcessingError(
                f"Product sync failed: {str(e)}",
                retriable=True,
                details={
                    "shopify_product_id": payload.get("id"),
                    "action": "product_create",
                },
            ) from e

    async def _handle_product_update(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle products/update webhook (ISS-009: Shopify → ERP sync).

        Args:
            payload: Product data from Shopify

        Returns:
            Processing result

        Raises:
            WebhookProcessingError: On sync failure (triggers retry)
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
            # ISS-036: Raise WebhookProcessingError to trigger retry
            raise WebhookProcessingError(
                f"Product update sync failed: {str(e)}",
                retriable=True,
                details={
                    "shopify_product_id": payload.get("id"),
                    "action": "product_update",
                },
            ) from e

    async def _handle_inventory_update(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle inventory_levels/update webhook (ISS-010: Shopify → ERP inventory sync).

        Args:
            payload: Inventory level data from Shopify

        Returns:
            Processing result
        """
        inventory_item_id = payload.get("inventory_item_id")
        available_quantity = payload.get("available")

        logger.info(
            "handling_inventory_update",
            inventory_item_id=inventory_item_id,
            available_quantity=available_quantity,
        )

        # Find product mapping by shopify_inventory_item_id
        from sqlalchemy import select
        stmt = select(ShopifyProductMapping).where(
            ShopifyProductMapping.shopify_inventory_item_id == inventory_item_id
        )
        result = await self.db.execute(stmt)
        mapping = result.scalar_one_or_none()

        if not mapping:
            logger.warning(
                "inventory_update_no_mapping",
                inventory_item_id=inventory_item_id,
            )
            return {
                "handled": False,
                "action": "no_mapping_found",
                "inventory_item_id": inventory_item_id,
            }

        # Sync inventory from Shopify to ERP (ISS-010)
        sync_service = InventorySyncService(self.client)

        try:
            # Sync the inventory level from Shopify to ERP
            result = await sync_service.sync_stock_from_shopify(
                db=self.db,
                product_id=mapping.product_id,
                shopify_product_id=mapping.shopify_product_id,
                new_shopify_quantity=available_quantity,
                triggered_by="webhook",
            )

            return {
                "handled": True,
                "action": "inventory_synced_from_shopify",
                "inventory_item_id": inventory_item_id,
                "product_id": str(mapping.product_id),
                "shopify_product_id": mapping.shopify_product_id,
                "new_quantity": available_quantity,
                "result": result,
            }

        except Exception as e:
            logger.error(
                "inventory_update_sync_failed",
                inventory_item_id=inventory_item_id,
                product_id=mapping.product_id,
                error=str(e),
            )
            # ISS-036: Raise WebhookProcessingError to trigger retry
            raise WebhookProcessingError(
                f"Inventory sync failed: {str(e)}",
                retriable=True,
                details={
                    "inventory_item_id": inventory_item_id,
                    "product_id": str(mapping.product_id),
                    "action": "inventory_update",
                },
            ) from e


# UNI-1873: Auto-register required webhooks on connection

REQUIRED_WEBHOOK_TOPICS = [
    "orders/create",
    "orders/updated",
    "orders/cancelled",
    "products/update",
    "inventory_levels/update",
    "refunds/create",
]


async def register_required_webhooks(
    shopify_client: Any,
    shop_domain: str,
) -> list[dict]:
    """Register required Shopify webhooks if not already present.

    For each required topic, checks existing webhooks first to avoid duplicates,
    then registers any missing ones against the configured SHOPIFY_WEBHOOK_URL.

    Args:
        shopify_client: ShopifyClient instance (used for auth via settings.access_token)
        shop_domain: Shopify shop domain (e.g. my-store.myshopify.com)

    Returns:
        List of dicts with keys: topic, webhook_id, created (and optional error)
    """
    webhook_base_url = os.environ.get("SHOPIFY_WEBHOOK_URL", "").rstrip("/")
    if not webhook_base_url:
        logger.warning("shopify_webhook_url_not_set", shop_domain=shop_domain)

    api_version = "2024-01"
    base = f"https://{shop_domain}/admin/api/{api_version}"
    access_token = shopify_client.settings.access_token
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
    }

    results: list[dict] = []

    async with httpx.AsyncClient(timeout=30.0) as http:
        # Fetch existing webhooks once to avoid duplicates
        resp = await http.get(f"{base}/webhooks.json", headers=headers)
        resp.raise_for_status()
        existing_topics = {
            wh["topic"]: wh["id"]
            for wh in resp.json().get("webhooks", [])
        }

        for topic in REQUIRED_WEBHOOK_TOPICS:
            if topic in existing_topics:
                results.append({"topic": topic, "webhook_id": existing_topics[topic], "created": False})
                logger.info("shopify_webhook_already_exists", topic=topic, shop_domain=shop_domain)
                continue

            address = f"{webhook_base_url}/{topic.replace('/', '-')}"
            payload = {"webhook": {"topic": topic, "address": address, "format": "json"}}

            try:
                resp = await http.post(f"{base}/webhooks.json", headers=headers, json=payload)
                resp.raise_for_status()
                webhook_id = resp.json()["webhook"]["id"]
                results.append({"topic": topic, "webhook_id": webhook_id, "created": True})
                logger.info(
                    "shopify_webhook_registered",
                    topic=topic,
                    webhook_id=webhook_id,
                    shop_domain=shop_domain,
                )
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "shopify_webhook_registration_failed",
                    topic=topic,
                    shop_domain=shop_domain,
                    status_code=exc.response.status_code,
                    detail=exc.response.text,
                )
                results.append(
                    {"topic": topic, "webhook_id": None, "created": False, "error": exc.response.text}
                )

    return results
