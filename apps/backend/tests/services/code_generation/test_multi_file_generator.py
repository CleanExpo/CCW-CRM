"""Tests for MultiFileGenerator (Phase B2)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.code_generation.multi_file_generator import (
    FeatureFile,
    FeatureRequest,
    FeatureResult,
    MultiFileGenerator,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def project_root(tmp_path: Path) -> Path:
    """Minimal project root with required directories."""
    (tmp_path / "apps/backend/src/api/routes").mkdir(parents=True)
    (tmp_path / "apps/backend/src/db").mkdir(parents=True)
    (tmp_path / "apps/backend/src/services").mkdir(parents=True)
    (tmp_path / "apps/backend/tests/unit").mkdir(parents=True)
    (tmp_path / "apps/web/lib/api").mkdir(parents=True)
    return tmp_path


@pytest.fixture
def generator(project_root: Path) -> MultiFileGenerator:
    return MultiFileGenerator(
        project_root=project_root,
        anthropic_api_key="test-key",
    )


SAMPLE_PYTHON = """\
from uuid import UUID

async def get_item(item_id: UUID) -> dict:
    return {"id": str(item_id)}
"""

SAMPLE_TS = """\
export interface Item {
  id: string;
  name: string;
}

export async function getItem(id: string): Promise<Item> {
  return fetch(`/api/items/${id}`).then(r => r.json());
}
"""


# ---------------------------------------------------------------------------
# Unit: file path planning
# ---------------------------------------------------------------------------


class TestPlanFilePaths:
    def test_generates_correct_paths(self, generator: MultiFileGenerator) -> None:
        request = FeatureRequest(feature_name="test_widget", description="test")
        paths = generator._plan_file_paths(request)

        assert paths["model"] == "apps/backend/src/db/test_widget_models.py"
        assert paths["service"] == "apps/backend/src/services/test_widget_service.py"
        assert paths["route"] == "apps/backend/src/api/routes/test_widget.py"
        assert paths["api_client"] == "apps/web/lib/api/test_widget.ts"
        assert "test_widget" in paths["test_unit"]

    def test_component_path_uses_pascal_case(self, generator: MultiFileGenerator) -> None:
        request = FeatureRequest(feature_name="purchase_order", description="test")
        paths = generator._plan_file_paths(request)
        assert "PurchaseOrderForm.tsx" in paths["component"]


# ---------------------------------------------------------------------------
# Unit: dependency ordering
# ---------------------------------------------------------------------------


class TestOrderedLayers:
    def test_model_before_service(self, generator: MultiFileGenerator) -> None:
        ordered = generator._ordered_layers(["service", "model", "route"])
        assert ordered.index("model") < ordered.index("service")

    def test_service_before_route(self, generator: MultiFileGenerator) -> None:
        ordered = generator._ordered_layers(["route", "service", "model"])
        assert ordered.index("service") < ordered.index("route")

    def test_api_client_before_component(self, generator: MultiFileGenerator) -> None:
        ordered = generator._ordered_layers(["component", "api_client"])
        assert ordered.index("api_client") < ordered.index("component")


# ---------------------------------------------------------------------------
# Unit: layer dependencies
# ---------------------------------------------------------------------------


class TestLayerDeps:
    def test_model_has_no_deps(self, generator: MultiFileGenerator) -> None:
        assert generator._layer_deps("model") == []

    def test_service_depends_on_model(self, generator: MultiFileGenerator) -> None:
        assert "model" in generator._layer_deps("service")

    def test_route_depends_on_service_and_model(self, generator: MultiFileGenerator) -> None:
        deps = generator._layer_deps("route")
        assert "model" in deps
        assert "service" in deps

    def test_test_integration_depends_on_all_backend(
        self, generator: MultiFileGenerator
    ) -> None:
        deps = generator._layer_deps("test_integration")
        assert "model" in deps
        assert "service" in deps
        assert "route" in deps


# ---------------------------------------------------------------------------
# Unit: syntax validation helpers
# ---------------------------------------------------------------------------


class TestValidateSyntax:
    async def test_valid_python_returns_true(
        self, generator: MultiFileGenerator
    ) -> None:
        valid, imports = await generator._validate_syntax(SAMPLE_PYTHON, "python")
        assert valid is True

    async def test_invalid_python_returns_false(
        self, generator: MultiFileGenerator
    ) -> None:
        valid, _ = await generator._validate_syntax("def foo(:\n  pass", "python")
        assert valid is False

    async def test_valid_typescript_returns_true(
        self, generator: MultiFileGenerator
    ) -> None:
        valid, imports = await generator._validate_syntax(SAMPLE_TS, "typescript")
        assert valid is True

    async def test_unbalanced_braces_returns_false(
        self, generator: MultiFileGenerator
    ) -> None:
        valid, _ = await generator._validate_syntax("const x = {", "typescript")
        assert valid is False

    async def test_extracts_python_imports(
        self, generator: MultiFileGenerator
    ) -> None:
        _, imports = await generator._validate_syntax(SAMPLE_PYTHON, "python")
        assert "uuid" in imports

    async def test_extracts_typescript_imports(
        self, generator: MultiFileGenerator
    ) -> None:
        ts_with_import = 'import { foo } from "bar";\n' + SAMPLE_TS
        _, imports = await generator._validate_syntax(ts_with_import, "typescript")
        assert "bar" in imports


# ---------------------------------------------------------------------------
# Unit: import resolution
# ---------------------------------------------------------------------------


class TestResolveImports:
    def test_replaces_placeholder_with_actual_path(
        self, generator: MultiFileGenerator
    ) -> None:
        import_map = {"model": "apps/backend/src/db/widget_models.py"}
        files = [
            FeatureFile(
                role="service",
                file_path="apps/backend/src/services/widget_service.py",
                language="python",
                content="from PLACEHOLDER_MODEL import Widget",
                syntax_valid=True,
            )
        ]
        resolved = generator._resolve_imports(files, import_map)
        assert "PLACEHOLDER_MODEL" not in resolved[0].content
        assert "apps.backend.src.db.widget_models" in resolved[0].content


# ---------------------------------------------------------------------------
# Unit: code cleaning
# ---------------------------------------------------------------------------


class TestCleanCode:
    def test_strips_python_fences(self, generator: MultiFileGenerator) -> None:
        raw = "```python\nprint('hello')\n```"
        assert generator._clean_code(raw) == "print('hello')"

    def test_strips_plain_fences(self, generator: MultiFileGenerator) -> None:
        raw = "```\ncode\n```"
        assert generator._clean_code(raw) == "code"

    def test_leaves_clean_code_untouched(self, generator: MultiFileGenerator) -> None:
        raw = "print('hello')"
        assert generator._clean_code(raw) == "print('hello')"


# ---------------------------------------------------------------------------
# Integration: generate_feature (mocked LLM)
# ---------------------------------------------------------------------------


class TestGenerateFeature:
    @patch.object(MultiFileGenerator, "_call_llm", new_callable=AsyncMock)
    async def test_generates_requested_layers(
        self,
        mock_llm: AsyncMock,
        generator: MultiFileGenerator,
    ) -> None:
        mock_llm.return_value = SAMPLE_PYTHON

        request = FeatureRequest(
            feature_name="test_widget",
            description="CRUD for test widgets",
            target_layers=["model", "service"],
        )
        result = await generator.generate_feature(request)

        assert len(result.files) == 2
        assert {f.role for f in result.files} == {"model", "service"}

    @patch.object(MultiFileGenerator, "_call_llm", new_callable=AsyncMock)
    async def test_generation_order_respected(
        self,
        mock_llm: AsyncMock,
        generator: MultiFileGenerator,
    ) -> None:
        mock_llm.return_value = SAMPLE_PYTHON

        request = FeatureRequest(
            feature_name="test_widget",
            description="test",
            target_layers=["route", "service", "model"],
        )
        result = await generator.generate_feature(request)

        roles = [f.role for f in result.files]
        assert roles.index("model") < roles.index("service")
        assert roles.index("service") < roles.index("route")

    @patch.object(MultiFileGenerator, "_call_llm", new_callable=AsyncMock)
    async def test_errors_captured_not_raised(
        self,
        mock_llm: AsyncMock,
        generator: MultiFileGenerator,
    ) -> None:
        mock_llm.side_effect = RuntimeError("LLM unavailable")

        request = FeatureRequest(
            feature_name="test_widget",
            description="test",
            target_layers=["model"],
        )
        result = await generator.generate_feature(request)

        assert len(result.errors) == 1
        assert "LLM unavailable" in result.errors[0]
        assert result.pr_ready is False

    @patch.object(MultiFileGenerator, "_call_llm", new_callable=AsyncMock)
    async def test_import_map_populated(
        self,
        mock_llm: AsyncMock,
        generator: MultiFileGenerator,
    ) -> None:
        mock_llm.return_value = SAMPLE_PYTHON

        request = FeatureRequest(
            feature_name="test_widget",
            description="test",
            target_layers=["model"],
        )
        result = await generator.generate_feature(request)

        assert "model" in result.import_map
        assert result.import_map["model"].endswith("_models.py")
