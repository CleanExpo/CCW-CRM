"""
Workflow automation API endpoints.

CRUD for WorkflowTemplate (with actions) and read-only access to WorkflowInstance.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workflow_models import WorkflowInstance, WorkflowTemplate, WorkflowTemplateAction

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/workflows", tags=["Workflows"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class WorkflowTemplateCreate(BaseModel):
    """Request to create a workflow template."""

    name: str
    description: str | None = None
    trigger_event: str
    trigger_conditions: dict | None = None
    is_active: bool = True


class WorkflowTemplateUpdate(BaseModel):
    """Request to update a workflow template (all fields optional)."""

    name: str | None = None
    description: str | None = None
    trigger_event: str | None = None
    trigger_conditions: dict | None = None
    is_active: bool | None = None


class WorkflowTemplateActionResponse(BaseModel):
    """Response schema for a workflow template action."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    template_id: str
    action_type: str
    action_config: dict | None
    order: int
    created_at: str

    @field_validator("id", "template_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: object) -> str:
        return str(v)

    @field_validator("created_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v: object) -> str:
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)


class WorkflowTemplateResponse(BaseModel):
    """Response schema for a workflow template."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    trigger_event: str
    trigger_conditions: dict | None
    is_active: bool
    created_at: str
    updated_at: str
    actions: list[WorkflowTemplateActionResponse] = []

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: object) -> str:
        return str(v)

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v: object) -> str:
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)


class WorkflowInstanceResponse(BaseModel):
    """Response schema for a workflow instance."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    template_id: str | None
    trigger_entity_type: str
    trigger_entity_id: str | None
    status: str
    started_at: str
    completed_at: str | None
    error_message: str | None

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v: object) -> str:
        return str(v)

    @field_validator("template_id", "trigger_entity_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v: object) -> str | None:
        if v is None:
            return None
        return str(v)

    @field_validator("started_at", mode="before")
    @classmethod
    def coerce_started_at(cls, v: object) -> str:
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)

    @field_validator("completed_at", mode="before")
    @classmethod
    def coerce_completed_at(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _get_template_with_actions(
    template_id: UUID,
    db: AsyncSession,
) -> WorkflowTemplate:
    """Fetch a template by PK; raise 404 if missing."""
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"WorkflowTemplate {template_id} not found",
        )
    return template


async def _build_template_response(
    template: WorkflowTemplate, db: AsyncSession
) -> WorkflowTemplateResponse:
    """Build a WorkflowTemplateResponse with actions eagerly loaded."""
    actions_result = await db.execute(
        select(WorkflowTemplateAction)
        .where(WorkflowTemplateAction.template_id == template.id)
        .order_by(WorkflowTemplateAction.order)
    )
    actions = actions_result.scalars().all()
    action_responses = [WorkflowTemplateActionResponse.model_validate(a) for a in actions]

    response = WorkflowTemplateResponse.model_validate(template)
    response.actions = action_responses
    return response


# ---------------------------------------------------------------------------
# Endpoints — Templates
# ---------------------------------------------------------------------------


@router.get("/templates", response_model=list[WorkflowTemplateResponse])
async def list_workflow_templates(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[WorkflowTemplateResponse]:
    """List all workflow templates ordered by creation date (newest first)."""
    result = await db.execute(
        select(WorkflowTemplate).order_by(WorkflowTemplate.created_at.desc())
    )
    templates = result.scalars().all()

    responses = []
    for template in templates:
        responses.append(await _build_template_response(template, db))

    logger.info("workflow_templates_listed", count=len(responses))
    return responses


@router.post(
    "/templates",
    response_model=WorkflowTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_workflow_template(
    request: WorkflowTemplateCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> WorkflowTemplateResponse:
    """Create a new workflow template."""
    template = WorkflowTemplate(
        name=request.name,
        description=request.description,
        trigger_event=request.trigger_event,
        trigger_conditions=request.trigger_conditions,
        is_active=request.is_active,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    logger.info(
        "workflow_template_created",
        template_id=str(template.id),
        trigger_event=request.trigger_event,
    )
    return await _build_template_response(template, db)


@router.get("/templates/{template_id}", response_model=WorkflowTemplateResponse)
async def get_workflow_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> WorkflowTemplateResponse:
    """Get a single workflow template with its actions."""
    template = await _get_template_with_actions(template_id, db)
    return await _build_template_response(template, db)


@router.put("/templates/{template_id}", response_model=WorkflowTemplateResponse)
async def update_workflow_template(
    template_id: UUID,
    request: WorkflowTemplateUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> WorkflowTemplateResponse:
    """Update an existing workflow template."""
    template = await _get_template_with_actions(template_id, db)

    if request.name is not None:
        template.name = request.name
    if request.description is not None:
        template.description = request.description
    if request.trigger_event is not None:
        template.trigger_event = request.trigger_event
    if request.trigger_conditions is not None:
        template.trigger_conditions = request.trigger_conditions
    if request.is_active is not None:
        template.is_active = request.is_active

    template.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(template)

    logger.info("workflow_template_updated", template_id=str(template_id))
    return await _build_template_response(template, db)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_workflow_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Delete a workflow template (cascade deletes actions)."""
    template = await _get_template_with_actions(template_id, db)
    await db.delete(template)
    await db.commit()

    logger.info("workflow_template_deleted", template_id=str(template_id))


# ---------------------------------------------------------------------------
# Endpoints — Instances
# ---------------------------------------------------------------------------


@router.get("/instances", response_model=list[WorkflowInstanceResponse])
async def list_workflow_instances(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    template_id: UUID | None = Query(None, description="Filter by template ID"),
    instance_status: str | None = Query(None, alias="status", description="Filter by status: running, completed, failed"),
) -> list[WorkflowInstanceResponse]:
    """List workflow instances with optional filtering by template_id or status."""
    query = select(WorkflowInstance).order_by(WorkflowInstance.started_at.desc())

    if template_id is not None:
        query = query.where(WorkflowInstance.template_id == template_id)
    if instance_status is not None:
        query = query.where(WorkflowInstance.status == instance_status)

    result = await db.execute(query)
    instances = result.scalars().all()

    logger.info("workflow_instances_listed", count=len(instances))
    return [WorkflowInstanceResponse.model_validate(i) for i in instances]


@router.get("/instances/{instance_id}", response_model=WorkflowInstanceResponse)
async def get_workflow_instance(
    instance_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> WorkflowInstanceResponse:
    """Get a single workflow instance by ID."""
    result = await db.execute(
        select(WorkflowInstance).where(WorkflowInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"WorkflowInstance {instance_id} not found",
        )

    logger.info("workflow_instance_retrieved", instance_id=str(instance_id))
    return WorkflowInstanceResponse.model_validate(instance)
