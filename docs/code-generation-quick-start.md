# Code Generation Quick Start Guide

Get started with AI-powered code generation in 5 minutes.

---

## Prerequisites

1. **Python 3.12+** installed
2. **Anthropic API key** (get from https://console.anthropic.com/)
3. **Project setup** complete

---

## Step 1: Set API Key

```bash
# Set environment variable (Linux/Mac)
export ANTHROPIC_API_KEY="sk-ant-..."

# Or Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."

# Or add to .env file
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
```

---

## Step 2: Basic Usage

```python
import asyncio
from pathlib import Path
from src.services.code_generation import (
    CodeGenerator,
    CodeGenerationRequest,
)

async def main():
    # Initialize generator
    generator = CodeGenerator(project_root=Path.cwd())

    # Create request
    request = CodeGenerationRequest(
        requirement="Create a function to calculate order total",
        target_language="python",
    )

    # Generate code
    result = await generator.generate(request)

    # Print generated code
    print(result.generated_files[0].content)

    # Check if PR-ready
    if result.pr_ready:
        print("✅ Code is ready for pull request!")

asyncio.run(main())
```

---

## Step 3: Common Patterns

### Generate API Endpoint

```python
request = CodeGenerationRequest(
    requirement="Create GET /api/products endpoint with pagination",
    target_language="python",
    reference_files=["apps/backend/src/api/routes/demo_lists.py"]
)
```

### Generate React Component

```python
request = CodeGenerationRequest(
    requirement="Create ProductCard component to display product info",
    target_language="typescript",
)
```

### Generate Service Class

```python
request = CodeGenerationRequest(
    requirement="Create EmailService class to send transactional emails",
    target_language="python",
)
```

---

## Step 4: Review Output

```python
result = await generator.generate(request)

# Generated code
for file in result.generated_files:
    print(f"\n=== {file.file_path} ===")
    print(file.content)

# Generated tests
for test in result.tests:
    print(f"\n=== {test.file_path} ===")
    print(test.content)

# Quality report
report = result.quality_report
print(f"\nLinting: {'✅' if report.linting_passed else '❌'}")
print(f"Type check: {'✅' if report.type_check_passed else '❌'}")
print(f"Security issues: {len(report.security_issues)}")
```

---

## Step 5: Save to File

```python
# Save generated code
output_file = Path(result.generated_files[0].file_path)
output_file.parent.mkdir(parents=True, exist_ok=True)
output_file.write_text(result.generated_files[0].content)

# Save tests
for test_file in result.tests:
    test_path = Path(test_file.file_path)
    test_path.parent.mkdir(parents=True, exist_ok=True)
    test_path.write_text(test_file.content)

print(f"✅ Saved to {output_file}")
```

---

## Complete Example

```python
"""
Complete example: Generate a product management endpoint
"""
import asyncio
from pathlib import Path
from src.services.code_generation import (
    CodeGenerator,
    CodeGenerationRequest,
)


async def generate_product_endpoint():
    """Generate a complete product management endpoint."""

    # Initialize
    generator = CodeGenerator(project_root=Path.cwd())

    # Define requirement
    requirement = """
    Create a FastAPI endpoint to update product information.

    Requirements:
    - PUT /api/products/{product_id}
    - Request body: name, price, stock (all optional)
    - Validate product exists (404 if not found)
    - Validate price > 0 if provided
    - Validate stock >= 0 if provided
    - Return updated product details
    - Include proper error handling
    - Add comprehensive documentation
    """

    # Create request
    request = CodeGenerationRequest(
        requirement=requirement,
        target_language="python",
        generation_type="feature",
        reference_files=[
            "apps/backend/src/api/routes/demo_lists.py",
            "apps/backend/src/db/demo_models.py"
        ]
    )

    # Generate
    print("🤖 Generating code...")
    result = await generator.generate(request)

    # Display results
    generated_file = result.generated_files[0]

    print(f"\n✅ Generated: {generated_file.file_path}")
    print(f"   Language: {generated_file.language}")
    print(f"   Syntax valid: {generated_file.syntax_valid}")
    print(f"   Lines: {len(generated_file.content.split('\\n'))}")

    # Quality report
    quality = result.quality_report
    print(f"\n📊 Quality Report:")
    print(f"   Linting: {'✅' if quality.linting_passed else '❌'}")
    print(f"   Type check: {'✅' if quality.type_check_passed else '❌'}")
    print(f"   Security issues: {len(quality.security_issues)}")
    print(f"   Best practice violations: {len(quality.best_practices_violations)}")

    # Tests
    print(f"\n🧪 Tests generated: {len(result.tests)}")
    for test in result.tests:
        print(f"   - {test.file_path}")

    # PR ready?
    if result.pr_ready:
        print("\n✅ Code is PR-ready! (syntax valid + tests generated)")
    else:
        print("\n⚠️  Code needs review before PR")

    # Save files
    output_dir = Path("generated_code")
    output_dir.mkdir(exist_ok=True)

    code_file = output_dir / "update_product_endpoint.py"
    code_file.write_text(generated_file.content)
    print(f"\n💾 Saved to: {code_file}")

    for i, test in enumerate(result.tests):
        test_file = output_dir / f"test_update_product_{i}.py"
        test_file.write_text(test.content)
        print(f"💾 Saved test: {test_file}")

    return result


# Run
if __name__ == "__main__":
    result = asyncio.run(generate_product_endpoint())
    print("\n🎉 Generation complete!")
```

---

## Troubleshooting

### Error: "ANTHROPIC_API_KEY environment variable must be set"

**Solution**:
```python
# Option 1: Set environment variable
import os
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

# Option 2: Pass directly to constructor
generator = CodeGenerator(
    project_root=Path.cwd(),
    anthropic_api_key="sk-ant-..."
)
```

### Error: "Rate limit exceeded"

**Solution**: Wait 60 seconds and retry, or reduce request frequency.

### Generated code has syntax errors

**Check**:
```python
if not result.generated_files[0].syntax_valid:
    print("⚠️  Syntax validation failed")
    print(result.generated_files[0].content)
```

**Solution**: Regenerate or fix manually.

### No tests generated

**Check**:
```python
if len(result.tests) == 0:
    print("⚠️  No tests generated")
```

**Solution**: Ensure generated code has testable elements (functions, classes, components).

---

## Next Steps

1. **Read full documentation**: [phase-5-week-4-code-generation.md](./phase-5-week-4-code-generation.md)
2. **Explore examples**: See API reference section
3. **Run tests**: `pytest tests/services/code_generation/`
4. **Customize prompts**: Edit templates in `src/services/code_generation/prompts/`

---

## Tips

✅ **DO**:
- Provide clear, specific requirements
- Include validation rules
- Reference similar files
- Review generated code before committing
- Run quality checks

❌ **DON'T**:
- Use vague requirements ("make it better")
- Skip quality review
- Commit without testing
- Ignore security warnings
- Generate production secrets

---

**Happy coding! 🚀**
