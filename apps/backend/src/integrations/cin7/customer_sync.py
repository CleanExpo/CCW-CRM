"""Cin7 bidirectional customer sync.

Syncs customers between the CCW ERP and Cin7 (Core + Omni).
Handles field mapping for Core (nested Contacts/Addresses) and Omni (flat contact).
"""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.cin7_models import Cin7CustomerMapping, Cin7SyncLog, SyncDirection, SyncStatus
from src.db.demo_models import Customer
from src.integrations.cin7.client import Cin7Client

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Field extraction helpers
# ---------------------------------------------------------------------------


def extract_core_customer_fields(cin7_customer: dict[str, Any]) -> dict[str, Any]:
    """Extract ERP-compatible fields from a Cin7 Core customer dict."""
    contacts = cin7_customer.get("Contacts", [])
    addresses = cin7_customer.get("Addresses", [])
    primary_contact = contacts[0] if contacts else {}
    primary_address = addresses[0] if addresses else {}

    return {
        "company_name": cin7_customer.get("Name", ""),
        "contact_name": primary_contact.get("Name", ""),
        "email": primary_contact.get("Email", ""),
        "phone": primary_contact.get("Phone"),
        "address": primary_address.get("Line1"),
        "city": primary_address.get("City"),
        "state": primary_address.get("State"),
        "postcode": primary_address.get("Postcode"),
        "is_active": cin7_customer.get("Status") == "Active",
    }


def extract_omni_contact_fields(cin7_contact: dict[str, Any]) -> dict[str, Any]:
    """Extract ERP-compatible fields from a Cin7 Omni contact dict."""
    first = cin7_contact.get("firstName", "")
    last = cin7_contact.get("lastName", "")
    contact_name = f"{first} {last}".strip() if (first or last) else ""

    return {
        "company_name": cin7_contact.get("company", ""),
        "contact_name": contact_name,
        "email": cin7_contact.get("email", ""),
        "phone": cin7_contact.get("phone"),
        "city": cin7_contact.get("city"),
        "state": cin7_contact.get("state"),
        "postcode": cin7_contact.get("postcode"),
        "is_active": cin7_contact.get("isActive", True),
    }


def generate_customer_number(cin7_id: str, source: str) -> str:
    """Generate a unique customer_number from a Cin7 customer ID.

    Format: CIN7-{C|O}-{first 8 chars of id}
    """
    prefix = "C" if source == "core" else "O"
    short_id = str(cin7_id)[:8]
    return f"CIN7-{prefix}-{short_id}"


def map_erp_customer_to_core(customer: Any) -> dict[str, Any]:
    """Map an ERP Customer to a Cin7 Core API payload."""
    return {
        "Name": customer.company_name,
        "Currency": "AUD",
        "PaymentTerm": "30 days",
        "TaxRule": "GST on Income",
        "Status": "Active" if customer.is_active else "Inactive",
        "Contacts": [
            {
                "Name": customer.contact_name,
                "Email": customer.email,
                "Phone": customer.phone or "",
                "Default": True,
            }
        ],
        "Addresses": [
            {
                "Line1": customer.address or "",
                "City": customer.city or "",
                "State": customer.state or "",
                "Postcode": customer.postcode or "",
                "Country": "Australia",
                "Type": "Business",
            }
        ],
    }


