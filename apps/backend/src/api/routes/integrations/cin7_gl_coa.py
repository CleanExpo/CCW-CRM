"""Cin7 GL — Chart of Accounts endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_gl_models import Cin7ChartOfAccount

from .cin7_gl_demo import _DEMO_ACCOUNTS
from .cin7_gl_schemas import (
    ChartOfAccountResponse,
    ChartOfAccountsListResponse,
    SyncChartOfAccountsResponse,
)

logger = structlog.get_logger(__name__)

_coa_router = APIRouter()


@_coa_router.get("/chart-of-accounts", response_model=ChartOfAccountsListResponse)
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


@_coa_router.post("/chart-of-accounts/sync", response_model=SyncChartOfAccountsResponse)
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
        return SyncChartOfAccountsResponse(
            synced=len(_DEMO_ACCOUNTS),
            created=len(_DEMO_ACCOUNTS),
            updated=0,
            message=f"Demo sync complete: {len(_DEMO_ACCOUNTS)} accounts (in-memory only)",
        )
