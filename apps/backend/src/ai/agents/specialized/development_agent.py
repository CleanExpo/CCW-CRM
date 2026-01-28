"""
Development Agent for autonomous code generation.

Generates production-quality code following project patterns and conventions.
"""

import json
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

import structlog

from src.ai.base_agent import BaseAgent
from src.ai.ollama_client import get_ollama_client

logger = structlog.get_logger(__name__)


class DevelopmentAgent(BaseAgent):
    """
    Specialized agent for code generation and development tasks.

    Capabilities:
    - Code generation following project patterns
    - File creation and modification
    - API endpoint generation
    - Database model generation
    - Service implementation
    - Frontend component generation
    """

    def __init__(self, agent_id: str | None = None):
        """Initialize Development Agent."""
        super().__init__(
            agent_id=agent_id or "development_agent",
            name="Development Agent",
            auto_register=True,
        )

        # Agent capabilities
        self.capabilities = [
            "code_generation",
            "api_endpoints",
            "database_models",
            "services",
            "components",
            "pattern_following",
        ]

        # Agent metadata
        self.description = "Generates production-quality code following project patterns and conventions"
        self.requires_verification = True  # Code must be reviewed
        self.estimated_execution_time = 30  # 30 seconds average

        # Get Ollama client for code generation
        self.ollama = get_ollama_client()

        # Project root
        self.project_root = Path(__file__).resolve().parents[5]

        logger.info(
            "DevelopmentAgent initialized",
            agent_id=self.agent_id,
            project_root=str(self.project_root),
            capabilities=self.capabilities,
        )

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Execute development task.

        Args:
            task: Task description (e.g., "create FastAPI endpoint for product search")
            context: Optional context with parameters

        Returns:
            Development result with generated code

        Context parameters:
            - task_type: "api_endpoint", "service", "model", "component", "migration"
            - file_path: Target file path
            - patterns: List of pattern files to follow
            - requirements: Specific requirements
        """
        if not await self.validate_input(task, context):
            return {"error": "Invalid development task"}

        context = context or {}

        # Extract parameters
        task_type = context.get("task_type", "general")
        file_path = context.get("file_path")
        patterns = context.get("patterns", [])
        requirements = context.get("requirements", "")

        try:
            # Load relevant patterns
            pattern_context = await self._load_patterns(patterns)

            # Generate code using LLM
            generated_code = await self._generate_code(
                task=task,
                task_type=task_type,
                pattern_context=pattern_context,
                requirements=requirements,
            )

            # Validate generated code
            validation_result = await self._validate_code(
                generated_code=generated_code,
                task_type=task_type,
            )

            if not validation_result["valid"]:
                logger.warning(
                    "Generated code failed validation",
                    validation_errors=validation_result["errors"],
                )

            logger.info(
                "Code generated",
                task_type=task_type,
                file_path=file_path,
                lines_of_code=len(generated_code.split("\n")),
                validation_passed=validation_result["valid"],
            )

            return {
                "success": True,
                "task": task,
                "task_type": task_type,
                "file_path": file_path,
                "generated_code": generated_code,
                "validation": validation_result,
                "requires_verification": True,
            }

        except Exception as e:
            logger.error("Code generation failed", task=task, error=str(e))
            return {"error": f"Code generation failed: {str(e)}"}

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream code generation results.

        Args:
            task: Task description
            context: Development parameters

        Yields:
            JSON-formatted result chunks
        """
        # Execute code generation
        result = await self.execute(task, context)

        # Stream result
        yield json.dumps(result)

    async def _load_patterns(self, pattern_files: list[str]) -> str:
        """
        Load pattern files for code generation context.

        Args:
            pattern_files: List of pattern file paths

        Returns:
            Combined pattern context
        """
        pattern_context = []

        for pattern_file in pattern_files:
            try:
                pattern_path = self.project_root / pattern_file
                if pattern_path.exists():
                    with open(pattern_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        pattern_context.append(f"## Pattern: {pattern_file}\n\n{content}")
            except Exception as e:
                logger.warning(
                    "Failed to load pattern file",
                    pattern_file=pattern_file,
                    error=str(e),
                )

        return "\n\n---\n\n".join(pattern_context)

    async def _generate_code(
        self,
        task: str,
        task_type: str,
        pattern_context: str,
        requirements: str,
    ) -> str:
        """
        Generate code using LLM.

        Args:
            task: Task description
            task_type: Type of code to generate
            pattern_context: Pattern examples
            requirements: Specific requirements

        Returns:
            Generated code
        """
        prompt = f"""You are an expert software engineer generating production-quality code.

Task: {task}
Task Type: {task_type}

Requirements:
{requirements if requirements else "Follow best practices"}

Patterns to Follow:
{pattern_context if pattern_context else "No specific patterns provided"}

Rules:
1. Follow the project's coding patterns and conventions
2. Include proper type hints and documentation
3. Handle errors appropriately
4. Use async/await for I/O operations
5. Follow Python PEP 8 style guide
6. Include imports at the top
7. Add comprehensive docstrings

Generate ONLY the code, no explanations or markdown formatting.
"""

        response = await self.ollama.generate(prompt=prompt, model="qwen2.5-coder:7b")

        # Extract code from response
        code = self._extract_code_from_response(response["response"])

        return code

    def _extract_code_from_response(self, response: str) -> str:
        """
        Extract clean code from LLM response.

        Args:
            response: LLM response text

        Returns:
            Clean code without markdown formatting
        """
        # Remove markdown code blocks
        code = response.strip()

        # Remove ```python or ``` markers
        if code.startswith("```"):
            lines = code.split("\n")
            # Remove first line (```python or ```)
            lines = lines[1:]
            # Remove last line if it's ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            code = "\n".join(lines)

        return code.strip()

    async def _validate_code(
        self,
        generated_code: str,
        task_type: str,
    ) -> dict[str, Any]:
        """
        Validate generated code for common issues.

        Args:
            generated_code: Code to validate
            task_type: Type of code

        Returns:
            Validation result with errors if any
        """
        errors = []

        # Check 1: Not empty
        if not generated_code or not generated_code.strip():
            errors.append("Generated code is empty")

        # Check 2: Has proper imports
        if "import " not in generated_code:
            errors.append("No imports found in generated code")

        # Check 3: Has docstrings (for Python)
        if '"""' not in generated_code and "'''" not in generated_code:
            errors.append("No docstrings found in generated code")

        # Check 4: Async patterns for API endpoints
        if task_type == "api_endpoint":
            if "async def" not in generated_code:
                errors.append("API endpoint should use async def")
            if "@router." not in generated_code:
                errors.append("API endpoint should have @router decorator")

        # Check 5: Type hints
        if "->" not in generated_code and "def " in generated_code:
            errors.append("Functions should have return type hints")

        # Check 6: Error handling
        if "try:" not in generated_code and "except" not in generated_code:
            errors.append("Code should include error handling (try/except)")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": [],
        }

    async def generate_api_endpoint(
        self,
        endpoint_name: str,
        method: str,
        description: str,
        parameters: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Convenience method for generating API endpoints.

        Args:
            endpoint_name: Endpoint name (e.g., "/products/search")
            method: HTTP method (GET, POST, PUT, DELETE)
            description: Endpoint description
            parameters: Optional parameters (name -> type)

        Returns:
            Generated endpoint code
        """
        requirements = f"""
Generate a FastAPI {method} endpoint for: {endpoint_name}

Description: {description}

Parameters:
{json.dumps(parameters, indent=2) if parameters else "None"}

Include:
- Pydantic models for request/response
- Type hints
- Docstring with description
- Error handling
- Database session dependency
"""

        return await self.execute(
            task=f"Create {method} endpoint {endpoint_name}",
            context={
                "task_type": "api_endpoint",
                "patterns": [
                    "apps/backend/src/api/routes/products.py",
                    "CLAUDE.md",
                ],
                "requirements": requirements,
            },
        )

    async def generate_service(
        self,
        service_name: str,
        description: str,
        methods: list[str],
    ) -> dict[str, Any]:
        """
        Convenience method for generating services.

        Args:
            service_name: Service class name
            description: Service description
            methods: List of method descriptions

        Returns:
            Generated service code
        """
        requirements = f"""
Generate a service class: {service_name}

Description: {description}

Methods to implement:
{chr(10).join(f"- {method}" for method in methods)}

Include:
- Async methods
- Type hints
- Docstrings
- Error handling
- Singleton pattern with get_{service_name.lower()} function
"""

        return await self.execute(
            task=f"Create {service_name} service",
            context={
                "task_type": "service",
                "patterns": [
                    "apps/backend/src/services/semantic_search_service.py",
                    "apps/backend/src/services/recommendation_service.py",
                ],
                "requirements": requirements,
            },
        )

    async def generate_database_model(
        self,
        model_name: str,
        table_name: str,
        fields: dict[str, str],
        relationships: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Convenience method for generating database models.

        Args:
            model_name: Model class name
            table_name: Database table name
            fields: Field definitions (name -> type)
            relationships: Optional relationships

        Returns:
            Generated model code
        """
        requirements = f"""
Generate a SQLAlchemy ORM model: {model_name}

Table: {table_name}

Fields:
{json.dumps(fields, indent=2)}

Relationships:
{chr(10).join(relationships) if relationships else "None"}

Include:
- UUID primary key with gen_random_uuid()
- Timestamps (created_at, updated_at)
- Type hints
- Docstring
- __repr__ method
"""

        return await self.execute(
            task=f"Create {model_name} database model",
            context={
                "task_type": "model",
                "patterns": [
                    "apps/backend/src/db/ai_search_models.py",
                    "apps/backend/src/db/demo_models.py",
                ],
                "requirements": requirements,
            },
        )

    async def health_check(self):
        """
        Check Development Agent health.

        Verifies:
        - Ollama client availability
        - Project root accessible
        - Pattern files accessible
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

            # Check 2: Project root accessible
            try:
                if self.project_root.exists():
                    checks_passed.append("project_root_accessible")
                else:
                    checks_failed.append("project_root_check: path does not exist")
            except Exception as e:
                checks_failed.append(f"project_root_check: {str(e)}")

            # Check 3: Test code generation
            try:
                test_code = await self._generate_code(
                    task="print hello world",
                    task_type="general",
                    pattern_context="",
                    requirements="Simple Python script",
                )
                if test_code and "print" in test_code:
                    checks_passed.append("code_generation_works")
                else:
                    checks_failed.append("code_generation_check: unexpected output")
            except Exception as e:
                checks_failed.append(f"code_generation_check: {str(e)}")

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
