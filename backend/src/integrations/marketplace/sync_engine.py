"""Unified marketplace sync orchestrator.

Coordinates product, inventory, and order sync across all connected channels.
Handles batching, error recovery, and audit logging.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog

from .base import BaseMarketplaceChannel, ChannelOrder, ChannelProduct

logger = structlog.get_logger(__name__)


class SyncEngine:
    """Orchestrates marketplace sync operations across channels.

    Provides high-level sync methods that work with any BaseMarketplaceChannel
    implementation. Handles batching, error collection, and result reporting.
    """

    def __init__(self) -> None:
        self._channels: dict[str, BaseMarketplaceChannel] = {}

    def add_channel(self, channel: BaseMarketplaceChannel) -> None:
        """Register an active channel instance for sync operations."""
        self._channels[channel.channel_type] = channel
        logger.info("sync_engine_channel_added", channel_type=channel.channel_type)

    def remove_channel(self, channel_type: str) -> None:
        """Remove a channel from the sync engine."""
        self._channels.pop(channel_type, None)
        logger.info("sync_engine_channel_removed", channel_type=channel_type)

    @property
    def active_channels(self) -> list[str]:
        """List of currently active channel types."""
        return list(self._channels.keys())

    async def push_product_to_channels(
        self,
        product: dict,
        channel_types: list[str] | None = None,
    ) -> dict[str, dict]:
        """Push a product to one or more channels.

        Args:
            product: ERP product data (must include sku, name, price, stock).
            channel_types: Specific channels to push to. None = all active.

        Returns:
            Dict of channel_type -> {"success": bool, "external_id": str | None, "error": str | None}
        """
        targets = channel_types or self.active_channels
        results: dict[str, dict] = {}

        for ch_type in targets:
            channel = self._channels.get(ch_type)
            if not channel:
                results[ch_type] = {"success": False, "external_id": None, "error": "Channel not connected"}
                continue

            try:
                external_id = await channel.push_product(product)
                results[ch_type] = {"success": True, "external_id": external_id, "error": None}
                logger.info(
                    "product_pushed",
                    channel=ch_type,
                    sku=product.get("sku"),
                    external_id=external_id,
                )
            except Exception as e:
                results[ch_type] = {"success": False, "external_id": None, "error": str(e)}
                logger.error(
                    "product_push_failed",
                    channel=ch_type,
                    sku=product.get("sku"),
                    error=str(e),
                )

        return results

    async def sync_inventory_to_channels(
        self,
        items: list[dict],
        channel_types: list[str] | None = None,
    ) -> dict[str, dict]:
        """Push inventory levels to one or more channels.

        Args:
            items: List of {"external_id": str, "quantity": int, "channel_type": str}.
            channel_types: Filter to specific channels. None = all active.

        Returns:
            Dict of channel_type -> {"synced": int, "failed": int, "errors": list}
        """
        targets = channel_types or self.active_channels
        results: dict[str, dict] = {}

        for ch_type in targets:
            channel = self._channels.get(ch_type)
            if not channel:
                continue

            synced = 0
            failed = 0
            errors: list[str] = []

            channel_items = [i for i in items if i.get("channel_type", ch_type) == ch_type]

            for item in channel_items:
                try:
                    await channel.sync_inventory(
                        external_id=item["external_id"],
                        quantity=item["quantity"],
                    )
                    synced += 1
                except Exception as e:
                    failed += 1
                    errors.append(f"{item.get('external_id')}: {e}")

            results[ch_type] = {"synced": synced, "failed": failed, "errors": errors}
            logger.info(
                "inventory_sync_complete",
                channel=ch_type,
                synced=synced,
                failed=failed,
            )

        return results

    async def pull_orders_from_channels(
        self,
        since: datetime | None = None,
        channel_types: list[str] | None = None,
    ) -> dict[str, list[ChannelOrder]]:
        """Pull orders from one or more channels.

        Args:
            since: Only fetch orders after this time. None = channel default.
            channel_types: Specific channels. None = all active.

        Returns:
            Dict of channel_type -> list of ChannelOrder.
        """
        targets = channel_types or self.active_channels
        results: dict[str, list[ChannelOrder]] = {}

        for ch_type in targets:
            channel = self._channels.get(ch_type)
            if not channel:
                continue

            try:
                orders = await channel.pull_orders(since=since)
                results[ch_type] = orders
                logger.info(
                    "orders_pulled",
                    channel=ch_type,
                    count=len(orders),
                    since=since.isoformat() if since else "default",
                )
            except Exception as e:
                results[ch_type] = []
                logger.error("order_pull_failed", channel=ch_type, error=str(e))

        return results

    async def pull_products_from_channels(
        self,
        limit: int = 50,
        channel_types: list[str] | None = None,
    ) -> dict[str, list[ChannelProduct]]:
        """Pull product listings from one or more channels.

        Args:
            limit: Max products per channel.
            channel_types: Specific channels. None = all active.

        Returns:
            Dict of channel_type -> list of ChannelProduct.
        """
        targets = channel_types or self.active_channels
        results: dict[str, list[ChannelProduct]] = {}

        for ch_type in targets:
            channel = self._channels.get(ch_type)
            if not channel:
                continue

            try:
                products = await channel.list_products(limit=limit)
                results[ch_type] = products
                logger.info("products_pulled", channel=ch_type, count=len(products))
            except Exception as e:
                results[ch_type] = []
                logger.error("product_pull_failed", channel=ch_type, error=str(e))

        return results

    async def get_sync_status(self) -> dict[str, dict]:
        """Get connection/sync status for all active channels.

        Returns:
            Dict of channel_type -> {"connected": bool, "channel_type": str, ...}
        """
        status: dict[str, dict] = {}

        for ch_type, channel in self._channels.items():
            try:
                result = await channel.test_connection()
                status[ch_type] = {
                    "connected": result.success,
                    "channel_type": ch_type,
                    "display_name": channel.display_name,
                    "message": result.message,
                    "metadata": result.metadata,
                    "checked_at": datetime.now(UTC).isoformat(),
                }
            except Exception as e:
                status[ch_type] = {
                    "connected": False,
                    "channel_type": ch_type,
                    "display_name": channel.display_name,
                    "message": str(e),
                    "metadata": {},
                    "checked_at": datetime.now(UTC).isoformat(),
                }

        return status


# Global sync engine singleton
sync_engine = SyncEngine()
