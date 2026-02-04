"""Generate Customer Order History Endpoint using AI Code Generator."""
import asyncio
from pathlib import Path
from src.services.code_generation import (
    CodeGenerator,
    CodeGenerationRequest,
)


async def main():
    """Generate customer order history endpoint."""
    print("🤖 AI Code Generator - Customer Order History Endpoint")
    print("=" * 70)

    # Initialize generator
    print("\n📦 Initializing code generator...")
    generator = CodeGenerator(project_root=Path.cwd())

    # Define requirement
    requirement = """
    Create a FastAPI GET endpoint to retrieve order history for a specific customer.

    Requirements:
    - Endpoint: GET /api/customers/{customer_id}/orders
    - Path parameter: customer_id (UUID)
    - Query parameters:
      - page (int, default: 1, min: 1)
      - page_size (int, default: 50, min: 1, max: 100)
      - status (optional): filter by order status
      - start_date (optional): filter orders after this date
      - end_date (optional): filter orders before this date
    - Response: Paginated list of orders with order items included
    - Sort: By order_date descending (newest first)
    - Include: Order items with product details
    - Error handling:
      - Return 404 if customer not found
      - Return 400 for invalid parameters
    - Authentication: Requires JWT token
    - Documentation: Comprehensive docstrings with request/response examples
    """

    print("\n📝 Requirement:")
    print(requirement)

    # Create request
    print("\n🔨 Building generation request...")
    request = CodeGenerationRequest(
        requirement=requirement,
        target_language="python",
        generation_type="feature",
        reference_files=[
            "apps/backend/src/api/routes/orders.py",
            "apps/backend/src/api/routes/demo_lists.py",
            "apps/backend/src/db/demo_models.py",
        ]
    )

    # Generate code
    print("\n⚡ Generating code with Claude Sonnet 4.5...")
    print("   (This will take 8-15 seconds...)")
    result = await generator.generate(request)

    # Display results
    print("\n" + "=" * 70)
    print("✅ GENERATION COMPLETE")
    print("=" * 70)

    # Generated code
    generated_file = result.generated_files[0]
    print(f"\n📄 Generated File: {generated_file.file_path}")
    print(f"   Language: {generated_file.language}")
    print(f"   Syntax Valid: {'✅' if generated_file.syntax_valid else '❌'}")
    print(f"   Lines of Code: {len(generated_file.content.split(chr(10)))}")
    print(f"   Imports: {len(generated_file.imports)}")

    print("\n" + "-" * 70)
    print("GENERATED CODE:")
    print("-" * 70)
    print(generated_file.content)

    # Tests
    print("\n" + "=" * 70)
    print(f"🧪 Generated Tests: {len(result.tests)}")
    print("=" * 70)

    for i, test_file in enumerate(result.tests, 1):
        print(f"\n📄 Test File #{i}: {test_file.file_path}")
        print(f"   Lines: {len(test_file.content.split(chr(10)))}")
        print(f"   Syntax Valid: {'✅' if test_file.syntax_valid else '❌'}")
        print("\n" + "-" * 70)
        print("TEST CODE:")
        print("-" * 70)
        print(test_file.content)

    # Documentation
    if result.documentation:
        print("\n" + "=" * 70)
        print(f"📚 Documentation: {len(result.documentation)} items")
        print("=" * 70)
        for doc in result.documentation:
            print(f"   ✅ {doc}")

    # Quality report
    print("\n" + "=" * 70)
    print("📊 QUALITY REPORT")
    print("=" * 70)

    quality = result.quality_report

    print(f"\n✓ Linting: {'✅ PASSED' if quality.linting_passed else '❌ FAILED'}")
    if quality.linting_errors:
        for error in quality.linting_errors[:5]:  # Show first 5
            print(f"  - {error}")

    print(f"\n✓ Type Check: {'✅ PASSED' if quality.type_check_passed else '❌ FAILED'}")
    if quality.type_errors:
        for error in quality.type_errors[:5]:
            print(f"  - {error}")

    print(f"\n✓ Formatting: {'✅ Applied' if quality.formatting_applied else 'Not needed'}")

    print(f"\n✓ Security Issues: {len(quality.security_issues)}")
    if quality.security_issues:
        for issue in quality.security_issues:
            print(f"  ⚠️  {issue}")
    else:
        print("  ✅ No security issues detected")

    print(f"\n✓ Best Practice Violations: {len(quality.best_practices_violations)}")
    if quality.best_practices_violations:
        for violation in quality.best_practices_violations[:5]:
            print(f"  ⚠️  {violation}")
    else:
        print("  ✅ No violations detected")

    # PR Ready?
    print("\n" + "=" * 70)
    if result.pr_ready:
        print("🎉 CODE IS PR-READY!")
        print("   ✅ Syntax valid")
        print("   ✅ Tests generated")
        print("   ✅ Quality checks passed")
    else:
        print("⚠️  CODE NEEDS REVIEW")
        print("   Review quality report above")
    print("=" * 70)

    # Save to file
    output_file = Path("apps/backend/src/api/routes") / "customer_orders.py"
    output_file.write_text(generated_file.content, encoding="utf-8")
    print(f"\n💾 Saved to: {output_file}")

    if result.tests:
        test_file_path = Path("apps/backend/tests/api") / "test_customer_orders.py"
        test_file_path.parent.mkdir(parents=True, exist_ok=True)
        test_file_path.write_text(result.tests[0].content, encoding="utf-8")
        print(f"💾 Saved tests to: {test_file_path}")

    print("\n✅ Generation complete! Files saved and ready to use.")

    return result


if __name__ == "__main__":
    result = asyncio.run(main())
