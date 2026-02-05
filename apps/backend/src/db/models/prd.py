"""PRD database models."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import ARRAY, TIMESTAMP, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from src.db.models_base import Base


class PRD(Base):
    """Product Requirements Document model."""

    __tablename__ = "prds"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )  # noqa: E501
    organization_id = Column(PGUUID(as_uuid=True), nullable=True)  # Made optional for demo auth

    # Input
    requirements = Column(Text, nullable=False)
    context = Column(JSONB, nullable=True)

    # Generated content
    executive_summary = Column(Text, nullable=True)
    problem_statement = Column(Text, nullable=True)
    prd_analysis = Column(JSONB, nullable=True)
    feature_decomposition = Column(JSONB, nullable=True)
    technical_spec = Column(JSONB, nullable=True)
    test_plan = Column(JSONB, nullable=True)
    roadmap = Column(JSONB, nullable=True)

    # Documents generated
    documents_generated = Column(ARRAY(String), nullable=True)

    # Summary stats
    total_user_stories = Column(Integer, default=0)
    total_api_endpoints = Column(Integer, default=0)
    total_test_scenarios = Column(Integer, default=0)
    total_sprints = Column(Integer, default=0)
    estimated_duration_weeks = Column(Integer, default=0)

    # Status tracking
    status = Column(String(50), default="generating", nullable=False)
    error_message = Column(Text, nullable=True)

    # Model info
    model_used = Column(String(100), default="claude-opus-4-6")

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )  # noqa: E501
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="prds")
    # organization relationship removed for demo auth (no Organization model in models.py)
    agent_runs = relationship("AgentRun", back_populates="prd", cascade="all, delete-orphan")
    api_usage = relationship("APIUsage", back_populates="prd", cascade="all, delete-orphan")


class AgentRun(Base):
    """Agent execution tracking model."""

    __tablename__ = "agent_runs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_name = Column(String(255), nullable=False)
    task_description = Column(Text, nullable=True)

    # Status tracking
    status = Column(String(50), nullable=False, default="running")
    progress = Column(Integer, default=0)
    current_step = Column(String(255), nullable=True)

    # Results
    outputs = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)

    # Linked resources
    prd_id = Column(PGUUID(as_uuid=True), ForeignKey("prds.id", ondelete="CASCADE"), nullable=True)

    # Timestamps
    started_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    prd = relationship("PRD", back_populates="agent_runs")


class APIUsage(Base):
    """API usage and cost tracking model."""

    __tablename__ = "api_usage"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_run_id = Column(String(255), nullable=False)
    prd_id = Column(PGUUID(as_uuid=True), ForeignKey("prds.id", ondelete="CASCADE"), nullable=True)

    # API details
    provider = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)

    # Token usage
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)

    # Cost calculation (stored as strings to preserve precision)
    cost_per_input_token = Column(String(50), nullable=False)
    cost_per_output_token = Column(String(50), nullable=False)

    # Additional data
    extra_data = Column("metadata", JSONB, nullable=True)

    # Timestamp
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    prd = relationship("PRD", back_populates="api_usage")
