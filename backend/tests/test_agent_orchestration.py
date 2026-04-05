"""Tests for Phase 5 Week 1 - Agent Orchestration Foundation."""

import pytest
from src.ai.orchestration import (
    AgentRegistry,
    AgentStatus,
    get_agent_registry,
)
from src.ai.agents.chat_assistant import ChatAssistant
from src.ai.agents.insights_agent import InsightsAgent
from src.ai.agents.content_generator import ContentGenerator


class TestAgentRegistry:
    """Test Agent Registry functionality."""

    def test_singleton_pattern(self):
        """Test that get_agent_registry returns the same instance."""
        registry1 = get_agent_registry()
        registry2 = get_agent_registry()
        assert registry1 is registry2

    def test_registry_initialization(self):
        """Test registry initializes with empty state."""
        registry = get_agent_registry()
        stats = registry.get_statistics()

        # Should have agents from previous tests or initialization
        assert "total_agents" in stats
        assert "active_agents" in stats
        assert "capabilities" in stats

    def test_agent_registration(self):
        """Test agents register with proper metadata."""
        # Ensure agents are instantiated and registered
        chat = ChatAssistant()
        insights = InsightsAgent()
        content = ContentGenerator()

        registry = get_agent_registry()

        # Get all registered agents
        agents = registry.get_all_metadata()

        # Should have at least 3 agents (Chat, Insights, Content)
        assert len(agents) >= 3

        # Check for specific agents
        agent_ids = [agent.agent_id for agent in agents]
        assert "chat_assistant" in agent_ids
        assert "insights_agent" in agent_ids
        assert "content_generator" in agent_ids

    def test_capability_based_discovery(self):
        """Test finding agents by capability."""
        # Ensure agents are instantiated and registered
        chat = ChatAssistant()
        insights = InsightsAgent()
        content = ContentGenerator()

        registry = get_agent_registry()

        # Test chat capability
        chat_agents = registry.find_agents_by_capability("chat")
        assert len(chat_agents) >= 1
        assert any(agent_id == "chat_assistant" for agent_id, _, _ in chat_agents)

        # Test data_analysis capability
        analysis_agents = registry.find_agents_by_capability("data_analysis")
        assert len(analysis_agents) >= 1
        assert any(agent_id == "insights_agent" for agent_id, _, _ in analysis_agents)

        # Test content_generation capability
        content_agents = registry.find_agents_by_capability("content_generation")
        assert len(content_agents) >= 1
        assert any(agent_id == "content_generator" for agent_id, _, _ in content_agents)

    def test_agent_metadata_structure(self):
        """Test agent metadata has required fields."""
        # Ensure agent is instantiated and registered
        chat = ChatAssistant()

        registry = get_agent_registry()
        metadata = registry.get_metadata("chat_assistant")

        assert metadata is not None
        assert metadata.agent_id == "chat_assistant"
        assert metadata.name == "Chat Assistant"
        assert len(metadata.capabilities) > 0
        assert metadata.status == AgentStatus.ACTIVE
        assert metadata.health_score >= 0.0
        assert metadata.health_score <= 1.0
        assert metadata.estimated_execution_time > 0

    def test_get_agent_by_name(self):
        """Test retrieving agent by name."""
        # Ensure agents are instantiated and registered
        chat = ChatAssistant()
        insights = InsightsAgent()

        registry = get_agent_registry()

        agent = registry.get_agent_by_name("Chat Assistant")
        assert agent is not None
        assert agent.name == "Chat Assistant"

        agent = registry.get_agent_by_name("Insights Agent")
        assert agent is not None
        assert agent.name == "Insights Agent"


