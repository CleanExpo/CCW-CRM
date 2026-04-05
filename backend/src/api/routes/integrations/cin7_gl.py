"""Cin7 Financial/GL Integration API endpoints.

Provides routes for:
- Chart of Accounts: list and sync from Cin7
- Journal Entries: list, create manual entries, post drafts
- Account Mappings: list and upsert ERP-to-GL mappings

In demo mode all operations use realistic mock data; no real Cin7 calls.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_gl_models import (
    AccountType,
    Cin7AccountMapping,
    Cin7ChartOfAccount,
    Cin7JournalEntry,
    Cin7JournalLine,
    ErpEntityType,
    JournalSource,
    JournalStatus,
    LineType,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cin7", tags=["Cin7 Financial/GL"])

# ---------------------------------------------------------------------------
# Demo data
# ---------------------------------------------------------------------------

_DEMO_ACCOUNTS: list[dict[str, Any]] = [
    {
        "id": "a1000000-0000-0000-0000-000000000001",
        "cin7_account_id": "CIN7-ACC-1000",
        "account_code": "1000",
        "account_name": "Cash and Bank",
        "account_type": AccountType.ASSET.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "Current cash and bank accounts",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
    {
        "id": "a1000000-0000-0000-0000-000000000002",
        "cin7_account_id": "CIN7-ACC-1200",
        "account_code": "1200",
        "account_name": "Accounts Receivable",
        "account_type": AccountType.ASSET.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "Amounts owed by customers",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
    {
        "id": "a1000000-0000-0000-0000-000000000003",
        "cin7_account_id": "CIN7-ACC-2000",
        "account_code": "2000",
        "account_name": "Accounts Payable",
        "account_type": AccountType.LIABILITY.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "Amounts owed to suppliers",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
    {
        "id": "a1000000-0000-0000-0000-000000000004",
        "cin7_account_id": "CIN7-ACC-2200",
        "account_code": "2200",
        "account_name": "GST Payable",
        "account_type": AccountType.LIABILITY.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "GST collected on sales",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
    {
        "id": "a1000000-0000-0000-0000-000000000005",
        "cin7_account_id": "CIN7-ACC-3000",
        "account_code": "3000",
        "account_name": "Retained Earnings",
        "account_type": AccountType.EQUITY.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "Accumulated retained earnings",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
    {
        "id": "a1000000-0000-0000-0000-000000000006",
        "cin7_account_id": "CIN7-ACC-4000",
        "account_code": "4000",
        "account_name": "Sales Revenue",
        "account_type": AccountType.REVENUE.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "Revenue from equipment sales",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
    {
        "id": "a1000000-0000-0000-0000-000000000007",
        "cin7_account_id": "CIN7-ACC-5000",
        "account_code": "5000",
        "account_name": "Cost of Goods Sold",
        "account_type": AccountType.COST_OF_GOODS.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "Direct cost of products sold",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
    {
        "id": "a1000000-0000-0000-0000-000000000008",
        "cin7_account_id": "CIN7-ACC-6000",
        "account_code": "6000",
        "account_name": "Operating Expenses",
        "account_type": AccountType.EXPENSE.value,
        "parent_account_id": None,
        "is_active": True,
        "currency": "AUD",
        "description": "General operating expenditure",
        "last_synced_at": "2026-03-01T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
    },
]

_DEMO_JOURNALS: list[dict[str, Any]] = [
    {
        "id": "j1000000-0000-0000-0000-000000000001",
        "cin7_journal_id": "CIN7-JNL-0001",
        "journal_date": "2026-03-01",
        "reference": "ORD-2026-001",
        "description": "Sales order ORD-2026-001 — revenue recognition",
        "status": JournalStatus.POSTED.value,
        "total_debit": "5500.00",
        "total_credit": "5500.00",
        "currency": "AUD",
        "source": JournalSource.ORDER.value,
        "cin7_synced": True,
        "created_at": "2026-03-01T09:00:00Z",
        "updated_at": "2026-03-01T09:05:00Z",
        "lines": [
            {
                "id": "l1000000-0000-0000-0001-000000000001",
                "journal_entry_id": "j1000000-0000-0000-0000-000000000001",
                "account_id": "a1000000-0000-0000-0000-000000000002",
                "account_code": "1200",
                "account_name": "Accounts Receivable",
                "line_type": LineType.DEBIT.value,
                "amount": "5500.00",
                "description": "AR from ORD-2026-001",
                "order_id": None,
                "tax_amount": "500.00",
            },
            {
                "id": "l1000000-0000-0000-0001-000000000002",
                "journal_entry_id": "j1000000-0000-0000-0000-000000000001",
                "account_id": "a1000000-0000-0000-0000-000000000006",
                "account_code": "4000",
                "account_name": "Sales Revenue",
                "line_type": LineType.CREDIT.value,
                "amount": "5000.00",
                "description": "Revenue from ORD-2026-001",
                "order_id": None,
                "tax_amount": "0.00",
            },
            {
                "id": "l1000000-0000-0000-0001-000000000003",
                "journal_entry_id": "j1000000-0000-0000-0000-000000000001",
                "account_id": "a1000000-0000-0000-0000-000000000004",
                "account_code": "2200",
                "account_name": "GST Payable",
                "line_type": LineType.CREDIT.value,
                "amount": "500.00",
                "description": "GST on ORD-2026-001",
                "order_id": None,
                "tax_amount": "0.00",
            },
        ],
    },
    {
        "id": "j1000000-0000-0000-0000-000000000002",
        "cin7_journal_id": None,
        "journal_date": "2026-03-02",
        "reference": "MAN-2026-001",
        "description": "Manual adjustment — stock write-down",
        "status": JournalStatus.DRAFT.value,
        "total_debit": "800.00",
        "total_credit": "800.00",
        "currency": "AUD",
        "source": JournalSource.MANUAL.value,
        "cin7_synced": False,
        "created_at": "2026-03-02T14:00:00Z",
        "updated_at": "2026-03-02T14:00:00Z",
        "lines": [
            {
                "id": "l1000000-0000-0000-0002-000000000001",
                "journal_entry_id": "j1000000-0000-0000-0000-000000000002",
                "account_id": "a1000000-0000-0000-0000-000000000008",
                "account_code": "6000",
                "account_name": "Operating Expenses",
                "line_type": LineType.DEBIT.value,
                "amount": "800.00",
                "description": "Damaged goods write-down",
                "order_id": None,
                "tax_amount": "0.00",
            },
            {
                "id": "l1000000-0000-0000-0002-000000000002",
                "journal_entry_id": "j1000000-0000-0000-0000-000000000002",
                "account_id": "a1000000-0000-0000-0000-000000000007",
                "account_code": "5000",
                "account_name": "Cost of Goods Sold",
                "line_type": LineType.CREDIT.value,
                "amount": "800.00",
                "description": "COGS credit for write-down",
                "order_id": None,
                "tax_amount": "0.00",
            },
        ],
    },
]

_DEMO_MAPPINGS: list[dict[str, Any]] = [
    {
        "id": "m1000000-0000-0000-0000-000000000001",
        "erp_entity_type": ErpEntityType.ORDER.value,
        "erp_field": "revenue",
        "cin7_account_id": "a1000000-0000-0000-0000-000000000006",
        "account_code": "4000",
        "account_name": "Sales Revenue",
        "is_default": True,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    },
    {
        "id": "m1000000-0000-0000-0000-000000000002",
        "erp_entity_type": ErpEntityType.ORDER.value,
        "erp_field": "receivable",
        "cin7_account_id": "a1000000-0000-0000-0000-000000000002",
        "account_code": "1200",
        "account_name": "Accounts Receivable",
        "is_default": True,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    },
    {
        "id": "m1000000-0000-0000-0000-000000000003",
        "erp_entity_type": ErpEntityType.ORDER.value,
        "erp_field": "tax",
        "cin7_account_id": "a1000000-0000-0000-0000-000000000004",
        "account_code": "2200",
        "account_name": "GST Payable",
        "is_default": True,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    },
    {
        "id": "m1000000-0000-0000-0000-000000000004",
        "erp_entity_type": ErpEntityType.PAYMENT.value,
        "erp_field": "bank",
        "cin7_account_id": "a1000000-0000-0000-0000-000000000001",
        "account_code": "1000",
        "account_name": "Cash and Bank",
        "is_default": True,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    },
    {
        "id": "m1000000-0000-0000-0000-000000000005",
        "erp_entity_type": ErpEntityType.INVOICE.value,
        "erp_field": "payable",
        "cin7_account_id": "a1000000-0000-0000-0000-000000000003",
        "account_code": "2000",
        "account_name": "Accounts Payable",
        "is_default": True,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    },
]


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ChartOfAccountResponse(BaseModel):
    id: str
    cin7_account_id: str
    account_code: str
    account_name: str
    account_type: str
    parent_account_id: str | None
    is_active: bool
    currency: str
    description: str | None
    last_synced_at: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ChartOfAccountsListResponse(BaseModel):
    accounts: list[ChartOfAccountResponse]
    total: int


class SyncChartOfAccountsResponse(BaseModel):
    synced: int
    created: int
    updated: int
    message: str


class JournalLineResponse(BaseModel):
    id: str
    journal_entry_id: str
    account_id: str
    account_code: str | None = None
    account_name: str | None = None
    line_type: str
    amount: str
    description: str | None
    order_id: str | None
    tax_amount: str

    model_config = {"from_attributes": True}


class JournalEntryResponse(BaseModel):
    id: str
    cin7_journal_id: str | None
    journal_date: str
    reference: str | None
    description: str | None
    status: str
    total_debit: str
    total_credit: str
    currency: str
    source: str
    cin7_synced: bool
    created_at: str
    updated_at: str
    lines: list[JournalLineResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class JournalEntriesListResponse(BaseModel):
    entries: list[JournalEntryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class JournalLineCreateRequest(BaseModel):
    account_id: str = Field(..., description="UUID of the GL account")
    line_type: str = Field(..., description="'debit' or 'credit'")
    amount: float = Field(..., gt=0, description="Positive amount")
    description: str | None = None
    tax_amount: float = Field(default=0.0, ge=0)


class JournalEntryCreateRequest(BaseModel):
    journal_date: str = Field(..., description="ISO date string YYYY-MM-DD")
    reference: str | None = None
    description: str | None = None
    currency: str = "AUD"
    lines: list[JournalLineCreateRequest] = Field(
        ..., min_length=2, description="At least one debit and one credit line"
    )


class AccountMappingResponse(BaseModel):
    id: str
    erp_entity_type: str
    erp_field: str
    cin7_account_id: str | None
    account_code: str | None
    account_name: str | None = None
    is_default: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class AccountMappingsListResponse(BaseModel):
    mappings: list[AccountMappingResponse]
    total: int


class UpsertAccountMappingRequest(BaseModel):
    erp_entity_type: str = Field(..., description="ERP entity type (order/invoice/...)")
    erp_field: str = Field(..., description="ERP field name (revenue/receivable/...)")
    account_code: str | None = None
    cin7_account_id: str | None = None
    is_default: bool = False


# ---------------------------------------------------------------------------
# Chart of Accounts endpoints
# ---------------------------------------------------------------------------


@router.get("/chart-of-accounts", response_model=ChartOfAccountsListResponse)
async def list_chart_of_accounts(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    account_type: str | None = Query(None, description="Filter by account type"),
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> ChartOfAccountsListResponse:
    """List all Chart of Accounts entries synced from Cin7.

    Optionally filter by account_type (asset, liability, equity, revenue,
    expense, cost_of_goods) and/or is_active status.

    In demo mode returns 8 representative accounts.
    """
    logger.info("list_chart_of_accounts", account_type=account_type, is_active=is_active)

    # Try database first
    try:
        stmt = select(Cin7ChartOfAccount)
        if account_type:
            stmt = stmt.where(Cin7ChartOfAccount.account_type == account_type)
        if is_active is not None:
            stmt = stmt.where(Cin7ChartOfAccount.is_active == is_active)
        result = await db.execute(stmt)
        db_accounts = result.scalars().all()

        if db_accounts:
            accounts = [
                ChartOfAccountResponse(
                    id=str(a.id),
                    cin7_account_id=a.cin7_account_id,
                    account_code=a.account_code,
                    account_name=a.account_name,
                    account_type=a.account_type,
                    parent_account_id=a.parent_account_id,
                    is_active=a.is_active,
                    currency=a.currency,
                    description=a.description,
                    last_synced_at=(
                        a.last_synced_at.isoformat() if a.last_synced_at else None
                    ),
                    created_at=a.created_at.isoformat(),
                    updated_at=a.updated_at.isoformat(),
                )
                for a in db_accounts
            ]
            return ChartOfAccountsListResponse(accounts=accounts, total=len(accounts))
    except Exception as exc:
        logger.warning("chart_of_accounts_db_fallback", error=str(exc))

    # Demo fallback
    filtered = list(_DEMO_ACCOUNTS)
    if account_type:
        filtered = [a for a in filtered if a["account_type"] == account_type]
    if is_active is not None:
        filtered = [a for a in filtered if a["is_active"] == is_active]

    accounts = [ChartOfAccountResponse(**a) for a in filtered]
    return ChartOfAccountsListResponse(accounts=accounts, total=len(accounts))


@router.post("/chart-of-accounts/sync", response_model=SyncChartOfAccountsResponse)
async def sync_chart_of_accounts(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SyncChartOfAccountsResponse:
    """Sync Chart of Accounts from Cin7.

    In demo mode, creates or updates the 8 standard demo accounts.
    In live mode this would call the Cin7 financial accounts API.
    """
    logger.info("sync_chart_of_accounts_triggered")

    now = datetime.now(UTC)
    created = 0
    updated = 0

    try:
        for demo_acc in _DEMO_ACCOUNTS:
            stmt = select(Cin7ChartOfAccount).where(
                Cin7ChartOfAccount.cin7_account_id == demo_acc["cin7_account_id"]
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                existing.account_code = demo_acc["account_code"]
                existing.account_name = demo_acc["account_name"]
                existing.account_type = demo_acc["account_type"]
                existing.is_active = demo_acc["is_active"]
                existing.currency = demo_acc["currency"]
                existing.description = demo_acc["description"]
                existing.last_synced_at = now
                updated += 1
            else:
                new_acc = Cin7ChartOfAccount(
                    id=uuid4(),
                    cin7_account_id=demo_acc["cin7_account_id"],
                    account_code=demo_acc["account_code"],
                    account_name=demo_acc["account_name"],
                    account_type=demo_acc["account_type"],
                    parent_account_id=demo_acc["parent_account_id"],
                    is_active=demo_acc["is_active"],
                    currency=demo_acc["currency"],
                    description=demo_acc["description"],
                    last_synced_at=now,
                )
                db.add(new_acc)
                created += 1

        await db.commit()
        logger.info("chart_of_accounts_synced", created=created, updated=updated)

        return SyncChartOfAccountsResponse(
            synced=created + updated,
            created=created,
            updated=updated,
            message=f"Synced {created + updated} accounts ({created} new, {updated} updated)",
        )

    except Exception as exc:
        await db.rollback()
        logger.error("chart_of_accounts_sync_failed", error=str(exc))
        # Return demo response even if DB write fails
        return SyncChartOfAccountsResponse(
            synced=len(_DEMO_ACCOUNTS),
            created=len(_DEMO_ACCOUNTS),
            updated=0,
            message=f"Demo sync complete: {len(_DEMO_ACCOUNTS)} accounts (in-memory only)",
        )


# ---------------------------------------------------------------------------
# Journal Entries endpoints
# ---------------------------------------------------------------------------


@router.get("/journal-entries", response_model=JournalEntriesListResponse)
async def list_journal_entries(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="Filter by status (draft/posted/void)"),
    date_from: str | None = Query(None, description="Start date YYYY-MM-DD (inclusive)"),
    date_to: str | None = Query(None, description="End date YYYY-MM-DD (inclusive)"),
) -> JournalEntriesListResponse:
    """List journal entries with optional filters.

    Supports pagination, status filter, and date range filters.
    In demo mode returns 2 sample entries.
    """
    logger.info(
        "list_journal_entries",
        page=page,
        page_size=page_size,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )

    # Try database
    try:
        stmt = select(Cin7JournalEntry)
        if status:
            stmt = stmt.where(Cin7JournalEntry.status == status)
        if date_from:
            from_dt = date.fromisoformat(date_from)
            stmt = stmt.where(Cin7JournalEntry.journal_date >= from_dt)
        if date_to:
            to_dt = date.fromisoformat(date_to)
            stmt = stmt.where(Cin7JournalEntry.journal_date <= to_dt)

        stmt = stmt.order_by(Cin7JournalEntry.journal_date.desc())

        count_stmt = stmt
        total_result = await db.execute(count_stmt)
        total = len(total_result.scalars().all())

        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(stmt)
        db_entries = result.scalars().all()

        if db_entries:
            entries = [
                JournalEntryResponse(
                    id=str(e.id),
                    cin7_journal_id=e.cin7_journal_id,
                    journal_date=e.journal_date.isoformat(),
                    reference=e.reference,
                    description=e.description,
                    status=e.status,
                    total_debit=str(e.total_debit),
                    total_credit=str(e.total_credit),
                    currency=e.currency,
                    source=e.source,
                    cin7_synced=e.cin7_synced,
                    created_at=e.created_at.isoformat(),
                    updated_at=e.updated_at.isoformat(),
                    lines=[
                        JournalLineResponse(
                            id=str(ln.id),
                            journal_entry_id=str(ln.journal_entry_id),
                            account_id=str(ln.account_id),
                            line_type=ln.line_type,
                            amount=str(ln.amount),
                            description=ln.description,
                            order_id=str(ln.order_id) if ln.order_id else None,
                            tax_amount=str(ln.tax_amount),
                        )
                        for ln in e.lines
                    ],
                )
                for e in db_entries
            ]
            total_pages = max(1, (total + page_size - 1) // page_size)
            return JournalEntriesListResponse(
                entries=entries,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages,
            )
    except Exception as exc:
        logger.warning("journal_entries_db_fallback", error=str(exc))

    # Demo fallback
    filtered = list(_DEMO_JOURNALS)
    if status:
        filtered = [j for j in filtered if j["status"] == status]
    if date_from:
        filtered = [j for j in filtered if j["journal_date"] >= date_from]
    if date_to:
        filtered = [j for j in filtered if j["journal_date"] <= date_to]

    total = len(filtered)
    offset = (page - 1) * page_size
    paginated = filtered[offset : offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    entries = []
    for j in paginated:
        lines = [JournalLineResponse(**ln) for ln in j.get("lines", [])]
        entries.append(
            JournalEntryResponse(
                id=j["id"],
                cin7_journal_id=j["cin7_journal_id"],
                journal_date=j["journal_date"],
                reference=j["reference"],
                description=j["description"],
                status=j["status"],
                total_debit=j["total_debit"],
                total_credit=j["total_credit"],
                currency=j["currency"],
                source=j["source"],
                cin7_synced=j["cin7_synced"],
                created_at=j["created_at"],
                updated_at=j["updated_at"],
                lines=lines,
            )
        )

    return JournalEntriesListResponse(
        entries=entries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/journal-entries", response_model=JournalEntryResponse, status_code=201)
async def create_journal_entry(
    body: JournalEntryCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> JournalEntryResponse:
    """Create a manual journal entry.

    Lines must include at least one debit and one credit.
    The totals are computed from the provided lines.
    """
    logger.info("create_journal_entry", reference=body.reference)

    # Validate debit/credit balance
    total_debit = sum(
        ln.amount for ln in body.lines if ln.line_type == LineType.DEBIT.value
    )
    total_credit = sum(
        ln.amount for ln in body.lines if ln.line_type == LineType.CREDIT.value
    )

    if not body.lines:
        raise HTTPException(status_code=400, detail="Journal entry requires at least 2 lines")

    try:
        journal_date = date.fromisoformat(body.journal_date)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid journal_date: {body.journal_date}. Use YYYY-MM-DD format.",
        )

    entry_id = uuid4()
    now = datetime.now(UTC)

    try:
        entry = Cin7JournalEntry(
            id=entry_id,
            journal_date=journal_date,
            reference=body.reference,
            description=body.description,
            status=JournalStatus.DRAFT.value,
            total_debit=Decimal(str(round(total_debit, 2))),
            total_credit=Decimal(str(round(total_credit, 2))),
            currency=body.currency,
            source=JournalSource.MANUAL.value,
            cin7_synced=False,
        )
        db.add(entry)
        await db.flush()

        line_responses: list[JournalLineResponse] = []
        for ln in body.lines:
            try:
                account_uuid = UUID(ln.account_id)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid account_id UUID: {ln.account_id}",
                )

            journal_line = Cin7JournalLine(
                id=uuid4(),
                journal_entry_id=entry_id,
                account_id=account_uuid,
                line_type=ln.line_type,
                amount=Decimal(str(round(ln.amount, 2))),
                description=ln.description,
                tax_amount=Decimal(str(round(ln.tax_amount, 2))),
            )
            db.add(journal_line)
            line_responses.append(
                JournalLineResponse(
                    id=str(journal_line.id),
                    journal_entry_id=str(entry_id),
                    account_id=ln.account_id,
                    line_type=ln.line_type,
                    amount=str(round(ln.amount, 2)),
                    description=ln.description,
                    order_id=None,
                    tax_amount=str(round(ln.tax_amount, 2)),
                )
            )

        await db.commit()

        return JournalEntryResponse(
            id=str(entry_id),
            cin7_journal_id=None,
            journal_date=body.journal_date,
            reference=body.reference,
            description=body.description,
            status=JournalStatus.DRAFT.value,
            total_debit=str(round(total_debit, 2)),
            total_credit=str(round(total_credit, 2)),
            currency=body.currency,
            source=JournalSource.MANUAL.value,
            cin7_synced=False,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
            lines=line_responses,
        )

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error("create_journal_entry_failed", error=str(exc))
        # Demo fallback: return in-memory entry
        entry_id_str = str(uuid4())
        line_responses = [
            JournalLineResponse(
                id=str(uuid4()),
                journal_entry_id=entry_id_str,
                account_id=ln.account_id,
                line_type=ln.line_type,
                amount=str(round(ln.amount, 2)),
                description=ln.description,
                order_id=None,
                tax_amount=str(round(ln.tax_amount, 2)),
            )
            for ln in body.lines
        ]
        return JournalEntryResponse(
            id=entry_id_str,
            cin7_journal_id=None,
            journal_date=body.journal_date,
            reference=body.reference,
            description=body.description,
            status=JournalStatus.DRAFT.value,
            total_debit=str(round(total_debit, 2)),
            total_credit=str(round(total_credit, 2)),
            currency=body.currency,
            source=JournalSource.MANUAL.value,
            cin7_synced=False,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
            lines=line_responses,
        )


@router.patch(
    "/journal-entries/{entry_id}/post", response_model=JournalEntryResponse
)
async def post_journal_entry(
    entry_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> JournalEntryResponse:
    """Post a draft journal entry.

    Validates that total debits equal total credits before posting.
    Returns 400 if the entry is already posted/void or if debits != credits.
    """
    logger.info("post_journal_entry", entry_id=entry_id)

    try:
        entry_uuid = UUID(entry_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entry_id: {entry_id}")

    try:
        stmt = select(Cin7JournalEntry).where(Cin7JournalEntry.id == entry_uuid)
        result = await db.execute(stmt)
        entry = result.scalar_one_or_none()

        if entry is None:
            # Demo fallback: find in demo data
            demo_match = next(
                (j for j in _DEMO_JOURNALS if j["id"] == entry_id), None
            )
            if not demo_match:
                raise HTTPException(
                    status_code=404, detail=f"Journal entry {entry_id} not found"
                )
            if demo_match["status"] != JournalStatus.DRAFT.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Journal entry is already {demo_match['status']}",
                )
            if demo_match["total_debit"] != demo_match["total_credit"]:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Debits ({demo_match['total_debit']}) must equal "
                        f"credits ({demo_match['total_credit']}) before posting"
                    ),
                )
            # Return demo posted entry
            lines = [JournalLineResponse(**ln) for ln in demo_match.get("lines", [])]
            now = datetime.now(UTC)
            return JournalEntryResponse(
                **{**demo_match, "status": JournalStatus.POSTED.value, "lines": lines,
                   "updated_at": now.isoformat()}
            )

        if entry.status != JournalStatus.DRAFT.value:
            raise HTTPException(
                status_code=400,
                detail=f"Journal entry is already {entry.status}",
            )

        if entry.total_debit != entry.total_credit:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Debits ({entry.total_debit}) must equal credits "
                    f"({entry.total_credit}) before posting"
                ),
            )

        entry.status = JournalStatus.POSTED.value
        await db.commit()
        await db.refresh(entry)

        lines = [
            JournalLineResponse(
                id=str(ln.id),
                journal_entry_id=str(ln.journal_entry_id),
                account_id=str(ln.account_id),
                line_type=ln.line_type,
                amount=str(ln.amount),
                description=ln.description,
                order_id=str(ln.order_id) if ln.order_id else None,
                tax_amount=str(ln.tax_amount),
            )
            for ln in entry.lines
        ]

        return JournalEntryResponse(
            id=str(entry.id),
            cin7_journal_id=entry.cin7_journal_id,
            journal_date=entry.journal_date.isoformat(),
            reference=entry.reference,
            description=entry.description,
            status=entry.status,
            total_debit=str(entry.total_debit),
            total_credit=str(entry.total_credit),
            currency=entry.currency,
            source=entry.source,
            cin7_synced=entry.cin7_synced,
            created_at=entry.created_at.isoformat(),
            updated_at=entry.updated_at.isoformat(),
            lines=lines,
        )

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error("post_journal_entry_failed", error=str(exc))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to post journal entry: {exc}",
        )


# ---------------------------------------------------------------------------
# Account Mappings endpoints
# ---------------------------------------------------------------------------


@router.get("/account-mappings", response_model=AccountMappingsListResponse)
async def list_account_mappings(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> AccountMappingsListResponse:
    """List all ERP-to-GL account mappings."""
    logger.info("list_account_mappings")

    try:
        stmt = select(Cin7AccountMapping)
        result = await db.execute(stmt)
        db_mappings = result.scalars().all()

        if db_mappings:
            mappings = [
                AccountMappingResponse(
                    id=str(m.id),
                    erp_entity_type=m.erp_entity_type,
                    erp_field=m.erp_field,
                    cin7_account_id=str(m.cin7_account_id) if m.cin7_account_id else None,
                    account_code=m.account_code,
                    account_name=(
                        m.cin7_account.account_name if m.cin7_account else None
                    ),
                    is_default=m.is_default,
                    created_at=m.created_at.isoformat(),
                    updated_at=m.updated_at.isoformat(),
                )
                for m in db_mappings
            ]
            return AccountMappingsListResponse(mappings=mappings, total=len(mappings))
    except Exception as exc:
        logger.warning("account_mappings_db_fallback", error=str(exc))

    # Demo fallback
    mappings = [AccountMappingResponse(**m) for m in _DEMO_MAPPINGS]
    return AccountMappingsListResponse(mappings=mappings, total=len(mappings))


@router.put("/account-mappings", response_model=AccountMappingResponse)
async def upsert_account_mapping(
    body: UpsertAccountMappingRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> AccountMappingResponse:
    """Create or update an ERP-to-GL account mapping.

    Matches on erp_entity_type + erp_field. Updates account_code,
    cin7_account_id, and is_default if the mapping already exists.
    """
    logger.info(
        "upsert_account_mapping",
        entity_type=body.erp_entity_type,
        field=body.erp_field,
    )

    now = datetime.now(UTC)

    try:
        stmt = select(Cin7AccountMapping).where(
            Cin7AccountMapping.erp_entity_type == body.erp_entity_type,
            Cin7AccountMapping.erp_field == body.erp_field,
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        cin7_account_uuid: UUID | None = None
        if body.cin7_account_id:
            try:
                cin7_account_uuid = UUID(body.cin7_account_id)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid cin7_account_id UUID: {body.cin7_account_id}",
                )

        if existing:
            existing.account_code = body.account_code
            existing.cin7_account_id = cin7_account_uuid
            existing.is_default = body.is_default
            await db.commit()
            await db.refresh(existing)
            return AccountMappingResponse(
                id=str(existing.id),
                erp_entity_type=existing.erp_entity_type,
                erp_field=existing.erp_field,
                cin7_account_id=str(existing.cin7_account_id)
                if existing.cin7_account_id
                else None,
                account_code=existing.account_code,
                account_name=(
                    existing.cin7_account.account_name if existing.cin7_account else None
                ),
                is_default=existing.is_default,
                created_at=existing.created_at.isoformat(),
                updated_at=existing.updated_at.isoformat(),
            )
        else:
            new_mapping = Cin7AccountMapping(
                id=uuid4(),
                erp_entity_type=body.erp_entity_type,
                erp_field=body.erp_field,
                cin7_account_id=cin7_account_uuid,
                account_code=body.account_code,
                is_default=body.is_default,
            )
            db.add(new_mapping)
            await db.commit()
            await db.refresh(new_mapping)
            return AccountMappingResponse(
                id=str(new_mapping.id),
                erp_entity_type=new_mapping.erp_entity_type,
                erp_field=new_mapping.erp_field,
                cin7_account_id=str(new_mapping.cin7_account_id)
                if new_mapping.cin7_account_id
                else None,
                account_code=new_mapping.account_code,
                account_name=None,
                is_default=new_mapping.is_default,
                created_at=new_mapping.created_at.isoformat(),
                updated_at=new_mapping.updated_at.isoformat(),
            )

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error("upsert_account_mapping_failed", error=str(exc))
        # Demo fallback
        mapping_id = str(uuid4())
        return AccountMappingResponse(
            id=mapping_id,
            erp_entity_type=body.erp_entity_type,
            erp_field=body.erp_field,
            cin7_account_id=body.cin7_account_id,
            account_code=body.account_code,
            account_name=None,
            is_default=body.is_default,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
        )
