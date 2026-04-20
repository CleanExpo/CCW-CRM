"""Tax calculation engine (GAP-028).

Calculates GST/PST/HST based on jurisdiction and product category.
Uses Pure Function TDD pattern - core logic is testable without DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.invoicing import Invoice

logger = structlog.get_logger(__name__)


class TaxType(str, Enum):
    """Tax type enum."""

    GST = "gst"
    PST = "pst"
    HST = "hst"


@dataclass
class TaxLine:
    """Individual tax line item."""

    tax_type: TaxType
    rate: Decimal
    amount: Decimal
    description: str


@dataclass
class TaxResult:
    """Tax calculation result."""

    gst: Decimal
    pst: Decimal
    hst: Decimal
    total_tax: Decimal
    breakdown: list[TaxLine]

    @property
    def is_hst_jurisdiction(self) -> bool:
        """Check if HST was applied."""
        return self.hst > Decimal("0")


# ---------------------------------------------------------------------------
# Tax Rate Configuration
# ---------------------------------------------------------------------------

# GST rates by country
GST_RATES = {
    "AU": Decimal("0.10"),  # 10% Australia
    "CA": Decimal("0.05"),  # 5% Canada
}

# PST rates by Canadian province
PST_RATES = {
    "BC": Decimal("0.07"),  # British Columbia
    "SK": Decimal("0.06"),  # Saskatchewan
    "MB": Decimal("0.07"),  # Manitoba
    "QC": Decimal("0.09975"),  # Quebec (QST)
}

# HST rates by Canadian province (GST + PST combined)
HST_RATES = {
    "ON": Decimal("0.13"),  # Ontario
    "NB": Decimal("0.15"),  # New Brunswick
    "NS": Decimal("0.15"),  # Nova Scotia
    "PE": Decimal("0.15"),  # Prince Edward Island
    "NL": Decimal("0.15"),  # Newfoundland and Labrador
}

# Tax-exempt product categories
EXEMPT_CATEGORIES = {
    "groceries",
    "basic_groceries",
    "medical_equipment",
    "medical_supplies",
    "prescription_drugs",
    "children_clothing",
}


# ---------------------------------------------------------------------------
# Pure Functions (No DB - easy to test)
# ---------------------------------------------------------------------------


def calculate_tax(
    subtotal: Decimal,
    jurisdiction: str,
    product_category: str = "general",
    is_b2b: bool = False,
) -> TaxResult:
    """
    Calculate tax for a transaction.

    Pure function - no database access, easily testable.

    Args:
        subtotal: Subtotal amount before tax
        jurisdiction: Jurisdiction code (e.g., "AU", "CA-ON", "CA-BC")
        product_category: Product category for exemption check
        is_b2b: True for business-to-business (may apply reverse charge)

    Returns:
        TaxResult with calculated taxes
    """
    gst = Decimal("0")
    pst = Decimal("0")
    hst = Decimal("0")
    breakdown: list[TaxLine] = []

    # Check for tax exemption
    if product_category.lower() in EXEMPT_CATEGORIES:
        logger.debug(
            "tax_exempt_category",
            category=product_category,
            subtotal=str(subtotal),
        )
        return TaxResult(
            gst=gst,
            pst=pst,
            hst=hst,
            total_tax=Decimal("0"),
            breakdown=[],
        )

    # B2B reverse charge (simplified - in real system would check business registration)
    if is_b2b:
        logger.debug(
            "b2b_reverse_charge",
            jurisdiction=jurisdiction,
            subtotal=str(subtotal),
        )
        return TaxResult(
            gst=gst,
            pst=pst,
            hst=hst,
            total_tax=Decimal("0"),
            breakdown=[
                TaxLine(
                    tax_type=TaxType.GST,
                    rate=Decimal("0"),
                    amount=Decimal("0"),
                    description="B2B Reverse Charge - No tax collected",
                )
            ],
        )

    # Parse jurisdiction
    parts = jurisdiction.upper().split("-")
    country = parts[0]
    province = parts[1] if len(parts) > 1 else None

    # Check for HST jurisdictions (Canada only)
    if country == "CA" and province in HST_RATES:
        hst_rate = HST_RATES[province]
        hst = (subtotal * hst_rate).quantize(Decimal("0.01"))
        breakdown.append(
            TaxLine(
                tax_type=TaxType.HST,
                rate=hst_rate * 100,
                amount=hst,
                description=f"HST ({hst_rate * 100}%) - {province}",
            )
        )
    else:
        # Apply GST
        gst_rate = GST_RATES.get(country, Decimal("0"))
        if gst_rate > Decimal("0"):
            gst = (subtotal * gst_rate).quantize(Decimal("0.01"))
            breakdown.append(
                TaxLine(
                    tax_type=TaxType.GST,
                    rate=gst_rate * 100,
                    amount=gst,
                    description=f"GST ({gst_rate * 100}%) - {country}",
                )
            )

        # Apply PST (Canada only, for non-HST provinces)
        if country == "CA" and province in PST_RATES:
            pst_rate = PST_RATES[province]
            pst = (subtotal * pst_rate).quantize(Decimal("0.01"))
            breakdown.append(
                TaxLine(
                    tax_type=TaxType.PST,
                    rate=pst_rate * 100,
                    amount=pst,
                    description=f"PST ({pst_rate * 100}%) - {province}",
                )
            )

    total_tax = gst + pst + hst

    return TaxResult(
        gst=gst,
        pst=pst,
        hst=hst,
        total_tax=total_tax,
        breakdown=breakdown,
    )


def calculate_reverse_tax(
    total_including_tax: Decimal,
    jurisdiction: str,
    product_category: str = "general",
) -> TaxResult:
    """
    Calculate tax from total that already includes tax (reverse calculation).

    Pure function.

    Args:
        total_including_tax: Total amount including tax
        jurisdiction: Jurisdiction code
        product_category: Product category

    Returns:
        TaxResult with extracted tax amounts
    """
    # Parse jurisdiction to determine tax rate
    parts = jurisdiction.upper().split("-")
    country = parts[0]
    province = parts[1] if len(parts) > 1 else None

    # Check for exemptions
    if product_category.lower() in EXEMPT_CATEGORIES:
        return TaxResult(
            gst=Decimal("0"),
            pst=Decimal("0"),
            hst=Decimal("0"),
            total_tax=Decimal("0"),
            breakdown=[],
        )

    total_tax_rate = Decimal("0")
    gst_rate = Decimal("0")
    pst_rate = Decimal("0")
    hst_rate = Decimal("0")

    # Determine applicable rates
    if country == "CA" and province in HST_RATES:
        hst_rate = HST_RATES[province]
        total_tax_rate = hst_rate
    else:
        gst_rate = GST_RATES.get(country, Decimal("0"))
        total_tax_rate = gst_rate

        if country == "CA" and province in PST_RATES:
            pst_rate = PST_RATES[province]
            total_tax_rate += pst_rate

    # Reverse calculate: subtotal = total / (1 + tax_rate)
    subtotal = (total_including_tax / (Decimal("1") + total_tax_rate)).quantize(Decimal("0.01"))
    total_tax = (total_including_tax - subtotal).quantize(Decimal("0.01"))

    # Break down into components
    gst = (subtotal * gst_rate).quantize(Decimal("0.01")) if gst_rate > 0 else Decimal("0")
    pst = (subtotal * pst_rate).quantize(Decimal("0.01")) if pst_rate > 0 else Decimal("0")
    hst = (subtotal * hst_rate).quantize(Decimal("0.01")) if hst_rate > 0 else Decimal("0")

    breakdown: list[TaxLine] = []
    if hst > 0:
        breakdown.append(
            TaxLine(
                tax_type=TaxType.HST,
                rate=hst_rate * 100,
                amount=hst,
                description=f"HST ({hst_rate * 100}%) - extracted",
            )
        )
    else:
        if gst > 0:
            breakdown.append(
                TaxLine(
                    tax_type=TaxType.GST,
                    rate=gst_rate * 100,
                    amount=gst,
                    description=f"GST ({gst_rate * 100}%) - extracted",
                )
            )
        if pst > 0:
            breakdown.append(
                TaxLine(
                    tax_type=TaxType.PST,
                    rate=pst_rate * 100,
                    amount=pst,
                    description=f"PST ({pst_rate * 100}%) - extracted",
                )
            )

    return TaxResult(
        gst=gst,
        pst=pst,
        hst=hst,
        total_tax=total_tax,
        breakdown=breakdown,
    )


def get_tax_rate_info(jurisdiction: str) -> dict[str, Any]:
    """
    Get tax rate information for a jurisdiction.

    Pure function.

    Args:
        jurisdiction: Jurisdiction code

    Returns:
        Dictionary with tax rate details
    """
    parts = jurisdiction.upper().split("-")
    country = parts[0]
    province = parts[1] if len(parts) > 1 else None

    info: dict[str, Any] = {
        "jurisdiction": jurisdiction,
        "country": country,
        "province": province,
        "uses_hst": False,
        "gst_rate": 0.0,
        "pst_rate": 0.0,
        "hst_rate": 0.0,
        "combined_rate": 0.0,
    }

    if country == "CA" and province in HST_RATES:
        info["uses_hst"] = True
        info["hst_rate"] = float(HST_RATES[province])
        info["combined_rate"] = float(HST_RATES[province])
    else:
        gst_rate = GST_RATES.get(country, Decimal("0"))
        info["gst_rate"] = float(gst_rate)
        info["combined_rate"] = float(gst_rate)

        if country == "CA" and province in PST_RATES:
            pst_rate = PST_RATES[province]
            info["pst_rate"] = float(pst_rate)
            info["combined_rate"] += float(pst_rate)

    return info


# ---------------------------------------------------------------------------
# Async DB Wrapper Functions
# ---------------------------------------------------------------------------


async def calculate_invoice_tax(
    db: AsyncSession,
    invoice_id: UUID,
    customer_type: str | None = None,
) -> TaxResult:
    """
    Calculate tax for an invoice (async DB wrapper).

    Fetches invoice from DB, then calls pure function for calculation.

    Args:
        db: Database session
        invoice_id: Invoice ID
        customer_type: Optional customer type string ("B2B" or "B2C"). When
            "B2B", sets ``is_b2b=True`` which may trigger reverse-charge logic
            for applicable jurisdictions (UNI-1831).

    Returns:
        TaxResult with calculated taxes
    """
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        logger.warning("invoice_not_found", invoice_id=str(invoice_id))
        return TaxResult(
            gst=Decimal("0"),
            pst=Decimal("0"),
            hst=Decimal("0"),
            total_tax=Decimal("0"),
            breakdown=[],
        )

    # In real system, would fetch jurisdiction from customer
    # For now, default to Australia
    jurisdiction = "AU"

    # B2B customers use ex-GST pricing; wire through from customer_type (UNI-1831)
    is_b2b = customer_type == "B2B" if customer_type else False

    # Call pure function
    tax_result = calculate_tax(
        subtotal=invoice.subtotal,
        jurisdiction=jurisdiction,
        product_category="general",
        is_b2b=is_b2b,
    )

    logger.info(
        "invoice_tax_calculated",
        invoice_id=str(invoice_id),
        subtotal=str(invoice.subtotal),
        total_tax=str(tax_result.total_tax),
        jurisdiction=jurisdiction,
        customer_type=customer_type,
        is_b2b=is_b2b,
    )

    return tax_result
