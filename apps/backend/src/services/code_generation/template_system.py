"""Pre-defined code templates for common patterns.

Provides fill-in-the-blank templates for the most common generation tasks
so the LLM is given a structural scaffold instead of generating from scratch.
This reduces hallucinations and speeds up generation for standard patterns.

Templates:
- FastAPI CRUD route file
- Async service class
- SQLAlchemy 2.0 model + Pydantic schemas
- React form component (React Hook Form + Zod + shadcn/ui)
- TypeScript API client module
- pytest unit test file
- pytest integration test file
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field


# ============================================================================
# Template registry
# ============================================================================


class TemplateKind(str, Enum):
    FASTAPI_CRUD_ROUTE = "fastapi_crud_route"
    ASYNC_SERVICE = "async_service"
    SQLALCHEMY_MODEL = "sqlalchemy_model"
    REACT_FORM = "react_form"
    TS_API_CLIENT = "ts_api_client"
    PYTEST_UNIT = "pytest_unit"
    PYTEST_INTEGRATION = "pytest_integration"


class TemplateVars(BaseModel):
    """Variables injected into a template."""

    # Required for all templates
    feature_name: str = Field(description="snake_case feature name, e.g. supplier_contacts")

    # Derived automatically if not provided
    class_name: str = Field(default="", description="PascalCase, e.g. SupplierContacts")
    route_prefix: str = Field(default="", description="/api/supplier-contacts")
    service_import: str = Field(default="", description="Import path for service class")
    model_import: str = Field(default="", description="Import path for SQLAlchemy model")

    # Optional
    extra_columns: list[str] = Field(
        default_factory=list,
        description="Additional column names beyond id/created_at/updated_at",
    )
    parent_model: str | None = Field(
        default=None,
        description="Parent model name for FK relationships",
    )
    description: str = Field(default="", description="Feature description for docstrings")

    def model_post_init(self, __context: object) -> None:
        if not self.class_name:
            self.class_name = "".join(w.capitalize() for w in self.feature_name.split("_"))
        if not self.route_prefix:
            self.route_prefix = "/api/" + self.feature_name.replace("_", "-")
        if not self.service_import:
            self.service_import = f"src.services.{self.feature_name}_service"
        if not self.model_import:
            self.model_import = f"src.db.{self.feature_name}_models"


class RenderedTemplate(BaseModel):
    """The output of rendering a template."""

    kind: TemplateKind
    content: str
    file_path: str
    language: str


# ============================================================================
# Template engine
# ============================================================================


@dataclass
class TemplateSystem:
    """Renders code templates with variable substitution.

    Usage:
        ts = TemplateSystem()
        rendered = ts.render(
            kind=TemplateKind.FASTAPI_CRUD_ROUTE,
            vars=TemplateVars(feature_name="supplier_contacts"),
        )
        Path(rendered.file_path).write_text(rendered.content)
    """

    def render(self, kind: TemplateKind, vars: TemplateVars) -> RenderedTemplate:
        """Render a template with the given variables."""
        template_fn = {
            TemplateKind.FASTAPI_CRUD_ROUTE: self._fastapi_crud_route,
            TemplateKind.ASYNC_SERVICE: self._async_service,
            TemplateKind.SQLALCHEMY_MODEL: self._sqlalchemy_model,
            TemplateKind.REACT_FORM: self._react_form,
            TemplateKind.TS_API_CLIENT: self._ts_api_client,
            TemplateKind.PYTEST_UNIT: self._pytest_unit,
            TemplateKind.PYTEST_INTEGRATION: self._pytest_integration,
        }
        content, file_path, language = template_fn[kind](vars)
        return RenderedTemplate(
            kind=kind, content=content, file_path=file_path, language=language
        )

    def render_all(self, vars: TemplateVars) -> list[RenderedTemplate]:
        """Render all standard templates for a feature."""
        return [self.render(kind, vars) for kind in TemplateKind]

    # ========================================================================
    # Individual templates
    # ========================================================================

    def _fastapi_crud_route(self, v: TemplateVars) -> tuple[str, str, str]:
        n = v.feature_name
        cls = v.class_name
        prefix = v.route_prefix
        svc_import = v.service_import
        model_import = v.model_import

        content = f'''\
"""FastAPI CRUD routes for {n}.

{v.description or f"Provides list, get, create, update, and delete endpoints for {n}."}
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies.auth import get_current_user
from src.config.database import get_async_db
from {model_import} import {cls}, {cls}Create, {cls}Update, {cls}Response, Paginated{cls}Response
from {svc_import} import {cls}Service

router = APIRouter(prefix="{prefix}", tags=["{cls}"])


