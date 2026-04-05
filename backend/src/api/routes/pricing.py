"""Customer trade pricing tier API endpoints.

Manages Bronze/Silver/Gold/Platinum pricing tiers and their
assignment to customers, enabling discounted pricing for trade accounts.
"""
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_async_db
from src.db.demo_models import Customer, Product  # noqa: F401 (Customer used for FK check)
from src.db.pricing_models import CustomerPricingAssignment, PricingTier

router = APIRouter(prefix="/api/pricing", tags=["Pricing Tiers"])


# ─── Pydantic schemas ───────────────────────────────────────────────────────


class PricingTierCreate(BaseModel):
    name: str
    discount_pct: Decimal
    min_annual_spend: Decimal | None = None
    description: str | None = None


class PricingTierResponse(BaseModel):
    id: UUID
    name: str
    discount_pct: Decimal
    min_annual_spend: Decimal | None
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomerTierAssignRequest(BaseModel):
    tier_id: UUID
    notes: str | None = None


class CustomerTierResponse(BaseModel):
    customer_id: UUID
    tier_id: UUID
    tier_name: str
    discount_pct: Decimal
    effective_date: datetime
    notes: str | None


class PriceCalculationResponse(BaseModel):
    customer_id: UUID
    product_id: UUID
    quantity: int
    list_price: Decimal
    tier_name: str | None
    discount_pct: Decimal
    discounted_unit_price: Decimal
    line_total: Decimal
    savings: Decimal


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/tiers", response_model=list[PricingTierResponse])
async def list_pricing_tiers(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[PricingTierResponse]:
    """List all pricing tiers ordered by discount percentage."""
    result = await db.execute(
        select(PricingTier).order_by(PricingTier.discount_pct.asc())
    )
    tiers = result.scalars().all()
    return [PricingTierResponse.model_validate(t) for t in tiers]


@router.post("/tiers", response_model=PricingTierResponse, status_code=201)
async def create_pricing_tier(
    payload: PricingTierCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PricingTierResponse:
    """Create a new pricing tier."""
    tier = PricingTier(
        name=payload.name,
        discount_pct=payload.discount_pct,
        min_annual_spend=payload.min_annual_spend,
        description=payload.description,
    )
    db.add(tier)
    try:
        await db.commit()
        await db.refresh(tier)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Tier name already exists")
    return PricingTierResponse.model_validate(tier)


@router.put("/customers/{customer_id}/pricing-tier", response_model=CustomerTierResponse)
async def assign_customer_tier(
    customer_id: UUID,
    payload: CustomerTierAssignRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CustomerTierResponse:
    """Assign or update a pricing tier for a customer."""
    # Verify customer exists
    customer_result = await db.execute(
        select(Customer).where(Customer.id == customer_id)  # type: ignore[arg-type]
    )
    if not customer_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")

    # Verify tier exists
    tier_result = await db.execute(
        select(PricingTier).where(PricingTier.id == payload.tier_id)  # type: ignore[arg-type]
    )
    tier = tier_result.scalar_one_or_none()
    if not tier:
        raise HTTPException(status_code=404, detail="Pricing tier not found")

    # Upsert assignment
    existing_result = await db.execute(
        select(CustomerPricingAssignment).where(
            CustomerPricingAssignment.customer_id == customer_id  # type: ignore[arg-type]
        )
    )
    assignment = existing_result.scalar_one_or_none()

    if assignment:
        assignment.tier_id = payload.tier_id
        assignment.effective_date = datetime.now(UTC)
        assignment.notes = payload.notes
        assignment.updated_at = datetime.now(UTC)
    else:
        assignment = CustomerPricingAssignment(
            customer_id=customer_id,
            tier_id=payload.tier_id,
            notes=payload.notes,
        )
        db.add(assignment)

    await db.commit()

    return CustomerTierResponse(
        customer_id=customer_id,
        tier_id=tier.id,
        tier_name=tier.name,
        discount_pct=tier.discount_pct,
        effective_date=assignment.effective_date,
        notes=assignment.notes,
    )


@router.get("/calculate")
async def calculate_customer_price(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    customer_id: UUID = Query(...),
    product_id: UUID = Query(...),
    qty: int = Query(1, ge=1),
) -> PriceCalculationResponse:
    """Calculate the discounted price for a customer + product + quantity combo."""
    # Get product list price
    product_result = await db.execute(
        select(Product).where(Product.id == product_id)  # type: ignore[arg-type]
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    list_price = Decimal(str(product.price))

    # Get customer pricing assignment
    assignment_result = await db.execute(
        select(CustomerPricingAssignment)
        .where(CustomerPricingAssignment.customer_id == customer_id)  # type: ignore[arg-type]
        .options(selectinload(CustomerPricingAssignment.tier))
    )
    assignment = assignment_result.scalar_one_or_none()

    if assignment and assignment.tier:
        discount_pct = assignment.tier.discount_pct
        tier_name = assignment.tier.name
    else:
        discount_pct = Decimal("0.00")
        tier_name = None

    discount_factor = Decimal("1") - (discount_pct / Decimal("100"))
    discounted_unit_price = (list_price * discount_factor).quantize(Decimal("0.01"))
    line_total = (discounted_unit_price * qty).quantize(Decimal("0.01"))
    savings = ((list_price - discounted_unit_price) * qty).quantize(Decimal("0.01"))

    return PriceCalculationResponse(
        customer_id=customer_id,
        product_id=product_id,
        quantity=qty,
        list_price=list_price,
        tier_name=tier_name,
        discount_pct=discount_pct,
        discounted_unit_price=discounted_unit_price,
        line_total=line_total,
        savings=savings,
    )


@router.get("/customers/{customer_id}/tier", response_model=CustomerTierResponse)
async def get_customer_tier(
    customer_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CustomerTierResponse:
    """Get the active pricing tier for a customer."""
    result = await db.execute(
        select(CustomerPricingAssignment)
        .where(CustomerPricingAssignment.customer_id == customer_id)  # type: ignore[arg-type]
        .options(selectinload(CustomerPricingAssignment.tier))
    )
    assignment = result.scalar_one_or_none()
    if not assignment or not assignment.tier:
        raise HTTPException(status_code=404, detail="No pricing tier assigned to this customer")

    return CustomerTierResponse(
        customer_id=customer_id,
        tier_id=assignment.tier.id,
        tier_name=assignment.tier.name,
        discount_pct=assignment.tier.discount_pct,
        effective_date=assignment.effective_date,
        notes=assignment.notes,
    )
