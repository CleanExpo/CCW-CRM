# Phase 5 Week 4: AI-Powered Code Generation System

**Status**: ✅ Complete
**Implementation Date**: February 2026
**Test Coverage**: 160 tests, 100% passing
**Lines of Code**: ~3,500 (implementation + tests)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Usage Guide](#usage-guide)
5. [API Reference](#api-reference)
6. [Examples](#examples)
7. [Quality Standards](#quality-standards)
8. [Testing](#testing)
9. [Future Enhancements](#future-enhancements)

---

## Overview

The AI-Powered Code Generation System is a sophisticated pipeline that transforms natural language requirements into production-ready code with tests, documentation, and quality validation.

### Key Features

- **🧠 Context-Aware Generation**: Analyzes existing codebase patterns and styles
- **🤖 Claude Sonnet 4.5 Integration**: State-of-the-art LLM for code generation
- **✅ Automatic Test Generation**: Creates unit tests for generated code
- **📚 Documentation Generation**: Adds Google-style docstrings and JSDoc
- **🔒 Security Scanning**: Detects hardcoded secrets, SQL injection, XSS
- **📊 Quality Validation**: Linting, type checking, complexity analysis
- **🎯 Production-Ready Output**: Code ready for pull requests

### What Gets Generated

For a single requirement, the system generates:

```
Input: "Create an API endpoint to get product by ID"

Output:
├── Implementation code (Python/TypeScript)
│   ├── Proper imports and dependencies
│   ├── Type annotations
│   ├── Error handling
│   └── Security-validated code
├── Comprehensive documentation
│   ├── Function/class docstrings
│   ├── Parameter descriptions
│   └── Return type documentation
├── Unit tests
│   ├── Happy path tests
│   ├── Error case tests
│   └── Edge case tests
└── Quality report
    ├── Linting results
    ├── Type check results
    ├── Security scan results
    └── Best practices validation
```

---

## Architecture

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Code Generation Pipeline                      │
└─────────────────────────────────────────────────────────────────────┘

1. INPUT: Natural Language Requirement
   └─> "Create an API endpoint to get product by ID"

2. CONTEXT BUILDER (Task #69)
   ├─> Analyzes codebase structure
   ├─> Detects code patterns (routes, services, models)
   ├─> Finds similar code examples
   ├─> Extracts style guides (naming, imports, frameworks)
   └─> Builds comprehensive context

3. CODE GENERATOR (Task #70)
   ├─> Loads prompt template (Python/TypeScript)
   ├─> Injects context into prompt
   ├─> Calls Claude Sonnet 4.5 API
   ├─> Validates syntax (AST parsing)
   ├─> Detects hardcoded secrets
   └─> Returns generated code

4. DOCUMENTATION GENERATOR (Task #72)
   ├─> Analyzes documentation needs
   ├─> Generates Google-style docstrings (Python)
   ├─> Generates JSDoc (TypeScript)
   ├─> Validates syntax after documentation
   └─> Returns documented code

5. TEST GENERATOR (Task #71)
   ├─> Analyzes testable elements
   ├─> Generates pytest tests (Python)
   ├─> Generates Vitest tests (TypeScript)
   ├─> Validates test syntax
   └─> Returns test files

6. QUALITY CHECKER (Task #73)
   ├─> Runs linting (Ruff for Python)
   ├─> Checks type annotations
   ├─> Runs formatting (Black for Python)
   ├─> Scans for security issues
   ├─> Validates best practices
   └─> Returns quality report

7. OUTPUT: CodeGenerationResult
   ├─> generated_files: [GeneratedFile]
   ├─> tests: [GeneratedFile]
   ├─> documentation: [str]
   ├─> quality_report: QualityReport
   └─> pr_ready: bool
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CodeGenerator                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ ContextBuilder │  │  TestGenerator │  │  DocGenerator  │        │
│  │                │  │                │  │                │        │
│  │ • Patterns     │  │ • Pytest       │  │ • Docstrings   │        │
│  │ • Styles       │  │ • Vitest       │  │ • JSDoc        │        │
│  │ • Similar code │  │ • Coverage     │  │ • Comments     │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                       │
│  ┌────────────────┐                      ┌────────────────┐        │
│  │QualityChecker  │                      │ Anthropic API  │        │
│  │                │                      │                │        │
│  │ • Linting      │                      │ Claude Sonnet  │        │
│  │ • Type check   │                      │ 4.5 (model:    │        │
│  │ • Security     │                      │ claude-sonnet- │        │
│  │ • Formatting   │                      │ 4-6)           │        │
│  └────────────────┘                      └────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Context Builder (`context_builder.py`)

**Purpose**: Analyze the codebase to understand patterns, styles, and conventions.

**Key Methods**:

- `build_context()`: Main entry point, returns `CodeContext`
- `_analyze_project_structure()`: Maps directory structure
- `_detect_patterns()`: Finds code patterns (routes, services, models)
- `_find_similar_code()`: Locates similar implementations
- `_extract_style_guide()`: Determines naming, imports, frameworks

**Output**: `CodeContext` object containing:

- `project_structure`: Directory mapping
- `patterns`: List of detected patterns (e.g., "FastAPI routes", "React components")
- `similar_files`: Files with similar functionality
- `backend_style`: Python style guide (framework, ORM, naming)
- `frontend_style`: TypeScript style guide (UI library, form library)

**Example**:

```python
from src.services.code_generation import ContextBuilder

builder = ContextBuilder(project_root=Path("/path/to/project"))
context = await builder.build_context(
    requirement="Create product endpoint",
    target_language="python",
    reference_files=["apps/backend/src/api/routes/demo_lists.py"]
)

print(context.backend_style.framework)  # "FastAPI"
print(context.patterns[0].pattern_type)  # "api_route"
```

### 2. Code Generator (`generator.py`)

**Purpose**: Generate production-ready code using Claude Sonnet 4.5.

**Key Methods**:

- `generate()`: Main entry point, returns `CodeGenerationResult`
- `_build_prompt()`: Constructs prompt with context injection
- `_call_llm()`: Calls Anthropic API with retry logic
- `_validate_syntax()`: Validates generated code syntax
- `_infer_file_path()`: Determines appropriate file path

**Models**:

- `CodeGenerationRequest`: Input model
- `CodeGenerationResult`: Output model
- `GeneratedFile`: Individual file model
- `QualityReport`: Quality validation results

**Example**:

```python
from src.services.code_generation import CodeGenerator, CodeGenerationRequest

generator = CodeGenerator(
    project_root=Path("/path/to/project"),
    anthropic_api_key="sk-ant-..."
)

request = CodeGenerationRequest(
    requirement="Create an API endpoint to get product by ID",
    target_language="python",
    generation_type="feature"
)

result = await generator.generate(request)

print(result.generated_files[0].content)
print(result.quality_report.linting_passed)
print(result.pr_ready)
```

### 3. Test Generator (`test_generator.py`)

**Purpose**: Automatically generate unit tests for generated code.

**Key Methods**:

- `generate_tests()`: Main entry point, returns list of test files
- `_analyze_code()`: Identifies testable elements
- `_build_test_prompt()`: Constructs test generation prompt
- `_validate_test_syntax()`: Validates test syntax

**Test Types**:

- **Unit tests**: Function/method testing
- **Component tests**: React component testing (TypeScript)
- **Endpoint tests**: API endpoint testing (Python)

**Example**:

```python
from src.services.code_generation import TestGenerator

test_gen = TestGenerator(
    project_root=Path("/path/to/project"),
    anthropic_api_key="sk-ant-..."
)

tests = await test_gen.generate_tests(
    generated_file=generated_file,
    test_type="unit"
)

for test_file in tests:
    print(test_file.file_path)
    print(test_file.content)
```

### 4. Documentation Generator (`doc_generator.py`)

**Purpose**: Add comprehensive documentation to generated code.

**Key Methods**:

- `generate_documentation()`: Main entry point, returns documented code
- `_analyze_documentation_needs()`: Identifies undocumented elements
- `_build_documentation_prompt()`: Constructs documentation prompt
- `_validate_documented_code()`: Ensures syntax is still valid

**Documentation Styles**:

- **Python**: Google-style docstrings
- **TypeScript**: JSDoc comments

**Example**:

```python
from src.services.code_generation import DocGenerator

doc_gen = DocGenerator(
    project_root=Path("/path/to/project"),
    anthropic_api_key="sk-ant-..."
)

documented_code = await doc_gen.generate_documentation(
    generated_file=generated_file,
    existing_examples=[]
)

print(documented_code)
```

### 5. Quality Checker (`quality_checker.py`)

**Purpose**: Validate code quality across multiple dimensions.

**Key Methods**:

- `check_quality()`: Main entry point, returns `QualityReport`
- Python checks:
  - `_run_ruff_check()`: Linting with Ruff
  - `_check_python_types()`: Type annotation validation
  - `_check_python_formatting()`: Black formatting
  - `_scan_python_security()`: Security scanning
  - `_check_python_best_practices()`: Best practices validation
- TypeScript checks:
  - `_check_typescript_linting()`: Basic linting
  - `_check_typescript_types()`: Type validation
  - `_scan_typescript_security()`: Security scanning
  - `_check_typescript_best_practices()`: Best practices

**Quality Checks**:

- ✅ Linting (Ruff for Python)
- ✅ Type annotations (missing return types, parameter types)
- ✅ Formatting (Black for Python)
- ✅ Security (secrets, SQL injection, XSS, eval, pickle)
- ✅ Best practices (unused imports, complexity, error handling)

**Example**:

```python
from src.services.code_generation import QualityChecker

checker = QualityChecker(
    project_root=Path("/path/to/project"),
    auto_fix=True
)

report = await checker.check_quality(generated_file)

print(f"Linting: {report.linting_passed}")
print(f"Type check: {report.type_check_passed}")
print(f"Security issues: {len(report.security_issues)}")
print(f"Formatting applied: {report.formatting_applied}")
```

---

## Usage Guide

### Quick Start

```python
import asyncio
from pathlib import Path
from src.services.code_generation import (
    CodeGenerator,
    CodeGenerationRequest,
)

async def generate_code_example():
    # Initialize generator
    generator = CodeGenerator(
        project_root=Path.cwd(),
        anthropic_api_key="sk-ant-..."  # Or set ANTHROPIC_API_KEY env var
    )

    # Create request
    request = CodeGenerationRequest(
        requirement="Create an API endpoint to list all products with pagination",
        target_language="python",
        generation_type="feature",
        reference_files=[
            "apps/backend/src/api/routes/demo_lists.py"
        ]
    )

    # Generate code
    result = await generator.generate(request)

    # Access generated code
    generated_file = result.generated_files[0]
    print(f"Generated: {generated_file.file_path}")
    print(f"Syntax valid: {generated_file.syntax_valid}")
    print(f"Language: {generated_file.language}")

    # Access tests
    for test_file in result.tests:
        print(f"Test: {test_file.file_path}")

    # Check quality
    quality = result.quality_report
    print(f"Linting: {'✅' if quality.linting_passed else '❌'}")
    print(f"Type check: {'✅' if quality.type_check_passed else '❌'}")
    print(f"Security issues: {len(quality.security_issues)}")

    # PR ready?
    print(f"PR ready: {'✅' if result.pr_ready else '❌'}")

    return result

# Run
result = asyncio.run(generate_code_example())
```

### Advanced Usage

#### Custom Context

```python
request = CodeGenerationRequest(
    requirement="Create a service class for order processing",
    target_language="python",
    generation_type="feature",
    reference_files=[
        "apps/backend/src/services/translations.py",
        "apps/backend/src/db/demo_models.py"
    ],
    constraints={
        "max_complexity": 10,
        "require_tests": True,
        "require_documentation": True
    }
)
```

#### Error Handling

```python
from anthropic import RateLimitError, APIError

try:
    result = await generator.generate(request)
except ValueError as e:
    print(f"Invalid request: {e}")
except RateLimitError:
    print("Rate limited - wait and retry")
except APIError as e:
    print(f"API error: {e}")
except Exception as e:
    print(f"Generation failed: {e}")
```

#### Standalone Components

```python
# Use context builder independently
from src.services.code_generation import ContextBuilder

builder = ContextBuilder(project_root=Path.cwd())
context = await builder.build_context(
    requirement="List products",
    target_language="python"
)

# Use quality checker independently
from src.services.code_generation import QualityChecker

checker = QualityChecker(project_root=Path.cwd())
report = await checker.check_quality(generated_file)
```

---

## API Reference

### CodeGenerationRequest

```python
class CodeGenerationRequest(BaseModel):
    requirement: str                    # Natural language requirement
    context: dict[str, Any] = {}        # Additional context
    target_language: str                # "python" or "typescript"
    generation_type: str = "feature"    # "feature", "bug_fix", "refactor"
    reference_files: list[str] = []     # Files to use as reference
    constraints: dict[str, Any] = {}    # Generation constraints
```

### CodeGenerationResult

```python
class CodeGenerationResult(BaseModel):
    generated_files: list[GeneratedFile]    # Generated code files
    tests: list[GeneratedFile]              # Generated test files
    documentation: list[str]                # Documentation summaries
    quality_report: QualityReport           # Quality check results
    pr_ready: bool                          # Whether code is PR-ready
```

### GeneratedFile

```python
class GeneratedFile(BaseModel):
    file_path: str                          # Relative path to file
    content: str                            # File content
    language: str                           # "python" or "typescript"
    file_type: str = "implementation"       # "implementation", "test", "documentation"
    syntax_valid: bool                      # Whether syntax is valid
    imports: list[str] = []                 # Imported modules
```

### QualityReport

```python
class QualityReport(BaseModel):
    linting_passed: bool = True             # Linting passed
    linting_errors: list[str] = []          # Linting errors
    type_check_passed: bool = True          # Type check passed
    type_errors: list[str] = []             # Type errors
    formatting_applied: bool = False        # Code formatted
    security_issues: list[str] = []         # Security issues
    best_practices_violations: list[str] = []  # Best practice violations
```

### CodeContext

```python
class CodeContext(BaseModel):
    project_structure: ProjectStructure     # Directory mapping
    patterns: list[CodePattern]             # Detected patterns
    similar_files: list[str]                # Similar code files
    backend_style: StyleGuide               # Python style
    frontend_style: StyleGuide              # TypeScript style
    total_files: int                        # Total file count
```

---

## Examples

### Example 1: Generate FastAPI Endpoint

```python
request = CodeGenerationRequest(
    requirement="""
    Create a FastAPI endpoint to create a new product.
    - Validate SKU is unique
    - Require: sku, name, price, stock
    - Return 400 if SKU exists
    - Return 201 with product details on success
    """,
    target_language="python",
    generation_type="feature",
    reference_files=[
        "apps/backend/src/api/routes/demo_lists.py",
        "apps/backend/src/db/demo_models.py"
    ]
)

result = await generator.generate(request)

# Expected output file: apps/backend/src/api/routes/generated_endpoint.py
# Contains:
# - @router.post("/products")
# - ProductCreate Pydantic model
# - SKU uniqueness check
# - Proper error handling
# - Type annotations
# - Docstrings
```

**Generated Code Sample**:

```python
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_async_db
from src.db.demo_models import Product
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["products"])


class ProductCreate(BaseModel):
    """Product creation request."""
    sku: str
    name: str
    price: float
    stock: int


@router.post("/products", status_code=201)
async def create_product(
    product_data: ProductCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)]
) -> dict:
    """Create a new product.

    Args:
        product_data: Product details
        db: Database session

    Returns:
        Created product details

    Raises:
        HTTPException: If SKU already exists
    """
    # Check if SKU exists
    result = await db.execute(
        select(Product).where(Product.sku == product_data.sku)
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")

    # Create product
    product = Product(**product_data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)

    return {
        "id": str(product.id),
        "sku": product.sku,
        "name": product.name,
        "price": float(product.price),
        "stock": product.stock
    }
```

### Example 2: Generate React Component

```python
request = CodeGenerationRequest(
    requirement="""
    Create a ProductForm React component for adding new products.
    - Fields: SKU, name, price, stock
    - Validation: SKU required, price > 0, stock >= 0
    - Use React Hook Form
    - TypeScript with proper types
    - Include error handling
    """,
    target_language="typescript",
    generation_type="feature"
)

result = await generator.generate(request)

# Expected output: apps/web/components/generated/GeneratedComponent.tsx
```

**Generated Code Sample**:

```typescript
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

/**
 * Product form data schema
 */
const productSchema = z.object({
    sku: z.string().min(1, "SKU is required"),
    name: z.string().min(1, "Name is required"),
    price: z.number().positive("Price must be positive"),
    stock: z.number().nonnegative("Stock cannot be negative")
});

type ProductFormData = z.infer<typeof productSchema>;

/**
 * Product form component
 * @component
 * @param {Object} props - Component props
 * @param {Function} props.onSubmit - Submit handler
 * @returns {JSX.Element} Product form
 */
export function ProductForm({
    onSubmit
}: {
    onSubmit: (data: ProductFormData) => void
}): JSX.Element {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm<ProductFormData>({
        resolver: zodResolver(productSchema)
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div>
                <label>SKU</label>
                <input {...register("sku")} />
                {errors.sku && <span>{errors.sku.message}</span>}
            </div>

            <div>
                <label>Name</label>
                <input {...register("name")} />
                {errors.name && <span>{errors.name.message}</span>}
            </div>

            <div>
                <label>Price</label>
                <input
                    type="number"
                    step="0.01"
                    {...register("price", { valueAsNumber: true })}
                />
                {errors.price && <span>{errors.price.message}</span>}
            </div>

            <div>
                <label>Stock</label>
                <input
                    type="number"
                    {...register("stock", { valueAsNumber: true })}
                />
                {errors.stock && <span>{errors.stock.message}</span>}
            </div>

            <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Product"}
            </button>
        </form>
    );
}
```

### Example 3: Generate Service Class

```python
request = CodeGenerationRequest(
    requirement="""
    Create an OrderService class for order processing.
    - Method: create_order(customer_id, items)
    - Validate: items not empty, calculate total
    - Return order details
    - Include error handling
    """,
    target_language="python",
    generation_type="feature"
)

result = await generator.generate(request)
```

**Generated Code Sample**:

```python
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class OrderService:
    """Service for order processing operations.

    Handles order creation, validation, and calculations.
    """

    async def create_order(
        self,
        customer_id: str,
        items: list[dict],
    ) -> dict:
        """Create a new order.

        Args:
            customer_id: Customer UUID
            items: List of order items with quantity and price

        Returns:
            Created order details with total

        Raises:
            ValueError: If validation fails
        """
        # Validate items
        if not items:
            raise ValueError("Order must have at least one item")

        # Validate item structure
        for item in items:
            if "quantity" not in item or "price" not in item:
                raise ValueError("Each item must have quantity and price")

        # Calculate total
        total = sum(item["quantity"] * item["price"] for item in items)

        return {
            "customer_id": customer_id,
            "items": items,
            "total": total,
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending"
        }
```

---

## Quality Standards

### Security Checks

The quality checker scans for:

**Python**:

- ❌ Hardcoded API keys: `api_key = "sk-..."`
- ❌ Hardcoded passwords: `password = "secret"`
- ❌ SQL injection: `f"SELECT * FROM users WHERE id = {user_id}"`
- ❌ Eval usage: `eval(user_input)`
- ❌ Exec usage: `exec(code)`
- ❌ Pickle deserialization: `pickle.loads(data)`
- ❌ Shell injection: `os.system(command)`, `subprocess.run(..., shell=True)`

**TypeScript**:

- ❌ Hardcoded API keys: `const API_KEY = "sk-..."`
- ❌ Eval usage: `eval(userInput)`
- ❌ XSS risks: `dangerouslySetInnerHTML`, `innerHTML = userContent`

### Type Checking

**Python**:

- ✅ All functions have return type annotations
- ✅ All parameters have type annotations (except `self`, `cls`)
- ✅ No missing type hints on public methods

**TypeScript**:

- ✅ Functions have return type annotations
- ✅ Props have proper TypeScript types
- ✅ No `any` types

### Best Practices

**Python**:

- ✅ No unused imports
- ✅ Functions have reasonable complexity (< 10)
- ✅ Async functions have error handling
- ✅ Code formatted with Black (auto-fix enabled)

**TypeScript**:

- ✅ No `console.log` in production code
- ✅ No `var` declarations (use `const`/`let`)
- ✅ `useState` has type parameter
- ✅ Async functions have error handling

---

## Testing

### Test Coverage

**Total**: 160 tests, 100% passing

1. **Context Builder**: 26 tests
2. **Code Generator**: 27 tests
3. **Test Generator**: 26 tests
4. **Documentation Generator**: 25 tests
5. **Quality Checker**: 41 tests
6. **Integration Tests**: 15 tests

### Running Tests

```bash
# All code generation tests
cd apps/backend
pytest tests/services/code_generation/ -v

# Specific component
pytest tests/services/code_generation/test_generator.py -v

# With coverage
pytest tests/services/code_generation/ --cov=src/services/code_generation

# Integration tests only
pytest tests/services/code_generation/test_integration.py -v
```

### Test Structure

Each component has comprehensive tests:

```
tests/services/code_generation/
├── test_context_builder.py      # Context analysis tests
├── test_generator.py             # Code generation tests
├── test_test_generator.py        # Test generation tests
├── test_doc_generator.py         # Documentation tests
├── test_quality_checker.py       # Quality validation tests
└── test_integration.py           # End-to-end pipeline tests
```

---

## Future Enhancements

### Planned Features (Phase 5 Week 5+)

1. **Multi-File Generation**
   - Generate complete features (endpoint + service + tests)
   - Handle file dependencies
   - Coordinate imports across files

2. **Incremental Updates**
   - Modify existing code instead of generating new
   - Preserve user customizations
   - Smart merge strategies

3. **Enhanced Context**
   - Database schema awareness
   - API contract analysis
   - Dependency graph understanding

4. **Advanced Quality**
   - ESLint integration for TypeScript
   - Mypy integration for Python
   - Coverage requirements
   - Performance analysis

5. **Interactive Mode**
   - Ask clarifying questions during generation
   - Suggest alternatives
   - Explain generated code

6. **Template System**
   - Pre-defined templates for common patterns
   - Customizable templates per project
   - Template versioning

7. **CI/CD Integration**
   - GitHub Actions for automated generation
   - PR comments with generation details
   - Automated quality gates

### Research Areas

- **Code Refactoring**: AI-powered refactoring suggestions
- **Bug Detection**: Proactive bug detection in generated code
- **Performance Optimization**: Auto-optimize generated code
- **Multi-Language Support**: Java, Go, Rust support

---

## Appendix

### Configuration

**Environment Variables**:

```bash
ANTHROPIC_API_KEY=sk-ant-...    # Required for LLM calls
```

**Optional Settings** (in generator initialization):

```python
generator = CodeGenerator(
    project_root=Path.cwd(),
    anthropic_api_key="sk-ant-...",
    model="claude-sonnet-4-6",      # Default: Sonnet 4.6
    fallback_model="claude-haiku-4-5-20251001",  # Fallback: Haiku
    max_retries=2                          # API retry count
)
```

### File Paths

**Implementation**:

```
apps/backend/src/services/code_generation/
├── __init__.py              # Public API exports
├── context_builder.py       # Context analysis
├── generator.py             # Main code generator
├── test_generator.py        # Test generation
├── doc_generator.py         # Documentation generation
├── quality_checker.py       # Quality validation
└── prompts/                 # Prompt templates
    ├── python_generation.txt
    ├── typescript_generation.txt
    ├── test_generation.txt
    └── doc_generation.txt
```

**Tests**:

```
apps/backend/tests/services/code_generation/
├── test_context_builder.py
├── test_generator.py
├── test_test_generator.py
├── test_doc_generator.py
├── test_quality_checker.py
└── test_integration.py
```

### Troubleshooting

**Issue**: `ValueError: ANTHROPIC_API_KEY environment variable must be set`
**Solution**: Set the API key environment variable or pass it to the constructor

**Issue**: `RateLimitError: Rate limit exceeded`
**Solution**: Wait and retry, or reduce request frequency

**Issue**: Generated code has syntax errors
**Solution**: Check `syntax_valid` field, review generated code manually

**Issue**: Quality checks failing
**Solution**: Review `quality_report`, fix issues manually or regenerate

**Issue**: No tests generated
**Solution**: Ensure code has testable elements (functions, classes, components)

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Maintained By**: AI Development Team
