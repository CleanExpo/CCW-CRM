"""Cin7 Shadow Poller — live nightly ghost sync.

Pulls real data from Cin7 Core API, compares against ERP records,
and writes Cin7ShadowSync + Cin7SyncGap rows for every discrepancy found.

This is the engine behind the nightly ghost mode:
  - Fetch Cin7 products/customers/orders/suppliers page-by-page
  - Hash key fields for change detection
  - Compare against ERP (via direct DB query)
  - Persist gaps for AI analysis + self-training

Called by:
  - POST /api/cin7/shadow/poll  (on demand)
  - ShadowSyncScheduler (nightly at 02:00 AEST)
  - POST /api/cron/cin7-shadow-poll (Vercel Cron)
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import get_cin7_settings
from src.db.cin7_shadow_models import Cin7ShadowSync, Cin7SyncGap
from src.db.demo_models import Customer, Product
from src.integrations.cin7.client import get_cin7_client

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Hash helpers
# ---------------------------------------------------------------------------


def _hash_fields(data: dict[str, Any], fields: list[str]) -> str:
    """SHA-256 hash of selected fields — used for change detection."""
    payload = {k: str(data.get(k, "")) for k in sorted(fields)}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Entity-level poll functions
# ---------------------------------------------------------------------------

_PRODUCT_HASH_FIELDS = ["SKU", "Name", "PriceTier1", "Category", "IsActive"]
_CUSTOMER_HASH_FIELDS = ["Name", "Email", "Phone", "Status"]
_ORDER_HASH_FIELDS = ["Status", "Total", "TotalDiscount", "TaxTotal"]
_SUPPLIER_HASH_FIELDS = ["Name", "AccountNumber", "Status"]


async def _upsert_shadow(
    db: AsyncSession,
    entity_type: str,
    cin7_id: str,
    cin7_hash: str,
    erp_id: str | None,
    erp_hash: str | None,
) -> tuple[Cin7ShadowSync, bool]:
    """Create or update a Cin7ShadowSync row.  Returns (record, is_new)."""
    now = datetime.now(UTC)

    stmt = select(Cin7ShadowSync).where(
        Cin7ShadowSync.entity_type == entity_type,
        Cin7ShadowSync.cin7_id == cin7_id,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing is None:
        status = "gap" if erp_id is None else ("synced" if cin7_hash == erp_hash else "conflict")
        record = Cin7ShadowSync(
            id=uuid4(),
            entity_type=entity_type,
            cin7_id=cin7_id,
            erp_id=erp_id,
            sync_status=status,
            cin7_hash=cin7_hash,
            erp_hash=erp_hash,
            last_checked_at=now,
            gap_detected_at=now if status in ("gap", "conflict") else None,
            created_at=now,
        )
        db.add(record)
        return record, True

    # Update existing
    prev_status = existing.sync_status
    existing.cin7_hash = cin7_hash
    existing.erp_hash = erp_hash
    existing.erp_id = erp_id
    existing.last_checked_at = now

    new_status = "gap" if erp_id is None else ("synced" if cin7_hash == erp_hash else "conflict")
    existing.sync_status = new_status

    if new_status in ("gap", "conflict") and existing.gap_detected_at is None:
        existing.gap_detected_at = now
    if new_status == "synced" and prev_status != "synced":
        existing.resolved_at = now

    return existing, False


async def _maybe_open_gap(
    db: AsyncSession,
    shadow: Cin7ShadowSync,
    gap_type: str,
    severity: str,
    field_name: str | None = None,
    cin7_value: str | None = None,
    erp_value: str | None = None,
) -> None:
    """Open a gap record if one doesn't already exist in open/investigating state."""
    stmt = select(Cin7SyncGap).where(
        Cin7SyncGap.shadow_sync_id == shadow.id,
        Cin7SyncGap.gap_type == gap_type,
        Cin7SyncGap.status.in_(["open", "investigating"]),
    )
    if field_name:
        stmt = stmt.where(Cin7SyncGap.field_name == field_name)

    exists = (await db.execute(stmt)).scalar_one_or_none()
    if exists:
        return

    now = datetime.now(UTC)
    gap = Cin7SyncGap(
        id=uuid4(),
        shadow_sync_id=shadow.id,
        gap_type=gap_type,
        entity_type=shadow.entity_type,
        cin7_id=shadow.cin7_id,
        erp_id=shadow.erp_id,
        field_name=field_name,
        cin7_value=cin7_value,
        erp_value=erp_value,
        severity=severity,
        status="open",
        detected_at=now,
        created_at=now,
    )
    db.add(gap)


