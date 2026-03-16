"""Workshop service templates API routes."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workshop_models import ServiceTemplate, ServiceTemplateItem

router = APIRouter(prefix="/api/workshop/templates", tags=["Workshop"])


class TemplateItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1, default=1)
    lead_time_days: int = Field(ge=0, default=14)
    notes: str | None = None


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    service_type: str = Field(min_length=1, max_length=50)
    applies_to_make: str | None = None
    applies_to_model: str | None = None
    description: str = ""
    estimated_hours: float = Field(ge=0.0, default=1.0)
    location: str | None = None
    items: list[TemplateItemCreate] = []


class TemplateUpdate(BaseModel):
    name: str | None = None
    service_type: str | None = None
    applies_to_make: str | None = None
    applies_to_model: str | None = None
    description: str | None = None
    estimated_hours: float | None = None
    location: str | None = None
    items: list[TemplateItemCreate] | None = None


class TemplateItemResponse(BaseModel):
    id: UUID
    template_id: UUID
    product_id: UUID
    quantity: int
    lead_time_days: int
    notes: str | None
    model_config = {"from_attributes": True}


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    service_type: str
    applies_to_make: str | None
    applies_to_model: str | None
    description: str
    estimated_hours: float
    location: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: list[TemplateItemResponse] = []
    model_config = {"from_attributes": True}


class PaginatedTemplatesResponse(BaseModel):
    items: list[TemplateResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("")
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    make: str | None = None,
    service_type: str | None = None,
    is_active: bool | None = None,
) -> PaginatedTemplatesResponse:
    """List service templates."""
    stmt = select(ServiceTemplate)
    if make:
        stmt = stmt.where(ServiceTemplate.applies_to_make == make)
    if service_type:
        stmt = stmt.where(ServiceTemplate.service_type == service_type)
    if is_active is not None:
        stmt = stmt.where(ServiceTemplate.is_active == is_active)

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    stmt = stmt.order_by(ServiceTemplate.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    templates = result.scalars().all()

    return PaginatedTemplatesResponse(
        items=[TemplateResponse.model_validate(t) for t in templates],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{template_id}")
async def get_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TemplateResponse:
    """Get template with parts list."""
    template = await db.get(ServiceTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Service template not found")
    return TemplateResponse.model_validate(template)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TemplateResponse:
    """Create a service template with parts."""
    items_data = payload.model_dump(exclude={"items"})
    template = ServiceTemplate(**items_data)
    db.add(template)
    await db.flush()

    for item_data in payload.items:
        item = ServiceTemplateItem(template_id=template.id, **item_data.model_dump())
        db.add(item)

    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


@router.put("/{template_id}")
async def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TemplateResponse:
    """Update template and replace parts list."""
    template = await db.get(ServiceTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Service template not found")

    update_data = payload.model_dump(exclude_none=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(template, field, value)
    template.updated_at = datetime.now(UTC)

    if payload.items is not None:
        # Replace parts list
        existing_items = await db.execute(
            select(ServiceTemplateItem).where(ServiceTemplateItem.template_id == template_id)
        )
        for item in existing_items.scalars().all():
            await db.delete(item)
        await db.flush()
        for item_data in payload.items:
            item = ServiceTemplateItem(template_id=template_id, **item_data.model_dump())
            db.add(item)

    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Deactivate a service template."""
    template = await db.get(ServiceTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Service template not found")
    template.is_active = False
    template.updated_at = datetime.now(UTC)
    await db.commit()
