# Phase 5 Week 4: AI-Powered Code Generation - Architecture Design

> **Status**: In Progress
> **Week**: Week 4
> **Goal**: Build AI-powered code generation with context-awareness, test generation, and documentation

## Overview

Week 4 implements an AI-powered code generation system that can write production-quality code from natural language requirements, following project conventions and generating tests and documentation automatically.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   AI Code Generation System                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Requirements Analysis                                        │
│     • Parse natural language requirements                        │
│     • Extract key entities and actions                           │
│     • Identify affected files                                    │
│     • Determine scope (new feature, bug fix, refactor)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Context Builder                                              │
│     • Analyze file structure                                     │
│     • Extract existing patterns                                  │
│     • Find similar code                                          │
│     • Build dependency graph                                     │
│     • Extract code style rules                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Code Generation (LLM)                                        │
│     • Inject context into prompt                                 │
│     • Generate implementation code                               │
│     • Follow project conventions                                 │
│     • Support multi-file generation                              │
│     • Validate syntax                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Test Generation                                              │
│     • Analyze generated code                                     │
│     • Generate unit tests                                        │
│     • Generate integration tests                                 │
│     • Create test fixtures                                       │
│     • Ensure coverage                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Documentation Generation                                     │
│     • Generate inline comments                                   │
│     • Create docstrings                                          │
│     • Update API documentation                                   │
│     • Update README if needed                                    │
│     • Generate architecture docs                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Quality Checks                                               │
│     • Run linters (ESLint, Ruff)                                 │
│     • Type checking (TypeScript, mypy)                           │
│     • Format code (Prettier, Black)                              │
│     • Security scanning                                          │
│     • Best practices validation                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. PR Creation (Integration with Week 2/3)                     │
│     • Create branch                                              │
│     • Commit changes                                             │
│     • Create PR with description                                 │
│     • Autonomy decision (auto-merge or review)                   │
│     • Audit logging                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Requirements Analyzer

**Purpose**: Parse and understand natural language requirements

**Responsibilities**:
- Extract key entities (models, functions, APIs)
- Identify actions (create, update, delete, refactor)
- Determine affected files
- Classify task type (feature, bug fix, refactor)

**Input**: Natural language requirement
**Output**: Structured requirement object

**Example**:
```python
requirement = "Add a delete button to the product list page with confirmation dialog"

analyzed = {
    "type": "feature",
    "entities": ["ProductList", "DeleteButton", "ConfirmationDialog"],
    "actions": ["add", "confirm"],
    "affected_files": [
        "apps/web/app/(dashboard)/products/page.tsx",
        "apps/web/components/products/DeleteProductDialog.tsx"
    ],
    "scope": "UI component addition"
}
```

---

### 2. Context Builder

**Purpose**: Gather relevant context from codebase for informed code generation

**Responsibilities**:
- File structure analysis
- Pattern detection
- Similar code finding
- Dependency tracking
- Style guide extraction

**Key Features**:

**2.1 File Structure Analysis**
```python
structure = {
    "backend": {
        "api_routes": "apps/backend/src/api/routes/",
        "models": "apps/backend/src/db/",
        "services": "apps/backend/src/services/",
        "tests": "apps/backend/tests/"
    },
    "frontend": {
        "pages": "apps/web/app/(dashboard)/",
        "components": "apps/web/components/",
        "tests": "apps/web/__tests__/"
    }
}
```

**2.2 Pattern Detection**
- Detect API route patterns
- Identify component patterns
- Extract naming conventions
- Find common imports

**2.3 Similar Code Finding**
- Vector similarity search
- Text similarity (fuzzy matching)
- Pattern matching

**2.4 Style Guide Extraction**
```python
style_guide = {
    "frontend": {
        "framework": "Next.js 15 + React 19",
        "styling": "Tailwind CSS v4",
        "components": "shadcn/ui",
        "forms": "React Hook Form + Zod",
        "patterns": ["login-form.tsx", "ProductForm.tsx"]
    },
    "backend": {
        "framework": "FastAPI",
        "orm": "SQLAlchemy 2.0",
        "validation": "Pydantic v2",
        "patterns": ["demo_lists.py", "orders.py"]
    }
}
```

---

### 3. Code Generator

**Purpose**: Generate production-quality code using LLM

**Responsibilities**:
- Prompt engineering
- Context injection
- Multi-file generation
- Syntax validation
- Error handling

**LLM Integration**:
- **Model**: Claude Sonnet 4.5 (primary)
- **Fallback**: Claude Haiku (for simple tasks)
- **API**: Anthropic API

