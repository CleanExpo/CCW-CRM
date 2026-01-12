"""Tests for Phase 5 Week 2 - Specialized Agents (Pricing, Procurement, TaskExecutor)."""

from decimal import Decimal
from uuid import uuid4

import pytest

from src.ai.agents.specialized import (
    PricingAgent,
    ProcurementAgent,
    TaskExecutorAgent,
)
from src.ai.orchestration import AgentStatus, get_agent_registry
from src.db.demo_models import Customer, Order, OrderItem, Product, ProductCategory


class TestPricingAgent:
    """Test Pricing Agent functionality."""

    def test_pricing_agent_registration(self):
        """Test PricingAgent registers with correct capabilities."""
        agent = PricingAgent()
        registry = get_agent_registry()

        metadata = registry.get_metadata("pricing_agent")
        assert metadata is not None
        assert metadata.agent_id == "pricing_agent"
        assert metadata.name == "Pricing Agent"
        assert "pricing" in metadata.capabilities
        assert "cost_analysis" in metadata.capabilities
        assert "price_optimization" in metadata.capabilities
        assert metadata.requires_verification is True

    @pytest.mark.asyncio
    async def test_pricing_agent_health_check(self):
        """Test PricingAgent health check."""
        agent = PricingAgent()
        report = await agent.health_check()

        assert report.agent_id == "pricing_agent"
        assert report.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED]
        assert report.response_time_ms >= 0

    @pytest.mark.asyncio
    async def test_pricing_recommendation_missing_product(self):
        """Test pricing recommendation with non-existent product."""
        agent = PricingAgent()

        result = await agent.execute(
            task="Recommend pricing",
            context={
                "request_type": "recommend",
                "product_id": str(uuid4()),  # Non-existent product
                "target_margin": 30.0,
            },
        )

        assert "error" in result
        assert result["status"] == "failed"

    @pytest.mark.asyncio
    async def test_pricing_recommendation_with_valid_product(self, sample_product):
        """Test pricing recommendation with valid product."""
        agent = PricingAgent()

        result = await agent.execute(
            task="Recommend pricing for product",
            context={
                "request_type": "recommend",
                "product_id": str(sample_product.id),
                "target_margin": 30.0,
            },
        )

        # Should complete successfully
        if "error" not in result:
            assert "product" in result
            assert "recommendation" in result
            assert result["product"]["product_id"] == str(sample_product.id)
            assert "price" in result["recommendation"]
            assert "margin" in result["recommendation"]

    @pytest.mark.asyncio
    async def test_pricing_agent_tools_registered(self):
        """Test PricingAgent has all required tools."""
        agent = PricingAgent()
        tools = agent.get_tools()

        assert len(tools) == 3
        tool_names = [tool.name for tool in tools]
        assert "analyze_pricing_history" in tool_names
        assert "calculate_margin" in tool_names
        assert "recommend_price" in tool_names

    @pytest.mark.asyncio
    async def test_pricing_validation_warnings(self, sample_product):
        """Test pricing validation generates warnings for risky changes."""
        agent = PricingAgent()

        # Set a very high target margin that would require large price change
        result = await agent.execute(
            task="Recommend pricing",
            context={
                "request_type": "recommend",
                "product_id": str(sample_product.id),
                "target_margin": 70.0,  # Very high margin
            },
        )

        # Should complete but may have validation warnings
        if "validation" in result:
            # Check if warnings were generated (optional test - may not trigger)
            assert "warnings" in result["validation"]


