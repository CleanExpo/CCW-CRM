"""
Testing Agent for autonomous test generation and execution.

Generates and runs tests for code validation.
"""

import json
import subprocess
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

import structlog

from src.ai.base_agent import BaseAgent
from src.ai.ollama_client import get_ollama_client

logger = structlog.get_logger(__name__)


class TestingAgent(BaseAgent):
    """
    Specialized agent for test generation and execution.

    Capabilities:
    - Unit test generation
    - Integration test generation
    - Test execution (pytest)
    - Test coverage analysis
    - Test failure analysis
    """

    def __init__(self, agent_id: str | None = None):
        """Initialize Testing Agent."""
        super().__init__(
            agent_id=agent_id or "testing_agent",
            name="Testing Agent",
            auto_register=True,
        )

        # Agent capabilities
        self.capabilities = [
            "test_generation",
            "unit_tests",
            "integration_tests",
            "test_execution",
            "coverage_analysis",
            "failure_analysis",
        ]

        # Agent metadata
        self.description = "Generates and executes tests for code validation"
        self.requires_verification = False  # Tests can run automatically
        self.estimated_execution_time = 45  # 45 seconds average

        # Get Ollama client for test generation
        self.ollama = get_ollama_client()

        # Project root
        self.project_root = Path(__file__).resolve().parents[5]
        self.backend_root = self.project_root / "apps" / "backend"

        logger.info(
            "TestingAgent initialized",
            agent_id=self.agent_id,
            project_root=str(self.project_root),
            capabilities=self.capabilities,
        )

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Execute testing task.

        Args:
            task: Task description (e.g., "generate tests for ProductService")
            context: Optional context with parameters

        Returns:
            Testing result

        Context parameters:
            - action: "generate" or "execute" or "both"
            - test_type: "unit", "integration", or "e2e"
            - target_file: File to test
            - code_to_test: Code snippet to test
            - existing_tests: Existing test file path
        """
        if not await self.validate_input(task, context):
            return {"error": "Invalid testing task"}

        context = context or {}

        # Extract parameters
        action = context.get("action", "both")
        test_type = context.get("test_type", "unit")
        target_file = context.get("target_file")
        code_to_test = context.get("code_to_test")
        existing_tests = context.get("existing_tests")

        try:
            result = {}

            # Generate tests if requested
            if action in ("generate", "both"):
                generated_tests = await self._generate_tests(
                    task=task,
                    test_type=test_type,
                    target_file=target_file,
                    code_to_test=code_to_test,
                )
                result["generated_tests"] = generated_tests

            # Execute tests if requested
            if action in ("execute", "both"):
                test_file = existing_tests or result.get("test_file_path")
                if test_file:
                    execution_result = await self._execute_tests(
                        test_file=test_file,
                    )
                    result["execution"] = execution_result
                else:
                    result["execution"] = {
                        "error": "No test file specified for execution"
                    }

            logger.info(
                "Testing task completed",
                action=action,
                test_type=test_type,
                tests_passed=result.get("execution", {}).get("passed", 0),
                tests_failed=result.get("execution", {}).get("failed", 0),
            )

            return {
                "success": True,
                "task": task,
                "action": action,
                "test_type": test_type,
                **result,
            }

        except Exception as e:
            logger.error("Testing task failed", task=task, error=str(e))
            return {"error": f"Testing failed: {str(e)}"}

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream testing results.

        Args:
            task: Task description
            context: Testing parameters

        Yields:
            JSON-formatted result chunks
        """
        # Execute testing task
        result = await self.execute(task, context)

        # Stream result
        yield json.dumps(result)

    async def _generate_tests(
        self,
        task: str,
        test_type: str,
        target_file: str | None,
        code_to_test: str | None,
    ) -> dict[str, Any]:
        """
        Generate tests using LLM.

        Args:
            task: Task description
            test_type: Type of tests (unit, integration, e2e)
            target_file: File path being tested
            code_to_test: Code snippet to test

        Returns:
            Generated tests
        """
        # Load code to test if not provided
        if not code_to_test and target_file:
            target_path = self.project_root / target_file
            if target_path.exists():
                with open(target_path, encoding="utf-8") as f:
                    code_to_test = f.read()

        prompt = f"""You are an expert at writing comprehensive tests.

Task: {task}
Test Type: {test_type}

Code to Test:
```python
{code_to_test if code_to_test else "No code provided"}
```

Generate comprehensive {test_type} tests using pytest.

Requirements:
1. Use pytest fixtures appropriately
2. Test happy paths and edge cases
3. Test error handling
4. Use proper assertions
5. Include docstrings
6. Mock external dependencies (database, API calls)
7. Use async test functions for async code
8. Follow AAA pattern (Arrange, Act, Assert)

Generate ONLY the test code, no explanations.
"""

        response = await self.ollama.generate(prompt=prompt, model="qwen2.5-coder:7b")

        # Extract code from response
        test_code = self._extract_code_from_response(response["response"])

        return {
            "test_code": test_code,
            "test_type": test_type,
            "lines_of_code": len(test_code.split("\n")),
        }

    def _extract_code_from_response(self, response: str) -> str:
        """
        Extract clean code from LLM response.

        Args:
            response: LLM response text

        Returns:
            Clean code
        """
        code = response.strip()

        # Remove markdown code blocks
        if code.startswith("```"):
            lines = code.split("\n")
            lines = lines[1:]  # Remove ```python or ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            code = "\n".join(lines)

        return code.strip()

    async def _execute_tests(
        self,
        test_file: str,
    ) -> dict[str, Any]:
        """
        Execute pytest tests.

        Args:
            test_file: Path to test file

        Returns:
            Execution results
        """
        test_path = self.project_root / test_file

        if not test_path.exists():
            return {"error": f"Test file not found: {test_file}"}

        try:
            # Run pytest
            result = subprocess.run(
                ["pytest", str(test_path), "-v", "--tb=short"],
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout
                cwd=str(self.backend_root),
            )

            # Parse pytest output
            output = result.stdout + result.stderr
            passed = output.count(" PASSED")
            failed = output.count(" FAILED")
            skipped = output.count(" SKIPPED")

            return {
                "exit_code": result.returncode,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "success": result.returncode == 0,
                "output": output,
            }

        except subprocess.TimeoutExpired:
            return {"error": "Test execution timed out after 2 minutes"}
        except Exception as e:
            return {"error": f"Test execution failed: {str(e)}"}

    async def analyze_test_failures(
        self,
        test_output: str,
    ) -> dict[str, Any]:
        """
        Analyze test failures and suggest fixes.

        Args:
            test_output: Pytest output with failures

        Returns:
            Analysis and suggestions
        """
        prompt = f"""Analyze the following pytest test failures and suggest fixes.

Test Output:
{test_output}

For each failure:
1. Identify the root cause
2. Suggest a fix
3. Explain why the test failed

Provide concise analysis in JSON format:
{{
    "failures": [
        {{
            "test": "test_name",
            "cause": "root cause",
            "fix": "suggested fix",
            "explanation": "why it failed"
        }}
    ]
}}
"""

        response = await self.ollama.generate(prompt=prompt)

        try:
            # Try to extract JSON from response
            analysis = json.loads(response["response"])
            return {"success": True, "analysis": analysis}
        except json.JSONDecodeError:
            # Return raw response if not valid JSON
            return {
                "success": False,
                "analysis": response["response"],
            }

    async def generate_unit_tests(
        self,
        target_file: str,
        code_to_test: str | None = None,
    ) -> dict[str, Any]:
        """
        Convenience method for generating unit tests.

        Args:
            target_file: File path being tested
            code_to_test: Optional code snippet

        Returns:
            Generated unit tests
        """
        return await self.execute(
            task=f"Generate unit tests for {target_file}",
            context={
                "action": "generate",
                "test_type": "unit",
                "target_file": target_file,
                "code_to_test": code_to_test,
            },
        )

    async def execute_test_suite(
        self,
        test_file: str,
    ) -> dict[str, Any]:
        """
        Convenience method for executing tests.

        Args:
            test_file: Path to test file

        Returns:
            Execution results
        """
        return await self.execute(
            task=f"Execute tests in {test_file}",
            context={
                "action": "execute",
                "existing_tests": test_file,
            },
        )

    async def health_check(self):
        """
        Check Testing Agent health.

        Verifies:
        - Ollama client availability
        - pytest installation
        - Project directories accessible
        """
        from src.ai.orchestration import AgentHealthReport, AgentStatus

        try:
            checks_passed = []
            checks_failed = []

            # Check 1: Ollama client available
            try:
                if self.ollama:
                    checks_passed.append("ollama_client_available")
                else:
                    checks_failed.append("ollama_check: client is None")
            except Exception as e:
                checks_failed.append(f"ollama_check: {str(e)}")

            # Check 2: pytest installed
            try:
                result = subprocess.run(
                    ["pytest", "--version"],
                    capture_output=True,
                    timeout=5,
                )
                if result.returncode == 0:
                    checks_passed.append("pytest_installed")
                else:
                    checks_failed.append("pytest_check: not installed or not working")
            except Exception as e:
                checks_failed.append(f"pytest_check: {str(e)}")

            # Check 3: Test directories accessible
            try:
                tests_dir = self.backend_root / "tests"
                if tests_dir.exists():
                    checks_passed.append("test_directories_accessible")
                else:
                    checks_failed.append("test_directories_check: tests dir not found")
            except Exception as e:
                checks_failed.append(f"test_directories_check: {str(e)}")

            # Determine status
            if len(checks_failed) == 0:
                status = AgentStatus.ACTIVE
            elif len(checks_passed) > len(checks_failed):
                status = AgentStatus.DEGRADED
            else:
                status = AgentStatus.OFFLINE

            from datetime import UTC, datetime

            return AgentHealthReport(
                agent_id=self.agent_id,
                status=status,
                checks_passed=checks_passed,
                checks_failed=checks_failed,
                last_checked=datetime.now(UTC),
            )

        except Exception as e:
            from datetime import UTC, datetime

            return AgentHealthReport(
                agent_id=self.agent_id,
                status=AgentStatus.OFFLINE,
                error=str(e),
                last_checked=datetime.now(UTC),
            )