**Prompt Structure**:
```python
prompt = f"""
You are an expert {language} developer working on the CCW ERP system.

## Task
{requirement_description}

## Project Context
Framework: {framework}
Style: {style_guide}
Conventions: {conventions}

## Reference Patterns
{reference_code_examples}

## Similar Code
{similar_code_snippets}

## Dependencies
{existing_dependencies}

## Instructions
1. Follow the exact patterns shown in reference code
2. Use existing dependencies (don't add new ones without approval)
3. Follow naming conventions: {naming_rules}
4. Include proper error handling
5. Add TypeScript types / Python type hints
6. Keep it simple (no over-engineering)

Generate production-ready code for this task.
"""
```

**Output Validation**:
- Syntax checking (AST parsing)
- Import validation
- Type checking
- Security scanning (no hardcoded secrets)

---

### 4. Test Generator

**Purpose**: Automatically generate comprehensive tests for generated code

**Responsibilities**:
- Unit test generation
- Integration test scaffolding
- Test data generation
- Coverage analysis

**Test Types**:

**4.1 Unit Tests**
```python
# For a function: create_product(data)
def test_create_product_success():
    """Test successful product creation."""
    data = {"name": "Test Product", "sku": "TEST-001", "price": 99.99}
    result = create_product(data)

    assert result.name == "Test Product"
    assert result.sku == "TEST-001"
    assert result.price == 99.99

def test_create_product_invalid_data():
    """Test product creation with invalid data."""
    data = {"name": ""}  # Missing required fields

    with pytest.raises(ValidationError):
        create_product(data)
```

**4.2 Integration Tests**
```python
async def test_create_product_endpoint():
    """Test POST /api/products endpoint."""
    response = await client.post(
        "/api/products",
        json={"name": "Test", "sku": "TEST-001", "price": 99.99}
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Test"
```

**4.3 Component Tests** (Frontend)
```typescript
describe("DeleteProductDialog", () => {
  it("shows confirmation message", () => {
    render(<DeleteProductDialog productName="Test Product" />);
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it("calls onConfirm when confirmed", () => {
    const onConfirm = jest.fn();
    render(<DeleteProductDialog onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

---

### 5. Documentation Generator

**Purpose**: Automatically generate comprehensive documentation

**Responsibilities**:
- Inline comments
- Docstrings
- API documentation
- README updates

**Documentation Types**:

**5.1 Inline Comments**
```python
# Complex logic only
def calculate_discount(price: float, customer_tier: str) -> float:
    """Calculate discount based on customer tier."""
    # VIP customers get 20% off, Premium 10%, Standard 0%
    tier_discounts = {"VIP": 0.2, "Premium": 0.1, "Standard": 0.0}
    return price * (1 - tier_discounts.get(customer_tier, 0.0))
```

**5.2 Docstrings**
```python
def create_product(data: ProductCreate) -> Product:
    """
    Create a new product in the catalog.

    Args:
        data: Product creation data including name, SKU, price, etc.

    Returns:
        Created product with ID and timestamps

    Raises:
        ValidationError: If data is invalid
        IntegrityError: If SKU already exists

    Example:
        >>> product = create_product(ProductCreate(name="Widget", sku="WID-001", price=9.99))
        >>> product.id
        UUID('...')
    """
```

**5.3 API Documentation**
```python
@router.post("/products", status_code=201)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db)
) -> Product:
    """
    Create a new product.

    **Request Body:**
    ```json
    {
      "name": "Product Name",
      "sku": "PROD-001",
      "price": 99.99,
      "description": "Optional description"
    }
    ```

    **Response:**
    ```json
    {
      "id": "uuid",
      "name": "Product Name",
      "sku": "PROD-001",
      "price": 99.99,
      "created_at": "2026-02-04T10:00:00Z"
    }
    ```

    **Errors:**
    - 400: Validation error (invalid data)
    - 409: Conflict (SKU already exists)
    """
```

---

### 6. Quality Checker

**Purpose**: Ensure generated code meets quality standards

**Checks**:

**6.1 Linting**
- Frontend: ESLint
- Backend: Ruff
- Auto-fix: Yes (where safe)

**6.2 Type Checking**
- Frontend: TypeScript compiler
- Backend: mypy / Pyright
- Strict mode: Yes

**6.3 Formatting**
- Frontend: Prettier
- Backend: Black
- Auto-format: Yes

**6.4 Security**
- No hardcoded secrets
- No SQL injection vulnerabilities
- No XSS vulnerabilities
- Safe API practices

**6.5 Best Practices**
- No unused imports
- No dead code
- Proper error handling
- Consistent naming
- No over-engineering

---

## Data Models

### CodeGenerationRequest
```python
@dataclass
class CodeGenerationRequest:
    """Request for code generation."""

    requirement: str  # Natural language requirement
    context: dict[str, Any]  # Additional context
    target_language: str  # "typescript", "python"
    generation_type: str  # "feature", "bug_fix", "refactor"
    reference_files: list[str]  # Files to use as reference
    constraints: dict[str, Any]  # Generation constraints
