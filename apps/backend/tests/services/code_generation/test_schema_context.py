"""Tests for SchemaContextBuilder (Phase B2)."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.services.code_generation.schema_context import (
    SchemaContextBuilder,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_MODEL = '''\
import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from src.db.base import Base


class Widget(Base):
    __tablename__ = "widgets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(nullable=False)
    price: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False)
'''

SAMPLE_ENUM_MODEL = '''\
import enum

class WidgetStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
'''

SAMPLE_ROUTE = '''\
from fastapi import APIRouter, Depends
from src.api.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/widgets", tags=["widgets"])


@router.get("")
async def list_widgets(
    _user = Depends(get_current_user),
) -> dict:
    return {}


@router.post("")
async def create_widget() -> dict:
    return {}
'''


@pytest.fixture
def project_root(tmp_path: Path) -> Path:
    models_dir = tmp_path / "apps/backend/src/db"
    routes_dir = tmp_path / "apps/backend/src/api/routes"
    models_dir.mkdir(parents=True)
    routes_dir.mkdir(parents=True)

    (models_dir / "widget_models.py").write_text(SAMPLE_MODEL)
    (models_dir / "enum_models.py").write_text(SAMPLE_ENUM_MODEL)
    (routes_dir / "widgets.py").write_text(SAMPLE_ROUTE)
    return tmp_path


@pytest.fixture
def builder(project_root: Path) -> SchemaContextBuilder:
    return SchemaContextBuilder(project_root=project_root)


# ---------------------------------------------------------------------------
# Model extraction
# ---------------------------------------------------------------------------


class TestModelExtraction:
    def test_extracts_model_class(self, builder: SchemaContextBuilder) -> None:
        models, _ = builder._extract_models()
        names = [m.class_name for m in models]
        assert "Widget" in names

    def test_extracts_table_name(self, builder: SchemaContextBuilder) -> None:
        models, _ = builder._extract_models()
        widget = next(m for m in models if m.class_name == "Widget")
        assert widget.table_name == "widgets"

    def test_extracts_columns(self, builder: SchemaContextBuilder) -> None:
        models, _ = builder._extract_models()
        widget = next(m for m in models if m.class_name == "Widget")
        col_names = [c.name for c in widget.columns]
        assert "name" in col_names

    def test_detects_primary_key(self, builder: SchemaContextBuilder) -> None:
        models, _ = builder._extract_models()
        widget = next(m for m in models if m.class_name == "Widget")
        id_col = next((c for c in widget.columns if c.name == "id"), None)
        assert id_col is not None
        assert id_col.primary_key is True

    def test_extracts_enums(self, builder: SchemaContextBuilder) -> None:
        _, enums = builder._extract_models()
        assert "WidgetStatus" in enums
        assert "ACTIVE" in enums["WidgetStatus"]


# ---------------------------------------------------------------------------
# Route extraction
# ---------------------------------------------------------------------------


class TestRouteExtraction:
    def test_extracts_route_module(self, builder: SchemaContextBuilder) -> None:
        modules = builder._extract_routes()
        prefixes = [m.prefix for m in modules]
        assert "/api/widgets" in prefixes

    def test_extracts_endpoints(self, builder: SchemaContextBuilder) -> None:
        modules = builder._extract_routes()
        widget_module = next(m for m in modules if m.prefix == "/api/widgets")
        methods = [ep.method for ep in widget_module.endpoints]
        assert "GET" in methods
        assert "POST" in methods

    def test_detects_auth(self, builder: SchemaContextBuilder) -> None:
        modules = builder._extract_routes()
        widget_module = next(m for m in modules if m.prefix == "/api/widgets")
        get_ep = next(ep for ep in widget_module.endpoints if ep.method == "GET")
        assert get_ep.has_auth is True

    def test_detects_missing_auth(self, builder: SchemaContextBuilder) -> None:
        modules = builder._extract_routes()
        widget_module = next(m for m in modules if m.prefix == "/api/widgets")
        post_ep = next(ep for ep in widget_module.endpoints if ep.method == "POST")
        assert post_ep.has_auth is False


# ---------------------------------------------------------------------------
# SchemaContext.summary()
# ---------------------------------------------------------------------------


class TestSchemaContextSummary:
    async def test_summary_contains_model_names(
        self, builder: SchemaContextBuilder
    ) -> None:
        ctx = await builder.build()
        summary = ctx.summary()
        assert "Widget" in summary

    async def test_summary_contains_endpoint_info(
        self, builder: SchemaContextBuilder
    ) -> None:
        ctx = await builder.build()
        summary = ctx.summary()
        assert "GET" in summary or "POST" in summary

    async def test_get_model_helper(self, builder: SchemaContextBuilder) -> None:
        ctx = await builder.build()
        model = ctx.get_model("Widget")
        assert model is not None
        assert model.class_name == "Widget"

    async def test_get_model_returns_none_for_missing(
        self, builder: SchemaContextBuilder
    ) -> None:
        ctx = await builder.build()
        assert ctx.get_model("NonExistent") is None
