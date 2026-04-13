"""Supervisor agent for routing tasks to specialized agents."""

import time
from typing import Any

import structlog
from langgraph.graph import END, StateGraph

from src.ai.base_agent import BaseAgent
from src.ai.orchestration import get_agent_registry
from src.ai.orchestration.supervisor_state import SupervisorState
from src.config import get_settings

logger = structlog.get_logger(__name__)

# Intent classification prompt
INTENT_CLASSIFICATION_PROMPT = """You are an AI task classifier for an ERP system with specialized agents.

Given a task, classify its primary intent and identify required capabilities.

Available agent capabilities:
- chat, customer_support, data_query, conversation
- data_analysis, insights_generation, analytics, business_intelligence
- content_generation, quote_generation, email_generation, report_generation
- pricing, cost_analysis, price_optimization
- procurement, supplier_recommendation, inventory_replenishment
- task_execution, action_execution, user_confirmation

Task: {task}

Respond in JSON format:
{{
    "intent": "brief_intent_description",
    "required_capabilities": ["capability1", "capability2"],
    "complexity": 5,  // 1-10 scale
    "estimated_time": 30  // seconds
}}

Only respond with valid JSON, no other text."""  # noqa: E501


class SupervisorAgent(BaseAgent):
    """Supervisor agent that routes tasks to specialized agents.

    The supervisor:
    1. Analyzes incoming tasks to determine intent
    2. Queries the agent registry for capable agents
    3. Selects the best agent based on health, capability, speed, load
    4. Executes the selected agent with context
    5. Validates results
    6. Returns final output

    Selection algorithm weighs:
    - Health score: 40%
    - Capability match: 30%
    - Estimated execution time: 20%
    - Current load (active executions): 10%
    """

    def __init__(self):
        super().__init__(
            agent_id="supervisor",
            name="Supervisor Agent",
            auto_register=False,  # Supervisor doesn't register itself
        )

        self.capabilities = ["orchestration", "routing", "coordination"]
        self.description = "Routes tasks to appropriate specialized agents"
        self.estimated_execution_time = 60
        self.requires_verification = False

        self._settings = get_settings()
        self._anthropic_key = self._settings.anthropic_api_key
        self.registry = get_agent_registry()
        self.graph = self._build_graph()

        logger.info("Supervisor agent initialized")

    def _build_graph(self) -> StateGraph:
        """Build LangGraph state graph for supervisor flow."""
        workflow = StateGraph(SupervisorState)

        # Add nodes
        workflow.add_node("analyze_task", self._analyze_task)
        workflow.add_node("query_registry", self._query_registry)
        workflow.add_node("select_agent", self._select_agent)
        workflow.add_node("execute_agent", self._execute_agent)
        workflow.add_node("validate_result", self._validate_result)
        workflow.add_node("finalize", self._finalize)

        # Set entry point
        workflow.set_entry_point("analyze_task")

        # Add edges
        workflow.add_edge("analyze_task", "query_registry")
        workflow.add_edge("query_registry", "select_agent")
        workflow.add_edge("select_agent", "execute_agent")
        workflow.add_edge("execute_agent", "validate_result")
        workflow.add_edge("validate_result", "finalize")
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def _analyze_task(self, state: SupervisorState) -> SupervisorState:
        """Analyze task to determine intent and required capabilities."""
        task = state["task"]
        logger.info("Analyzing task", task_preview=task[:100])

        try:
            import json

            import anthropic

            # Use Anthropic claude-haiku for fast, cheap intent classification
            # (~200 tokens per call, ~$0.0004 — negligible cost)
            if not self._anthropic_key:
                raise ValueError("ANTHROPIC_API_KEY not configured")

            client = anthropic.AsyncAnthropic(api_key=self._anthropic_key)
            prompt = INTENT_CLASSIFICATION_PROMPT.format(task=task)
            message = await client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=200,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}],
            )
            response = message.content[0].text

            classification = json.loads(response.strip())

            state["task_intent"] = classification.get("intent", "general")
            state["required_capabilities"] = classification.get("required_capabilities", [])
            state["task_complexity"] = classification.get("complexity", 5)
            state["estimated_execution_time"] = classification.get("estimated_time", 60)

            logger.info(
                "Task analysis complete",
                intent=state["task_intent"],
                capabilities=state["required_capabilities"],
            )

        except Exception as e:
            logger.error("Task analysis failed", error=str(e))
            # Fallback: basic keyword matching
            state["task_intent"] = "general"
            state["required_capabilities"] = self._fallback_capability_detection(task)
            state["task_complexity"] = 5
            state["estimated_execution_time"] = 60

        # Initialize metadata
        state.setdefault("metadata", {})
        state["metadata"]["analysis_method"] = "anthropic" if not state.get("error") else "fallback"

        return state

    def _fallback_capability_detection(self, task: str) -> list[str]:
        """Fallback keyword-based capability detection."""
        task_lower = task.lower()
        capabilities = []

        # Chat/conversation keywords
        if any(word in task_lower for word in ["chat", "ask", "question", "help", "tell me"]):
            capabilities.append("chat")

        # Data analysis keywords
        if any(
            word in task_lower
            for word in ["analyze", "insight", "trend", "report", "metrics", "statistics"]
        ):
            capabilities.append("data_analysis")

        # Content generation keywords
        if any(
            word in task_lower
            for word in ["generate", "create", "write", "quote", "email", "draft"]
        ):
            capabilities.append("content_generation")

        # Pricing keywords
        if any(word in task_lower for word in ["price", "pricing", "cost", "margin"]):
            capabilities.append("pricing")

        # Procurement keywords
        if any(
            word in task_lower
            for word in ["procurement", "supplier", "inventory", "reorder", "stock"]
        ):
            capabilities.append("procurement")

        # Task execution keywords
        if any(
            word in task_lower
            for word in ["execute", "create order", "delete", "update", "modify"]
        ):
            capabilities.append("task_execution")

        return capabilities if capabilities else ["chat"]  # Default to chat

    async def _query_registry(self, state: SupervisorState) -> SupervisorState:
        """Query agent registry for agents with required capabilities."""
        required_capabilities = state.get("required_capabilities", [])
        logger.info("Querying registry", capabilities=required_capabilities)

        candidate_agents = []

        # Query registry for each required capability
        for capability in required_capabilities:
            agents = self.registry.find_agents_by_capability(capability)
            for agent_id, agent_name, agent_capabilities in agents:
                # Get agent metadata
                metadata = self.registry.get_metadata(agent_id)
                if metadata and metadata.status.value == "active":
                    candidate_agents.append(
                        (
                            agent_id,
                            metadata.health_score,
                            metadata.estimated_execution_time,
                        )
                    )

        # Deduplicate agents (same agent might match multiple capabilities)
        unique_agents = {}
        for agent_id, health_score, exec_time in candidate_agents:
            if agent_id not in unique_agents:
                unique_agents[agent_id] = (agent_id, health_score, exec_time)

        state["candidate_agents"] = list(unique_agents.values())

        logger.info(
            "Registry query complete",
            candidates_found=len(state["candidate_agents"]),
        )

        # Handle no candidates found
        if not state["candidate_agents"]:
            state["error"] = f"No agents found for capabilities: {required_capabilities}"
            logger.warning("No suitable agents found", capabilities=required_capabilities)

        return state

    async def _select_agent(self, state: SupervisorState) -> SupervisorState:
        """Select best agent based on weighted scoring algorithm."""
        candidates = state.get("candidate_agents", [])

        if not candidates:
            state["error"] = "No candidate agents available"
            return state

        logger.info("Selecting agent", candidates_count=len(candidates))

        # Scoring algorithm
        scored_agents = []
        for agent_id, health_score, est_time in candidates:
            metadata = self.registry.get_metadata(agent_id)
            if not metadata:
                continue

            # Calculate scores (normalize to 0-1 range)
            health_score_normalized = health_score  # Already 0-1
            capability_match_score = 1.0  # All candidates match capabilities
            speed_score = 1.0 - min(est_time / 300.0, 1.0)  # Faster = better (cap at 300s)
            load_score = 1.0 - min(metadata.active_executions / 10.0, 1.0)  # Less load = better

            # Weighted total (health 40%, capability 30%, speed 20%, load 10%)
            total_score = (
                health_score_normalized * 0.4
                + capability_match_score * 0.3
                + speed_score * 0.2
                + load_score * 0.1
            )

            scored_agents.append((agent_id, total_score, metadata))

        # Sort by score (descending)
        scored_agents.sort(key=lambda x: x[1], reverse=True)

        # Select top agent
        selected_agent_id, score, metadata = scored_agents[0]
        state["selected_agent_id"] = selected_agent_id
        state["selection_reasoning"] = (
            f"Selected {metadata.name} (score: {score:.2f}, "
            f"health: {metadata.health_score:.2f}, "
            f"load: {metadata.active_executions}, "
            f"est_time: {metadata.estimated_execution_time}s)"
        )

        logger.info(
            "Agent selected",
            agent_id=selected_agent_id,
            agent_name=metadata.name,
            score=score,
        )

        return state

    async def _execute_agent(self, state: SupervisorState) -> SupervisorState:
        """Execute selected agent with task and context."""
        selected_agent_id = state.get("selected_agent_id")

        if not selected_agent_id:
            state["error"] = "No agent selected for execution"
            return state

        logger.info("Executing agent", agent_id=selected_agent_id)

        try:
            # Get agent from registry
            metadata = self.registry.get_metadata(selected_agent_id)
            if not metadata:
                state["error"] = f"Agent {selected_agent_id} not found in registry"
                return state

            agent_instance = metadata.agent_instance

            # Build execution context
            execution_context = state.get("context", {})
            execution_context["supervisor_task_id"] = state.get("metadata", {}).get(
                "task_id", "unknown"
            )
            execution_context["user_id"] = state.get("user_id")
            execution_context["workflow_id"] = state.get("workflow_id")
            execution_context["call_stack_depth"] = state.get("call_stack_depth", 0) + 1

            # Check call stack depth (prevent infinite loops)
            if execution_context["call_stack_depth"] > 3:
                state["error"] = "Maximum call stack depth exceeded (agent-to-agent calls)"
                logger.warning("Call stack depth exceeded", depth=execution_context["call_stack_depth"])  # noqa: E501
                return state

            # Execute agent with metrics tracking
            start_time = time.time()
            result = await agent_instance.execute_with_metrics(
                task=state["task"], context=execution_context
            )
            execution_time_ms = int((time.time() - start_time) * 1000)

            state["agent_result"] = result
            state["execution_time_ms"] = execution_time_ms
            state["tools_used"] = result.get("tools_used", [])

            # Extract tokens_used if available
            state["tokens_used"] = result.get("tokens_used")

            logger.info(
                "Agent execution complete",
                agent_id=selected_agent_id,
                execution_time_ms=execution_time_ms,
                has_error=bool(result.get("error")),
            )

        except Exception as e:
            logger.error("Agent execution failed", agent_id=selected_agent_id, error=str(e))
            state["error"] = f"Agent execution failed: {str(e)}"
            state["agent_result"] = {"error": str(e)}

        return state

    async def _validate_result(self, state: SupervisorState) -> SupervisorState:
        """Validate agent execution result."""
        agent_result = state.get("agent_result", {})
        validation_errors = []

        logger.info("Validating result")

        # Check for errors
        if agent_result.get("error"):
            validation_errors.append(f"Agent returned error: {agent_result['error']}")

        # Check if result requires user confirmation
        requires_confirmation = agent_result.get("requires_verification", False)
        state["requires_user_confirmation"] = requires_confirmation

        # Validation passed if no errors
        state["validation_passed"] = len(validation_errors) == 0
        state["validation_errors"] = validation_errors

        if validation_errors:
            logger.warning("Validation failed", errors=validation_errors)
        else:
            logger.info("Validation passed")

        return state

    async def _finalize(self, state: SupervisorState) -> SupervisorState:
        """Finalize supervisor execution and format output."""
        validation_passed = state.get("validation_passed", False)
        agent_result = state.get("agent_result", {})

        if not validation_passed or state.get("error"):
            # Execution failed
            state["status"] = "failed"
            state["final_result"] = {
                "error": state.get("error") or "Validation failed",
                "validation_errors": state.get("validation_errors", []),
            }
        elif state.get("requires_user_confirmation"):
            # Execution succeeded but needs user approval
            state["status"] = "pending_confirmation"
            state["final_result"] = agent_result
        else:
            # Execution succeeded
            state["status"] = "completed"
            state["final_result"] = agent_result

        # Add metadata
        state["metadata"] = state.get("metadata", {})
        state["metadata"].update(
            {
                "selected_agent": state.get("selected_agent_id"),
                "execution_time_ms": state.get("execution_time_ms"),
                "tools_used": state.get("tools_used", []),
                "tokens_used": state.get("tokens_used"),
            }
        )

        logger.info(
            "Supervisor execution finalized",
            status=state["status"],
            requires_confirmation=state.get("requires_user_confirmation", False),
        )

        return state

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute a task by routing to appropriate agent.

        Args:
            task: Task description
            context: Execution context (user_id, workflow_id, etc.)

        Returns:
            dict with final_result, status, metadata
        """
        context = context or {}

        # Initialize state
        initial_state: SupervisorState = {
            "task": task,
            "context": context,
            "user_id": context.get("user_id"),
            "workflow_id": context.get("workflow_id"),
            # Analysis
            "task_intent": None,
            "required_capabilities": [],
            "task_complexity": 5,
            "estimated_execution_time": 60,
            # Selection
            "candidate_agents": [],
            "selected_agent_id": None,
            "selection_reasoning": None,
            # Execution
            "agent_result": None,
            "execution_time_ms": None,
            "tokens_used": None,
            # Validation
            "validation_passed": False,
            "validation_errors": [],
            "requires_user_confirmation": False,
            # Output
            "final_result": None,
            "status": "pending",
            "error": None,
            # Metadata
            "metadata": {},
            "tools_used": [],
            "call_stack_depth": context.get("call_stack_depth", 0),
        }

        try:
            # Execute graph
            final_state = await self.graph.ainvoke(initial_state)

            return {
                "final_result": final_state.get("final_result"),
                "status": final_state.get("status"),
                "requires_confirmation": final_state.get("requires_user_confirmation", False),
                "metadata": final_state.get("metadata", {}),
                "error": final_state.get("error"),
            }

        except Exception as e:
            logger.error("Supervisor execution failed", error=str(e))
            return {
                "final_result": None,
                "status": "failed",
                "error": f"Supervisor execution failed: {str(e)}",
                "metadata": {},
            }

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        """Stream supervisor execution (not implemented - supervisor is batch-based)."""
        yield "Supervisor routing task...\n"
        result = await self.execute(task, context)

        if result["status"] == "failed":
            yield f"Error: {result['error']}\n"
        elif result["status"] == "pending_confirmation":
            yield "⚠ Task requires user confirmation\n"
        else:
            yield f"✓ Task completed by {result['metadata'].get('selected_agent', 'unknown agent')}\n"  # noqa: E501


# Singleton instance
_supervisor_agent: SupervisorAgent | None = None


def get_supervisor_agent() -> SupervisorAgent:
    """Get or create supervisor agent singleton."""
    global _supervisor_agent
    if _supervisor_agent is None:
        _supervisor_agent = SupervisorAgent()
    return _supervisor_agent
