"""AU Customs Import Documentation — import declaration summaries and duty estimates."""
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.inventory_models import PurchaseOrder

router = APIRouter(prefix="/api/customs", tags=["Customs Docs"], dependencies=[Depends(get_current_user)])

_GST = Decimal("0.10")
# Simplified HS chapter → duty rate (AU tariff schedule)
_RATES = {"84": Decimal("0"), "85": Decimal("0"),  # electronics 0%
          "61": Decimal("0.05"), "62": Decimal("0.05"), "63": Decimal("0.05"),  # clothing 5%
          "86": Decimal("0.05"), "87": Decimal("0.05"), "88": Decimal("0.05")}  # vehicles 5%
_DEFAULT_RATE = Decimal("0.05")


def _rate(hs_code: str) -> Decimal:
    return _RATES.get(hs_code[:2], _DEFAULT_RATE) if hs_code else _DEFAULT_RATE


@router.get("/import-declaration/{purchase_order_id}")
async def import_declaration(purchase_order_id: UUID, db: AsyncSession = Depends(get_async_db)) -> dict:
    """Generate an import declaration summary for a purchase order."""
    result = await db.execute(
        select(PurchaseOrder).options(selectinload(PurchaseOrder.supplier))
        .where(PurchaseOrder.id == purchase_order_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    customs_value = po.total or Decimal("0")
    hs_codes: list[str] = getattr(po, "hs_codes", []) or []
    avg_rate = (sum(_rate(h) for h in hs_codes) / len(hs_codes)) if hs_codes else _DEFAULT_RATE
    duty = (customs_value * avg_rate).quantize(Decimal("0.01"))
    gst_on_imports = ((customs_value + duty) * _GST).quantize(Decimal("0.01"))

    return {
        "po_number": po.po_number,
        "supplier_name": po.supplier.company_name if po.supplier else None,
        "country_of_origin": getattr(po, "country_of_origin", None),
        "incoterms": getattr(po, "incoterms", None),
        "goods_description": getattr(po, "goods_description", None) or f"Goods per PO {po.po_number}",
        "hs_codes": hs_codes,
        "customs_value_aud": str(customs_value),
        "duty_estimate": str(duty),
        "gst_on_imports": str(gst_on_imports),
    }


@router.get("/duty-estimate")
async def duty_estimate(
    hs_code: str = Query(..., description="HS tariff code"),
    customs_value_aud: Decimal = Query(..., ge=0, description="Customs value in AUD"),
    country: str = Query("AU", description="Country of origin"),
) -> dict:
    """Estimate import duty and GST on imports for a given HS code and value."""
    rate = _rate(hs_code)
    duty = (customs_value_aud * rate).quantize(Decimal("0.01"))
    gst = ((customs_value_aud + duty) * _GST).quantize(Decimal("0.01"))
    return {
        "hs_code": hs_code, "country": country,
        "customs_value_aud": str(customs_value_aud),
        "duty_rate_pct": str(rate * 100),
        "duty_estimate": str(duty),
        "gst_on_imports": str(gst),
        "total_landed_tax": str(duty + gst),
    }
