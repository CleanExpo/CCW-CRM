"""Audit trail API — entity-level change history."""
from datetime import datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routes.demo_auth import get_current_user
from src.config.database import get_async_db
from src.db.audit_models import AuditLog

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/audit", tags=["Audit Trail"])


class AuditLogResponse(BaseModel):
    """Audit log entry response."""

    id: UUID
    user_id: UUID | None
    user_email: str | None
    entity_type: str
    entity_id: str
    action: str
    changes: dict | None
    metadata_: dict | None
    ip_address: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAuditResponse(BaseModel):
    """Paginated audit log response."""

    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=PaginatedAuditResponse)
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    entity_type: str | None = Query(None, description="Filter by entity type (order, quote, invoice)"),
    entity_id: str | None = Query(None, description="Filter by entity ID"),
    action: str | None = Query(None, description="Filter by action (create, update, delete)"),
    user_id: UUID | None = Query(None, description="Filter by user ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> PaginatedAuditResponse:
    """List audit trail entries with optional filters."""
    query = select(AuditLog)

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if action:
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)

    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(AuditLog.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    logs = result.scalars().all()

    items = [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=log.user_email,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            action=log.action,
            changes=log.changes,
            metadata_=log.metadata_,
            ip_address=log.ip_address,
            notes=log.notes,
            created_at=log.created_at,
        )
        for log in logs
    ]

    return PaginatedAuditResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{entity_type}/{entity_id}", response_model=list[AuditLogResponse])
async def get_entity_audit_trail(
    entity_type: str,
    entity_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=200),
) -> list[AuditLogResponse]:
    """Get audit trail for a specific entity."""
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=log.user_email,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            action=log.action,
            changes=log.changes,
            metadata_=log.metadata_,
            ip_address=log.ip_address,
            notes=log.notes,
            created_at=log.created_at,
        )
        for log in logs
    ]
