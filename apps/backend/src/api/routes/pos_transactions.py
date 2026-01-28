"""
POS Transaction API endpoints.

Handles:
- Creating POS transactions (walk-in and order-based sales)
- Processing payments (EFTPOS, AMEX, bank transfer, cash)
- Location routing (QLD branch routing logic)
- Transaction lookup and reporting
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User
from src.db.pos_models import (
    BankAccount,
    Location,
    POSTerminal,
    POSTransaction,
    SalesStaff,
)

router = APIRouter(prefix="/api/pos", tags=["POS"])


# ============================================================
# PYDANTIC MODELS
# ============================================================


class POSLineItem(BaseModel):
    """Line item for walk-in POS sale (without existing order)."""

    product_id: UUID
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")
    unit_price: Decimal = Field(..., ge=0, description="Unit price")
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class POSTransactionCreate(BaseModel):
    """Create a new POS transaction."""

    # Links
    terminal_id: UUID
    sales_staff_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    order_id: Optional[UUID] = None

    # Transaction details
    amount: Decimal = Field(..., gt=0, description="Transaction amount")
    payment_method: str = Field(
        ..., pattern="^(eftpos|amex|bank_transfer|cash)$", description="Payment method"
    )

    # Location routing
    manual_location_code: Optional[str] = Field(
        None, description="Manual location override (requires manager approval)"
    )

    # Items (for walk-in sales without order)
    items: Optional[list[POSLineItem]] = Field(
        None, description="Line items for walk-in sale (if no order_id)"
    )


class POSTransactionResponse(BaseModel):
    """POS transaction response."""

    id: UUID
    transaction_number: str

    # Links
    order_id: Optional[UUID] = None
    terminal_id: Optional[UUID] = None
    sales_staff_id: Optional[UUID] = None

    # Location
    location_code: str
    resolved_location_code: Optional[str] = None

    # Transaction
    transaction_type: str
    payment_method: str
    amount: Decimal
    currency: str

    # Payment
    payment_status: str
    payment_gateway_ref: Optional[str] = None

    # Reconciliation
    reconciliation_status: str
    bank_statement_ref: Optional[str] = None
    xero_invoice_id: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedPOSTransactionsResponse(BaseModel):
    """Paginated POS transactions response."""

    data: list[POSTransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================
# LOCATION ROUTING SERVICE
# ============================================================


class LocationRoutingService:
    """
    Determines the correct location for POS transactions.

    Routing strategies:
    1. Manual override (if provided by manager)
    2. Salesperson's primary location (for QLD branch routing)
    3. Terminal location (default for walk-ins)
    """

    async def resolve_location(
        self,
        db: AsyncSession,
        terminal_id: UUID,
        sales_staff_id: Optional[UUID] = None,
        manual_location: Optional[str] = None,
    ) -> str:
        """
        Resolve the final location code for a POS transaction.

        Priority:
        1. Manual override (if provided)
        2. Salesperson's primary location (if sales staff assigned)
        3. Terminal location (default)

        This handles the QLD branch routing issue where QLD-JOHN's sales
        should route to Brisbane even when processed on other terminals.
        """
        # 1. Manual override takes precedence
        if manual_location:
            # Verify location exists
            location = await db.execute(
                select(Location).where(Location.code == manual_location)
            )
            if not location.scalar_one_or_none():
                raise HTTPException(
                    status_code=400, detail=f"Invalid location code: {manual_location}"
                )
            return manual_location

        # 2. Salesperson's primary location (for QLD branch routing)
        if sales_staff_id:
            staff_result = await db.execute(
                select(SalesStaff).where(SalesStaff.id == sales_staff_id)
            )
            staff = staff_result.scalar_one_or_none()
            if staff:
                return staff.primary_location_code

        # 3. Terminal location (default for walk-ins)
        terminal_result = await db.execute(
            select(POSTerminal).where(POSTerminal.id == terminal_id)
        )
        terminal = terminal_result.scalar_one_or_none()
        if not terminal:
            raise HTTPException(status_code=404, detail="Terminal not found")

        return terminal.location_code


# ============================================================
# API ENDPOINTS
# ============================================================


@router.post("/transactions", response_model=POSTransactionResponse, status_code=201)
async def create_pos_transaction(
    data: POSTransactionCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> POSTransaction:
    """
    Create a new POS transaction.

    Supports:
    - Walk-in sales (provide items, no order_id)
    - Order-based sales (provide order_id, no items)
    - EFTPOS, AMEX, bank transfer, cash payments
    - Location routing (QLD branch routing logic)

    Returns:
    - Created POS transaction with transaction number
    """
    # Validate terminal exists
    terminal_result = await db.execute(
        select(POSTerminal).where(POSTerminal.id == data.terminal_id)
    )
    terminal = terminal_result.scalar_one_or_none()
    if not terminal:
        raise HTTPException(status_code=404, detail="Terminal not found")

    # Validate sales staff if provided
    if data.sales_staff_id:
        staff_result = await db.execute(
            select(SalesStaff).where(SalesStaff.id == data.sales_staff_id)
        )
        staff = staff_result.scalar_one_or_none()
        if not staff:
            raise HTTPException(status_code=404, detail="Sales staff not found")

    # Resolve location using routing service
    routing_service = LocationRoutingService()
    terminal_location = terminal.location_code
    resolved_location = await routing_service.resolve_location(
        db=db,
        terminal_id=data.terminal_id,
        sales_staff_id=data.sales_staff_id,
        manual_location=data.manual_location_code,
    )

    # Generate transaction number
    from sqlalchemy import text

    result = await db.execute(text("SELECT generate_pos_transaction_number()"))
    transaction_number = result.scalar()

    # Create POS transaction
    pos_transaction = POSTransaction(
        transaction_number=transaction_number,
        order_id=data.order_id,
        terminal_id=data.terminal_id,
        sales_staff_id=data.sales_staff_id,
        location_code=terminal_location,
        resolved_location_code=resolved_location,
        transaction_type="sale",
        payment_method=data.payment_method,
        amount=data.amount,
        currency="AUD",
        payment_status="pending",  # Will be updated by payment processor
        reconciliation_status="pending",
    )

    db.add(pos_transaction)
    await db.flush()

    # TODO: Process payment based on payment_method
    # For now, mark as captured (will integrate payment gateways in Phase 3D)
    pos_transaction.payment_status = "captured"
    pos_transaction.payment_gateway_ref = f"MOCK-{transaction_number}"

    await db.commit()
    await db.refresh(pos_transaction)

    return pos_transaction


@router.get("/transactions/{transaction_id}", response_model=POSTransactionResponse)
async def get_pos_transaction(
    transaction_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> POSTransaction:
    """Get POS transaction by ID."""
    result = await db.execute(
        select(POSTransaction).where(POSTransaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return transaction


@router.get("/transactions", response_model=PaginatedPOSTransactionsResponse)
async def list_pos_transactions(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    location_code: Optional[str] = Query(None, description="Filter by location"),
    sales_staff_id: Optional[UUID] = Query(None, description="Filter by sales staff"),
    payment_status: Optional[str] = Query(None, description="Filter by payment status"),
    reconciliation_status: Optional[str] = Query(
        None, description="Filter by reconciliation status"
    ),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    search: Optional[str] = Query(None, description="Search transaction number or reference"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Page size"),
) -> PaginatedPOSTransactionsResponse:
    """
    List POS transactions with filters.

    Filters:
    - location_code: Filter by resolved location
    - sales_staff_id: Filter by salesperson
    - payment_status: pending, authorized, captured, failed, refunded
    - reconciliation_status: pending, matched, discrepancy, resolved
    - start_date/end_date: Date range filter
    - search: Search by transaction number or reference

    Returns:
    - Paginated list of POS transactions
    """
    # Build query
    query = select(POSTransaction)

    # Apply filters
    if location_code:
        query = query.where(POSTransaction.resolved_location_code == location_code)

    if sales_staff_id:
        query = query.where(POSTransaction.sales_staff_id == sales_staff_id)

    if payment_status:
        query = query.where(POSTransaction.payment_status == payment_status)

    if reconciliation_status:
        query = query.where(POSTransaction.reconciliation_status == reconciliation_status)

    if start_date:
        query = query.where(func.date(POSTransaction.created_at) >= start_date)

    if end_date:
        query = query.where(func.date(POSTransaction.created_at) <= end_date)

    if search:
        query = query.where(
            or_(
                POSTransaction.transaction_number.ilike(f"%{search}%"),
                POSTransaction.payment_gateway_ref.ilike(f"%{search}%"),
                POSTransaction.bank_statement_ref.ilike(f"%{search}%"),
            )
        )

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = (
        query.order_by(POSTransaction.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )

    # Execute
    result = await db.execute(query)
    transactions = result.scalars().all()

    return PaginatedPOSTransactionsResponse(
        data=transactions,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/locations", response_model=list[dict])
async def list_locations(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    """List all active locations."""
    result = await db.execute(select(Location).where(Location.is_active == True))
    locations = result.scalars().all()

    return [
        {
            "code": loc.code,
            "name": loc.name,
            "location_type": loc.location_type,
            "city": loc.city,
            "state": loc.state,
        }
        for loc in locations
    ]


@router.get("/sales-staff", response_model=list[dict])
async def list_sales_staff(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    """List all active sales staff."""
    result = await db.execute(select(SalesStaff).where(SalesStaff.is_active == True))
    staff_list = result.scalars().all()

    return [
        {
            "id": staff.id,
            "staff_code": staff.staff_code,
            "full_name": staff.full_name,
            "primary_location_code": staff.primary_location_code,
            "can_sell_at_locations": staff.can_sell_at_locations,
        }
        for staff in staff_list
    ]


@router.get("/terminals", response_model=list[dict])
async def list_terminals(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    location_code: Optional[str] = Query(None, description="Filter by location"),
) -> list[dict]:
    """List POS terminals."""
    query = select(POSTerminal).where(POSTerminal.is_active == True)

    if location_code:
        query = query.where(POSTerminal.location_code == location_code)

    result = await db.execute(query)
    terminals = result.scalars().all()

    return [
        {
            "id": term.id,
            "terminal_id": term.terminal_id,
            "location_code": term.location_code,
            "terminal_type": term.terminal_type,
            "merchant_id": term.merchant_id,
        }
        for term in terminals
    ]