# ---------------------------------------------------------------------------
# Per-entity-type pollers
# ---------------------------------------------------------------------------


async def _poll_products(db: AsyncSession, client: Any) -> dict[str, int]:
    """Poll Cin7 products and compare against ERP."""
    counts = {"checked": 0, "synced": 0, "gap": 0, "conflict": 0}
    page = 1

    while True:
        try:
            response = await client.core.get_products(page=page, limit=100)
        except Exception as exc:
            logger.warning("shadow_poll_products_api_error", page=page, error=str(exc))
            break

        products = response.get("ProductList", [])
        if not products:
            break

        for cin7_product in products:
            cin7_id = str(cin7_product.get("ID", ""))
            sku = cin7_product.get("SKU", "")
            if not cin7_id:
                continue

            cin7_hash = _hash_fields(cin7_product, _PRODUCT_HASH_FIELDS)

            # Look up ERP product by SKU
            erp_stmt = select(Product).where(Product.sku == sku)
            erp_result = await db.execute(erp_stmt)
            erp_product = erp_result.scalar_one_or_none()

            erp_id = str(erp_product.id) if erp_product else None
            erp_hash = (
                _hash_fields(
                    {
                        "SKU": erp_product.sku,
                        "Name": erp_product.name,
                        "PriceTier1": str(erp_product.price),
                        "Category": erp_product.category,
                        "IsActive": str(erp_product.is_active),
                    },
                    _PRODUCT_HASH_FIELDS,
                )
                if erp_product
                else None
            )

            shadow, _ = await _upsert_shadow(
                db, "product", cin7_id, cin7_hash, erp_id, erp_hash
            )
            await db.flush()

            if shadow.sync_status == "gap":
                await _maybe_open_gap(
                    db, shadow, "missing_in_erp", "high",
                    cin7_value=json.dumps({"sku": sku, "name": cin7_product.get("Name")}),
                )
                counts["gap"] += 1
            elif shadow.sync_status == "conflict":
                await _maybe_open_gap(
                    db, shadow, "data_mismatch", "medium",
                    field_name="price",
                    cin7_value=str(cin7_product.get("PriceTier1")),
                    erp_value=str(erp_product.price) if erp_product else None,
                )
                counts["conflict"] += 1
            else:
                counts["synced"] += 1

            counts["checked"] += 1

        if len(products) < 100:
            break
        page += 1

    return counts


async def _poll_customers(db: AsyncSession, client: Any) -> dict[str, int]:
    """Poll Cin7 customers and compare against ERP."""
    counts = {"checked": 0, "synced": 0, "gap": 0, "conflict": 0}
    page = 1

    while True:
        try:
            response = await client.core.get_customers(page=page, limit=100)
        except Exception as exc:
            logger.warning("shadow_poll_customers_api_error", page=page, error=str(exc))
            break

        customers = response.get("CustomerList", [])
        if not customers:
            break

        for cin7_cust in customers:
            cin7_id = str(cin7_cust.get("ID", ""))
            if not cin7_id:
                continue

            cin7_hash = _hash_fields(cin7_cust, _CUSTOMER_HASH_FIELDS)
            email = cin7_cust.get("Email", "")

            erp_stmt = select(Customer).where(Customer.email == email)
            erp_result = await db.execute(erp_stmt)
            erp_cust = erp_result.scalar_one_or_none()

            erp_id = str(erp_cust.id) if erp_cust else None
            erp_hash = (
                _hash_fields(
                    {
                        "Name": erp_cust.company_name,
                        "Email": erp_cust.email,
                        "Phone": getattr(erp_cust, "phone", ""),
                        "Status": "Active" if erp_cust.is_active else "Inactive",
                    },
                    _CUSTOMER_HASH_FIELDS,
                )
                if erp_cust
                else None
            )

            shadow, _ = await _upsert_shadow(
                db, "customer", cin7_id, cin7_hash, erp_id, erp_hash
            )
            await db.flush()

            if shadow.sync_status == "gap":
                await _maybe_open_gap(
                    db, shadow, "missing_in_erp", "high",
                    cin7_value=json.dumps({"name": cin7_cust.get("Name"), "email": email}),
                )
                counts["gap"] += 1
            elif shadow.sync_status == "conflict":
                await _maybe_open_gap(
                    db, shadow, "data_mismatch", "medium",
                    field_name="email",
                    cin7_value=email,
                    erp_value=erp_cust.email if erp_cust else None,
                )
                counts["conflict"] += 1
            else:
                counts["synced"] += 1

            counts["checked"] += 1

        if len(customers) < 100:
            break
        page += 1

    return counts


