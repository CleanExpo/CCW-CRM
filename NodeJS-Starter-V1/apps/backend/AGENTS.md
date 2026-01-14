# Backend AGENTS.md

> FastAPI + LangGraph + Pydantic backend with AI agent orchestration

## Package Identity

| Attribute | Value |
|-----------|-------|
| Framework | FastAPI |
| AI Orchestration | LangGraph |
| Validation | Pydantic |
| Python Version | 3.12+ |
| Package Manager | uv |

## Setup & Run

```bash
# Install dependencies
cd apps/backend && uv sync

# Development server
uv run uvicorn src.api.main:app --reload --port 8000

# Run all tests
uv run pytest

# Run specific test
uv run pytest -k "test_name"

# Type checking
uv run mypy src/

# Linting
uv run ruff check src/
```

## File Organization

```
apps/backend/
├── src/
│   ├── agents/              # AI agents
│   │   ├── base_agent.py    # Abstract base class
│   │   ├── orchestrator.py  # Task router
│   │   ├── registry.py      # Agent registry
│   │   └── long_running/    # Multi-session agents
│   ├── api/                 # FastAPI application
│   │   ├── main.py          # App entry point
│   │   ├── middleware/      # Auth, rate limiting
│   │   └── routes/          # API endpoints
│   ├── graphs/              # LangGraph flows
│   │   ├── main_graph.py    # Primary graph
│   │   └── nodes/           # Graph nodes
│   ├── tools/               # Agent tools
│   │   ├── registry.py      # Tool registry
│   │   ├── search.py        # Search tools
│   │   └── programmatic.py  # Programmatic calling
│   ├── verification/        # Independent verification
│   ├── models/              # LLM model clients
│   ├── state/               # State management
│   ├── config/              # Settings
│   └── utils/               # Shared utilities
└── tests/                   # Test suite
```

## Patterns & Conventions

### ✅ DO: Agent Pattern

```python
# agents/base_agent.py - Real example
from abc import ABC, abstractmethod
from pydantic import BaseModel, Field

class BaseAgent(ABC):
    """Abstract base class for all agents."""

    def __init__(self, name: str, capabilities: list[str]):
        self.name = name
        self.capabilities = capabilities
        self.agent_id = str(uuid.uuid4())

    @abstractmethod
    async def execute(self, task: str, context: dict) -> TaskOutput:
        """Execute a task. Must be implemented by subclasses."""
        pass

    def can_handle(self, task: str) -> bool:
        """Check if agent can handle this task."""
        return any(cap in task.lower() for cap in self.capabilities)
```

### ✅ DO: Pydantic Models

```python
# All data structures use Pydantic
from pydantic import BaseModel, Field

class TaskOutput(BaseModel):
    """Structured output from task execution."""
    task_id: str
    agent_id: str
    status: str = Field(description="completed, failed, or pending_verification")
    outputs: list[dict[str, Any]] = Field(default_factory=list)
    requires_verification: bool = Field(default=True)
```

### ✅ DO: API Route Pattern

```python
# api/routes/health.py - Real example
from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
async def health_check() -> dict:
    """Basic health check endpoint."""
    return {"status": "healthy"}

@router.get("/deep")
async def deep_health_check() -> dict:
    """Deep health check with dependencies."""
    # Check database, external services, etc.
    return {"status": "healthy", "checks": {...}}
```

### ❌ DON'T: Anti-patterns

```python
# BAD: Missing type hints
def process_data(data):
    return data["value"]

# BAD: Using dict instead of Pydantic
def get_user() -> dict:  # Use UserModel
    return {"name": "John"}

# BAD: Self-attestation verification
class Agent:
    def verify_own_work(self):  # NEVER - use IndependentVerifier
        return True

# BAD: Sync functions in async context
def blocking_call():  # Use async def
    time.sleep(1)
```

## Key Systems

### Agent Orchestration
```python
# agents/orchestrator.py
class Orchestrator:
    def __init__(self):
        self.registry = AgentRegistry()
        self.verifier = IndependentVerifier()

    async def process(self, task: str) -> dict:
        agent = self.registry.find_agent_for_task(task)
        result = await agent.execute(task, context)
        # CRITICAL: Always verify independently
        verification = await self.verifier.verify(result)
        return {"result": result, "verification": verification}
```

### Independent Verification
```python
# verification/verifier.py
# CRITICAL: Agents CANNOT verify their own work
class IndependentVerifier:
    async def verify(self, task_output: TaskOutput) -> VerificationResult:
        # Run actual tests, check outputs, collect evidence
        # Never trust agent self-attestation
        pass
```

### LangGraph Patterns
```python
# graphs/main_graph.py
from langgraph.graph import StateGraph

def create_graph():
    graph = StateGraph(AgentState)
    graph.add_node("router", router_node)
    graph.add_node("executor", executor_node)
    graph.add_node("validator", validator_node)
    graph.add_edge("router", "executor")
    graph.add_conditional_edges("executor", should_validate)
    return graph.compile()
```

## Key Files

| File | Purpose |
|------|---------|
| `api/main.py` | FastAPI app entry point |
| `agents/base_agent.py` | Abstract agent base class |
| `agents/orchestrator.py` | Task routing and coordination |
| `agents/registry.py` | Agent registration and lookup |
| `verification/verifier.py` | Independent verification |
| `tools/registry.py` | Tool registration |
| `config/settings.py` | Environment configuration |

## Search Patterns (JIT)

```bash
# Find agent class
rg "class.*Agent" src/agents/

# Find API route
rg "@router\.(get|post|put|delete)" src/api/routes/

# Find Pydantic model
rg "class.*BaseModel" src/

# Find graph node
rg "def.*_node" src/graphs/

# Find tool
rg "@tool" src/tools/
```

## Common Gotchas

1. **Self-Attestation Prohibition**
   - Agents CANNOT verify their own work
   - Always use `IndependentVerifier`
   - See: `verification/verifier.py`

2. **Async Everywhere**
   - All agent methods must be `async def`
   - Use `asyncio` for concurrency
   - Never use blocking calls

3. **Type Hints Required**
   - Every function needs type hints
   - Use Pydantic for complex types
   - Run `mypy` before commits

4. **Environment Variables**
   - Never hardcode secrets
   - Use `config/settings.py`
   - Check `.env.example` for required vars

## Pre-PR Checks

```bash
# Single command - all checks
cd apps/backend && uv run ruff check src/ && uv run mypy src/ && uv run pytest && echo "✅ Ready"
```

## Adding New Agents

1. Extend `BaseAgent` from `agents/base_agent.py`
2. Implement `execute()` method
3. Register in `AgentRegistry`
4. Add corresponding skill in `skills/`

```python
# New agent template
from src.agents.base_agent import BaseAgent, TaskOutput

class NewAgent(BaseAgent):
    """Description of what this agent does."""

    def __init__(self):
        super().__init__(
            name="new_agent",
            capabilities=["task_type_1", "task_type_2"]
        )

    async def execute(self, task: str, context: dict) -> TaskOutput:
        # Implementation
        return TaskOutput(
            task_id=context.get("task_id", "unknown"),
            agent_id=self.agent_id,
            status="pending_verification",
            outputs=[{"type": "result", "data": result}],
            requires_verification=True
        )
```

## Testing

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=src

# Run specific file
uv run pytest tests/test_agents.py

# Run specific test
uv run pytest -k "test_orchestrator"
```

---

**Parent**: [Root AGENTS.md](../../AGENTS.md)
