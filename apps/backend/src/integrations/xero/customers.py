"""Xero customer synchronization logic.

This module handles syncing customers between the ERP and Xero as contacts,
supporting bidirectional updates.
"""

from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.crm_models import CustomerProfile
from src.db.demo_models import Customer
from src.integrations.xero import get_xero_client
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroAPIError

logger = structlog.get_logger(__name__)


class XeroCustomerSync:
    """Handles synchronization of customers to/from Xero contacts."""

    def __init__(self, xero_auth: XeroAuth):
        """Initialize customer sync handler.

        Args:
            xero_auth: XeroAuth instance for managing authentication
        """
        self.xero_auth = xero_auth

    async def sync_customer_to_xero(
        self,
        db: AsyncSession,
        organization_id: UUID,
        customer_id: UUID,
        force_update: bool = False,
    ) -> dict:
        """Sync a customer to Xero as a contact.

        Args:
            db: Database session
            organization_id: Organization UUID
            customer_id: Customer UUID to sync
            force_update: If True, update even if already synced

        Returns:
            Dict with sync result and contact details

        Raises:
            ValueError: If customer not found
            XeroAPIError: If Xero API call fails
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Get customer + profile (payment terms / customer type)
        stmt = select(Customer).where(Customer.id == customer_id)
        result = await db.execute(stmt)
        customer = result.scalar_one_or_none()

        profile_stmt = select(CustomerProfile).where(CustomerProfile.customer_id == customer_id)
        profile_result = await db.execute(profile_stmt)
        customer_profile = profile_result.scalar_one_or_none()

        if not customer:
            raise ValueError(f"Customer {customer_id} not found")

        # Check if already synced and force_update is False
        if customer.xero_contact_id and not force_update:
            logger.info(
                "Customer already synced to Xero",
                customer_id=str(customer_id),
                xero_contact_id=customer.xero_contact_id,
            )
            return {
                "success": True,
                "already_synced": True,
                "customer_id": str(customer_id),
                "xero_contact_id": customer.xero_contact_id,
            }

        # Initialize Xero client
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Check if contact exists in Xero by email
            existing_contact = await xero_client.get_contact_by_email(customer.email)

            if existing_contact:
                # Update existing contact
                contact_id = existing_contact["ContactID"]
                logger.info(
                    "Found existing Xero contact",
                    contact_id=contact_id,
                    email=customer.email,
                )

                # Store contact ID if not already stored
                if not customer.xero_contact_id:
                    customer.xero_contact_id = contact_id
                    customer.xero_synced_at = datetime.now()
                    await db.commit()

                return {
                    "success": True,
                    "action": "linked",
                    "customer_id": str(customer_id),
                    "xero_contact_id": contact_id,
                    "message": "Linked to existing Xero contact",
                }

            # Create new contact in Xero
            address = {
                "street": customer.address or "",
                "city": customer.city or "",
                "state": customer.state or "",
                "postal_code": customer.postcode or "",
                "country": "Australia",  # Default
            }

            contact = await xero_client.create_contact(
                name=customer.company_name,
                email=customer.email,
                phone=customer.phone,
                address=address,
                payment_terms_days=(
                    customer_profile.payment_terms_days if customer_profile else None
                ),
            )

            # Store Xero contact ID
            customer.xero_contact_id = contact["ContactID"]
            customer.xero_synced_at = datetime.now()
            await db.commit()

            logger.info(
                "Customer synced to Xero",
                customer_id=str(customer_id),
                customer_number=customer.customer_number,
                xero_contact_id=contact["ContactID"],
            )

            return {
                "success": True,
                "action": "created",
                "customer_id": str(customer_id),
                "customer_number": customer.customer_number,
                "xero_contact_id": contact["ContactID"],
                "message": "Created new Xero contact",
            }

        except XeroAPIError as e:
            logger.error(
                "Failed to sync customer to Xero",
                customer_id=str(customer_id),
                error=str(e),
                status_code=e.status_code,
            )
            raise

        finally:
            await xero_client.close()

    async def process_contact_webhook(
        self,
        db: AsyncSession,
        organization_id: UUID,
        xero_contact_data: dict,
    ) -> dict:
        """Process a contact webhook from Xero.

        Args:
            db: Database session
            organization_id: Organization UUID
            xero_contact_data: Contact data from Xero webhook

        Returns:
            Dict with processing result
        """
        contact_id = xero_contact_data.get("ContactID")
        contact_name = xero_contact_data.get("Name")
        email = xero_contact_data.get("EmailAddress")

        logger.info(
            "Processing contact webhook",
            contact_id=contact_id,
            name=contact_name,
            email=email,
        )

        if not contact_id:
            raise ValueError("Contact webhook missing ContactID")

        # Find customer by xero_contact_id
        stmt = select(Customer).where(Customer.xero_contact_id == contact_id)
        result = await db.execute(stmt)
        customer = result.scalar_one_or_none()

        if not customer:
            # Contact not tracked in ERP
            logger.info(
                "Contact not tracked in ERP",
                contact_id=contact_id,
            )
            return {
                "success": True,
                "note": "Contact not tracked in ERP",
            }

        # Update customer with Xero data
        updated_fields = []

        # Update company name if different
        if contact_name and customer.company_name != contact_name:
            customer.company_name = contact_name
            updated_fields.append("company_name")

        # Update email if different
        if email and customer.email != email:
            customer.email = email
            updated_fields.append("email")

        # Update phone from Xero data
        phones = xero_contact_data.get("Phones", [])
        if phones:
            phone = phones[0].get("PhoneNumber")
            if phone and customer.phone != phone:
                customer.phone = phone
                updated_fields.append("phone")

        # Update address from Xero data
        addresses = xero_contact_data.get("Addresses", [])
        if addresses:
            address = addresses[0]
            if address.get("AddressLine1") and customer.address != address.get("AddressLine1"):
                customer.address = address.get("AddressLine1")
                updated_fields.append("address")

            if address.get("City") and customer.city != address.get("City"):
                customer.city = address.get("City")
                updated_fields.append("city")

            if address.get("Region") and customer.state != address.get("Region"):
                customer.state = address.get("Region")
                updated_fields.append("state")

            if address.get("PostalCode") and customer.postcode != address.get("PostalCode"):
                customer.postcode = address.get("PostalCode")
                updated_fields.append("postcode")

        if updated_fields:
            customer.xero_synced_at = datetime.now()
            await db.commit()

            logger.info(
                "Updated customer from Xero webhook",
                customer_id=str(customer.id),
                updated_fields=updated_fields,
            )

            return {
                "success": True,
                "customer_id": str(customer.id),
                "customer_number": customer.customer_number,
                "updated_fields": updated_fields,
            }
        else:
            logger.info(
                "No changes needed for customer",
                customer_id=str(customer.id),
            )

            return {
                "success": True,
                "customer_id": str(customer.id),
                "note": "No changes needed",
            }

    async def bulk_sync_customers(
        self,
        db: AsyncSession,
        organization_id: UUID,
        max_customers: int = 100,
    ) -> dict:
        """Bulk sync customers to Xero.

        Args:
            db: Database session
            organization_id: Organization UUID
            max_customers: Maximum number of customers to sync

        Returns:
            Dict with sync statistics

        Raises:
            ValueError: If no active Xero connection
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Find unsynced customers (active customers without xero_contact_id)
        stmt = (
            select(Customer)
            .where(Customer.is_active)
            .where(Customer.xero_contact_id is None)
            .limit(max_customers)
        )
        result = await db.execute(stmt)
        customers = result.scalars().all()

        logger.info(
            "Starting bulk customer sync",
            organization_id=str(organization_id),
            total_customers=len(customers),
        )

        synced = 0
        failed = 0
        errors = []

        for customer in customers:
            try:
                await self.sync_customer_to_xero(db, organization_id, customer.id)
                synced += 1
            except Exception as e:
                failed += 1
                errors.append(
                    {
                        "customer_id": str(customer.id),
                        "customer_number": customer.customer_number,
                        "error": str(e),
                    }
                )
                logger.error(
                    "Failed to sync customer",
                    customer_id=str(customer.id),
                    customer_number=customer.customer_number,
                    error=str(e),
                )

        logger.info(
            "Bulk customer sync completed",
            synced=synced,
            failed=failed,
            total=len(customers),
        )

        return {
            "total": len(customers),
            "synced": synced,
            "failed": failed,
            "errors": errors if errors else None,
        }
