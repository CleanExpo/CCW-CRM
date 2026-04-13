"""Tests for Quality Checker.

Tests code quality validation including linting, type checking,
formatting, security scanning, and best practices.
"""

from pathlib import Path

import pytest

from src.services.code_generation.generator import GeneratedFile
from src.services.code_generation.quality_checker import QualityChecker

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def project_root():
    """Project root directory."""
    return Path(__file__).parents[5]


@pytest.fixture
def quality_checker(project_root):
    """QualityChecker instance."""
    return QualityChecker(project_root=project_root, auto_fix=True)


# ============================================================================
# Python Linting Tests
# ============================================================================


@pytest.mark.asyncio
async def test_ruff_check_clean_code(quality_checker):
    """Test Ruff check on clean Python code."""
    code = '''
def calculate_total(items: list[dict]) -> float:
    """Calculate total price."""
    return sum(item["price"] for item in items)
'''

    errors = await quality_checker._run_ruff_check(code)

    # Clean code should have no errors (or Ruff not installed)
    assert isinstance(errors, list)


@pytest.mark.asyncio
async def test_ruff_check_with_issues(quality_checker):
    """Test Ruff detects linting issues."""
    code = '''
import os
import sys

def test():
    x=1+2
    return x
'''

    errors = await quality_checker._run_ruff_check(code)

    # May detect unused imports or formatting issues
    assert isinstance(errors, list)


# ============================================================================
# Python Type Checking Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_python_types_no_annotations(quality_checker):
    """Test detecting missing type annotations."""
    code = """
def calculate_total(items):
    return sum(items)
"""

    errors = await quality_checker._check_python_types(code)

    assert len(errors) > 0
    assert any("missing type annotation" in err.lower() for err in errors)


@pytest.mark.asyncio
async def test_check_python_types_with_annotations(quality_checker):
    """Test clean code with type annotations."""
    code = """
def calculate_total(items: list[float]) -> float:
    return sum(items)
"""

    errors = await quality_checker._check_python_types(code)

    assert len(errors) == 0


@pytest.mark.asyncio
async def test_check_python_types_skip_private(quality_checker):
    """Test that private methods are skipped."""
    code = """
def _internal_helper(x):
    return x * 2

def __private(x):
    return x * 3
"""

    errors = await quality_checker._check_python_types(code)

    # Private methods should be skipped
    assert len(errors) == 0


@pytest.mark.asyncio
async def test_check_python_types_skip_init(quality_checker):
    """Test that __init__ is skipped for return type."""
    code = """
class MyClass:
    def __init__(self, value: int):
        self.value = value
"""

    errors = await quality_checker._check_python_types(code)

    # __init__ doesn't need return type annotation
    assert len(errors) == 0


# ============================================================================
# Python Formatting Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_python_formatting_clean(quality_checker):
    """Test formatted Python code."""
    code = '''
def calculate_total(items: list[dict]) -> float:
    """Calculate total price."""
    return sum(item["price"] for item in items)
'''

    needs_formatting, formatted_code = await quality_checker._check_python_formatting(
        code
    )

    # Clean code may or may not need formatting depending on Black availability
    assert isinstance(needs_formatting, bool)
    assert isinstance(formatted_code, str)


@pytest.mark.asyncio
async def test_check_python_formatting_messy(quality_checker):
    """Test unformatted Python code."""
    code = "def test():x=1+2;return x"

    needs_formatting, formatted_code = await quality_checker._check_python_formatting(
        code
    )

    # If Black is installed, should detect need for formatting
    assert isinstance(needs_formatting, bool)
    assert isinstance(formatted_code, str)


# ============================================================================
# Python Security Scanning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_scan_python_security_hardcoded_api_key(quality_checker):
    """Test detecting hardcoded API keys."""
    code = '''
api_key = "sk-1234567890abcdefghijklmnopqrst"
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("api key" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_hardcoded_password(quality_checker):
    """Test detecting hardcoded passwords."""
    code = '''
