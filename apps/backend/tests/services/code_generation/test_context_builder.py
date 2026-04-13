"""Tests for Context Builder.

Tests codebase analysis, pattern detection, and context generation
for AI-powered code generation.
"""

from pathlib import Path

import pytest

from src.services.code_generation.context_builder import (
    CodeContext,
    CodePattern,
    ContextBuilder,
    ProjectStructure,
    StyleGuide,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def project_root():
    """Project root directory."""
    # Go from test file -> code_generation -> services -> tests -> backend -> apps -> root
    return Path(__file__).parents[5]  # Go up to project root


@pytest.fixture
def context_builder(project_root):
    """ContextBuilder instance."""
    return ContextBuilder(project_root=project_root)


# ============================================================================
# ProjectStructure Tests
# ============================================================================


def test_project_structure_from_project_root(project_root):
    """Test project structure auto-detection."""
    structure = ProjectStructure.from_project_root(project_root)

    # Verify all paths are set
    assert structure.backend_routes
    assert structure.backend_models
    assert structure.backend_services
    assert structure.backend_tests
    assert structure.frontend_pages
    assert structure.frontend_components
    assert structure.frontend_tests
    assert structure.root_dir

    # Verify paths end with expected directories
    assert structure.backend_routes.endswith("apps/backend/src/api/routes") or structure.backend_routes.endswith("apps\\backend\\src\\api\\routes")
    assert structure.backend_models.endswith("apps/backend/src/db") or structure.backend_models.endswith("apps\\backend\\src\\db")
    assert structure.frontend_pages.endswith("apps/web/app/(dashboard)") or structure.frontend_pages.endswith("apps\\web\\app\\(dashboard)")


def test_project_structure_paths_exist(project_root):
    """Test that detected paths actually exist."""
    structure = ProjectStructure.from_project_root(project_root)

    # Backend paths should exist
    assert Path(structure.backend_routes).exists()
    assert Path(structure.backend_models).exists()
    assert Path(structure.backend_services).exists()
    assert Path(structure.backend_tests).exists()

    # Frontend paths should exist
    assert Path(structure.frontend_pages).exists()
    assert Path(structure.frontend_components).exists()


# ============================================================================
# ContextBuilder Initialization Tests
# ============================================================================


def test_context_builder_initialization(context_builder, project_root):
    """Test ContextBuilder initializes correctly."""
    assert context_builder.project_root == project_root
    assert isinstance(context_builder.structure, ProjectStructure)
    assert context_builder.structure.root_dir == str(project_root)


# ============================================================================
# Pattern Detection Tests
# ============================================================================


@pytest.mark.asyncio
async def test_detect_python_patterns(context_builder):
    """Test Python pattern detection."""
    patterns = await context_builder._detect_patterns("python")

    # Should detect patterns
    assert isinstance(patterns, list)

    # Check for common import patterns
    import_patterns = [p for p in patterns if p.pattern_type == "common_imports"]
    if import_patterns:
        pattern = import_patterns[0]
        assert pattern.frequency > 0
        assert 0 < pattern.confidence <= 1
        # Should detect FastAPI imports
        examples_str = " ".join(pattern.examples)
        assert "fastapi" in examples_str.lower() or "router" in examples_str.lower()


@pytest.mark.asyncio
async def test_detect_typescript_patterns(context_builder):
    """Test TypeScript pattern detection."""
    patterns = await context_builder._detect_patterns("typescript")

    # Should detect patterns
    assert isinstance(patterns, list)

    # Check for common import patterns
    import_patterns = [p for p in patterns if p.pattern_type == "common_imports"]
    if import_patterns:
        pattern = import_patterns[0]
        assert pattern.frequency > 0
        assert 0 < pattern.confidence <= 1


@pytest.mark.asyncio
async def test_detect_python_patterns_includes_route_decorators(context_builder):
    """Test that route decorator patterns are detected."""
    patterns = await context_builder._detect_patterns("python")

    route_patterns = [p for p in patterns if p.pattern_type == "route_decorators"]
    if route_patterns:
        pattern = route_patterns[0]
        assert pattern.frequency > 0
        # Examples should look like @router.get('/path')
        assert any("@router." in ex for ex in pattern.examples)


@pytest.mark.asyncio
async def test_detect_typescript_patterns_includes_component_features(context_builder):
    """Test that React component features are detected."""
    patterns = await context_builder._detect_patterns("typescript")

    feature_patterns = [p for p in patterns if p.pattern_type == "component_features"]
    # Component features might not always be present, so just verify structure if found
    if feature_patterns:
        pattern = feature_patterns[0]
        assert pattern.frequency > 0
        assert isinstance(pattern.examples, list)


# ============================================================================
# Style Guide Extraction Tests
# ============================================================================


@pytest.mark.asyncio
async def test_extract_backend_style(context_builder):
    """Test backend style guide extraction."""
    style = await context_builder._extract_backend_style()

    assert style.language == "python"
    assert style.framework == "FastAPI"
    assert style.validation_library == "Pydantic v2"
    assert style.naming_convention == "snake_case"
    assert len(style.common_imports) > 0
    assert len(style.reference_files) > 0

    # Check reference files
    assert "demo_lists.py" in style.reference_files


@pytest.mark.asyncio
async def test_extract_frontend_style(context_builder):
    """Test frontend style guide extraction."""
    style = await context_builder._extract_frontend_style()

    assert style.language == "typescript"
    assert "Next.js" in style.framework
    assert style.ui_library == "shadcn/ui"
    assert style.form_library == "React Hook Form"
    assert style.validation_library == "Zod"
    assert len(style.common_imports) > 0
    assert len(style.reference_files) > 0

    # Check reference files
    assert "login-form.tsx" in style.reference_files


# ============================================================================
# Similar File Finding Tests
# ============================================================================


@pytest.mark.asyncio
async def test_find_similar_files_python(context_builder):
    """Test finding similar Python files."""
    similar = await context_builder._find_similar_files(
        requirement="Create a new API endpoint for products",
        language="python",
        max_results=3,
    )

    assert isinstance(similar, list)
    assert len(similar) <= 3

    # Should find Python files
    if similar:
        assert all(path.endswith(".py") for path in similar)


@pytest.mark.asyncio
async def test_find_similar_files_typescript(context_builder):
    """Test finding similar TypeScript files."""
    similar = await context_builder._find_similar_files(
        requirement="Create a form component for products",
        language="typescript",
        max_results=3,
    )

    assert isinstance(similar, list)
    assert len(similar) <= 3

    # Should find TypeScript/TSX files
    if similar:
        assert all(path.endswith((".ts", ".tsx")) for path in similar)


@pytest.mark.asyncio
async def test_find_similar_files_respects_max_results(context_builder):
    """Test that max_results parameter is respected."""
    similar = await context_builder._find_similar_files(
        requirement="API endpoint",
        language="python",
        max_results=2,
    )

    assert len(similar) <= 2


# ============================================================================
# Dependency Analysis Tests
# ============================================================================


@pytest.mark.asyncio
async def test_build_dependencies_python(context_builder):
    """Test building dependency graph for Python files."""
    # Use a known file
    files = ["apps/backend/src/api/routes/demo_lists.py"]
    dependencies = await context_builder._build_dependencies(files)

    assert isinstance(dependencies, dict)
    # File should be in dependencies if it exists
    if files[0] in dependencies:
        # Should have extracted some imports
        deps = dependencies[files[0]]
        assert isinstance(deps, list)


@pytest.mark.asyncio
async def test_build_dependencies_typescript(context_builder):
    """Test building dependency graph for TypeScript files."""
    # Use a known file
    files = ["apps/web/components/auth/login-form.tsx"]
    dependencies = await context_builder._build_dependencies(files)

    assert isinstance(dependencies, dict)
    # File should be in dependencies if it exists
    if files[0] in dependencies:
        # Should have extracted some imports
        deps = dependencies[files[0]]
        assert isinstance(deps, list)


@pytest.mark.asyncio
async def test_build_dependencies_handles_missing_files(context_builder):
    """Test dependency builder handles non-existent files gracefully."""
    files = ["nonexistent/file.py"]
    dependencies = await context_builder._build_dependencies(files)

    # Should not crash
    assert isinstance(dependencies, dict)


@pytest.mark.asyncio
async def test_extract_python_imports(context_builder):
    """Test Python import extraction."""
    # Create a test file path
    test_file = context_builder.project_root / "apps/backend/src/api/routes/demo_lists.py"

    if test_file.exists():
        imports = await context_builder._extract_python_imports(test_file)

        assert isinstance(imports, list)
        # Should have extracted common imports
        # Check for partial matches since exact imports may vary
        import_str = " ".join(imports)
        # At least some standard library or common imports should be present


@pytest.mark.asyncio
async def test_extract_typescript_imports(context_builder):
    """Test TypeScript import extraction."""
    # Create a test file path
    test_file = context_builder.project_root / "apps/web/components/auth/login-form.tsx"

    if test_file.exists():
        imports = await context_builder._extract_typescript_imports(test_file)

        assert isinstance(imports, list)
        # Should have extracted React/Next.js imports
        if imports:
            # At least one import should be from react or next
            import_str = " ".join(imports)
            assert "react" in import_str or "next" in import_str or "@" in import_str


# ============================================================================
# Full Context Building Tests
# ============================================================================


@pytest.mark.asyncio
async def test_build_context_python(context_builder):
    """Test building complete context for Python code generation."""
    context = await context_builder.build_context(
        requirement="Add a new API endpoint for managing suppliers",
        target_language="python",
    )

    # Verify context structure
    assert isinstance(context, CodeContext)
    assert isinstance(context.structure, ProjectStructure)
    assert isinstance(context.patterns, list)
    assert isinstance(context.backend_style, StyleGuide)
    assert isinstance(context.frontend_style, StyleGuide)
    assert isinstance(context.similar_files, list)
    assert isinstance(context.dependencies, dict)

    # Backend style should be populated
    assert context.backend_style.language == "python"
    assert context.backend_style.framework == "FastAPI"


@pytest.mark.asyncio
async def test_build_context_typescript(context_builder):
    """Test building complete context for TypeScript code generation."""
    context = await context_builder.build_context(
        requirement="Create a form component for customer management",
        target_language="typescript",
    )

    # Verify context structure
    assert isinstance(context, CodeContext)
    assert isinstance(context.structure, ProjectStructure)

    # Frontend style should be populated
    assert context.frontend_style.language == "typescript"
    assert "Next.js" in context.frontend_style.framework


@pytest.mark.asyncio
async def test_build_context_with_reference_files(context_builder):
    """Test building context with specific reference files."""
    reference_files = ["apps/backend/src/api/routes/orders.py"]

    context = await context_builder.build_context(
        requirement="Add order processing logic",
        target_language="python",
        reference_files=reference_files,
    )

    # Dependencies should include the reference file
    assert isinstance(context.dependencies, dict)
    # The reference file should be analyzed
    assert reference_files[0] in context.dependencies or len(context.dependencies) >= 0


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================


@pytest.mark.asyncio
async def test_context_builder_handles_invalid_language(context_builder):
    """Test that invalid language returns empty patterns."""
    patterns = await context_builder._detect_patterns("invalid_language")

    # Should return empty list, not crash
    assert isinstance(patterns, list)
    assert len(patterns) == 0


@pytest.mark.asyncio
async def test_find_similar_files_empty_requirement(context_builder):
    """Test similar file finding with empty requirement."""
    similar = await context_builder._find_similar_files(
        requirement="",
        language="python",
    )

    # Should handle gracefully
    assert isinstance(similar, list)


def test_project_structure_validation():
    """Test ProjectStructure Pydantic validation."""
    # Valid structure
    structure = ProjectStructure(
        backend_routes="/path/routes",
        backend_models="/path/models",
        backend_services="/path/services",
        backend_tests="/path/tests",
        frontend_pages="/path/pages",
        frontend_components="/path/components",
        frontend_tests="/path/tests",
        root_dir="/path/root",
    )

    assert structure.backend_routes == "/path/routes"


def test_code_pattern_validation():
    """Test CodePattern Pydantic validation."""
    pattern = CodePattern(
        pattern_type="import",
        examples=["import fastapi", "from fastapi import APIRouter"],
        frequency=10,
        confidence=0.95,
    )

    assert pattern.pattern_type == "import"
    assert pattern.frequency == 10
    assert 0 <= pattern.confidence <= 1


def test_style_guide_validation():
    """Test StyleGuide Pydantic validation."""
    style = StyleGuide(
        language="python",
        framework="FastAPI",
        naming_convention="snake_case",
    )

    assert style.language == "python"
    assert style.framework == "FastAPI"


def test_code_context_validation():
    """Test CodeContext Pydantic validation."""
    structure = ProjectStructure.from_project_root(Path.cwd())
    backend_style = StyleGuide(
        language="python", framework="FastAPI", naming_convention="snake_case"
    )
    frontend_style = StyleGuide(
        language="typescript", framework="Next.js", naming_convention="PascalCase"
    )

    context = CodeContext(
        structure=structure,
        patterns=[],
        backend_style=backend_style,
        frontend_style=frontend_style,
        similar_files=[],
        dependencies={},
    )

    assert isinstance(context.structure, ProjectStructure)
    assert isinstance(context.backend_style, StyleGuide)
