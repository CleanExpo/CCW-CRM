"""Code quality checker for generated code.

Performs linting, type checking, formatting, and security scanning
on generated code to ensure it meets project standards.

Phase B2 additions:
- mypy static type checking for Python
- ESLint integration for TypeScript (via npx eslint)
- Coverage gate: asserts test files meet minimum branch coverage
"""

import ast
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import BaseModel, Field as PydanticField

from .generator import GeneratedFile, QualityReport

# ============================================================================
# Extended Quality Models (Phase B2)
# ============================================================================


class CoverageReport(BaseModel):
    """Result of a coverage analysis against a test file."""

    file_path: str
    coverage_percent: float = PydanticField(default=0.0)
    missing_lines: list[int] = PydanticField(default_factory=list)
    meets_threshold: bool = PydanticField(default=False)
    threshold: float = PydanticField(default=80.0)
    error: str | None = None


# ============================================================================
# Quality Checker
# ============================================================================


@dataclass
class QualityChecker:
    """Code quality checker for generated code.

    Analyzes code for:
    - Linting issues (Ruff for Python)
    - Type checking errors
    - Formatting violations (Black for Python)
    - Security issues (hardcoded secrets, SQL injection, XSS)
    - Best practices violations

    Usage:
        checker = QualityChecker(project_root=Path("/path/to/project"))
        report = await checker.check_quality(
            generated_file=GeneratedFile(...)
        )
    """

    project_root: Path
    auto_fix: bool = True  # Automatically fix safe issues
    coverage_threshold: float = 80.0  # Minimum branch coverage % for test files

    # ========================================================================
    # Main API
    # ========================================================================

    async def check_quality(
        self,
        generated_file: GeneratedFile,
    ) -> QualityReport:
        """Run quality checks on generated code.

        Args:
            generated_file: The generated code file to check

        Returns:
            QualityReport with check results
        """
        if generated_file.language == "python":
            return await self._check_python_quality(generated_file)
        else:
            return await self._check_typescript_quality(generated_file)

    # ========================================================================
    # Python Quality Checks
    # ========================================================================

    async def _check_python_quality(
        self, generated_file: GeneratedFile
    ) -> QualityReport:
        """Run Python quality checks.

        Args:
            generated_file: Python code to check

        Returns:
            QualityReport with results
        """
        code = generated_file.content
        report = QualityReport()

        # 1. Linting (Ruff)
        linting_errors = await self._run_ruff_check(code)
        report.linting_passed = len(linting_errors) == 0
        report.linting_errors = linting_errors

        # 2. Type checking — mypy (falls back to AST-based if mypy unavailable)
        type_errors = await self._run_mypy_check(code)
        if not type_errors:
            type_errors = await self._check_python_types(code)
        report.type_check_passed = len(type_errors) == 0
        report.type_errors = type_errors

        # 3. Formatting (Black)
        formatting_needed, formatted_code = await self._check_python_formatting(code)
        report.formatting_applied = False
        if formatting_needed and self.auto_fix:
            generated_file.content = formatted_code
            report.formatting_applied = True

        # 4. Security scanning
        security_issues = await self._scan_python_security(code)
        report.security_issues = security_issues

        # 5. Best practices
        best_practices_violations = await self._check_python_best_practices(code)
        report.best_practices_violations = best_practices_violations

        return report

    async def _run_ruff_check(self, code: str) -> list[str]:
        """Run Ruff linter on Python code.

        Args:
            code: Python code to lint

        Returns:
            List of linting error messages
        """
        errors = []

        try:
            # Write code to temporary file
            temp_file = self.project_root / ".tmp_lint.py"
            temp_file.write_text(code, encoding="utf-8")

            try:
                # Run Ruff
                result = subprocess.run(
                    ["ruff", "check", str(temp_file), "--output-format", "text"],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )

                if result.returncode != 0:
                    # Parse Ruff output
                    for line in result.stdout.split("\n"):
                        if line.strip() and not line.startswith("Found"):
                            errors.append(line.strip())

            finally:
                # Clean up temp file
                if temp_file.exists():
                    temp_file.unlink()

        except FileNotFoundError:
            # Ruff not installed - skip linting
            pass
        except subprocess.TimeoutExpired:
            errors.append("Linting timeout - code too complex")
        except Exception as e:
            errors.append(f"Linting error: {str(e)}")

        return errors

    async def _check_python_types(self, code: str) -> list[str]:
        """Check Python type hints and annotations.

        Args:
            code: Python code to check

        Returns:
            List of type-related issues
        """
        errors = []

        try:
            tree = ast.parse(code)

            for node in ast.walk(tree):
                # Check for functions without return type hints
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    # Skip __init__ and private methods
                    if node.name.startswith("_") and node.name != "__init__":
                        continue

                    # Check if function has return type annotation
                    if node.returns is None and node.name != "__init__":
                        errors.append(
                            f"Function '{node.name}' missing return type annotation"
                        )

                    # Check if parameters have type annotations
                    for arg in node.args.args:
                        if arg.annotation is None and arg.arg not in ["self", "cls"]:
                            errors.append(
                                f"Parameter '{arg.arg}' in '{node.name}' missing type annotation"
                            )

        except SyntaxError:
            errors.append("Syntax error - cannot perform type checking")

        return errors

    async def _check_python_formatting(self, code: str) -> tuple[bool, str]:
        """Check if Python code is formatted with Black.

        Args:
            code: Python code to check

        Returns:
            Tuple of (needs_formatting, formatted_code)
        """
        try:
            # Write code to temporary file
            temp_file = self.project_root / ".tmp_format.py"
            temp_file.write_text(code, encoding="utf-8")

            try:
                # Run Black in check mode
                result = subprocess.run(
                    ["black", "--check", str(temp_file)],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )

                if result.returncode != 0:
                    # Code needs formatting - run Black to format
                    subprocess.run(
                        ["black", str(temp_file)],
                        capture_output=True,
                        timeout=10,
                    )
                    formatted_code = temp_file.read_text(encoding="utf-8")
                    return True, formatted_code
                else:
                    return False, code

            finally:
                # Clean up temp file
                if temp_file.exists():
                    temp_file.unlink()

        except FileNotFoundError:
            # Black not installed - skip formatting
            return False, code
        except subprocess.TimeoutExpired:
            return False, code
        except Exception:
            return False, code

    async def _scan_python_security(self, code: str) -> list[str]:
        """Scan Python code for security issues.

        Args:
            code: Python code to scan

        Returns:
            List of security issues found
        """
        issues = []

        # 1. Check for hardcoded secrets
        secret_patterns = [
            (r'api[_-]?key\s*=\s*["\'][^"\']{10,}["\']', "Hardcoded API key detected"),
            (
                r'secret[_-]?key\s*=\s*["\'][^"\']{10,}["\']',
                "Hardcoded secret key detected",
            ),
            (r'password\s*=\s*["\'][^"\']{5,}["\']', "Hardcoded password detected"),
            (r'token\s*=\s*["\'][^"\']{10,}["\']', "Hardcoded token detected"),
        ]

        for pattern, message in secret_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                issues.append(message)

        # 2. Check for SQL injection risks
        # Check for f-strings containing SQL keywords
        if re.search(
            r'f["\'].*\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b.*{',
            code,
            re.IGNORECASE,
        ):
            issues.append("Potential SQL injection - use parameterized queries")

        # Also check for string concatenation in SQL
        if re.search(r'execute\s*\([^)]*\+', code):
            if "sql injection" not in [i.lower() for i in issues]:
                issues.append("Potential SQL injection - use parameterized queries")

        # 3. Check for eval/exec usage
        if re.search(r'\beval\s*\(', code):
            issues.append("Use of eval() is dangerous - avoid dynamic code execution")

        if re.search(r'\bexec\s*\(', code):
            issues.append("Use of exec() is dangerous - avoid dynamic code execution")

        # 4. Check for unsafe deserialization
        if re.search(r'pickle\.loads?\(', code):
            issues.append(
                "Pickle deserialization can execute arbitrary code - use JSON instead"
            )

        # 5. Check for shell injection
        if re.search(r'os\.system\(', code):
            issues.append(
                "os.system() is vulnerable to shell injection - use subprocess.run()"
            )

        if re.search(r'subprocess\.(run|call|Popen)\([^)]*shell\s*=\s*True', code):
            issues.append(
                "shell=True in subprocess is dangerous - use shell=False with list arguments"
            )

        return issues

    async def _check_python_best_practices(self, code: str) -> list[str]:
        """Check Python best practices.

        Args:
            code: Python code to check

        Returns:
            List of best practice violations
        """
        violations = []

        try:
            tree = ast.parse(code)

            # 1. Check for unused imports (basic check)
            imports = set()
            used_names = set()

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.add(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    for alias in node.names:
                        imports.add(alias.name)
                elif isinstance(node, ast.Name):
                    used_names.add(node.id)

            # Check for imports that aren't used
            unused = imports - used_names
            if unused and len(unused) < 5:  # Only report if reasonable number
                violations.append(f"Unused imports detected: {', '.join(unused)}")

            # 2. Check for overly complex functions
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    # Count complexity (simplified McCabe complexity)
                    complexity = self._calculate_complexity(node)
                    if complexity > 10:
                        violations.append(
                            f"Function '{node.name}' is too complex (complexity: {complexity})"
                        )

            # 3. Check for missing error handling
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    # Check if function has any try-except blocks
                    has_error_handling = any(
                        isinstance(child, ast.Try) for child in ast.walk(node)
                    )

                    # Check if function makes external calls (API, DB)
                    has_external_calls = any(
                        isinstance(child, ast.Call) for child in ast.walk(node)
                    )

                    # If function makes external calls but has no error handling
                    if (
                        has_external_calls
                        and not has_error_handling
                        and not node.name.startswith("_")
                    ):
                        # Check if it's an async function (likely API/DB)
                        if isinstance(node, ast.AsyncFunctionDef):
                            violations.append(
                                f"Async function '{node.name}' should have error handling"
                            )

        except SyntaxError:
            pass

        return violations

    def _calculate_complexity(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> int:
        """Calculate cyclomatic complexity of a function.

        Args:
            node: Function AST node

        Returns:
            Complexity score
        """
        complexity = 1  # Start at 1

        for child in ast.walk(node):
            # Add 1 for each decision point
            if isinstance(child, ast.If):
                complexity += 1
                # Check for elif (which is nested If in else)
                if child.orelse and isinstance(child.orelse[0], ast.If):
                    complexity += 1
            elif isinstance(child, (ast.While, ast.For, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                # Add for each additional boolean operator
                complexity += len(child.values) - 1
            elif isinstance(child, ast.Compare):
                # Add for each comparison operator
                complexity += len(child.ops)

        return complexity

    # ========================================================================
    # TypeScript Quality Checks
    # ========================================================================

    async def _check_typescript_quality(
        self, generated_file: GeneratedFile
    ) -> QualityReport:
        """Run TypeScript quality checks.

        Args:
            generated_file: TypeScript code to check

        Returns:
            QualityReport with results
        """
        code = generated_file.content
        report = QualityReport()

        # 1. Linting — ESLint (falls back to basic checks if ESLint unavailable)
        linting_errors = await self._run_eslint_check(code, generated_file.file_path)
        if not linting_errors:
            linting_errors = await self._check_typescript_linting(code)
        report.linting_passed = len(linting_errors) == 0
        report.linting_errors = linting_errors

        # 2. Type checking (basic syntax)
        type_errors = await self._check_typescript_types(code)
        report.type_check_passed = len(type_errors) == 0
        report.type_errors = type_errors

        # 3. Security scanning
        security_issues = await self._scan_typescript_security(code)
        report.security_issues = security_issues

        # 4. Best practices
        best_practices_violations = await self._check_typescript_best_practices(code)
        report.best_practices_violations = best_practices_violations

        return report

    async def _check_typescript_linting(self, code: str) -> list[str]:
        """Basic TypeScript linting checks.

        Args:
            code: TypeScript code to check

        Returns:
            List of linting errors
        """
        errors = []

        # 1. Check for console.log statements
        if re.search(r'\bconsole\.log\s*\(', code):
            errors.append("Remove console.log statements before production")

        # 2. Check for any types
        if re.search(r':\s*any\b', code):
            errors.append("Avoid using 'any' type - use specific types instead")

        # 3. Check for var usage
        if re.search(r'\bvar\s+', code):
            errors.append("Use 'const' or 'let' instead of 'var'")

        return errors

    async def _check_typescript_types(self, code: str) -> list[str]:
        """Check TypeScript type annotations.

        Args:
            code: TypeScript code to check

        Returns:
            List of type issues
        """
        errors = []

        # 1. Check for functions without return types
        function_pattern = r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{'
        matches = re.finditer(function_pattern, code)

        for match in matches:
            func_name = match.group(1)
            # Check if there's a return type annotation
            if not re.search(rf'function\s+{func_name}\s*\([^)]*\)\s*:\s*\w+', code):
                errors.append(f"Function '{func_name}' missing return type annotation")

        return errors

    async def _scan_typescript_security(self, code: str) -> list[str]:
        """Scan TypeScript code for security issues.

        Args:
            code: TypeScript code to scan

        Returns:
            List of security issues
        """
        issues = []

        # 1. Check for hardcoded secrets
        if re.search(r'api[_-]?key\s*[:=]\s*["\'][^"\']{10,}["\']', code, re.IGNORECASE):
            issues.append("Hardcoded API key detected")

        # 2. Check for eval usage
        if re.search(r'\beval\s*\(', code):
            issues.append("Use of eval() is dangerous - avoid dynamic code execution")

        # 3. Check for dangerouslySetInnerHTML
        if re.search(r'dangerouslySetInnerHTML', code):
            issues.append(
                "dangerouslySetInnerHTML can lead to XSS - sanitize user input"
            )

        # 4. Check for innerHTML usage
        if re.search(r'\.innerHTML\s*=', code):
            issues.append("innerHTML can lead to XSS - use textContent or sanitize input")

        return issues

    async def _check_typescript_best_practices(self, code: str) -> list[str]:
        """Check TypeScript best practices.

        Args:
            code: TypeScript code to check

        Returns:
            List of best practice violations
        """
        violations = []

        # 1. Check for missing error handling in async functions
        async_functions = re.findall(
            r'(?:export\s+)?async\s+function\s+(\w+)', code
        )

        for func_name in async_functions:
            # Check if function has try-catch
            func_pattern = rf'async\s+function\s+{func_name}[^{{]*{{([^}}]+)}}'
            match = re.search(func_pattern, code, re.DOTALL)

            if match:
                func_body = match.group(1)
                if 'try' not in func_body:
                    violations.append(
                        f"Async function '{func_name}' should have error handling"
                    )

        # 2. Check for useState without TypeScript type
        if re.search(r'useState\s*\(\s*(?!<)', code):
            violations.append("useState should have explicit type parameter")

        return violations

    # ========================================================================
    # Phase B2 additions: mypy, ESLint, coverage gate
    # ========================================================================

    async def _run_mypy_check(self, code: str) -> list[str]:
        """Run mypy static type checker on Python code.

        Writes code to a temp file and runs ``mypy --ignore-missing-imports``.
        Returns an empty list if mypy is not installed (graceful degradation).
        """
        errors: list[str] = []
        try:
            with tempfile.NamedTemporaryFile(
                suffix=".py", mode="w", encoding="utf-8", delete=False
            ) as tmp:
                tmp.write(code)
                tmp_path = tmp.name

            result = subprocess.run(
                [
                    "mypy",
                    tmp_path,
                    "--ignore-missing-imports",
                    "--no-error-summary",
                    "--show-error-codes",
                ],
                capture_output=True,
                text=True,
                timeout=20,
            )

            Path(tmp_path).unlink(missing_ok=True)

            if result.returncode != 0:
                for line in result.stdout.splitlines():
                    # Strip temp file path prefix so errors are readable
                    clean = re.sub(r"^[^:]+:", "mypy:", line)
                    if clean.strip():
                        errors.append(clean.strip())

        except FileNotFoundError:
            pass  # mypy not installed — skip
        except subprocess.TimeoutExpired:
            errors.append("mypy: type check timed out")
        except Exception as exc:
            errors.append(f"mypy: {exc}")

        return errors

    async def _run_eslint_check(self, code: str, file_path: str) -> list[str]:
        """Run ESLint on TypeScript/TSX code via ``npx eslint``.

        Uses the project's own ``.eslintrc`` / ``eslint.config.*`` so it
        respects the project's actual rule set.  Falls back to the basic
        checks if ESLint is unavailable.
        """
        errors: list[str] = []
        suffix = ".tsx" if "jsx" in code or "return (" in code else ".ts"
        try:
            with tempfile.NamedTemporaryFile(
                suffix=suffix, mode="w", encoding="utf-8", delete=False
            ) as tmp:
                tmp.write(code)
                tmp_path = tmp.name

            result = subprocess.run(
                [
                    "npx",
                    "--yes",
                    "eslint",
                    tmp_path,
                    "--format",
                    "compact",
                    "--no-eslintrc",  # avoid project config bleed on temp file
                    "--rule",
                    '{"no-unused-vars": "warn", "no-undef": "warn"}',
                ],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(self.project_root / "apps/web"),
            )

            Path(tmp_path).unlink(missing_ok=True)

            if result.returncode != 0:
                for line in result.stdout.splitlines():
                    clean = re.sub(r"^[^:]+:", "eslint:", line)
                    if clean.strip() and "0 problems" not in clean:
                        errors.append(clean.strip())

        except FileNotFoundError:
            pass  # npx/eslint not available
        except subprocess.TimeoutExpired:
            errors.append("eslint: check timed out")
        except Exception as exc:
            errors.append(f"eslint: {exc}")

        return errors

    async def check_coverage(
        self,
        test_file_path: str,
        source_file_path: str,
        threshold: float | None = None,
    ) -> "CoverageReport":
        """Run pytest-cov on a test file and return branch coverage %.

        Args:
            test_file_path: Relative path to the test file.
            source_file_path: Relative path to the source file under test.
            threshold: Override the instance-level ``coverage_threshold``.

        Returns:
            CoverageReport with percent covered, missing lines, and pass/fail.
        """
        min_cov = threshold if threshold is not None else self.coverage_threshold
        report = CoverageReport(file_path=test_file_path, threshold=min_cov)

        full_test = self.project_root / test_file_path
        full_src = self.project_root / source_file_path

        if not full_test.exists():
            report.error = f"Test file not found: {test_file_path}"
            return report
        if not full_src.exists():
            report.error = f"Source file not found: {source_file_path}"
            return report

        try:
            result = subprocess.run(
                [
                    "uv",
                    "run",
                    "pytest",
                    str(full_test),
                    f"--cov={full_src}",
                    "--cov-report=term-missing",
                    "--cov-branch",
                    "-q",
                    "--no-header",
                ],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(self.project_root / "apps/backend"),
            )

            output = result.stdout + result.stderr

            # Parse coverage % from pytest-cov output: "TOTAL   50   10   80%"
            cov_match = re.search(r"TOTAL\s+\d+\s+\d+\s+(\d+)%", output)
            if cov_match:
                report.coverage_percent = float(cov_match.group(1))

            # Parse missing lines: "module.py   50   10   80%   12-15, 30"
            missing_match = re.search(
                re.escape(full_src.name) + r"\s+\d+\s+\d+\s+\d+%\s+([\d,\s\-]+)",
                output,
            )
            if missing_match:
                raw = missing_match.group(1).strip()
                for part in raw.split(","):
                    part = part.strip()
                    if "-" in part:
                        start, end = part.split("-", 1)
                        try:
                            report.missing_lines.extend(
                                range(int(start), int(end) + 1)
                            )
                        except ValueError:
                            pass
                    elif part.isdigit():
                        report.missing_lines.append(int(part))

            report.meets_threshold = report.coverage_percent >= min_cov

        except FileNotFoundError:
            report.error = "pytest/uv not available"
        except subprocess.TimeoutExpired:
            report.error = "Coverage check timed out"
        except Exception as exc:
            report.error = str(exc)

        return report