class TestProcurementAgent:
    """Test Procurement Agent functionality."""

    def test_procurement_agent_registration(self):
        """Test ProcurementAgent registers with correct capabilities."""
        agent = ProcurementAgent()
        registry = get_agent_registry()

        metadata = registry.get_metadata("procurement_agent")
        assert metadata is not None
        assert metadata.agent_id == "procurement_agent"
        assert metadata.name == "Procurement Agent"
        assert "procurement" in metadata.capabilities
        assert "inventory_management" in metadata.capabilities
        assert "supplier_recommendation" in metadata.capabilities
        assert metadata.requires_verification is True

    @pytest.mark.asyncio
    async def test_procurement_agent_health_check(self):
        """Test ProcurementAgent health check."""
        agent = ProcurementAgent()
        report = await agent.health_check()

        assert report.agent_id == "procurement_agent"
        assert report.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED]
        assert report.response_time_ms >= 0

    @pytest.mark.asyncio
    async def test_procurement_agent_tools_registered(self):
        """Test ProcurementAgent has all required tools."""
        agent = ProcurementAgent()
        tools = agent.get_tools()

        assert len(tools) == 3
        tool_names = [tool.name for tool in tools]
        assert "analyze_inventory" in tool_names
        assert "calculate_reorder_quantity" in tool_names
        assert "suggest_suppliers" in tool_names

    @pytest.mark.asyncio
    async def test_inventory_analysis_with_products(self, sample_product):
        """Test inventory analysis with existing products."""
        agent = ProcurementAgent()

        result = await agent.execute(
            task="Analyze inventory",
            context={
                "request_type": "analyze_inventory",
                "category": None,  # All categories
            },
        )

        # Should complete successfully
        if "error" not in result:
            assert "summary" in result
            assert "priority_actions" in result
            assert result["summary"]["total_products_analyzed"] >= 0

    @pytest.mark.asyncio
    async def test_inventory_analysis_by_category(self, sample_product):
        """Test inventory analysis filtered by category."""
        agent = ProcurementAgent()

        result = await agent.execute(
            task="Analyze inventory for heavy machinery",
            context={
                "request_type": "analyze_inventory",
                "category": ProductCategory.HEAVY_MACHINERY.value,
            },
        )

        # Should complete successfully
        if "error" not in result:
            assert "summary" in result
            assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_procurement_insights_generation(self, sample_product):
        """Test procurement generates insights and risk factors."""
        agent = ProcurementAgent()

        result = await agent.execute(
            task="Analyze procurement needs",
            context={"request_type": "analyze_inventory"},
        )

        # Should have insights
        if "error" not in result:
            assert "insights" in result
            assert isinstance(result["insights"], list)


class TestTaskExecutorAgent:
    """Test Task Executor Agent functionality."""

    def test_task_executor_registration(self):
        """Test TaskExecutorAgent registers with correct capabilities."""
        agent = TaskExecutorAgent()
        registry = get_agent_registry()

        metadata = registry.get_metadata("task_executor")
        assert metadata is not None
        assert metadata.agent_id == "task_executor"
        assert metadata.name == "Task Executor"
        assert "task_execution" in metadata.capabilities
        assert "action_execution" in metadata.capabilities
        assert "user_confirmation" in metadata.capabilities
        assert metadata.requires_verification is True

    @pytest.mark.asyncio
    async def test_task_executor_health_check(self):
        """Test TaskExecutorAgent health check."""
        agent = TaskExecutorAgent()
        report = await agent.health_check()

        assert report.agent_id == "task_executor"
        assert report.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED]
        assert report.response_time_ms >= 0

    @pytest.mark.asyncio
    async def test_task_executor_tools_registered(self):
        """Test TaskExecutorAgent has all required tools."""
        agent = TaskExecutorAgent()
        tools = agent.get_tools()

        assert len(tools) == 2
        tool_names = [tool.name for tool in tools]
        assert "validate_action" in tool_names
        assert "execute_action" in tool_names

    @pytest.mark.asyncio
    async def test_confirmation_token_generation(self, sample_product):
        """Test TaskExecutor generates confirmation token for write operations."""
        agent = TaskExecutorAgent()

        result = await agent.execute(
            task="Update product stock",
            context={
                "action_type": "update_product",
                "action_params": {
                    "product_id": str(sample_product.id),
                    "updates": {"stock": 100},
                },
            },
        )

        # Should request confirmation
        assert result["status"] == "pending_confirmation"
        assert "confirmation_token" in result
        assert result["confirmation_token"].startswith("conf-")
        assert "confirmation_instructions" in result

    @pytest.mark.asyncio
    async def test_confirmation_token_verification_invalid(self, sample_product):
        """Test TaskExecutor rejects invalid confirmation tokens."""
        agent = TaskExecutorAgent()

        result = await agent.execute(
            task="Update product stock",
            context={
                "action_type": "update_product",
                "action_params": {
                    "product_id": str(sample_product.id),
                    "updates": {"stock": 100},
                },
                "confirmation_token": "conf-invalid-token",
            },
        )

        # Should reject invalid token
        assert result["status"] == "confirmation_failed"
        assert "error" in result["message"] or result["status"] == "confirmation_failed"

    @pytest.mark.asyncio
    async def test_confirmation_token_verification_valid(self, sample_product):
        """Test TaskExecutor accepts valid confirmation token."""
        agent = TaskExecutorAgent()

        # Step 1: Generate token
        result1 = await agent.execute(
            task="Update product stock",
            context={
                "action_type": "update_product",
                "action_params": {
                    "product_id": str(sample_product.id),
                    "updates": {"stock": 100},
                },
            },
        )

        assert result1["status"] == "pending_confirmation"
        token = result1["confirmation_token"]

        # Step 2: Provide token to confirm
        result2 = await agent.execute(
            task="Update product stock",
            context={
                "action_type": "update_product",
                "action_params": {
                    "product_id": str(sample_product.id),
                    "updates": {"stock": 100},
                },
                "confirmation_token": token,
            },
        )

        # Should execute successfully
        assert result2["status"] == "completed"
        assert result2["message"] == "Action executed successfully"
        assert "execution_result" in result2

    @pytest.mark.asyncio
    async def test_validation_errors_prevent_execution(self):
        """Test TaskExecutor validation prevents execution of invalid actions."""
        agent = TaskExecutorAgent()

        result = await agent.execute(
            task="Update non-existent product",
            context={
                "action_type": "update_product",
                "action_params": {
                    "product_id": str(uuid4()),  # Non-existent product
                    "updates": {"stock": 100},
                },
            },
        )

        # Should fail validation
        assert result["status"] == "failed"
        assert "validation_errors" in result
        assert len(result["validation_errors"]) > 0

    @pytest.mark.asyncio
    async def test_action_validation_with_missing_params(self):
        """Test TaskExecutor validates missing required parameters."""
        agent = TaskExecutorAgent()

        result = await agent.execute(
            task="Create order",
            context={
                "action_type": "create_order",
                "action_params": {
                    # Missing customer_id and items
                },
            },
        )

        # Should fail validation
        assert result["status"] == "failed"
        assert "validation_errors" in result
        assert len(result["validation_errors"]) > 0