@router.get("", response_model=Paginated{cls}Response)
async def list_{n}(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    _current_user: Annotated[dict, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
) -> Paginated{cls}Response:
    """List {n} with pagination and optional search."""
    service = {cls}Service(db)
    return await service.list(page=page, page_size=page_size, search=search)


@router.get("/{{item_id}}", response_model={cls}Response)
async def get_{n}(
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> {cls}Response:
    """Get a single {n.replace("_", " ")} by ID."""
    service = {cls}Service(db)
    item = await service.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="{cls} not found")
    return item


@router.post("", response_model={cls}Response, status_code=status.HTTP_201_CREATED)
async def create_{n}(
    data: {cls}Create,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> {cls}Response:
    """Create a new {n.replace("_", " ")}."""
    service = {cls}Service(db)
    return await service.create(data)


@router.put("/{{item_id}}", response_model={cls}Response)
async def update_{n}(
    item_id: UUID,
    data: {cls}Update,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> {cls}Response:
    """Update an existing {n.replace("_", " ")}."""
    service = {cls}Service(db)
    item = await service.update(item_id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="{cls} not found")
    return item


@router.delete("/{{item_id}}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_{n}(
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> None:
    """Delete a {n.replace("_", " ")}."""
    service = {cls}Service(db)
    deleted = await service.delete(item_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="{cls} not found")
'''
        path = f"apps/backend/src/api/routes/{n}.py"
        return content, path, "python"

    def _async_service(self, v: TemplateVars) -> tuple[str, str, str]:
        n = v.feature_name
        cls = v.class_name
        model_import = v.model_import

        content = f'''\
"""Service layer for {n}."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from {model_import} import {cls}, {cls}Create, {cls}Update, {cls}Response, Paginated{cls}Response


class {cls}Service:
    """Business logic for {n}."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        page: int = 1,
        page_size: int = 50,
        search: str | None = None,
    ) -> Paginated{cls}Response:
        """List {n} with pagination."""
        query = select({cls})

        if search:
            query = query.where(
                or_(
                    {cls}.name.ilike(f"%{{search}}%"),
                )
            )

        count_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar() or 0

        query = query.order_by({cls}.created_at.desc()).limit(page_size).offset(
            (page - 1) * page_size
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return Paginated{cls}Response(
            data=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    async def get_by_id(self, item_id: UUID) -> {cls} | None:
        """Get a single {n.replace("_", " ")} by ID."""
        result = await self.db.execute(
            select({cls}).where({cls}.id == item_id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: {cls}Create) -> {cls}:
        """Create a new {n.replace("_", " ")}."""
        item = {cls}(**data.model_dump())
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def update(self, item_id: UUID, data: {cls}Update) -> {cls} | None:
        """Update an existing {n.replace("_", " ")}."""
        item = await self.get_by_id(item_id)
        if not item:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete(self, item_id: UUID) -> bool:
        """Delete a {n.replace("_", " ")}. Returns True if deleted, False if not found."""
        item = await self.get_by_id(item_id)
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True
'''
        path = f"apps/backend/src/services/{n}_service.py"
        return content, path, "python"

    def _sqlalchemy_model(self, v: TemplateVars) -> tuple[str, str, str]:
        n = v.feature_name
        cls = v.class_name
        extra_cols = "\n    ".join(
            f'{col}: Mapped[str | None] = mapped_column(Text, nullable=True)'
            for col in v.extra_columns
        )

        content = f'''\
"""SQLAlchemy models and Pydantic schemas for {n}."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class {cls}(Base):
    """SQLAlchemy model for {n}."""

    __tablename__ = "{n}s"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    {extra_cols}
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class {cls}Base(BaseModel):
    """Shared fields for {cls} schemas."""

    name: str


class {cls}Create({cls}Base):
    """Schema for creating a {cls}."""

    pass


class {cls}Update(BaseModel):
    """Schema for updating a {cls} (all fields optional)."""

    name: str | None = None


class {cls}Response({cls}Base):
    """Schema for {cls} API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class Paginated{cls}Response(BaseModel):
    """Paginated list response for {cls}."""

    data: list[{cls}Response]
    total: int
    page: int
    page_size: int
    total_pages: int
'''
        path = f"apps/backend/src/db/{n}_models.py"
        return content, path, "python"

    def _react_form(self, v: TemplateVars) -> tuple[str, str, str]:
        n = v.feature_name
        cls = v.class_name
        ts_name = n  # kebab for API, camelCase for TS functions

        content = f'''\
"use client";

import {{ useState }} from "react";
import {{ useRouter }} from "next/navigation";
import {{ zodResolver }} from "@hookform/resolvers/zod";
import {{ useForm }} from "react-hook-form";
import * as z from "zod";
import {{ Button }} from "@/components/ui/button";
import {{
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
}} from "@/components/ui/form";
import {{ Input }} from "@/components/ui/input";
import {{ useToast }} from "@/hooks/use-toast";
import {{ create{cls}, update{cls} }} from "@/lib/api/{n}";
import type {{ {cls}Response }} from "@/lib/api/{n}";

const formSchema = z.object({{
  name: z.string().min(1, "Name is required"),
}});

type FormData = z.infer<typeof formSchema>;

interface {cls}FormProps {{
  mode: "create" | "edit";
  initialData?: {cls}Response;
  onSuccess?: () => void;
}}

export function {cls}Form({{ mode, initialData, onSuccess }}: {cls}FormProps) {{
  const router = useRouter();
  const {{ toast }} = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({{
    resolver: zodResolver(formSchema),
    defaultValues: {{
      name: initialData?.name ?? "",
    }},
  }});

  async function onSubmit(values: FormData): Promise<void> {{
    setIsLoading(true);
    try {{
      if (mode === "create") {{
        await create{cls}(values);
        toast({{ title: "Created", description: "{cls} created successfully." }});
      }} else if (initialData) {{
        await update{cls}(initialData.id, values);
        toast({{ title: "Updated", description: "{cls} updated successfully." }});
      }}
      onSuccess?.();
      router.refresh();
    }} catch (error: unknown) {{
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({{ title: "Error", description: message, variant: "destructive" }});
    }} finally {{
      setIsLoading(false);
    }}
  }}

  return (
    <Form {{...form}}>
      <form onSubmit={{form.handleSubmit(onSubmit)}} className="space-y-4">
        <FormField
          control={{form.control}}
          name="name"
          render={{({{ field }}) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter name" {{...field}} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}}
        />
        <Button type="submit" disabled={{isLoading}}>
          {{isLoading ? "Saving..." : mode === "create" ? "Create" : "Update"}}
        </Button>
      </form>
    </Form>
  );
}}
'''
        path = f"apps/web/app/(dashboard)/{n}/components/{cls}Form.tsx"
        return content, path, "typescript"

    def _ts_api_client(self, v: TemplateVars) -> tuple[str, str, str]:
        n = v.feature_name
        cls = v.class_name
        prefix = v.route_prefix

        content = f'''\
import {{ apiClient }} from "@/lib/api/client";

export interface {cls}Response {{
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}}

export interface {cls}Create {{
  name: string;
}}

export interface {cls}Update {{
  name?: string;
}}

export interface Paginated{cls}Response {{
  data: {cls}Response[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}}

export async function list{cls}(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<Paginated{cls}Response> {{
  const params = new URLSearchParams({{
    page: String(page),
    page_size: String(pageSize),
    ...(search ? {{ search }} : {{}}),
  }});
  return apiClient.get<Paginated{cls}Response>(`{prefix}?${{params}}`);
}}

export async function get{cls}ById(id: string): Promise<{cls}Response> {{
  return apiClient.get<{cls}Response>(`{prefix}/${{id}}`);
}}

export async function create{cls}(data: {cls}Create): Promise<{cls}Response> {{
  return apiClient.post<{cls}Response>("{prefix}", data);
}}

export async function update{cls}(
  id: string,
  data: {cls}Update
): Promise<{cls}Response> {{
  return apiClient.put<{cls}Response>(`{prefix}/${{id}}`, data);
}}

export async function delete{cls}(id: string): Promise<void> {{
  return apiClient.delete(`{prefix}/${{id}}`);
}}
'''
        path = f"apps/web/lib/api/{n}.ts"
        return content, path, "typescript"

    def _pytest_unit(self, v: TemplateVars) -> tuple[str, str, str]:
        n = v.feature_name
        cls = v.class_name

        content = f'''\
"""Unit tests for {cls}Service."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.{n}_models import {cls}, {cls}Create, {cls}Update
from src.services.{n}_service import {cls}Service


@pytest.fixture
def mock_db() -> AsyncMock:
    """Mock async SQLAlchemy session."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


@pytest.fixture
def service(mock_db: AsyncMock) -> {cls}Service:
    return {cls}Service(mock_db)


@pytest.fixture
def sample_{n}() -> {cls}:
    return {cls}(id=uuid4(), name="Test Item")


class TestList:
    async def test_returns_paginated_response(
        self, service: {cls}Service, mock_db: AsyncMock, sample_{n}: {cls}
    ) -> None:
        mock_db.execute.side_effect = [
            MagicMock(scalar=MagicMock(return_value=1)),   # count
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[sample_{n}])))),
        ]
        result = await service.list()
        assert result.total == 1
        assert len(result.data) == 1


class TestGetById:
    async def test_returns_item_when_found(
        self, service: {cls}Service, mock_db: AsyncMock, sample_{n}: {cls}
    ) -> None:
        mock_db.execute.return_value = MagicMock(
            scalar_one_or_none=MagicMock(return_value=sample_{n})
        )
        result = await service.get_by_id(sample_{n}.id)
        assert result is sample_{n}

    async def test_returns_none_when_not_found(
        self, service: {cls}Service, mock_db: AsyncMock
    ) -> None:
        mock_db.execute.return_value = MagicMock(
            scalar_one_or_none=MagicMock(return_value=None)
        )
        result = await service.get_by_id(uuid4())
        assert result is None


class TestCreate:
    async def test_creates_and_returns_item(
        self, service: {cls}Service, mock_db: AsyncMock, sample_{n}: {cls}
    ) -> None:
        mock_db.refresh.side_effect = lambda item: setattr(item, "id", sample_{n}.id)
        data = {cls}Create(name="New Item")
        result = await service.create(data)
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()


class TestUpdate:
    async def test_updates_existing_item(
        self, service: {cls}Service, mock_db: AsyncMock, sample_{n}: {cls}
    ) -> None:
        mock_db.execute.return_value = MagicMock(
            scalar_one_or_none=MagicMock(return_value=sample_{n})
        )
        result = await service.update(sample_{n}.id, {cls}Update(name="Updated"))
        mock_db.commit.assert_called_once()

    async def test_returns_none_for_missing_item(
        self, service: {cls}Service, mock_db: AsyncMock
    ) -> None:
        mock_db.execute.return_value = MagicMock(
            scalar_one_or_none=MagicMock(return_value=None)
        )
        result = await service.update(uuid4(), {cls}Update(name="x"))
        assert result is None


class TestDelete:
    async def test_returns_true_on_success(
        self, service: {cls}Service, mock_db: AsyncMock, sample_{n}: {cls}
    ) -> None:
        mock_db.execute.return_value = MagicMock(
            scalar_one_or_none=MagicMock(return_value=sample_{n})
        )
        result = await service.delete(sample_{n}.id)
        assert result is True
        mock_db.delete.assert_called_once_with(sample_{n})

    async def test_returns_false_when_not_found(
        self, service: {cls}Service, mock_db: AsyncMock
    ) -> None:
        mock_db.execute.return_value = MagicMock(
            scalar_one_or_none=MagicMock(return_value=None)
        )
        result = await service.delete(uuid4())
        assert result is False
'''
        path = f"apps/backend/tests/unit/test_{n}_service.py"
        return content, path, "python"

    def _pytest_integration(self, v: TemplateVars) -> tuple[str, str, str]:
        n = v.feature_name
        cls = v.class_name
        prefix = v.route_prefix

        content = f'''\
"""Integration tests for {prefix} endpoints."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient


VALID_ITEM = {{"name": "Test {cls}"}}


class TestList{cls}:
    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get("{prefix}")
        assert resp.status_code == 401

    def test_returns_list(self, authenticated_client: TestClient) -> None:
        resp = authenticated_client.get("{prefix}")
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data


class TestGet{cls}:
    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get(f"{prefix}/{{uuid4()}}")
        assert resp.status_code == 401

    def test_returns_404_for_unknown_id(self, authenticated_client: TestClient) -> None:
        resp = authenticated_client.get(f"{prefix}/{{uuid4()}}")
        assert resp.status_code == 404


class TestCreate{cls}:
    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.post("{prefix}", json=VALID_ITEM)
        assert resp.status_code == 401

    def test_creates_item(self, authenticated_client: TestClient) -> None:
        resp = authenticated_client.post("{prefix}", json=VALID_ITEM)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == VALID_ITEM["name"]
        assert "id" in data

    def test_rejects_missing_name(self, authenticated_client: TestClient) -> None:
        resp = authenticated_client.post("{prefix}", json={{}})
        assert resp.status_code == 422


class TestUpdate{cls}:
    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.put(f"{prefix}/{{uuid4()}}", json=VALID_ITEM)
        assert resp.status_code == 401

    def test_returns_404_for_unknown_id(self, authenticated_client: TestClient) -> None:
        resp = authenticated_client.put(
            f"{prefix}/{{uuid4()}}", json={{"name": "Updated"}}
        )
        assert resp.status_code == 404


class TestDelete{cls}:
    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.delete(f"{prefix}/{{uuid4()}}")
        assert resp.status_code == 401

    def test_returns_404_for_unknown_id(self, authenticated_client: TestClient) -> None:
        resp = authenticated_client.delete(f"{prefix}/{{uuid4()}}")
        assert resp.status_code == 404
'''
        path = f"apps/backend/tests/integration/test_{n}_routes.py"
        return content, path, "python"
