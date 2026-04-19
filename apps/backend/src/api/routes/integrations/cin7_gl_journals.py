"""Cin7 GL — Journal Entries read endpoint (list)."""

from __future__ import annotations

from datetime import date
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_gl_models import Cin7JournalEntry

from .cin7_gl_demo import _DEMO_JOURNALS
from .cin7_gl_schemas import (
    JournalEntriesListResponse,
    JournalEntryResponse,
    JournalLineResponse,
)

logger = structlog.get_logger(__name__)

_journals_router = APIRouter()


@_journals_router.get("/journal-entries", response_model=JournalEntriesListResponse)
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
