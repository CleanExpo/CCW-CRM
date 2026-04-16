"""Xero credit note integration for POS refunds."""

from datetime import UTC, datetime

import structlog

from src.integrations.xero.client import XeroClient

logger = structlog.get_logger(__name__)


async def push_credit_note(
    xero_client: XeroClient,
    contact_id: str,
    amount: float | str,
    description: str,
    reference: str,
) -> str:
    """Create an ACCREC credit note in Xero and return its CreditNoteID.

    Args:
        xero_client: Authenticated XeroClient instance.
        contact_id: Xero ContactID to apply the credit note to.
        amount: Refund amount (positive value).
        description: Line-item description.
        reference: Internal reference (e.g. refund transaction number).

    Returns:
        The CreditNoteID string from Xero.

    Raises:
        XeroAPIError: If the API request fails.
        ValueError: If Xero returns an empty response.
    """
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    payload = {
        "CreditNotes": [
            {
                "Type": "ACCREC",
                "Contact": {"ContactID": contact_id},
                "Date": today,
                "DueDate": today,
                "Status": "AUTHORISED",
                "Reference": reference,
                "LineItems": [
                    {
                        "Description": description,
                        "Quantity": "1.00",
                        "UnitAmount": str(amount),
                        "AccountCode": "200",
                        "TaxType": "OUTPUT2",
                    }
                ],
            }
        ]
    }

    logger.info("Pushing credit note to Xero", reference=reference, amount=amount)
    result = await xero_client._make_request("POST", "/CreditNotes", data=payload)

    credit_notes = result.get("CreditNotes", [])
    if not credit_notes:
        raise ValueError("No CreditNote returned from Xero")

    credit_note_id = credit_notes[0].get("CreditNoteID")
    logger.info("Credit note created in Xero", credit_note_id=credit_note_id)
    return credit_note_id
