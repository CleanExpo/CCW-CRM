"""Tests for TemplateSystem (Phase B2)."""

from __future__ import annotations

import ast

import pytest

from src.services.code_generation.template_system import (
    RenderedTemplate,
    TemplateKind,
    TemplateSystem,
    TemplateVars,
)


@pytest.fixture
def ts() -> TemplateSystem:
    return TemplateSystem()


@pytest.fixture
def vars_simple() -> TemplateVars:
    return TemplateVars(feature_name="test_widget")


@pytest.fixture
def vars_with_extras() -> TemplateVars:
    return TemplateVars(
        feature_name="supplier_contact",
        extra_columns=["email", "phone"],
        description="Supplier contact person management",
    )


# ---------------------------------------------------------------------------
# TemplateVars derived fields
# ---------------------------------------------------------------------------


class TestTemplateVars:
    def test_derives_class_name(self, vars_simple: TemplateVars) -> None:
        assert vars_simple.class_name == "TestWidget"

    def test_derives_route_prefix(self, vars_simple: TemplateVars) -> None:
        assert vars_simple.route_prefix == "/api/test-widget"

    def test_derives_service_import(self, vars_simple: TemplateVars) -> None:
        assert "test_widget_service" in vars_simple.service_import

    def test_derives_model_import(self, vars_simple: TemplateVars) -> None:
        assert "test_widget_models" in vars_simple.model_import

    def test_multi_word_class_name(self) -> None:
        v = TemplateVars(feature_name="purchase_order_item")
        assert v.class_name == "PurchaseOrderItem"


# ---------------------------------------------------------------------------
# Route template
# ---------------------------------------------------------------------------


class TestFastapiCrudRoute:
    def test_renders_without_error(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.FASTAPI_CRUD_ROUTE, vars_simple)
        assert rendered.language == "python"
        assert rendered.content

    def test_contains_all_http_verbs(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.FASTAPI_CRUD_ROUTE, vars_simple)
        for method in ("@router.get", "@router.post", "@router.put", "@router.delete"):
            assert method in rendered.content

    def test_all_routes_have_auth_dep(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.FASTAPI_CRUD_ROUTE, vars_simple)
        assert "get_current_user" in rendered.content

    def test_valid_python_syntax(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.FASTAPI_CRUD_ROUTE, vars_simple)
        ast.parse(rendered.content)  # raises SyntaxError if invalid

    def test_correct_file_path(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.FASTAPI_CRUD_ROUTE, vars_simple)
        assert "test_widget.py" in rendered.file_path


# ---------------------------------------------------------------------------
# Service template
# ---------------------------------------------------------------------------


class TestAsyncService:
    def test_renders_service_class(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.ASYNC_SERVICE, vars_simple)
        assert "class TestWidgetService" in rendered.content

    def test_has_crud_methods(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.ASYNC_SERVICE, vars_simple)
        for method in ("async def list", "async def get_by_id", "async def create",
                       "async def update", "async def delete"):
            assert method in rendered.content

    def test_valid_python_syntax(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.ASYNC_SERVICE, vars_simple)
        ast.parse(rendered.content)


# ---------------------------------------------------------------------------
# Model template
# ---------------------------------------------------------------------------


class TestSQLAlchemyModel:
    def test_has_base_columns(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.SQLALCHEMY_MODEL, vars_simple)
        for col in ("id", "name", "created_at", "updated_at"):
            assert col in rendered.content

    def test_includes_extra_columns(
        self, ts: TemplateSystem, vars_with_extras: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.SQLALCHEMY_MODEL, vars_with_extras)
        assert "email" in rendered.content
        assert "phone" in rendered.content

    def test_valid_python_syntax(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.SQLALCHEMY_MODEL, vars_simple)
        ast.parse(rendered.content)

    def test_has_pydantic_schemas(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.SQLALCHEMY_MODEL, vars_simple)
        assert "TestWidgetCreate" in rendered.content
        assert "TestWidgetUpdate" in rendered.content
        assert "TestWidgetResponse" in rendered.content


# ---------------------------------------------------------------------------
# React form template
# ---------------------------------------------------------------------------


class TestReactForm:
    def test_renders_as_typescript(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.REACT_FORM, vars_simple)
        assert rendered.language == "typescript"

    def test_uses_react_hook_form(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.REACT_FORM, vars_simple)
        assert "useForm" in rendered.content

    def test_uses_zod_validation(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.REACT_FORM, vars_simple)
        assert "z.object" in rendered.content

    def test_has_loading_state(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.REACT_FORM, vars_simple)
        assert "isLoading" in rendered.content

    def test_supports_create_and_edit_modes(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.REACT_FORM, vars_simple)
        assert '"create"' in rendered.content
        assert '"edit"' in rendered.content


# ---------------------------------------------------------------------------
# TypeScript API client template
# ---------------------------------------------------------------------------


class TestTsApiClient:
    def test_exports_all_crud_functions(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.TS_API_CLIENT, vars_simple)
        for fn in ("listTestWidget", "getTestWidgetById", "createTestWidget",
                   "updateTestWidget", "deleteTestWidget"):
            assert fn in rendered.content

    def test_exports_interfaces(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.TS_API_CLIENT, vars_simple)
        assert "TestWidgetResponse" in rendered.content
        assert "TestWidgetCreate" in rendered.content


# ---------------------------------------------------------------------------
# Pytest unit template
# ---------------------------------------------------------------------------


class TestPytestUnit:
    def test_has_test_classes_for_all_crud(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.PYTEST_UNIT, vars_simple)
        for cls in ("TestList", "TestGetById", "TestCreate", "TestUpdate", "TestDelete"):
            assert cls in rendered.content

    def test_valid_python_syntax(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        rendered = ts.render(TemplateKind.PYTEST_UNIT, vars_simple)
        ast.parse(rendered.content)


# ---------------------------------------------------------------------------
# render_all
# ---------------------------------------------------------------------------


class TestRenderAll:
    def test_renders_all_template_kinds(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        results = ts.render_all(vars_simple)
        kinds = {r.kind for r in results}
        assert kinds == set(TemplateKind)

    def test_no_duplicate_file_paths(
        self, ts: TemplateSystem, vars_simple: TemplateVars
    ) -> None:
        results = ts.render_all(vars_simple)
        paths = [r.file_path for r in results]
        assert len(paths) == len(set(paths))
