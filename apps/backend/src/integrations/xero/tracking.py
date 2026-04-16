"""Xero Tracking Categories — read and assign to invoices."""

import structlog

logger = structlog.get_logger(__name__)


async def get_tracking_categories(xero_client) -> list[dict]:
    """Fetch all active tracking categories from Xero.

    Args:
        xero_client: XeroClient instance.

    Returns:
        List of dicts with keys: id, name, status, options (list of {id, name}).
    """
    response = await xero_client._make_request("GET", "/TrackingCategories")

    categories = []
    for cat in response.get("TrackingCategories", []):
        categories.append(
            {
                "id": cat["TrackingCategoryID"],
                "name": cat["Name"],
                "status": cat.get("Status", "ACTIVE"),
                "options": [
                    {"id": opt["TrackingOptionID"], "name": opt["Name"]}
                    for opt in cat.get("Options", [])
                ],
            }
        )

    return categories


async def assign_tracking_to_invoice(
    xero_client,
    xero_invoice_id: str,
    tracking_category_id: str,
    tracking_option_id: str,
) -> bool:
    """Assign a tracking category option to every line item on a Xero invoice.

    Fetches the existing invoice, attaches tracking to each line item, then
    PUTs the updated invoice back to Xero.

    Args:
        xero_client: XeroClient instance.
        xero_invoice_id: Xero InvoiceID.
        tracking_category_id: Xero TrackingCategoryID.
        tracking_option_id: Xero TrackingOptionID.

    Returns:
        True on success.

    Raises:
        XeroAPIError: If any Xero API call fails.
        KeyError: If the invoice is not found in the response.
    """
    # Fetch the existing invoice so we can preserve its line items.
    get_response = await xero_client._make_request(
        "GET", f"/Invoices/{xero_invoice_id}"
    )
    invoices = get_response.get("Invoices", [])
    if not invoices:
        raise KeyError(f"Invoice {xero_invoice_id} not found in Xero")

    invoice = invoices[0]
    tracking_entry = {
        "TrackingCategoryID": tracking_category_id,
        "TrackingOptionID": tracking_option_id,
    }

    for line_item in invoice.get("LineItems", []):
        existing = line_item.setdefault("Tracking", [])
        # Replace any existing entry for this category, or append.
        replaced = False
        for i, t in enumerate(existing):
            if t.get("TrackingCategoryID") == tracking_category_id:
                existing[i] = tracking_entry
                replaced = True
                break
        if not replaced:
            existing.append(tracking_entry)

    payload = {"Invoices": [invoice]}
    await xero_client._make_request(
        "PUT", f"/Invoices/{xero_invoice_id}", data=payload
    )

    logger.info(
        "Tracking assigned to invoice",
        xero_invoice_id=xero_invoice_id,
        tracking_category_id=tracking_category_id,
        tracking_option_id=tracking_option_id,
    )
    return True
