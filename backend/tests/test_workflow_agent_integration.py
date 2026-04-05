"""Tests for Phase 5 Week 3 - Workflow Engine + Agent Integration."""

from decimal import Decimal
from uuid import uuid4

import pytest

from src.ai.orchestration.supervisor_agent import SupervisorAgent
from src.workflow.engine import WorkflowEngine
from src.workflow.models import (
    EdgeType,
    ExecutionStatus,
    NodeConfig,
    NodePosition,
    NodeType,
    WorkflowDefinition,
    WorkflowEdge,
)


class TestWorkflowAgentIntegration:
    """Test workflow engine integration with agent orchestration."""

    @pytest.mark.asyncio
    async def test_workflow_engine_initializes_with_supervisor(self):
        """Test WorkflowEngine initializes with SupervisorAgent."""
        engine = WorkflowEngine()

        assert engine.supervisor is not None
        assert isinstance(engine.supervisor, SupervisorAgent)
        assert engine.storage is not None
        assert engine.tool_registry is not None

    @pytest.mark.asyncio
    async def test_agent_node_execution_routes_to_supervisor(self):
        """Test agent node routes task through SupervisorAgent."""
        engine = WorkflowEngine()

        # Create a simple agent node
        node = NodeConfig(
            id="agent1",
            type=NodeType.AGENT,
            position=NodePosition(x=100, y=100),
            label="Pricing Agent Task",
            config={
                "task_description": "Analyze pricing for product XYZ",
                "agent_name": "auto",
            },
            outputs={
                "agent": "selected_agent",
                "status": "execution_status",
            },
        )

        # Execute the node
        result = await engine._execute_agent_node(node, {})

        # Verify result structure
        assert "agent" in result
        assert "status" in result
        assert "result" in result
        assert result["status"] in ["completed", "failed"]

    @pytest.mark.asyncio
    async def test_nested_output_extraction(self):
        """Test _extract_nested_value handles nested dictionaries."""
        engine = WorkflowEngine()

        # Test data with nested structure (like agent output)
        data = {
            "agent": "pricing_agent",
            "status": "completed",
            "result": {
                "recommendation": {
                    "price": 150.00,
                    "margin": 30.5,
                },
                "product": {
                    "sku": "TEST-001",
                    "name": "Test Product",
                },
            },
        }

        # Test top-level extraction
        assert engine._extract_nested_value(data, "agent") == "pricing_agent"
        assert engine._extract_nested_value(data, "status") == "completed"

        # Test nested extraction
        assert engine._extract_nested_value(data, "result.recommendation.price") == 150.00
        assert engine._extract_nested_value(data, "result.recommendation.margin") == 30.5
        assert engine._extract_nested_value(data, "result.product.sku") == "TEST-001"

        # Test non-existent paths
        assert engine._extract_nested_value(data, "result.nonexistent") is None
        assert engine._extract_nested_value(data, "nonexistent.path") is None

    @pytest.mark.asyncio
    async def test_variable_resolution_in_workflow(self):
        """Test variable resolution with {{variable.path}} syntax."""
        engine = WorkflowEngine()

        variables = {
            "customer_id": "12345",
            "product": {
                "sku": "PROD-001",
                "name": "Test Product",
            },
            "pricing": {
                "current": 100.00,
                "target": 150.00,
            },
        }

        # Test string resolution
        template = "Analyze pricing for {{product.name}} (SKU: {{product.sku}})"
        resolved = engine._resolve_variables_in_string(template, variables)
        assert resolved == "Analyze pricing for Test Product (SKU: PROD-001)"

        # Test nested dict resolution
        template_dict = {
            "task": "Price {{product.sku}}",
            "context": {
                "current_price": "{{pricing.current}}",
                "target_price": "{{pricing.target}}",
            },
        }
        resolved_dict = engine._resolve_variables(template_dict, variables)
        assert resolved_dict["task"] == "Price PROD-001"
        assert resolved_dict["context"]["current_price"] == "100.0"
        assert resolved_dict["context"]["target_price"] == "150.0"

    @pytest.mark.asyncio
    async def test_simple_workflow_with_agent_node(self):
        """Test executing a simple workflow with an agent node."""
        engine = WorkflowEngine()

        # Define a simple workflow: START -> AGENT -> END
        workflow = WorkflowDefinition(
            id=str(uuid4()),
            name="Test Agent Workflow",
            description="Simple workflow with one agent node",
            nodes=[
                NodeConfig(
                    id="start",
                    type=NodeType.START,
                    position=NodePosition(x=100, y=100),
                    label="Start",
                ),
                NodeConfig(
                    id="agent1",
                    type=NodeType.AGENT,
                    position=NodePosition(x=300, y=100),
                    label="Analyze Product",
                    config={
                        "task_description": "Analyze inventory for low stock products",
                        "agent_name": "auto",
                    },
                    outputs={
                        "agent": "agent_used",
                        "status": "agent_status",
                    },
                ),
                NodeConfig(
                    id="end",
                    type=NodeType.END,
                    position=NodePosition(x=500, y=100),
                    label="End",
                ),
            ],
            edges=[
                WorkflowEdge(
                    id="e1",
                    source_node_id="start",
                    target_node_id="agent1",
                    type=EdgeType.DEFAULT,
                ),
                WorkflowEdge(
                    id="e2",
                    source_node_id="agent1",
                    target_node_id="end",
                    type=EdgeType.DEFAULT,
                ),
            ],
            variables={},
        )

        # Start execution
        execution_id = await engine.start_execution(workflow, {})
        assert execution_id is not None

        # Execute workflow
        context = await engine.execute(execution_id)

        # Verify execution completed
        assert context.status == ExecutionStatus.COMPLETED
        assert len(context.completed_nodes) == 3  # start, agent1, end
        assert "agent1" in context.node_outputs
        assert "agent_used" in context.variables  # Output was mapped

    @pytest.mark.asyncio
    async def test_agent_node_with_input_variables(self):
        """Test agent node receives and uses workflow variables."""
        engine = WorkflowEngine()

        # Define workflow with variable inputs
        workflow = WorkflowDefinition(
            id=str(uuid4()),
            name="Test Variable Passing",
            nodes=[
                NodeConfig(
                    id="start",
                    type=NodeType.START,
                    position=NodePosition(x=100, y=100),
                    label="Start",
                ),
                NodeConfig(
                    id="agent1",
                    type=NodeType.AGENT,
                    position=NodePosition(x=300, y=100),
                    label="Price Product",
                    config={
                        "task_description": "Recommend pricing for product {{product_sku}} with target margin {{target_margin}}%",
                        "agent_name": "auto",
                    },
                    inputs={
                        "product_sku": "product_sku",
                        "target_margin": "target_margin",
                    },
                    outputs={
                        "result": "pricing_result",
                    },
                ),
                NodeConfig(
                    id="end",
                    type=NodeType.END,
                    position=NodePosition(x=500, y=100),
                    label="End",
                ),
            ],
            edges=[
                WorkflowEdge(
                    id="e1",
                    source_node_id="start",
                    target_node_id="agent1",
                    type=EdgeType.DEFAULT,
                ),
                WorkflowEdge(
                    id="e2",
                    source_node_id="agent1",
                    target_node_id="end",
                    type=EdgeType.DEFAULT,
                ),
            ],
            variables={},
        )

        # Execute with input variables
        input_vars = {
            "product_sku": "PROD-12345",
            "target_margin": 30.0,
        }

        execution_id = await engine.start_execution(workflow, input_vars)
        context = await engine.execute(execution_id)

        # Verify variables were passed and used
        assert context.variables["product_sku"] == "PROD-12345"
        assert context.variables["target_margin"] == 30.0
        assert context.status == ExecutionStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_agent_node_error_handling(self):
        """Test agent node handles errors gracefully."""
        engine = WorkflowEngine()

        # Create node with missing required config
        node = NodeConfig(
            id="agent1",
            type=NodeType.AGENT,
            position=NodePosition(x=100, y=100),
            label="Bad Agent Node",
            config={
                # Missing task_description - should raise error
                "agent_name": "auto",
            },
        )

        # Execute should handle error gracefully
        result = await engine._execute_agent_node(node, {})

        # Should return error status
        assert result["status"] == "failed"
        assert "error" in result

    @pytest.mark.asyncio
    async def test_output_mapping_with_nested_agent_results(self):
        """Test output mapping extracts nested values from agent results."""
        engine = WorkflowEngine()

        # Simulate agent node execution context
        from src.workflow.models import ExecutionContext

        context = ExecutionContext(
            execution_id=str(uuid4()),
            workflow_id=str(uuid4()),
            variables={},
        )

        # Simulate agent node with nested outputs
        node = NodeConfig(
            id="agent1",
            type=NodeType.AGENT,
            position=NodePosition(x=100, y=100),
            label="Pricing Agent",
            config={"task_description": "test"},
            outputs={
                "result.recommendation.price": "recommended_price",
                "result.recommendation.margin": "recommended_margin",
                "status": "execution_status",
            },
        )

        # Simulate agent result
        agent_result = {
            "agent": "pricing_agent",
            "status": "completed",
            "result": {
                "recommendation": {
                    "price": 150.00,
                    "margin": 30.5,
                },
            },
        }

        # Store and map outputs
        context.node_outputs[node.id] = agent_result
        for output_path, output_var in node.outputs.items():
            output_value = engine._extract_nested_value(agent_result, output_path)
            if output_value is not None:
                context.variables[output_var] = output_value

        # Verify mapping worked
        assert context.variables["recommended_price"] == 150.00
        assert context.variables["recommended_margin"] == 30.5
        assert context.variables["execution_status"] == "completed"


