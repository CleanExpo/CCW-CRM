"""Demo mode Xero client for testing without real API calls.

Returns realistic mock data that matches Xero's API response structure.
"""

import uuid
from datetime import date, datetime

import structlog

logger = structlog.get_logger(__name__)


class DemoXeroClient:
    """Demo Xero client that returns mock data for testing.

    This client mimics the XeroClient interface but returns fake data,
    allowing full integration testing without real Xero API calls.
    """

    def __init__(self, access_token: str, tenant_id: str):
        """Initialize demo client.

        Args:
            access_token: Ignored in demo mode
            tenant_id: Ignored in demo mode
        """
        self.access_token = access_token
        self.tenant_id = tenant_id
        logger.info("Demo Xero client initialized - no real API calls will be made")

    async def create_contact(
        self,
        name: str,
        email: str | None = None,
        phone: str | None = None,
        address: dict | None = None,
        tax_number: str | None = None,
    ) -> dict:
        """Return mock contact data."""
        contact_id = str(uuid.uuid4())

        logger.info("Demo: Created contact", name=name, email=email, contact_id=contact_id)

        return {
            "ContactID": contact_id,
            "Name": name,
            "EmailAddress": email or "demo@example.com",
            "ContactStatus": "ACTIVE",
            "Phones": [{"PhoneType": "DEFAULT", "PhoneNumber": phone or "0400000000"}] if phone else [],  # noqa: E501
            "Addresses": [
                {
                    "AddressType": "STREET",
                    "AddressLine1": address.get("street", "123 Demo St") if address else "123 Demo St",  # noqa: E501
                    "City": address.get("city", "Sydney") if address else "Sydney",
                    "Region": address.get("state", "NSW") if address else "NSW",
                    "PostalCode": address.get("postal_code", "2000") if address else "2000",
                    "Country": address.get("country", "Australia") if address else "Australia",
                }
            ]
            if address
            else [],
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

    async def get_contact_by_email(self, email: str) -> dict | None:
        """Return None (always create new contacts in demo mode)."""
        logger.info("Demo: Contact lookup by email", email=email)
        return None  # Always create new in demo mode

    async def create_invoice(
        self,
        contact_id: str,
        invoice_number: str,
        line_items: list[dict],
        due_date: date | None = None,
        reference: str | None = None,
    ) -> dict:
        """Return mock invoice data."""
        invoice_id = str(uuid.uuid4())

        # Calculate totals
        subtotal = sum(item["quantity"] * item["unit_amount"] for item in line_items)
        tax = subtotal * 0.1  # 10% GST
        total = subtotal + tax

        logger.info(
            "Demo: Created invoice",
            invoice_number=invoice_number,
            total=total,
            invoice_id=invoice_id,
        )

        return {
            "InvoiceID": invoice_id,
            "InvoiceNumber": invoice_number,
            "Type": "ACCREC",
            "Contact": {"ContactID": contact_id},
            "LineItems": [
                {
                    "Description": item["description"],
                    "Quantity": item["quantity"],
                    "UnitAmount": item["unit_amount"],
                    "LineAmount": item["quantity"] * item["unit_amount"],
                    "AccountCode": "200",
                }
                for item in line_items
            ],
            "Date": datetime.utcnow().date().isoformat(),
            "DueDate": (due_date or datetime.utcnow().date()).isoformat(),
            "Reference": reference or "",
            "Status": "DRAFT",
            "SubTotal": subtotal,
            "TotalTax": tax,
            "Total": total,
            "AmountDue": total,
            "AmountPaid": 0.0,
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

    async def get_invoice(self, invoice_id: str) -> dict:
        """Return mock invoice data (simulating a paid invoice)."""
        logger.info("Demo: Get invoice", invoice_id=invoice_id)

        return {
            "InvoiceID": invoice_id,
            "InvoiceNumber": "INV-DEMO-001",
            "Type": "ACCREC",
            "Contact": {"ContactID": str(uuid.uuid4()), "Name": "Demo Customer"},
            "Status": "PAID",  # Changed to PAID
            "SubTotal": 1000.00,
            "TotalTax": 100.00,
            "Total": 1100.00,
            "AmountDue": 0.0,  # Changed to 0 (fully paid)
            "AmountPaid": 1100.00,  # Changed to full amount
            "Date": datetime.utcnow().date().isoformat(),
            "DueDate": datetime.utcnow().date().isoformat(),
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

    async def approve_invoice(self, invoice_id: str) -> dict:
        """Return mock approved invoice."""
        logger.info("Demo: Approved invoice", invoice_id=invoice_id)

        return {
            "InvoiceID": invoice_id,
            "InvoiceNumber": "INV-DEMO-001",
            "Type": "ACCREC",
            "Status": "AUTHORISED",  # Changed from DRAFT
            "SubTotal": 1000.00,
            "TotalTax": 100.00,
            "Total": 1100.00,
            "AmountDue": 1100.00,
            "AmountPaid": 0.0,
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

    async def get_payments(
        self,
        invoice_id: str | None = None,
        modified_after: date | None = None,
    ) -> list[dict]:
        """Return mock payment data (simulating a payment received)."""
        logger.info(
            "Demo: Get payments",
            invoice_id=invoice_id,
            modified_after=modified_after,
        )

        # Return mock payment data if invoice_id is provided
        if invoice_id:
            payment_id = str(uuid.uuid4())
            return [
                {
                    "PaymentID": payment_id,
                    "Date": datetime.utcnow().isoformat() + "Z",
                    "Amount": 1100.00,
                    "Reference": "Demo Payment - Bank Transfer",
                    "Invoice": {
                        "InvoiceID": invoice_id,
                        "InvoiceNumber": "INV-DEMO-001",
                    },
                    "Account": {
                        "AccountID": str(uuid.uuid4()),
                        "Code": "200",
                    },
                    "Status": "AUTHORISED",
                    "PaymentType": "ACCRECPAYMENT",
                    "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
                }
            ]

        # Return empty list if no specific invoice requested
        return []

    async def get_organisation(self) -> dict:
        """Return mock organization data."""
        logger.info("Demo: Get organisation")

        return {
            "OrganisationID": str(uuid.uuid4()),
            "Name": "Demo Organization Pty Ltd",
            "LegalName": "Demo Organization Pty Ltd",
            "BaseCurrency": "AUD",
            "CountryCode": "AU",
            "OrganisationType": "COMPANY",
            "ShortCode": "DEMO",
            "Edition": "BUSINESS",
        }

    async def close(self) -> None:
        """No-op for demo client."""
        logger.info("Demo: Client closed")
