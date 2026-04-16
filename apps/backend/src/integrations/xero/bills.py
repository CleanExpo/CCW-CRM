"""Xero bills (Accounts Payable invoices) sync for purchase orders.

Purchase orders are pushed to Xero as ACCPAY invoices (bills).
"""

import structlog

from src.integrations.xero.client import XeroAPIError  # noqa: F401 (re-exported for callers)

logger = structlog.get_logger(__name__)


async def push_purchase_order_as_bill(xero_client, po_data: dict) -> str:
    """Push a purchase order to Xero as an Accounts Payable bill.

    Args:
        xero_client: XeroClient (or DemoXeroClient) instance.
        po_data: Dict with keys:
            - supplier_contact_id (str): Xero contact ID for the supplier.
            - reference (str): PO number used as the Xero reference.
            - date (str): Invoice date in ISO format (YYYY-MM-DD).
            - due_date (str): Due date in ISO format (YYYY-MM-DD).
            - line_items (list[dict]): Each item has:
                - description (str)
                - quantity (float | int)
                - unit_amount (float | Decimal)
                - account_code (str, default "310")

    Returns:
        The Xero InvoiceID string for the created bill.

    Raises:
        XeroAPIError: If the Xero API call fails.
        KeyError: If the response is missing the expected InvoiceID.
    """
    line_items = [
        {
            "Description": item["description"],
            "Quantity": float(item["quantity"]),
            "UnitAmount": float(item["unit_amount"]),
            "AccountCode": item.get("account_code", "310"),
            "TaxType": "INPUT2",
        }
        for item in po_data["line_items"]
    ]

    payload = {
        "Invoices": [
            {
                "Type": "ACCPAY",
                "Status": "AUTHORISED",
                "Contact": {"ContactID": po_data["supplier_contact_id"]},
                "Reference": po_data["reference"],
                "Date": po_data["date"],
                "DueDate": po_data["due_date"],
                "LineItems": line_items,
            }
        ]
    }

    response = await xero_client._make_request("POST", "/Invoices", data=payload)

    invoices = response.get("Invoices", [])
    if not invoices:
        raise KeyError("Xero response contained no Invoices")

    bill_id: str = invoices[0]["InvoiceID"]

    logger.info(
        "Purchase order pushed to Xero as bill",
        reference=po_data["reference"],
        xero_bill_id=bill_id,
    )

    return bill_id