```

### CodeGenerationResult
```python
@dataclass
class CodeGenerationResult:
    """Result of code generation."""

    generated_files: list[GeneratedFile]
    tests: list[GeneratedFile]
    documentation: list[str]
    quality_report: QualityReport
    pr_ready: bool
```

### GeneratedFile
```python
@dataclass
class GeneratedFile:
    """A generated code file."""

    file_path: str
    content: str
    language: str
    file_type: str  # "implementation", "test", "documentation"
    syntax_valid: bool
    imports: list[str]
```

### QualityReport
```python
@dataclass
class QualityReport:
    """Quality check results."""

    linting_passed: bool
    linting_errors: list[str]
    type_check_passed: bool
    type_errors: list[str]
    formatting_applied: bool
    security_issues: list[str]
    best_practices_violations: list[str]
```

---

## Integration with Existing Systems

### Week 2: PR Automation
- Use PR creation workflow
- Automatically commit generated code
- Create descriptive PR with context

### Week 3: Autonomy Framework
- Risk assessment for generated code
- Auto-merge if LOW risk + tests pass
- Protected files respected
- Complete audit trail

### Monitoring
- Log all generation requests
- Track success/failure rates
- Monitor quality metrics
- Analyze common issues

---

## Progressive Rollout Strategy

### Phase 1: Shadow Mode (Week 4.1)
- Generate code but don't commit
- Manual review of all outputs
- Collect quality metrics
- Validate context builder accuracy

### Phase 2: Documentation Only (Week 4.2)
- Auto-generate documentation
- Auto-commit docs only
- Code generation requires review

### Phase 3: Test Generation (Week 4.3)
- Auto-generate tests
- Auto-commit tests
- Code still requires review

### Phase 4: Simple Features (Week 4.4)
- Auto-generate simple UI components
- Auto-generate CRUD endpoints
- Auto-merge if LOW risk

### Phase 5: Full Generation (Week 5+)
- Auto-generate complex features
- Context-aware refactoring
- End-to-end automation

---

## Success Metrics

### Code Quality
- **Syntax Validity**: 100%
- **Type Check Pass Rate**: >95%
- **Linting Pass Rate**: >90%
- **Test Coverage**: >80%

### Generation Accuracy
- **Follows Patterns**: >90%
- **Correct Imports**: >95%
- **Style Compliance**: >90%

### Autonomy
- **Auto-Commit Rate**: Progressive (0% → 50%)
- **Auto-Merge Rate**: Progressive (0% → 30%)
- **Reversion Rate**: <5%

### Performance
- **Generation Time**: <60s for single file
- **Context Build Time**: <10s
- **Test Generation Time**: <30s

---

## Technology Stack

### LLM
- **Primary**: Claude Sonnet 4.5 (Anthropic API)
- **Fallback**: Claude Haiku (cost optimization)
- **Embedding**: text-embedding-3-small (OpenAI)

### Code Analysis
- **AST Parsing**: ast (Python), @typescript-eslint/parser (TS)
- **Pattern Matching**: regex, fuzzy matching
- **Similarity**: cosine similarity on embeddings

### Quality Tools
- **Frontend**: ESLint, TypeScript, Prettier
- **Backend**: Ruff, mypy, Black
- **Security**: bandit, semgrep

---

## File Structure

```
apps/backend/src/
├── services/
│   ├── code_generation/
│   │   ├── __init__.py
│   │   ├── generator.py           # Main code generator
│   │   ├── context_builder.py     # Context analysis
│   │   ├── test_generator.py      # Test generation
│   │   ├── doc_generator.py       # Documentation generation
│   │   ├── quality_checker.py     # Quality validation
│   │   └── prompts/
│   │       ├── python_generation.txt
│   │       ├── typescript_generation.txt
│   │       ├── test_generation.txt
│   │       └── doc_generation.txt
│   └── requirements_analyzer.py
├── api/routes/
│   └── code_generation.py         # API endpoints
└── tests/
    └── services/
        └── code_generation/
            ├── test_generator.py
            ├── test_context_builder.py
            ├── test_test_generator.py
            └── test_quality_checker.py
```

---

## Next Steps

1. ✅ Architecture design (this document)
2. ⏳ Implement context builder
3. ⏳ Implement code generator
4. ⏳ Implement test generator
5. ⏳ Implement documentation generator
6. ⏳ Implement quality checker
7. ⏳ Integration testing
8. ⏳ Documentation

---

**Architecture Status**: ✅ Complete
**Next Task**: Implement Context Builder (#69)
**Target**: Production-ready AI code generation by end of Week 4
