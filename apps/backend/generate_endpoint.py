"""Generate Customer Order History Endpoint."""
import asyncio
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
load_dotenv('../../.env')

from src.services.code_generation import (  # noqa: E402
    CodeGenerationRequest,
    CodeGenerator,
)


async def main():
    print('=' * 70)
    print('AI Code Generator - Customer Order History Endpoint')
    print('=' * 70)

    # Initialize generator
    print('\nInitializing code generator...')
    generator = CodeGenerator(project_root=Path.cwd().parent.parent)

    # Define requirement
    requirement = """Create a FastAPI GET endpoint to retrieve order history for a specific customer.

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
- Documentation: Comprehensive docstrings with request/response examples"""

    print('\nRequirement:')
    print(requirement)
    print('\nReference files:')
    print('  - apps/backend/src/api/routes/orders.py')
    print('  - apps/backend/src/api/routes/demo_lists.py')
    print('  - apps/backend/src/db/demo_models.py')

    # Create request
    request = CodeGenerationRequest(
        requirement=requirement,
        target_language='python',
        generation_type='feature',
        reference_files=[
            'apps/backend/src/api/routes/orders.py',
            'apps/backend/src/api/routes/demo_lists.py',
            'apps/backend/src/db/demo_models.py',
        ]
    )

    # Generate code
    print('\n' + '=' * 70)
    print('Calling Claude Sonnet 4.5...')
    print('(This will take 8-15 seconds)')
    print('=' * 70)
    result = await generator.generate(request)

    # Display results
    print('\n' + '=' * 70)
    print('GENERATION COMPLETE')
    print('=' * 70)

    generated_file = result.generated_files[0]
    print(f'\nGenerated File: {generated_file.file_path}')
    print(f'  Syntax Valid: {generated_file.syntax_valid}')
    print(f'  Lines of Code: {len(generated_file.content.splitlines())}')
    print(f'  Imports: {len(generated_file.imports)}')

    print(f'\nTests Generated: {len(result.tests)} file(s)')
    for test in result.tests:
        print(f'  - {test.file_path} ({len(test.content.splitlines())} lines)')

    if result.documentation:
        print(f'\nDocumentation: {len(result.documentation)} item(s)')
        for doc in result.documentation:
            print(f'  - {doc}')

    # Quality report
    print('\n' + '=' * 70)
    print('QUALITY REPORT')
    print('=' * 70)

    quality = result.quality_report
    print(f'\nLinting: {"PASSED" if quality.linting_passed else "FAILED"}')
    if quality.linting_errors:
        for error in quality.linting_errors[:3]:
            print(f'  - {error}')

    print(f'\nType Check: {"PASSED" if quality.type_check_passed else "FAILED"}')
    if quality.type_errors:
        for error in quality.type_errors[:3]:
            print(f'  - {error}')

    print(f'\nFormatting: {"Applied" if quality.formatting_applied else "Not needed"}')

    print(f'\nSecurity Issues: {len(quality.security_issues)}')
    if quality.security_issues:
        for issue in quality.security_issues:
            print(f'  ! {issue}')

    print(f'\nBest Practice Violations: {len(quality.best_practices_violations)}')
    if quality.best_practices_violations:
        for violation in quality.best_practices_violations[:3]:
            print(f'  ! {violation}')

    # PR Ready?
    print('\n' + '=' * 70)
    print(f'PR READY: {result.pr_ready}')
    if result.pr_ready:
        print('  - Syntax valid')
        print('  - Tests generated')
        print('  - Quality checks passed')
    print('=' * 70)

    # Save files
    print('\nSaving files...')

    output_file = Path('src/api/routes/customer_orders.py')
    output_file.write_text(generated_file.content, encoding='utf-8')
    print(f'  Saved: {output_file}')

    if result.tests:
        test_dir = Path('tests/api')
        test_dir.mkdir(parents=True, exist_ok=True)
        test_file = test_dir / 'test_customer_orders.py'
        test_file.write_text(result.tests[0].content, encoding='utf-8')
        print(f'  Saved: {test_file}')

    print('\n' + '=' * 70)
    print('SUCCESS - Files generated and saved!')
    print('=' * 70)

    return result


if __name__ == "__main__":
    result = asyncio.run(main())