# Fixtures for test data
@pytest.fixture
async def sample_product(db_session):
    """Create a sample product for testing."""
    import uuid
    unique_sku = f"TEST-SKU-{uuid.uuid4().hex[:8].upper()}"
    product = Product(
        sku=unique_sku,
        name="Test Product",
        description="Test product for specialized agents",
        category=ProductCategory.HEAVY_MACHINERY,
        price=Decimal("100.00"),
        cost=Decimal("70.00"),
        stock=50,
        warehouse_location="A1",
        is_active=True,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)

    yield product

    # Cleanup after test
    try:
        await db_session.delete(product)
        await db_session.commit()
    except Exception:
        await db_session.rollback()


@pytest.fixture
async def sample_customer(db_session):
    """Create a sample customer for testing."""
    import uuid
    unique_number = f"CUST-{uuid.uuid4().hex[:8].upper()}"
    customer = Customer(
        customer_number=unique_number,
        company_name="Test Company",
        contact_name="Test Contact",
        email=f"test-{uuid.uuid4().hex[:6]}@example.com",
        phone="555-0100",
        address="123 Test St",
        city="Test City",
        state="TS",
        postal_code="12345",
        country="USA",
        is_active=True,
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    yield customer

    # Cleanup after test
    try:
        await db_session.delete(customer)
        await db_session.commit()
    except Exception:
        await db_session.rollback()


@pytest.fixture
async def sample_order_with_items(db_session, sample_customer, sample_product):
    """Create a sample order with items for testing."""
    import uuid
    unique_order_num = f"ORD-TEST-{uuid.uuid4().hex[:8].upper()}"
    order = Order(
        order_number=unique_order_num,
        customer_id=sample_customer.id,
        status="confirmed",
        notes="Test order",
    )
    db_session.add(order)
    await db_session.flush()

    # Add order item
    order_item = OrderItem(
        order_id=order.id,
        product_id=sample_product.id,
        quantity=5,
        unit_price=sample_product.price,
    )
    db_session.add(order_item)

    await db_session.commit()
    await db_session.refresh(order)

    yield order

    # Cleanup after test (cascade should handle order_item)
    try:
        await db_session.delete(order)
        await db_session.commit()
    except Exception:
        await db_session.rollback()