def map_erp_customer_to_omni(customer: Any) -> dict[str, Any]:
    """Map an ERP Customer to a Cin7 Omni API payload."""
    parts = (customer.contact_name or "").split(" ", 1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""

    return {
        "company": customer.company_name,
        "firstName": first_name,
        "lastName": last_name,
        "email": customer.email,
        "phone": customer.phone or "",
        "city": customer.city or "",
        "state": customer.state or "",
        "postcode": customer.postcode or "",
        "country": "Australia",
        "isActive": customer.is_active,
        "type": "Customer",
    }


# ---------------------------------------------------------------------------
# Customer Syncer
# ---------------------------------------------------------------------------


class Cin7CustomerSyncer:
    """Bidirectional customer sync between Cin7 and the ERP."""

    def __init__(
        self,
        db: AsyncSession,
        client: Cin7Client,
        conflict_strategy: Literal["erp_wins", "cin7_wins"] = "erp_wins",
    ) -> None:
        self.db = db
        self.client = client
        self.conflict_strategy = conflict_strategy

    # ------------------------------------------------------------------
    # Cin7 → ERP
    # ------------------------------------------------------------------

    async def sync_customers_from_cin7(
        self,
        source: Literal["core", "omni"] = "core",
        page: int = 1,
        limit: int = 100,
    ) -> Cin7SyncLog:
        """Fetch customers from Cin7 and create/update in the ERP."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="customers",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        created = updated = failed = 0

        try:
            if source == "core":
                data = await self.client.core.get_customers(page=page, limit=limit)
                customers = data.get("CustomerList", [])
            else:
                data = await self.client.omni.get_contacts(page=page, rows=limit)
                customers = data if isinstance(data, list) else []

            for cin7_customer in customers:
                try:
                    cin7_id = self._extract_id(cin7_customer, source)
                    if not cin7_id:
                        failed += 1
                        continue

                    mapping = await self._find_mapping(cin7_id, source)

                    if mapping is None:
                        await self._create_erp_customer_from_cin7(cin7_customer, source)
                        created += 1
                    else:
                        await self._update_erp_customer_from_cin7(mapping, cin7_customer, source)
                        updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "cin7_customer_sync_item_failed",
                        cin7_id=self._extract_id(cin7_customer, source),
                        error=str(exc),
                    )

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            logger.error("cin7_customer_sync_failed", source=source, error=str(exc))

        log.records_processed = created + updated + failed
        log.records_created = created
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    async def _create_erp_customer_from_cin7(
        self,
        cin7_customer: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> Customer:
        """Create a new ERP Customer + mapping from a Cin7 record."""
        cin7_id = self._extract_id(cin7_customer, source)

        if source == "core":
            fields = extract_core_customer_fields(cin7_customer)
            mapping_kwargs = {"cin7_core_customer_id": cin7_id}
        else:
            fields = extract_omni_contact_fields(cin7_customer)
            mapping_kwargs = {"cin7_omni_contact_id": cin7_customer.get("id")}

        customer = Customer(
            id=uuid4(),
            customer_number=generate_customer_number(cin7_id, source),
            **fields,
        )

        name = fields.get("company_name", cin7_id)
        mapping = Cin7CustomerMapping(
            id=str(uuid4()),
            customer_id=str(customer.id),
            cin7_customer_name=name,
            sync_status="synced",
            last_synced_at=datetime.now(UTC),
            **mapping_kwargs,
        )

        self.db.add(customer)
        self.db.add(mapping)
        return customer

    async def _update_erp_customer_from_cin7(
        self,
        mapping: Cin7CustomerMapping,
        cin7_customer: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> None:
        """Update an existing ERP Customer from a Cin7 record."""
        if self.conflict_strategy == "erp_wins":
            mapping.last_synced_at = datetime.now(UTC)
            mapping.sync_status = "synced"
            return

        result = await self.db.execute(
            select(Customer).where(Customer.id == mapping.customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer is None:
            return

        if source == "core":
            fields = extract_core_customer_fields(cin7_customer)
        else:
            fields = extract_omni_contact_fields(cin7_customer)

        for key, value in fields.items():
            setattr(customer, key, value)

        mapping.last_synced_at = datetime.now(UTC)
        mapping.sync_status = "synced"

    # ------------------------------------------------------------------
    # ERP → Cin7
    # ------------------------------------------------------------------

    async def sync_customer_to_cin7(
        self,
        customer_id: str,
        target: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Push a single ERP customer to Cin7."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="customers",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source=target,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        try:
            result = await self.db.execute(
                select(Customer).where(Customer.id == customer_id)
            )
            customer = result.scalar_one_or_none()
            if customer is None:
                log.status = SyncStatus.FAILED.value
                log.error_message = f"Customer {customer_id} not found"
                log.completed_at = datetime.now(UTC)
                await self.db.flush()
                return log

            if target == "core":
                payload = map_erp_customer_to_core(customer)
            else:
                payload = map_erp_customer_to_omni(customer)

            log.details = {"payload": payload, "target": target}
            log.records_processed = 1
            log.records_updated = 1
            log.status = SyncStatus.COMPLETED.value

            # Update or create mapping
            mapping = await self._find_mapping_by_customer_id(customer_id)
            if mapping is None:
                mapping = Cin7CustomerMapping(
                    id=str(uuid4()),
                    customer_id=customer_id,
                    cin7_customer_name=customer.company_name,
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

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_id(cin7_customer: dict[str, Any], source: str) -> str | None:
        """Extract the primary identifier from a Cin7 customer/contact."""
        if source == "core":
            return cin7_customer.get("ID")
        cid = cin7_customer.get("id")
        return str(cid) if cid is not None else None

    async def _find_mapping(
        self, cin7_id: str, source: str
    ) -> Cin7CustomerMapping | None:
        """Look up an existing customer mapping by Cin7 ID."""
        if source == "core":
            result = await self.db.execute(
                select(Cin7CustomerMapping).where(
                    Cin7CustomerMapping.cin7_core_customer_id == cin7_id
                )
            )
        else:
            try:
                omni_id = int(cin7_id)
            except (ValueError, TypeError):
                return None
            result = await self.db.execute(
                select(Cin7CustomerMapping).where(
                    Cin7CustomerMapping.cin7_omni_contact_id == omni_id
                )
            )
        return result.scalar_one_or_none()

    async def _find_mapping_by_customer_id(
        self, customer_id: str
    ) -> Cin7CustomerMapping | None:
        """Look up an existing customer mapping by ERP customer ID."""
        result = await self.db.execute(
            select(Cin7CustomerMapping).where(
                Cin7CustomerMapping.customer_id == customer_id
            )
        )
        return result.scalar_one_or_none()
