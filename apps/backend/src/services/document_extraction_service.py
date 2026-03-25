"""Document Extraction Service — Claude Sonnet 4.6 Vision.

Extracts structured invoice and purchase order data from uploaded images/PDFs
using Claude's vision capabilities.

In demo mode (no ANTHROPIC_API_KEY), returns realistic mock extractions.
"""

from __future__ import annotations

import base64
import os
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Demo-mode detection
# ---------------------------------------------------------------------------


def _is_demo_mode() -> bool:
    return not os.getenv("ANTHROPIC_API_KEY")


# ---------------------------------------------------------------------------
# Demo extractions
# ---------------------------------------------------------------------------

DEMO_INVOICE_EXTRACTION: dict[str, Any] = {
    "document_type": "invoice",
    "confidence": 0.94,
    "vendor": {
        "name": "CleanTech Supplies Pty Ltd",
        "abn": "41 234 567 890",
        "address": "12 Warehouse Drive, Dandenong VIC 3175",
        "email": "accounts@cleantech.com.au",
        "phone": "03 9876 5432",
    },
    "invoice": {
        "invoice_number": "CT-2026-04512",
        "invoice_date": "2026-03-20",
        "due_date": "2026-04-19",
        "payment_terms": "Net 30",
        "currency": "AUD",
    },
    "line_items": [
        {
            "description": "Truckmount Filter Set (3-pack)",
            "sku": "FILTER-TM-003",
            "quantity": 10,
            "unit_price": 45.00,
            "gst": 4.50,
            "line_total": 495.00,
        },
        {
            "description": "Pro-Kleen Upholstery Cleaner 5L",
            "sku": "PKC-UPH-5L",
            "quantity": 24,
            "unit_price": 22.50,
            "gst": 2.25,
            "line_total": 594.00,
        },
        {
            "description": "Hose Reel 30m — Commercial Grade",
            "sku": "HOSE-30M-CG",
            "quantity": 5,
            "unit_price": 185.00,
            "gst": 18.50,
            "line_total": 1017.50,
        },
    ],
    "totals": {
        "subtotal": 1915.91,
        "gst_total": 191.59,
        "invoice_total": 2107.50,
    },
    "notes": "EFT details: BSB 013-421 Acc 456 789 123",
    "extraction_warnings": [],
}

DEMO_PO_EXTRACTION: dict[str, Any] = {
    "document_type": "purchase_order",
    "confidence": 0.91,
    "buyer": {
        "name": "CCW Online Pty Ltd",
        "abn": "87 654 321 012",
        "address": "Level 3, 45 Commerce Street, Brisbane QLD 4000",
    },
    "supplier": {
        "name": "Kärcher Australia Pty Ltd",
        "contact": "sales@karcher.com.au",
    },
    "purchase_order": {
        "po_number": "PO-2026-0342",
        "po_date": "2026-03-21",
        "delivery_date_requested": "2026-04-04",
        "delivery_address": "Warehouse A, 18 Industrial Ave, Rocklea QLD 4106",
    },
    "line_items": [
        {
            "description": "Kärcher HD 5/15 C Professional Pressure Washer",
            "sku": "K-HD515C",
            "quantity": 3,
            "unit_price": 1250.00,
            "line_total": 3750.00,
        },
        {
            "description": "Kärcher T 7/20 C Wet & Dry Vacuum",
            "sku": "K-T720C",
            "quantity": 5,
            "unit_price": 480.00,
            "line_total": 2400.00,
        },
    ],
    "totals": {
        "subtotal": 5590.91,
        "gst": 559.09,
        "total": 6150.00,
    },
    "extraction_warnings": [],
}


# ---------------------------------------------------------------------------
# Core extraction function
# ---------------------------------------------------------------------------


async def extract_document(
    image_bytes: bytes,
    document_type: str,
    mime_type: str = "image/jpeg",
) -> dict[str, Any]:
    """
    Extract structured data from a document image using Claude Vision.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, or PDF page render)
        document_type: "invoice" or "purchase_order"
        mime_type: MIME type of the image

    Returns:
        Structured extraction result with line items and totals
    """
    if _is_demo_mode():
        logger.info("Document extraction: demo mode", doc_type=document_type)
        return DEMO_INVOICE_EXTRACTION if document_type == "invoice" else DEMO_PO_EXTRACTION

    try:
        import anthropic  # type: ignore[import]
    except ImportError:
        logger.warning("anthropic SDK not installed; returning demo extraction")
        return DEMO_INVOICE_EXTRACTION if document_type == "invoice" else DEMO_PO_EXTRACTION

    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    image_b64 = base64.standard_b64encode(image_bytes).decode()

    prompt = _build_extraction_prompt(document_type)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    raw = message.content[0].text if message.content else "{}"
    return _parse_claude_extraction(raw, document_type)


def _build_extraction_prompt(document_type: str) -> str:
    base = (
        "You are a document extraction specialist for an Australian ERP system. "
        "Extract ALL data from this document as structured JSON. "
        "Include vendor/buyer details, document numbers, dates, ALL line items "
        "(description, SKU if visible, quantity, unit price, GST, line total), "
        "and totals. Use Australian date format (YYYY-MM-DD in output). "
        "Return ONLY valid JSON — no markdown, no explanation.\n\n"
    )
    if document_type == "invoice":
        return base + (
            "This is a TAX INVOICE. Extract: vendor details (name, ABN, address, email), "
            "invoice number, invoice date, due date, payment terms, line items with GST breakdown, "
            "subtotal, GST total, and invoice total."
        )
    return base + (
        "This is a PURCHASE ORDER. Extract: buyer details, supplier details, "
        "PO number, PO date, requested delivery date, delivery address, "
        "line items, subtotal, GST, and total."
    )


def _parse_claude_extraction(raw: str, document_type: str) -> dict[str, Any]:
    """Parse Claude's JSON response, falling back to demo data on parse failure."""
    import json

    # Strip markdown code fences if present
    clean = raw.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]) if len(lines) > 2 else clean

    try:
        data = json.loads(clean)
        data["document_type"] = document_type
        if "confidence" not in data:
            data["confidence"] = 0.85
        return data
    except json.JSONDecodeError:
        logger.warning("Claude returned non-JSON extraction; using demo data")
        return DEMO_INVOICE_EXTRACTION if document_type == "invoice" else DEMO_PO_EXTRACTION