class TestWorkflowVariableResolution:
    """Test variable resolution in various contexts."""

    @pytest.mark.asyncio
    async def test_simple_variable_substitution(self):
        """Test basic {{variable}} substitution."""
        engine = WorkflowEngine()

        variables = {"name": "Alice", "age": 30}
        template = "Hello {{name}}, you are {{age}} years old"

        result = engine._resolve_variables_in_string(template, variables)
        assert result == "Hello Alice, you are 30 years old"

    @pytest.mark.asyncio
    async def test_nested_variable_substitution(self):
        """Test {{nested.path}} substitution."""
        engine = WorkflowEngine()

        variables = {
            "user": {
                "name": "Alice",
                "profile": {
                    "city": "San Francisco",
                },
            },
        }

        template = "{{user.name}} lives in {{user.profile.city}}"
        result = engine._resolve_variables_in_string(template, variables)
        assert result == "Alice lives in San Francisco"

    @pytest.mark.asyncio
    async def test_missing_variable_resolution(self):
        """Test handling of missing variables."""
        engine = WorkflowEngine()

        variables = {"name": "Alice"}
        template = "Hello {{name}}, age: {{missing.age}}"

        result = engine._resolve_variables_in_string(template, variables)
        # Missing variables resolve to empty dict string representation
        assert "Alice" in result
        assert "{}" in result or "missing" in result

    @pytest.mark.asyncio
    async def test_dict_variable_resolution(self):
        """Test resolving variables in nested dictionaries."""
        engine = WorkflowEngine()

        variables = {
            "product_id": "12345",
            "pricing": {"current": 100, "target": 150},
        }

        template = {
            "task": "Analyze product {{product_id}}",
            "params": {
                "current_price": "{{pricing.current}}",
                "target_price": "{{pricing.target}}",
            },
        }

        result = engine._resolve_variables(template, variables)

        assert result["task"] == "Analyze product 12345"
        assert result["params"]["current_price"] == "100"
        assert result["params"]["target_price"] == "150"

    @pytest.mark.asyncio
    async def test_list_variable_resolution(self):
        """Test resolving variables in lists."""
        engine = WorkflowEngine()

        variables = {"name": "Alice", "city": "NYC"}

        template = [
            "Hello {{name}}",
            "City: {{city}}",
            {"nested": "{{name}} from {{city}}"},
        ]

        result = engine._resolve_variables(template, variables)

        assert result[0] == "Hello Alice"
        assert result[1] == "City: NYC"
        assert result[2]["nested"] == "Alice from NYC"
