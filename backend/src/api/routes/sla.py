"""
SLA (Service Level Agreement) API endpoints.

CRUD for SLARule and read access to SLAInstance.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workflow_models import SLAInstance, SLARule

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/sla", tags=["SLA"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class SLARuleCreate(BaseModel):
    """Request to create an SLA rule."""

    name: str
    entity_type: str
    sla_hours: int
    escalation_action: str
    escalation_config: dict | None = None
    is_active: bool = True


class SLARuleUpdate(BaseModel):
    """Request to update an SLA rule (all fields optional)."""

    name: str | None = None
    entity_type: str | None = None
    sla_hours: int | None = None
    escalation_action: str | None = None
    escalation_config: dict | None = None
    is_active: bool | None = None


class SLARuleResponse(BaseModel):
    """Response schema for an SLA rule."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    entity_type: str
    sla_hours: int
    escalation_action: str
    escalation_config: dict | None
    is_active: bool
    created_at: str

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: object) -> str:
        return str(v)

    @field_validator("created_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v: object) -> str:
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)


class SLAInstanceResponse(BaseModel):
    """Response schema for an SLA instance."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    sla_rule_id: str
    entity_id: str
    entity_type: str
    deadline: str
    breached: bool
    breach_notified: bool
    created_at: str

    @field_validator("id", "sla_rule_id", "entity_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: object) -> str:
        return str(v)

    @field_validator("deadline", "created_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v: object) -> str:
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _get_rule(rule_id: UUID, db: AsyncSession) -> SLARule:
    """Fetch SLARule by PK; raise 404 if missing."""
    result = await db.execute(select(SLARule).where(SLARule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SLARule {rule_id} not found",
        )
    return rule


# ---------------------------------------------------------------------------
# Endpoints — Rules
# ---------------------------------------------------------------------------


@router.get("/rules", response_model=list[SLARuleResponse])
async def list_sla_rules(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[SLARuleResponse]:
    """List all SLA rules ordered by creation date (newest first)."""
    result = await db.execute(select(SLARule).order_by(SLARule.created_at.desc()))
    rules = result.scalars().all()

    logger.info("sla_rules_listed", count=len(rules))
    return [SLARuleResponse.model_validate(r) for r in rules]


@router.post("/rules", response_model=SLARuleResponse, status_code=status.HTTP_201_CREATED)
async def create_sla_rule(
    request: SLARuleCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SLARuleResponse:
    """Create a new SLA rule."""
    rule = SLARule(
        name=request.name,
        entity_type=request.entity_type,
        sla_hours=request.sla_hours,
        escalation_action=request.escalation_action,
        escalation_config=request.escalation_config,
        is_active=request.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    logger.info(
        "sla_rule_created",
        rule_id=str(rule.id),
        entity_type=request.entity_type,
        sla_hours=request.sla_hours,
    )
    return SLARuleResponse.model_validate(rule)


@router.put("/rules/{rule_id}", response_model=SLARuleResponse)
async def update_sla_rule(
    rule_id: UUID,
    request: SLARuleUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SLARuleResponse:
    """Update an existing SLA rule."""
    rule = await _get_rule(rule_id, db)

    if request.name is not None:
        rule.name = request.name
    if request.entity_type is not None:
        rule.entity_type = request.entity_type
    if request.sla_hours is not None:
        rule.sla_hours = request.sla_hours
    if request.escalation_action is not None:
        rule.escalation_action = request.escalation_action
    if request.escalation_config is not None:
        rule.escalation_config = request.escalation_config
    if request.is_active is not None:
        rule.is_active = request.is_active

    await db.commit()
    await db.refresh(rule)

    logger.info("sla_rule_updated", rule_id=str(rule_id))
    return SLARuleResponse.model_validate(rule)


# ---------------------------------------------------------------------------
# Endpoints — Instances
# ---------------------------------------------------------------------------


@router.get("/instances", response_model=list[SLAInstanceResponse])
async def list_sla_instances(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    entity_type: str | None = Query(None, description="Filter by entity type (e.g. order, quote)"),
    breached: bool | None = Query(None, description="Filter by breached status"),
) -> list[SLAInstanceResponse]:
    """List SLA instances with optional filtering by entity_type or breached status."""
    query = select(SLAInstance).order_by(SLAInstance.created_at.desc())

    if entity_type is not None:
        query = query.where(SLAInstance.entity_type == entity_type)
    if breached is not None:
        query = query.where(SLAInstance.breached == breached)

    result = await db.execute(query)
    instances = result.scalars().all()

    logger.info("sla_instances_listed", count=len(instances))
    return [SLAInstanceResponse.model_validate(i) for i in instances]


@router.get("/instances/{entity_id}", response_model=list[SLAInstanceResponse])
async def get_sla_instances_for_entity(
    entity_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[SLAInstanceResponse]:
    """Get all SLA instances for a specific entity ID."""
    result = await db.execute(
        select(SLAInstance)
        .where(SLAInstance.entity_id == entity_id)
        .order_by(SLAInstance.created_at.desc())
    )
    instances = result.scalars().all()

    logger.info("sla_instances_for_entity", entity_id=str(entity_id), count=len(instances))
    return [SLAInstanceResponse.model_validate(i) for i in instances]
