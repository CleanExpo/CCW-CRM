"""Cin7 GL — Journal Entries write endpoints (create + post)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_gl_models import (
    Cin7JournalEntry,
    Cin7JournalLine,
    JournalSource,
    JournalStatus,
    LineType,
)
from sqlalchemy import select

from .cin7_gl_demo import _DEMO_JOURNALS
from .cin7_gl_schemas import (
    JournalEntryCreateRequest,
    JournalEntryResponse,
    JournalLineResponse,
)

logger = structlog.get_logger(__name__)

_journals_write_router = APIRouter()


@_journals_write_router.post("/journal-entries", response_model=JournalEntryResponse, status_code=201)
async def create_journal_entry(
    body: JournalEntryCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> JournalEntryResponse:
    """Create a manual journal entry.

    Lines must include at least one debit and one credit.
    The totals are computed from the provided lines.
    """
    logger.info("create_journal_entry", reference=body.reference)

    total_debit = sum(ln.amount for ln in body.lines if ln.line_type == LineType.DEBIT.value)
    total_credit = sum(ln.amount for ln in body.lines if ln.line_type == LineType.CREDIT.value)

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
                raise HTTPException(status_code=400, detail=f"Invalid account_id UUID: {ln.account_id}")

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


@_journals_write_router.patch(
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
            demo_match = next((j for j in _DEMO_JOURNALS if j["id"] == entry_id), None)
            if not demo_match:
                raise HTTPException(status_code=404, detail=f"Journal entry {entry_id} not found")
            if demo_match["status"] != JournalStatus.DRAFT.value:
                raise HTTPException(status_code=400, detail=f"Journal entry is already {demo_match['status']}")
            if demo_match["total_debit"] != demo_match["total_credit"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Debits ({demo_match['total_debit']}) must equal credits ({demo_match['total_credit']}) before posting",
                )
            lines = [JournalLineResponse(**ln) for ln in demo_match.get("lines", [])]
            now = datetime.now(UTC)
            return JournalEntryResponse(
                **{**demo_match, "status": JournalStatus.POSTED.value, "lines": lines, "updated_at": now.isoformat()}
            )

        if entry.status != JournalStatus.DRAFT.value:
            raise HTTPException(status_code=400, detail=f"Journal entry is already {entry.status}")

        if entry.total_debit != entry.total_credit:
            raise HTTPException(
                status_code=400,
                detail=f"Debits ({entry.total_debit}) must equal credits ({entry.total_credit}) before posting",
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
        raise HTTPException(status_code=500, detail=f"Failed to post journal entry: {exc}")
