# Code Generation Service

AI-powered code generation using Claude Sonnet 4.5 with context awareness, automated testing, documentation, and quality validation.

---

## Quick Start

```python
from pathlib import Path
from src.services.code_generation import CodeGenerator, CodeGenerationRequest

# Initialize
generator = CodeGenerator(project_root=Path.cwd())

# Generate
request = CodeGenerationRequest(
    requirement="Create a function to calculate order total",
    target_language="python"
)
result = await generator.generate(request)

# Use generated code
print(result.generated_files[0].content)
```

---

## Components

### 1. CodeGenerator (`generator.py`)

Main orchestrator that coordinates all sub-components.

**Usage**:

```python
generator = CodeGenerator(
    project_root=Path("/path/to/project"),
    anthropic_api_key="sk-ant-..."  # Optional, can use env var
)
```

### 2. ContextBuilder (`context_builder.py`)

Analyzes codebase to understand patterns and conventions.

**What it does**:

- Maps project structure
- Detects code patterns (API routes, React components, services)
- Finds similar code examples
- Extracts style guides (naming, imports, frameworks)

### 3. TestGenerator (`test_generator.py`)

Automatically generates unit tests for generated code.

**Supports**:

- pytest (Python)
- Vitest (TypeScript)
- Endpoint tests
- Component tests

### 4. DocGenerator (`doc_generator.py`)

Adds comprehensive documentation to generated code.

**Styles**:

- Google-style docstrings (Python)
- JSDoc (TypeScript)

### 5. QualityChecker (`quality_checker.py`)

Validates code quality across multiple dimensions.

**Checks**:

- Linting (Ruff for Python)
- Type annotations
- Formatting (Black for Python)
- Security (secrets, SQL injection, XSS)
- Best practices (complexity, error handling)

---

## Models

### Input: CodeGenerationRequest

```python
request = CodeGenerationRequest(
    requirement="Create API endpoint...",  # Natural language requirement
    target_language="python",              # "python" or "typescript"
    generation_type="feature",             # "feature", "bug_fix", "refactor"
    reference_files=[],                    # Files to use as reference
    constraints={}                         # Optional constraints
)
```

### Output: CodeGenerationResult

```python
result = CodeGenerationResult(
    generated_files=[...],      # Generated code files
    tests=[...],                # Generated test files
    documentation=[...],        # Documentation summaries
    quality_report=...,         # Quality validation results
    pr_ready=True/False         # Whether code is ready for PR
)
```

---

## Configuration

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...    # Required for LLM calls
```

### Optional Parameters

```python
generator = CodeGenerator(
    project_root=Path.cwd(),
    anthropic_api_key="sk-ant-...",
    model="claude-sonnet-4-6",                  # Sonnet 4.6
    fallback_model="claude-haiku-4-5-20251001",  # Haiku 4.5 fallback
    max_retries=2                              # API retry count
)
```

---

## Examples

### Example 1: API Endpoint

```python
request = CodeGenerationRequest(
    requirement="""
    Create GET /api/products endpoint:
    - Pagination (page, page_size)
    - Search by name/SKU
    - Filter by category
    - Return product list with stock info
    """,
    target_language="python",
    reference_files=["apps/backend/src/api/routes/demo_lists.py"]
)

result = await generator.generate(request)
```

### Example 2: React Component

```python
request = CodeGenerationRequest(
    requirement="""
    Create ProductCard component:
    - Display: image, name, price, stock status
    - Props: product object, onAddToCart callback
    - Show "Out of Stock" badge if stock = 0
    - Use TypeScript with proper types
    """,
    target_language="typescript"
)

result = await generator.generate(request)
```

### Example 3: Service Class

```python
request = CodeGenerationRequest(
    requirement="""
    Create OrderService class:
    - Method: calculate_total(items)
    - Validate items not empty
    - Calculate subtotal + tax + shipping
    - Return breakdown dict
    """,
    target_language="python"
)

