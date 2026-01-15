"""Xero API client wrapper.

This module provides a clean interface to the Xero Accounting API,
handling authentication, error handling, and request formatting.
"""

from datetime import date
from typing import Any, Optional
from uuid import UUID

import httpx
import structlog

logger = structlog.get_logger(__name__)


class XeroAPIError(Exception):
    """Exception raised for Xero API errors."""

    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[dict] = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class XeroClient:
    """Client for interacting with Xero Accounting API.

    This client handles authenticated requests to Xero's API endpoints,
    with methods for common operations like creating invoices and contacts.
    """

    BASE_URL = "https://api.xero.com/api.xro/2.0"

    def __init__(self, access_token: str, tenant_id: str):
        """Initialize Xero API client.

        Args:
            access_token: Valid OAuth2 access token
            tenant_id: Xero tenant (organization) ID
        """
        self.access_token = access_token
        self.tenant_id = tenant_id
        self._http_client = httpx.AsyncClient(timeout=30.0)

    def _get_headers(self) -> dict[str, str]:
        """Get common headers for Xero API requests."""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Xero-tenant-id": self.tenant_id,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict:
        """Make an authenticated request to Xero API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (e.g., "/Invoices")
            data: Request body data
            params: Query parameters

        Returns:
            Response JSON data

        Raises:
            XeroAPIError: If request fails
        """
        url = f"{self.BASE_URL}{endpoint}"
        headers = self._get_headers()

        try:
            response = await self._http_client.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                params=params,
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            error_data = {}
            try:
                error_data = e.response.json()
            except Exception:
                pass

            logger.error(
                "Xero API request failed",
                method=method,
                endpoint=endpoint,
                status_code=e.response.status_code,
                error=error_data,
            )

            raise XeroAPIError(
                message=f"Xero API error: {e.response.status_code}",
                status_code=e.response.status_code,
                response=error_data,
            ) from e

        except Exception as e:
            logger.error(
                "Unexpected error making Xero API request",
                method=method,
                endpoint=endpoint,
                error=str(e),
            )
            raise XeroAPIError(f"Unexpected error: {str(e)}") from e

    async def create_contact(
        self,
        name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        address: Optional[dict] = None,
    ) -> dict:
        """Create or update a contact (customer) in Xero.

        Args:
            name: Contact name (company or person)
            email: Contact email address
            phone: Contact phone number
            address: Contact address dict with street, city, state, postal_code, country

        Returns:
            Created/updated contact data

        Raises:
            XeroAPIError: If creation fails
        """
        contact_data = {
            "Name": name,
        }

        if email:
            contact_data["EmailAddress"] = email

        if phone:
            contact_data["Phones"] = [{"PhoneType": "DEFAULT", "PhoneNumber": phone}]

        if address:
            contact_data["Addresses"] = [
                {
                    "AddressType": "STREET",
                    "AddressLine1": address.get("street", ""),
                    "City": address.get("city", ""),
                    "Region": address.get("state", ""),
                    "PostalCode": address.get("postal_code", ""),
                    "Country": address.get("country", ""),
                }
            ]

        payload = {"Contacts": [contact_data]}

        logger.info("Creating/updating Xero contact", name=name)

        result = await self._make_request("POST", "/Contacts", data=payload)

        contacts = result.get("Contacts", [])
        if contacts:
            logger.info(
                "Successfully created/updated contact",
                contact_id=contacts[0].get("ContactID"),
            )
            return contacts[0]

        raise XeroAPIError("No contact returned from Xero")

    async def get_contact_by_email(self, email: str) -> Optional[dict]:
        """Find a contact by email address.

        Args:
            email: Email address to search

        Returns:
            Contact data or None if not found
        """
        params = {"where": f'EmailAddress=="{email}"'}

        result = await self._make_request("GET", "/Contacts", params=params)

        contacts = result.get("Contacts", [])
        return contacts[0] if contacts else None

    async def create_invoice(
        self,
        contact_id: str,
        invoice_number: str,
        line_items: list[dict],
        due_date: Optional[date] = None,
        reference: Optional[str] = None,
    ) -> dict:
        """Create an invoice in Xero.

        Args:
            contact_id: Xero contact ID
            invoice_number: Invoice reference number
            line_items: List of line item dicts with description, quantity, unit_amount
            due_date: Invoice due date
            reference: Internal reference

        Returns:
            Created invoice data

        Raises:
            XeroAPIError: If creation fails
        """
        invoice_data = {
            "Type": "ACCREC",  # Accounts Receivable (sales invoice)
            "Contact": {"ContactID": contact_id},
            "InvoiceNumber": invoice_number,
            "LineItems": [
                {
                    "Description": item["description"],
                    "Quantity": item["quantity"],
                    "UnitAmount": item["unit_amount"],
                    "AccountCode": "200",  # Sales account (can be customized)
                }
                for item in line_items
            ],
            "Status": "DRAFT",  # Start as DRAFT, can be approved later
        }

        if due_date:
            invoice_data["DueDate"] = due_date.isoformat()

        if reference:
            invoice_data["Reference"] = reference

        payload = {"Invoices": [invoice_data]}

        logger.info("Creating Xero invoice", invoice_number=invoice_number)

        result = await self._make_request("POST", "/Invoices", data=payload)

        invoices = result.get("Invoices", [])
        if invoices:
            invoice = invoices[0]
            logger.info(
                "Successfully created invoice",
                invoice_id=invoice.get("InvoiceID"),
                total=invoice.get("Total"),
            )
            return invoice

        raise XeroAPIError("No invoice returned from Xero")

    async def get_invoice(self, invoice_id: str) -> dict:
        """Get invoice details by ID.

        Args:
            invoice_id: Xero invoice ID

        Returns:
            Invoice data

        Raises:
            XeroAPIError: If invoice not found
        """
        result = await self._make_request("GET", f"/Invoices/{invoice_id}")

        invoices = result.get("Invoices", [])
        if invoices:
            return invoices[0]

        raise XeroAPIError(f"Invoice {invoice_id} not found")

    async def approve_invoice(self, invoice_id: str) -> dict:
        """Approve a draft invoice.

        Args:
            invoice_id: Xero invoice ID

        Returns:
            Updated invoice data

        Raises:
            XeroAPIError: If approval fails
        """
        payload = {"Invoices": [{"InvoiceID": invoice_id, "Status": "AUTHORISED"}]}

        result = await self._make_request("POST", "/Invoices", data=payload)

        invoices = result.get("Invoices", [])
        if invoices:
            logger.info("Successfully approved invoice", invoice_id=invoice_id)
            return invoices[0]

        raise XeroAPIError("Failed to approve invoice")

    async def get_payments(
        self,
        invoice_id: Optional[str] = None,
        modified_after: Optional[date] = None,
    ) -> list[dict]:
        """Get payments, optionally filtered by invoice or date.

        Args:
            invoice_id: Filter by specific invoice
            modified_after: Get payments modified after this date

        Returns:
            List of payment data

        Raises:
            XeroAPIError: If request fails
        """
        params = {}

        if invoice_id:
            params["where"] = f'Invoice.InvoiceID==Guid("{invoice_id}")'

        if modified_after:
            params["If-Modified-Since"] = modified_after.isoformat()

        result = await self._make_request("GET", "/Payments", params=params)

        return result.get("Payments", [])

    async def get_organisation(self) -> dict:
        """Get organization details.

        Returns:
            Organization data

        Raises:
            XeroAPIError: If request fails
        """
        result = await self._make_request("GET", "/Organisation")

        organisations = result.get("Organisations", [])
        if organisations:
            return organisations[0]

        raise XeroAPIError("No organisation data returned")

    async def close(self) -> None:
        """Close HTTP client."""
        await self._http_client.aclose()