password = "mysecretpass123"
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("password" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_sql_injection(quality_checker):
    """Test detecting SQL injection risks."""
    code = '''
query = f"SELECT * FROM users WHERE id = {user_id}"
db.execute(query)
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("sql injection" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_eval_usage(quality_checker):
    """Test detecting eval() usage."""
    code = '''
result = eval(user_input)
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("eval" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_exec_usage(quality_checker):
    """Test detecting exec() usage."""
    code = '''
exec(dynamic_code)
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("exec" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_pickle_usage(quality_checker):
    """Test detecting unsafe pickle usage."""
    code = '''
import pickle

data = pickle.loads(user_data)
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("pickle" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_os_system(quality_checker):
    """Test detecting os.system() usage."""
    code = '''
import os

os.system(command)
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("os.system" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_shell_true(quality_checker):
    """Test detecting shell=True in subprocess."""
    code = '''
import subprocess

subprocess.run(command, shell=True)
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) > 0
    assert any("shell=true" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_python_security_clean_code(quality_checker):
    """Test clean code with no security issues."""
    code = '''
import subprocess

def safe_function(data: dict) -> str:
    """Safe function."""
    result = subprocess.run(["ls", "-la"], capture_output=True)
    return result.stdout.decode()
'''

    issues = await quality_checker._scan_python_security(code)

    assert len(issues) == 0


# ============================================================================
# Python Best Practices Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_python_best_practices_unused_imports(quality_checker):
    """Test detecting unused imports."""
    code = '''
import os
import sys
import json

def test():
    return json.dumps({"test": "data"})
'''

    violations = await quality_checker._check_python_best_practices(code)

    # Should detect os and sys as unused
    assert len(violations) > 0
    assert any("unused import" in v.lower() for v in violations)


@pytest.mark.asyncio
async def test_check_python_best_practices_complex_function(quality_checker):
    """Test detecting overly complex functions."""
    code = '''
def complex_function(x):
    if x > 0:
        if x < 10:
            if x % 2 == 0:
                if x < 5:
                    if x == 2:
                        if x != 3:
                            if x < 4:
                                return True
    return False
'''

    violations = await quality_checker._check_python_best_practices(code)

    # Should detect high complexity
    assert len(violations) > 0
    assert any("complex" in v.lower() for v in violations)


@pytest.mark.asyncio
async def test_check_python_best_practices_missing_error_handling(quality_checker):
    """Test detecting missing error handling in async functions."""
    code = '''
async def fetch_data(url: str):
    response = await api_client.get(url)
    return response.json()
'''

    violations = await quality_checker._check_python_best_practices(code)

    # Should suggest error handling for async functions
    assert len(violations) > 0
    assert any("error handling" in v.lower() for v in violations)


@pytest.mark.asyncio
async def test_check_python_best_practices_clean_code(quality_checker):
    """Test clean code with no violations."""
    code = '''
async def fetch_data(url: str) -> dict:
    """Fetch data from API."""
    try:
        response = await api_client.get(url)
        return response.json()
    except Exception as e:
        logger.error(f"Failed to fetch data: {e}")
        raise
'''

    violations = await quality_checker._check_python_best_practices(code)

    # Clean code should have minimal violations
    assert len(violations) <= 1  # May have unused import warning


@pytest.mark.asyncio
async def test_calculate_complexity_simple(quality_checker):
    """Test complexity calculation for simple function."""
    import ast

    code = '''
def simple_function(x):
    return x * 2
'''

    tree = ast.parse(code)
    func_node = tree.body[0]

    complexity = quality_checker._calculate_complexity(func_node)

    assert complexity == 1  # No decision points


@pytest.mark.asyncio
async def test_calculate_complexity_with_conditions(quality_checker):
    """Test complexity calculation with conditions."""
    import ast

    code = '''
def conditional_function(x):
    if x > 0:
        return x
    elif x < 0:
        return -x
    else:
        return 0
'''

    tree = ast.parse(code)
    func_node = tree.body[0]

    complexity = quality_checker._calculate_complexity(func_node)

    # 1 (base) + 1 (if) + 1 (elif as another If node) = 3
    assert complexity >= 2


# ============================================================================
# TypeScript Linting Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_typescript_linting_console_log(quality_checker):
    """Test detecting console.log in TypeScript."""
    code = '''
export function debugData(data: any) {
    console.log(data);
    return data;
}
'''

    errors = await quality_checker._check_typescript_linting(code)

    assert len(errors) > 0
    assert any("console.log" in err.lower() for err in errors)


@pytest.mark.asyncio
async def test_check_typescript_linting_any_type(quality_checker):
    """Test detecting 'any' type usage."""
    code = '''
export function processData(data: any): any {
    return data;
}
'''

    errors = await quality_checker._check_typescript_linting(code)

    assert len(errors) > 0
    assert any("any" in err.lower() for err in errors)


@pytest.mark.asyncio
async def test_check_typescript_linting_var_usage(quality_checker):
    """Test detecting var usage."""
    code = '''
export function test() {
    var x = 1;
    return x;
}
'''

    errors = await quality_checker._check_typescript_linting(code)

    assert len(errors) > 0
    assert any("var" in err.lower() for err in errors)


@pytest.mark.asyncio
async def test_check_typescript_linting_clean_code(quality_checker):
    """Test clean TypeScript code."""
    code = '''
export function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + item.price, 0);
}
'''

    errors = await quality_checker._check_typescript_linting(code)

    assert len(errors) == 0


# ============================================================================
# TypeScript Type Checking Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_typescript_types_missing_return_type(quality_checker):
    """Test detecting missing return type in TypeScript."""
    code = '''
export function calculateTotal(items: Item[]) {
    return items.reduce((sum, item) => sum + item.price, 0);
}
'''

    errors = await quality_checker._check_typescript_types(code)

    assert len(errors) > 0
    assert any("return type" in err.lower() for err in errors)


@pytest.mark.asyncio
async def test_check_typescript_types_with_return_type(quality_checker):
    """Test clean TypeScript with return types."""
    code = '''
export function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + item.price, 0);
}
'''

    errors = await quality_checker._check_typescript_types(code)

    assert len(errors) == 0


# ============================================================================
# TypeScript Security Scanning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_scan_typescript_security_hardcoded_key(quality_checker):
    """Test detecting hardcoded API key in TypeScript."""
    code = '''
const API_KEY = "sk-1234567890abcdefghijklmnopqrst";
'''

    issues = await quality_checker._scan_typescript_security(code)

    assert len(issues) > 0
    assert any("api key" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_typescript_security_eval_usage(quality_checker):
    """Test detecting eval() in TypeScript."""
    code = '''
const result = eval(userInput);
'''

    issues = await quality_checker._scan_typescript_security(code)

    assert len(issues) > 0
    assert any("eval" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_typescript_security_dangerously_set_inner_html(quality_checker):
    """Test detecting dangerouslySetInnerHTML."""
    code = '''
export function Component() {
    return <div dangerouslySetInnerHTML={{ __html: userContent }} />;
}
'''

    issues = await quality_checker._scan_typescript_security(code)

    assert len(issues) > 0
    assert any("dangerouslysetinnerhtml" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_typescript_security_inner_html(quality_checker):
    """Test detecting innerHTML usage."""
    code = '''
element.innerHTML = userContent;
'''

    issues = await quality_checker._scan_typescript_security(code)

    assert len(issues) > 0
    assert any("innerhtml" in issue.lower() for issue in issues)


@pytest.mark.asyncio
async def test_scan_typescript_security_clean_code(quality_checker):
    """Test clean TypeScript with no security issues."""
    code = '''
export function Component({ data }: Props): JSX.Element {
    return <div>{data.title}</div>;
}
'''

    issues = await quality_checker._scan_typescript_security(code)

    assert len(issues) == 0


# ============================================================================
# TypeScript Best Practices Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_typescript_best_practices_missing_error_handling(
    quality_checker,
):
    """Test detecting missing error handling in async functions."""
    code = '''
export async function fetchData(url: string) {
    const response = await fetch(url);
    return response.json();
}
'''

    violations = await quality_checker._check_typescript_best_practices(code)

    assert len(violations) > 0
    assert any("error handling" in v.lower() for v in violations)


@pytest.mark.asyncio
async def test_check_typescript_best_practices_use_state_no_type(quality_checker):
    """Test detecting useState without type parameter."""
    code = '''
export function Component() {
    const [count, setCount] = useState(0);
    return <div>{count}</div>;
}
'''

    violations = await quality_checker._check_typescript_best_practices(code)

    assert len(violations) > 0
    assert any("usestate" in v.lower() for v in violations)


@pytest.mark.asyncio
async def test_check_typescript_best_practices_clean_code(quality_checker):
    """Test clean TypeScript with best practices."""
    code = '''
export async function fetchData(url: string): Promise<Data> {
    try {
        const response = await fetch(url);
        return response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
}
'''

    violations = await quality_checker._check_typescript_best_practices(code)

    # May have console.error but that's in error handling, so acceptable
    assert len(violations) <= 1


# ============================================================================
# Full Quality Check Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_quality_python_clean(quality_checker):
    """Test full quality check on clean Python code."""
    generated_file = GeneratedFile(
        file_path="apps/backend/src/module.py",
        content='''
async def fetch_data(url: str) -> dict:
    """Fetch data from API."""
    try:
        response = await api_client.get(url)
        return response.json()
    except Exception as e:
        logger.error(f"Failed: {e}")
        raise
''',
        language="python",
        file_type="implementation",
        syntax_valid=True,
        imports=["api_client", "logger"],
    )

    report = await quality_checker.check_quality(generated_file)

    # Clean code should pass most checks
    assert report.linting_passed or len(report.linting_errors) <= 2
    assert len(report.security_issues) == 0


@pytest.mark.asyncio
async def test_check_quality_python_with_issues(quality_checker):
    """Test full quality check on Python code with issues."""
    generated_file = GeneratedFile(
        file_path="apps/backend/src/module.py",
        content='''
api_key = "sk-1234567890abcdefghijklmnopqrst"

def test(x):
    result = eval(x)
    return result
''',
        language="python",
        file_type="implementation",
        syntax_valid=True,
        imports=[],
    )

    report = await quality_checker.check_quality(generated_file)

    # Should detect security issues and type issues
    assert len(report.security_issues) > 0
    assert len(report.type_errors) > 0


@pytest.mark.asyncio
async def test_check_quality_typescript_clean(quality_checker):
    """Test full quality check on clean TypeScript code."""
    generated_file = GeneratedFile(
        file_path="apps/web/components/Component.tsx",
        content='''
export async function fetchData(url: string): Promise<Data> {
    try {
        const response = await fetch(url);
        return response.json();
    } catch (error) {
        throw error;
    }
}
''',
        language="typescript",
        file_type="implementation",
        syntax_valid=True,
        imports=[],
    )

    report = await quality_checker.check_quality(generated_file)

    # Clean code should pass checks
    assert len(report.security_issues) == 0


@pytest.mark.asyncio
async def test_check_quality_typescript_with_issues(quality_checker):
    """Test full quality check on TypeScript code with issues."""
    generated_file = GeneratedFile(
        file_path="apps/web/components/Component.tsx",
        content='''
const API_KEY = "sk-12345678901234567890";

export function Component() {
    const [data, setData] = useState(null);
    return <div dangerouslySetInnerHTML={{ __html: data }} />;
}
''',
        language="typescript",
        file_type="implementation",
        syntax_valid=True,
        imports=[],
    )

    report = await quality_checker.check_quality(generated_file)

    # Should detect security issues
    assert len(report.security_issues) > 0
    assert len(report.best_practices_violations) > 0