result = await generator.generate(request)
```

---

## Quality Standards

### Security Checks

Automatically scans for:

- ❌ Hardcoded secrets (API keys, passwords)
- ❌ SQL injection vulnerabilities
- ❌ XSS vulnerabilities (dangerouslySetInnerHTML)
- ❌ Unsafe eval/exec usage
- ❌ Shell injection risks

### Type Safety

Ensures:

- ✅ All functions have return type annotations
- ✅ All parameters have type annotations
- ✅ No `any` types in TypeScript

### Best Practices

Validates:

- ✅ Code complexity (< 10 cyclomatic complexity)
- ✅ Error handling in async functions
- ✅ No unused imports
- ✅ Proper formatting (Black for Python)

---

## Testing

Run tests:

```bash
cd apps/backend
pytest tests/services/code_generation/ -v
```

Test coverage:

- Context Builder: 26 tests
- Code Generator: 27 tests
- Test Generator: 26 tests
- Doc Generator: 25 tests
- Quality Checker: 41 tests
- Integration: 15 tests

**Total**: 160 tests, 100% passing

---

## Advanced Usage

### Standalone Components

```python
# Use context builder independently
from src.services.code_generation import ContextBuilder

builder = ContextBuilder(project_root=Path.cwd())
context = await builder.build_context(
    requirement="Create product endpoint",
    target_language="python"
)

# Use quality checker independently
from src.services.code_generation import QualityChecker

checker = QualityChecker(project_root=Path.cwd(), auto_fix=True)
report = await checker.check_quality(generated_file)
```

### Error Handling

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
```

---

## File Structure

```
src/services/code_generation/
├── __init__.py              # Public API exports
├── context_builder.py       # Codebase analysis (478 lines)
├── generator.py             # Main orchestrator (608 lines)
├── test_generator.py        # Test generation (380 lines)
├── doc_generator.py         # Documentation (340 lines)
├── quality_checker.py       # Quality validation (454 lines)
├── README.md                # This file
└── prompts/                 # LLM prompt templates
    ├── python_generation.txt
    ├── typescript_generation.txt
    ├── test_generation.txt
    └── doc_generation.txt
```

---

## Prompt Templates

Located in `prompts/` directory:

1. **python_generation.txt**: Python code generation
2. **typescript_generation.txt**: TypeScript code generation
3. **test_generation.txt**: Test generation (both languages)
4. **doc_generation.txt**: Documentation generation (both languages)

Templates use `{placeholder}` format for context injection.

---

## Troubleshooting

**Issue**: Generated code has syntax errors
**Check**: `result.generated_files[0].syntax_valid`
**Fix**: Regenerate or manually fix

**Issue**: No tests generated
**Check**: `len(result.tests) == 0`
**Cause**: Code may not have testable elements
**Fix**: Ensure functions/classes/components exist

**Issue**: Quality checks failing
**Check**: `result.quality_report.security_issues`
**Fix**: Review and fix security/type/linting issues

**Issue**: Rate limit errors
**Cause**: Too many API calls
**Fix**: Add delay between requests, use smaller batches

---

## Performance

- **Average generation time**: 3-8 seconds (depends on complexity)
- **LLM calls per request**: 2-4 (code, docs, tests, retries)
- **Context building**: < 1 second
- **Quality validation**: < 1 second

---

## Limitations

- **Single file generation**: Currently generates one file at a time
- **No multi-file coordination**: Doesn't handle cross-file dependencies
- **Limited context window**: Large codebases may exceed context limits
- **No incremental updates**: Always generates new code, doesn't modify existing

---

## Future Roadmap

See [phase-5-week-4-code-generation.md](../../../../../docs/phase-5-week-4-code-generation.md) for planned enhancements.

---

## Documentation

- **Full Documentation**: [docs/phase-5-week-4-code-generation.md](../../../../../docs/phase-5-week-4-code-generation.md)
- **Quick Start**: [docs/code-generation-quick-start.md](../../../../../docs/code-generation-quick-start.md)
- **API Reference**: See full documentation

---

## Support

For issues or questions:

1. Check documentation
2. Review test examples
3. Run `pytest tests/services/code_generation/ -v`

---

**Version**: 1.0
**Last Updated**: February 2026
**License**: MIT
