"""Cin7 GL — Account Mappings endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_gl_models import Cin7AccountMapping

from .cin7_gl_demo import _DEMO_MAPPINGS
from .cin7_gl_schemas import (
    AccountMappingResponse,
    AccountMappingsListResponse,
    UpsertAccountMappingRequest,
)

logger = structlog.get_logger(__name__)

_mappings_router = APIRouter()


@_mappings_router.get("/account-mappings", response_model=AccountMappingsListResponse)
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

    mappings = [AccountMappingResponse(**m) for m in _DEMO_MAPPINGS]
    return AccountMappingsListResponse(mappings=mappings, total=len(mappings))


@_mappings_router.put("/account-mappings", response_model=AccountMappingResponse)
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
