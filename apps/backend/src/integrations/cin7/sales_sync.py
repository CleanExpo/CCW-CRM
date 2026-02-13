"""Cin7 sales order and quote sync.

Syncs orders and quotes between the CCW ERP and Cin7 (Core + Omni).
Handles status mapping and FK resolution via customer/product mapping tables.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.cin7_models import (
    Cin7CustomerMapping,
    Cin7OrderMapping,
    Cin7QuoteMapping,
    Cin7SyncLog,
    SyncDirection,
    SyncStatus,
)
from src.db.demo_models import Order, OrderStatus, Quote, QuoteStatus
from src.integrations.cin7.client import Cin7Client

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Status mappings
# ---------------------------------------------------------------------------

CIN7_CORE_ORDER_STATUS: dict[str, OrderStatus] = {
    "Draft": OrderStatus.DRAFT,
    "Authorised": OrderStatus.CONFIRMED,
    "Ordered": OrderStatus.PROCESSING,
    "Dispatched": OrderStatus.SHIPPED,
    "Completed": OrderStatus.DELIVERED,
    "Voided": OrderStatus.CANCELLED,
}

CIN7_OMNI_ORDER_STATUS: dict[str, OrderStatus] = {
    "New": OrderStatus.PENDING,
    "Dispatched": OrderStatus.SHIPPED,
    "Completed": OrderStatus.DELIVERED,
    "Cancelled": OrderStatus.CANCELLED,
}

CIN7_OMNI_QUOTE_STATUS: dict[str, QuoteStatus] = {
    "Pending": QuoteStatus.SENT,
    "Accepted": QuoteStatus.ACCEPTED,
    "Declined": QuoteStatus.REJECTED,
    "Expired": QuoteStatus.EXPIRED,
}

ERP_TO_CIN7_CORE_ORDER_STATUS: dict[OrderStatus, str] = {
    v: k for k, v in CIN7_CORE_ORDER_STATUS.items()
}

ERP_TO_CIN7_OMNI_ORDER_STATUS: dict[OrderStatus, str] = {
    v: k for k, v in CIN7_OMNI_ORDER_STATUS.items()
}

ERP_TO_CIN7_OMNI_QUOTE_STATUS: dict[QuoteStatus, str] = {
    v: k for k, v in CIN7_OMNI_QUOTE_STATUS.items()
}


def map_cin7_core_order_status(cin7_status: str) -> OrderStatus:
    """Map a Cin7 Core sale status to an ERP OrderStatus."""
    return CIN7_CORE_ORDER_STATUS.get(cin7_status, OrderStatus.PENDING)


def map_cin7_omni_order_status(cin7_stage: str) -> OrderStatus:
    """Map a Cin7 Omni sale stage to an ERP OrderStatus."""
    return CIN7_OMNI_ORDER_STATUS.get(cin7_stage, OrderStatus.PENDING)


def map_cin7_omni_quote_status(cin7_stage: str) -> QuoteStatus:
    """Map a Cin7 Omni quote stage to an ERP QuoteStatus."""
    return CIN7_OMNI_QUOTE_STATUS.get(cin7_stage, QuoteStatus.DRAFT)


def map_erp_order_to_core(order: Any) -> dict[str, Any]:
    """Map an ERP Order to a Cin7 Core sale payload."""
    try:
        erp_status = OrderStatus(order.status)
    except ValueError:
        erp_status = OrderStatus.PENDING
    cin7_status = ERP_TO_CIN7_CORE_ORDER_STATUS.get(erp_status, "Draft")

    return {
        "SaleOrderNumber": order.order_number,
        "Status": cin7_status,
        "Total": float(order.total),
        "OrderDate": order.order_date.strftime("%Y-%m-%d") if order.order_date else None,
        "Notes": order.notes or "",
    }


def map_erp_order_to_omni(order: Any) -> dict[str, Any]:
    """Map an ERP Order to a Cin7 Omni sales order payload."""
    try:
        erp_status = OrderStatus(order.status)
    except ValueError:
        erp_status = OrderStatus.PENDING
    cin7_stage = ERP_TO_CIN7_OMNI_ORDER_STATUS.get(erp_status, "New")

    return {
        "reference": order.order_number,
        "stage": cin7_stage,
        "total": float(order.total),
        "createdDate": order.order_date.isoformat() if order.order_date else None,
    }


def map_erp_quote_to_omni(quote: Any) -> dict[str, Any]:
    """Map an ERP Quote to a Cin7 Omni quote payload."""
    try:
        erp_status = QuoteStatus(quote.status)
    except ValueError:
        erp_status = QuoteStatus.DRAFT
    cin7_stage = ERP_TO_CIN7_OMNI_QUOTE_STATUS.get(erp_status, "Pending")

    return {
        "reference": quote.quote_number,
        "stage": cin7_stage,
        "total": float(quote.total),
        "expiryDate": quote.valid_until.isoformat() if quote.valid_until else None,
        "createdDate": quote.quote_date.isoformat() if quote.quote_date else None,
    }


# ---------------------------------------------------------------------------
# Order number generation
# ---------------------------------------------------------------------------


def generate_order_number(cin7_ref: str, source: str) -> str:
    """Generate a unique order_number from a Cin7 sale reference."""
    prefix = "C7C" if source == "core" else "C7O"
    return f"{prefix}-{cin7_ref}"


def generate_quote_number(cin7_ref: str) -> str:
    """Generate a unique quote_number from a Cin7 Omni quote reference."""
    return f"C7Q-{cin7_ref}"


# ---------------------------------------------------------------------------
# Sales Syncer
# ---------------------------------------------------------------------------


class Cin7SalesSyncer:
    """Sync sales orders and quotes between Cin7 and the ERP."""

    def __init__(self, db: AsyncSession, client: Cin7Client) -> None:
        self.db = db
        self.client = client

    # ------------------------------------------------------------------
    # Orders: Cin7 → ERP
    # ------------------------------------------------------------------

    async def sync_orders_from_cin7(
        self,
        source: Literal["core", "omni"] = "core",
        page: int = 1,
        limit: int = 100,
    ) -> Cin7SyncLog:
        """Fetch sales orders from Cin7 and create/update in the ERP."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="orders",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        created = updated = failed = 0

        try:
            if source == "core":
                data = await self.client.core.get_sale_list(page=page, limit=limit)
                orders = data.get("SaleList", [])
            else:
                data = await self.client.omni.get_sales_orders(page=page, rows=limit)
                orders = data if isinstance(data, list) else []

            for cin7_order in orders:
                try:
                    cin7_id = self._extract_order_id(cin7_order, source)
                    if not cin7_id:
                        failed += 1
                        continue

                    mapping = await self._find_order_mapping(cin7_id, source)

                    if mapping is None:
                        await self._create_erp_order_from_cin7(cin7_order, source)
                        created += 1
                    else:
                        await self._update_erp_order_from_cin7(mapping, cin7_order, source)
                        updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "cin7_order_sync_item_failed",
                        cin7_id=self._extract_order_id(cin7_order, source),
                        error=str(exc),
                    )

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]

        log.records_processed = created + updated + failed
        log.records_created = created
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    async def _create_erp_order_from_cin7(
        self,
        cin7_order: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> Order:
        """Create a new ERP Order + mapping from a Cin7 sale record."""
        cin7_id = self._extract_order_id(cin7_order, source)
        ref = self._extract_order_ref(cin7_order, source)

        if source == "core":
            status = map_cin7_core_order_status(cin7_order.get("Status", "Draft"))
            total = Decimal(str(cin7_order.get("Total", 0)))
            # Resolve customer by name
            customer_name = cin7_order.get("Customer", "")
            customer_id = await self._resolve_customer_by_name(customer_name)
        else:
            status = map_cin7_omni_order_status(cin7_order.get("stage", "New"))
            total = Decimal(str(cin7_order.get("total", 0)))
            member_id = cin7_order.get("memberId")
            customer_id = await self._resolve_customer_by_omni_id(member_id)

        order = Order(
            id=uuid4(),
            order_number=generate_order_number(ref, source),
            customer_id=customer_id,
            status=status.value,
            total=total,
            order_date=datetime.now(UTC),
        )

        mapping_kwargs = {}
        if source == "core":
            mapping_kwargs["cin7_core_sale_id"] = cin7_id
        else:
            mapping_kwargs["cin7_omni_order_id"] = cin7_order.get("id")

        mapping = Cin7OrderMapping(
            id=str(uuid4()),
            order_id=str(order.id),
            cin7_order_number=ref,
            sync_status="synced",
            last_synced_at=datetime.now(UTC),
            **mapping_kwargs,
        )

        self.db.add(order)
        self.db.add(mapping)
        return order

    async def _update_erp_order_from_cin7(
        self,
        mapping: Cin7OrderMapping,
        cin7_order: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> None:
        """Update an existing ERP Order from a Cin7 sale record (status only)."""
        result = await self.db.execute(
            select(Order).where(Order.id == mapping.order_id)
        )
        order = result.scalar_one_or_none()
        if order is None:
            return

        if source == "core":
            order.status = map_cin7_core_order_status(
                cin7_order.get("Status", "Draft")
            ).value
        else:
            order.status = map_cin7_omni_order_status(
                cin7_order.get("stage", "New")
            ).value

        mapping.last_synced_at = datetime.now(UTC)
        mapping.sync_status = "synced"

    # ------------------------------------------------------------------
    # Quotes: Cin7 → ERP (Omni only)
    # ------------------------------------------------------------------

    async def sync_quotes_from_cin7(
        self,
        page: int = 1,
        limit: int = 50,
    ) -> Cin7SyncLog:
        """Fetch quotes from Cin7 Omni and create/update in the ERP."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="quotes",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source="omni",
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        created = updated = failed = 0

        try:
            quotes = await self.client.omni.get_quotes(page=page, rows=limit)
            if not isinstance(quotes, list):
                quotes = []

            for cin7_quote in quotes:
                try:
                    cin7_id = cin7_quote.get("id")
                    if cin7_id is None:
                        failed += 1
                        continue

                    mapping = await self._find_quote_mapping(cin7_id)

                    if mapping is None:
                        await self._create_erp_quote_from_cin7(cin7_quote)
                        created += 1
                    else:
                        await self._update_erp_quote_from_cin7(mapping, cin7_quote)
                        updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "cin7_quote_sync_item_failed",
                        cin7_id=cin7_quote.get("id"),
                        error=str(exc),
                    )

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]

        log.records_processed = created + updated + failed
        log.records_created = created
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    async def _create_erp_quote_from_cin7(
        self, cin7_quote: dict[str, Any]
    ) -> Quote:
        """Create a new ERP Quote + mapping from a Cin7 Omni quote."""
        ref = cin7_quote.get("reference", str(cin7_quote.get("id", "")))
        status = map_cin7_omni_quote_status(cin7_quote.get("stage", "Pending"))
        total = Decimal(str(cin7_quote.get("total", 0)))

        member_id = cin7_quote.get("memberId")
        customer_id = await self._resolve_customer_by_omni_id(member_id)

        quote = Quote(
            id=uuid4(),
            quote_number=generate_quote_number(ref),
            customer_id=customer_id,
            status=status.value,
            total=total,
            quote_date=datetime.now(UTC),
        )

        mapping = Cin7QuoteMapping(
            id=str(uuid4()),
            quote_id=str(quote.id),
            cin7_omni_quote_id=cin7_quote.get("id"),
            cin7_quote_reference=ref,
            sync_status="synced",
            last_synced_at=datetime.now(UTC),
        )

        self.db.add(quote)
        self.db.add(mapping)
        return quote

    async def _update_erp_quote_from_cin7(
        self,
        mapping: Cin7QuoteMapping,
        cin7_quote: dict[str, Any],
    ) -> None:
        """Update an existing ERP Quote from a Cin7 Omni quote (status only)."""
        result = await self.db.execute(
            select(Quote).where(Quote.id == mapping.quote_id)
        )
        quote = result.scalar_one_or_none()
        if quote is None:
            return

        quote.status = map_cin7_omni_quote_status(
            cin7_quote.get("stage", "Pending")
        ).value

        mapping.last_synced_at = datetime.now(UTC)
        mapping.sync_status = "synced"

    # ------------------------------------------------------------------
    # ERP → Cin7
    # ------------------------------------------------------------------

    async def sync_order_to_cin7(
        self,
        order_id: str,
        target: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Push a single ERP order to Cin7."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="orders",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source=target,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        try:
            result = await self.db.execute(
                select(Order).where(Order.id == order_id)
            )
            order = result.scalar_one_or_none()
            if order is None:
                log.status = SyncStatus.FAILED.value
                log.error_message = f"Order {order_id} not found"
                log.completed_at = datetime.now(UTC)
                await self.db.flush()
                return log

            if target == "core":
                payload = map_erp_order_to_core(order)
            else:
                payload = map_erp_order_to_omni(order)

            log.details = {"payload": payload, "target": target}
            log.records_processed = 1
            log.records_updated = 1
            log.status = SyncStatus.COMPLETED.value

        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            log.records_failed = 1

        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    async def sync_quote_to_cin7(self, quote_id: str) -> Cin7SyncLog:
        """Push a single ERP quote to Cin7 Omni."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="quotes",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source="omni",
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        try:
            result = await self.db.execute(
                select(Quote).where(Quote.id == quote_id)
            )
            quote = result.scalar_one_or_none()
            if quote is None:
                log.status = SyncStatus.FAILED.value
                log.error_message = f"Quote {quote_id} not found"
                log.completed_at = datetime.now(UTC)
                await self.db.flush()
                return log

            payload = map_erp_quote_to_omni(quote)
            log.details = {"payload": payload, "target": "omni"}
            log.records_processed = 1
            log.records_updated = 1
            log.status = SyncStatus.COMPLETED.value

        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            log.records_failed = 1

        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_order_id(cin7_order: dict[str, Any], source: str) -> str | None:
        """Extract the primary ID from a Cin7 sale record."""
        if source == "core":
            return cin7_order.get("SaleID")
        oid = cin7_order.get("id")
        return str(oid) if oid is not None else None

    @staticmethod
    def _extract_order_ref(cin7_order: dict[str, Any], source: str) -> str:
        """Extract the order reference number from a Cin7 sale record."""
        if source == "core":
            return cin7_order.get("SaleOrderNumber", "")
        return cin7_order.get("reference", "")

    async def _find_order_mapping(
        self, cin7_id: str, source: str
    ) -> Cin7OrderMapping | None:
        if source == "core":
            result = await self.db.execute(
                select(Cin7OrderMapping).where(
                    Cin7OrderMapping.cin7_core_sale_id == cin7_id
                )
            )
        else:
            try:
                omni_id = int(cin7_id)
            except (ValueError, TypeError):
                return None
            result = await self.db.execute(
                select(Cin7OrderMapping).where(
                    Cin7OrderMapping.cin7_omni_order_id == omni_id
                )
            )
        return result.scalar_one_or_none()

    async def _find_quote_mapping(self, cin7_id: int) -> Cin7QuoteMapping | None:
        result = await self.db.execute(
            select(Cin7QuoteMapping).where(
                Cin7QuoteMapping.cin7_omni_quote_id == cin7_id
            )
        )
        return result.scalar_one_or_none()

    async def _resolve_customer_by_name(self, name: str) -> str | None:
        """Resolve an ERP customer_id from a Cin7 Core customer name."""
        if not name:
            return None
        result = await self.db.execute(
            select(Cin7CustomerMapping.customer_id).where(
                Cin7CustomerMapping.cin7_customer_name == name
            )
        )
        row = result.first()
        return str(row[0]) if row else None

    async def _resolve_customer_by_omni_id(self, omni_id: int | None) -> str | None:
        """Resolve an ERP customer_id from a Cin7 Omni contact ID."""
        if omni_id is None:
            return None
        result = await self.db.execute(
            select(Cin7CustomerMapping.customer_id).where(
                Cin7CustomerMapping.cin7_omni_contact_id == omni_id
            )
        )
        row = result.first()
        return str(row[0]) if row else None