async def _poll_orders(db: AsyncSession, client: Any) -> dict[str, int]:
    """Poll Cin7 orders (sale list) and compare against ERP."""
    counts = {"checked": 0, "synced": 0, "gap": 0, "conflict": 0}

    try:
        response = await client.core.get_sale_list(page=1, limit=100)
    except Exception as exc:
        logger.warning("shadow_poll_orders_api_error", error=str(exc))
        return counts

    sales = response.get("SaleList", [])
    for cin7_order in sales:
        cin7_id = str(cin7_order.get("ID", ""))
        if not cin7_id:
            continue

        cin7_hash = _hash_fields(cin7_order, _ORDER_HASH_FIELDS)

        # Orders are matched by Cin7 ID stored in ERP mapping tables (if any)
        # For now, check if a gap record exists — treat as gap if not mapped
        shadow, _ = await _upsert_shadow(
            db, "order", cin7_id, cin7_hash, None, None
        )
        await db.flush()

        if shadow.sync_status == "gap":
            await _maybe_open_gap(
                db, shadow, "missing_in_erp", "critical",
                cin7_value=json.dumps({
                    "ref": cin7_order.get("SaleOrderNumber"),
                    "status": cin7_order.get("Status"),
                }),
            )
            counts["gap"] += 1
        else:
            counts["synced"] += 1

        counts["checked"] += 1

    return counts


async def _poll_suppliers(db: AsyncSession, client: Any) -> dict[str, int]:
    """Poll Cin7 suppliers and record presence/absence in ERP."""
    counts = {"checked": 0, "synced": 0, "gap": 0, "conflict": 0}

    try:
        response = await client.core.get_suppliers(page=1, limit=100)
    except Exception as exc:
        logger.warning("shadow_poll_suppliers_api_error", error=str(exc))
        return counts

    suppliers = response.get("SupplierList", [])
    for cin7_sup in suppliers:
        cin7_id = str(cin7_sup.get("ID", ""))
        if not cin7_id:
            continue

        cin7_hash = _hash_fields(cin7_sup, _SUPPLIER_HASH_FIELDS)
        shadow, _ = await _upsert_shadow(
            db, "supplier", cin7_id, cin7_hash, None, None
        )
        await db.flush()

        if shadow.sync_status == "gap":
            await _maybe_open_gap(
                db, shadow, "missing_in_erp", "medium",
                cin7_value=json.dumps({
                    "name": cin7_sup.get("Name"),
                    "account": cin7_sup.get("AccountNumber"),
                }),
            )
            counts["gap"] += 1
        else:
            counts["synced"] += 1

        counts["checked"] += 1

    return counts


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def run_shadow_poll(db: AsyncSession) -> dict[str, Any]:
    """Execute a full nightly ghost sync poll across all entity types.

    Returns a summary dict suitable for logging and the API response.
    """
    started_at = datetime.now(UTC)
    logger.info("shadow_poll_started")

    settings = get_cin7_settings()
    client = get_cin7_client(settings)

    results: dict[str, dict[str, int]] = {}
    errors: list[str] = []

    async with client.core:
        for entity, poll_fn in [
            ("product", _poll_products),
            ("customer", _poll_customers),
            ("order", _poll_orders),
            ("supplier", _poll_suppliers),
        ]:
            try:
                counts = await poll_fn(db, client)
                results[entity] = counts
                logger.info("shadow_poll_entity_complete", entity=entity, **counts)
            except Exception as exc:
                logger.error("shadow_poll_entity_failed", entity=entity, error=str(exc))
                errors.append(f"{entity}: {exc}")

    await db.commit()

    total_checked = sum(r.get("checked", 0) for r in results.values())
    total_gap = sum(r.get("gap", 0) for r in results.values())
    total_conflict = sum(r.get("conflict", 0) for r in results.values())
    total_synced = sum(r.get("synced", 0) for r in results.values())

    elapsed_ms = int((datetime.now(UTC) - started_at).total_seconds() * 1000)

    summary = {
        "status": "completed" if not errors else "completed_with_errors",
        "mode": "live",
        "polled_at": started_at.isoformat(),
        "elapsed_ms": elapsed_ms,
        "total_checked": total_checked,
        "total_synced": total_synced,
        "total_gap": total_gap,
        "total_conflict": total_conflict,
        "by_entity": results,
        "errors": errors,
    }

    logger.info(
        "shadow_poll_complete",
        total_checked=total_checked,
        total_gap=total_gap,
        total_conflict=total_conflict,
        elapsed_ms=elapsed_ms,
    )
    return summary
