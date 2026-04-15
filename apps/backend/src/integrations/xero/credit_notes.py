"""Xero credit note creation.

Handles pushing credit notes to Xero for refunded orders.
UNI-1817: Shopify Refunds + Xero Credit Note Sync.
"""

import structlog

from src.integrations.xero.client import XeroClient

logger = structlog.get_logger(__name__)


async def push_credit_note(
    xero_client: XeroClient,
    contact_id: str,
    amount: float | str,
    description: str,
    reference: str,
) -> dict:
    """Create a credit note in Xero for a refunded amount.

    Args:
        xero_client: Authenticated Xero API client
        contact_id: Xero contact (customer) ID
        amount: Refund amount (positive value)
        description: Line item description for the credit note
        reference: External reference (e.g. SHOPIFY-REFUND-<id>)

    Returns:
        Created credit note data from Xero

    Raises:
        XeroAPIError: If the Xero API call fails
    """
    payload = {
        "CreditNotes": [
            {
                "Type": "ACCRECCREDIT",
                "Contact": {"ContactID": contact_id},
                "Reference": reference,
                "Status": "DRAFT",
                "LineItems": [
                    {
                        "Description": description,
                        "Quantity": 1,
                        "UnitAmount": float(amount),
                        "AccountCode": "200",
                    }
                ],
            }
        ]
    }

    logger.info(
        "creating_xero_credit_note",
        contact_id=contact_id,
        amount=amount,
        reference=reference,
    )

    result = await xero_client._make_request("POST", "/CreditNotes", data=payload)

    credit_notes = result.get("CreditNotes", [])
    if credit_notes:
        credit_note = credit_notes[0]
        logger.info(
            "xero_credit_note_created",
            credit_note_id=credit_note.get("CreditNoteID"),
            reference=reference,
        )
        return credit_note

    from src.integrations.xero.client import XeroAPIError
    raise XeroAPIError("No credit note returned from Xero")
