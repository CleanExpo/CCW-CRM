"""Tests for IncrementalUpdater (Phase B2)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services.code_generation.incremental_updater import (
    IncrementalUpdater,
    UpdateRequest,
    UpdateResult,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_PY = """\
\"\"\"Sample module.\"\"\"

import os


def greet(name: str) -> str:
    \"\"\"Return a greeting.\"\"\"
    return f"Hello, {name}"


def farewell(name: str) -> str:
    \"\"\"Return a farewell.\"\"\"
    return f"Goodbye, {name}"
"""

SAMPLE_TS = """\
export interface User {
  id: string;
  name: string;
}

export function greet(name: string): string {
  return `Hello, ${name}`;
}

export function farewell(name: string): string {
  return `Goodbye, ${name}`;
}
"""


@pytest.fixture
def py_file(tmp_path: Path) -> Path:
    f = tmp_path / "sample.py"
    f.write_text(SAMPLE_PY)
    return f


@pytest.fixture
def ts_file(tmp_path: Path) -> Path:
    f = tmp_path / "sample.ts"
    f.write_text(SAMPLE_TS)
    return f


@pytest.fixture
def updater(tmp_path: Path) -> IncrementalUpdater:
    return IncrementalUpdater(project_root=tmp_path, anthropic_api_key="test-key")


# ---------------------------------------------------------------------------
# Unit: language detection
# ---------------------------------------------------------------------------


class TestDetectLanguage:
    def test_detects_python(self, updater: IncrementalUpdater) -> None:
        assert updater._detect_language("foo.py") == "python"

    def test_detects_typescript(self, updater: IncrementalUpdater) -> None:
        assert updater._detect_language("foo.ts") == "typescript"

    def test_detects_tsx(self, updater: IncrementalUpdater) -> None:
        assert updater._detect_language("Foo.tsx") == "typescript"


# ---------------------------------------------------------------------------
# Unit: symbol extraction (Python)
# ---------------------------------------------------------------------------


class TestExtractPythonSymbol:
    def test_extracts_function(self, updater: IncrementalUpdater) -> None:
        extracted = updater._extract_python_symbol(SAMPLE_PY, "greet")
        assert "def greet" in extracted
        assert "return f" in extracted

    def test_does_not_include_next_function(self, updater: IncrementalUpdater) -> None:
        extracted = updater._extract_python_symbol(SAMPLE_PY, "greet")
        assert "def farewell" not in extracted

    def test_returns_empty_for_missing_symbol(self, updater: IncrementalUpdater) -> None:
        assert updater._extract_python_symbol(SAMPLE_PY, "nonexistent") == ""


# ---------------------------------------------------------------------------
# Unit: symbol extraction (TypeScript)
# ---------------------------------------------------------------------------


class TestExtractTsSymbol:
    def test_extracts_function(self, updater: IncrementalUpdater) -> None:
        extracted = updater._extract_ts_symbol(SAMPLE_TS, "greet")
        assert "function greet" in extracted
        assert "Hello" in extracted

    def test_does_not_include_next_function(self, updater: IncrementalUpdater) -> None:
        extracted = updater._extract_ts_symbol(SAMPLE_TS, "greet")
        assert "farewell" not in extracted

    def test_returns_empty_for_missing_symbol(self, updater: IncrementalUpdater) -> None:
        assert updater._extract_ts_symbol(SAMPLE_TS, "nonexistent") == ""


# ---------------------------------------------------------------------------
# Unit: remove function
# ---------------------------------------------------------------------------


class TestRemoveFunction:
    def test_removes_python_function(self, updater: IncrementalUpdater) -> None:
        request = UpdateRequest(
            file_path="sample.py",
            change_type="remove_function",
            instruction="Remove greet",
            target_symbol="greet",
        )
        result = updater._remove_function(SAMPLE_PY, request, "python")
        assert "def greet" not in result
        assert "def farewell" in result

    def test_raises_if_symbol_missing(self, updater: IncrementalUpdater) -> None:
        request = UpdateRequest(
            file_path="sample.py",
            change_type="remove_function",
            instruction="Remove missing",
            target_symbol="totally_missing",
        )
        with pytest.raises(ValueError, match="not found"):
            updater._remove_function(SAMPLE_PY, request, "python")


# ---------------------------------------------------------------------------
# Unit: syntax validation
# ---------------------------------------------------------------------------


class TestValidateSyntax:
    def test_valid_python(self, updater: IncrementalUpdater) -> None:
        assert updater._validate_syntax("x = 1\n", "python") is True

    def test_invalid_python(self, updater: IncrementalUpdater) -> None:
        assert updater._validate_syntax("def foo(:\n  pass", "python") is False

    def test_valid_typescript_balanced(self, updater: IncrementalUpdater) -> None:
        assert updater._validate_syntax("const x = { a: 1 };", "typescript") is True

    def test_invalid_typescript_unbalanced(self, updater: IncrementalUpdater) -> None:
        assert updater._validate_syntax("const x = {", "typescript") is False


# ---------------------------------------------------------------------------
# Integration: update() dispatches correctly
# ---------------------------------------------------------------------------


class TestUpdate:
    async def test_raises_for_missing_file(self, updater: IncrementalUpdater) -> None:
        request = UpdateRequest(
            file_path="does_not_exist.py",
            change_type="add_method",
            instruction="Add something",
        )
        with pytest.raises(FileNotFoundError):
            await updater.update(request)

    @patch.object(IncrementalUpdater, "_call_llm", new_callable=AsyncMock)
    async def test_add_method_appends_code(
        self,
        mock_llm: AsyncMock,
        updater: IncrementalUpdater,
        py_file: Path,
    ) -> None:
        new_fn = 'def hello(x: str) -> str:\n    return f"Hi {x}"\n'
        mock_llm.return_value = new_fn

        request = UpdateRequest(
            file_path=py_file.name,
            change_type="add_method",
            instruction="Add a hello function",
        )
        result = await updater.update(request)
        assert "hello" in result.updated_content
        assert result.syntax_valid is True

    @patch.object(IncrementalUpdater, "_call_llm", new_callable=AsyncMock)
    async def test_remove_function_produces_valid_diff(
        self,
        mock_llm: AsyncMock,
        updater: IncrementalUpdater,
        py_file: Path,
    ) -> None:
        request = UpdateRequest(
            file_path=py_file.name,
            change_type="remove_function",
            instruction="Remove greet",
            target_symbol="greet",
        )
        result = await updater.update(request)
        assert result.lines_removed > 0
        assert "def greet" not in result.updated_content

    @patch.object(IncrementalUpdater, "_call_llm", new_callable=AsyncMock)
    async def test_preserve_markers_flagged_when_violated(
        self,
        mock_llm: AsyncMock,
        updater: IncrementalUpdater,
        py_file: Path,
    ) -> None:
        # LLM returns code that drops the "farewell" function
        mock_llm.return_value = 'def hello(x: str) -> str:\n    return "hi"\n'

        request = UpdateRequest(
            file_path=py_file.name,
            change_type="add_method",
            instruction="Add hello",
            preserve_markers=["def farewell"],
        )
        result = await updater.update(request)
        # "def farewell" is still in the file (add_method only appends)
        assert result.preserved is True


# ---------------------------------------------------------------------------
# Unit: apply() refuses invalid syntax
# ---------------------------------------------------------------------------


class TestApply:
    async def test_refuses_invalid_syntax(
        self, updater: IncrementalUpdater, tmp_path: Path
    ) -> None:
        result = UpdateResult(
            file_path="foo.py",
            original_content="x = 1",
            updated_content="def foo(:\n  pass",
            diff="",
            syntax_valid=False,
            change_summary="broken",
            lines_added=0,
            lines_removed=0,
            preserved=True,
        )
        with pytest.raises(ValueError, match="syntactically invalid"):
            await updater.apply(result)

    async def test_refuses_when_marker_violated(
        self, updater: IncrementalUpdater, tmp_path: Path
    ) -> None:
        result = UpdateResult(
            file_path="foo.py",
            original_content="x = 1",
            updated_content="y = 2",
            diff="",
            syntax_valid=True,
            change_summary="test",
            lines_added=1,
            lines_removed=1,
            preserved=False,
        )
        with pytest.raises(ValueError, match="preserve_markers"):
            await updater.apply(result)