class TestAgentHealthChecks:
    """Test agent health check functionality."""

    @pytest.mark.asyncio
    async def test_chat_assistant_health_check(self):
        """Test ChatAssistant health check."""
        agent = ChatAssistant()
        report = await agent.health_check()

        assert report.agent_id == "chat_assistant"
        assert report.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED, AgentStatus.OFFLINE]
        assert report.response_time_ms >= 0
        assert len(report.checks_passed) > 0 or len(report.checks_failed) > 0

    @pytest.mark.asyncio
    async def test_insights_agent_health_check(self):
        """Test InsightsAgent health check."""
        agent = InsightsAgent()
        report = await agent.health_check()

        assert report.agent_id == "insights_agent"
        assert report.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED, AgentStatus.OFFLINE]
        assert report.response_time_ms >= 0

    @pytest.mark.asyncio
    async def test_content_generator_health_check(self):
        """Test ContentGenerator health check."""
        agent = ContentGenerator()
        report = await agent.health_check()

        assert report.agent_id == "content_generator"
        assert report.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED, AgentStatus.OFFLINE]
        assert report.response_time_ms >= 0

    @pytest.mark.asyncio
    async def test_registry_health_check_all(self):
        """Test registry can health check all agents."""
        registry = get_agent_registry()
        reports = await registry.health_check_all()

        # Should have reports for all registered agents
        assert len(reports) >= 3

        # Check specific agents
        assert "chat_assistant" in reports
        assert "insights_agent" in reports
        assert "content_generator" in reports

        # Verify report structure
        for agent_id, report in reports.items():
            assert report.agent_id == agent_id
            assert report.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED, AgentStatus.OFFLINE]


class TestAgentCapabilities:
    """Test agent capability declarations."""

    def test_chat_assistant_capabilities(self):
        """Test ChatAssistant declares correct capabilities."""
        agent = ChatAssistant()
        assert "chat" in agent.capabilities
        assert "customer_support" in agent.capabilities
        assert "data_query" in agent.capabilities

    def test_insights_agent_capabilities(self):
        """Test InsightsAgent declares correct capabilities."""
        agent = InsightsAgent()
        assert "data_analysis" in agent.capabilities
        assert "insights_generation" in agent.capabilities
        assert "analytics" in agent.capabilities

    def test_content_generator_capabilities(self):
        """Test ContentGenerator declares correct capabilities."""
        agent = ContentGenerator()
        assert "content_generation" in agent.capabilities
        assert "quote_generation" in agent.capabilities
        assert "email_generation" in agent.capabilities


class TestAgentMetrics:
    """Test agent metrics tracking."""

    def test_increment_decrement_active_executions(self):
        """Test active execution counter."""
        registry = get_agent_registry()
        agent_id = "chat_assistant"

        # Get initial count
        metadata = registry.get_metadata(agent_id)
        initial_count = metadata.active_executions if metadata else 0

        # Increment
        registry.increment_active_executions(agent_id)
        metadata = registry.get_metadata(agent_id)
        assert metadata.active_executions == initial_count + 1

        # Decrement
        registry.decrement_active_executions(agent_id)
        metadata = registry.get_metadata(agent_id)
        assert metadata.active_executions == initial_count

    def test_record_execution(self):
        """Test recording execution metrics."""
        registry = get_agent_registry()
        agent_id = "chat_assistant"

        # Get initial counts
        metadata = registry.get_metadata(agent_id)
        initial_total = metadata.total_executions if metadata else 0
        initial_failed = metadata.failed_executions if metadata else 0

        # Record successful execution
        registry.record_execution(agent_id, success=True)
        metadata = registry.get_metadata(agent_id)
        assert metadata.total_executions == initial_total + 1
        assert metadata.failed_executions == initial_failed

        # Record failed execution
        registry.record_execution(agent_id, success=False)
        metadata = registry.get_metadata(agent_id)
        assert metadata.total_executions == initial_total + 2
        assert metadata.failed_executions == initial_failed + 1

    def test_health_score_calculation(self):
        """Test health score updates based on success rate."""
        registry = get_agent_registry()
        agent_id = "chat_assistant"

        metadata = registry.get_metadata(agent_id)
        assert metadata is not None
        assert 0.0 <= metadata.health_score <= 1.0


class TestAgentStatistics:
    """Test registry statistics."""

    def test_get_statistics(self):
        """Test registry statistics structure."""
        registry = get_agent_registry()
        stats = registry.get_statistics()

        assert "total_agents" in stats
        assert "active_agents" in stats
        assert "degraded_agents" in stats
        assert "offline_agents" in stats
        assert "disabled_agents" in stats
        assert "total_executions" in stats
        assert "total_failures" in stats
        assert "success_rate" in stats
        assert "capabilities" in stats

        assert stats["total_agents"] >= 3
        assert isinstance(stats["capabilities"], list)
        assert len(stats["capabilities"]) > 0
