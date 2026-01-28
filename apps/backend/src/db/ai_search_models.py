"""
AI Search Database Models.

SQLAlchemy ORM models for semantic search and recommendations.
"""

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from src.db.models import Base


class RecommendationType(str, enum.Enum):
    """Product recommendation types."""

    SIMILAR = "similar"
    COMPLEMENTARY = "complementary"
    FREQUENTLY_BOUGHT_TOGETHER = "frequently_bought_together"
    PERSONALIZED = "personalized"


class InteractionType(str, enum.Enum):
    """Customer interaction types."""

    VIEW = "view"
    ADD_TO_CART = "add_to_cart"
    PURCHASE = "purchase"
    SEARCH = "search"
    WISHLIST = "wishlist"


class ProductEmbedding(Base):
    """
    Product vector embeddings for semantic search.

    Table: product_embeddings
    """

    __tablename__ = "product_embeddings"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    language_code: str = Column(String(10), nullable=False, index=True)

    # Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding: list[float] = Column(Vector(1536), nullable=False)

    # Model metadata
    model_version: str = Column(String(50), nullable=False, default="text-embedding-3-small")
    model_provider: str = Column(String(50), nullable=False, default="openai")

    # Generation metadata
    generated_from: str | None = Column(Text, nullable=True)
    generation_timestamp: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ProductEmbedding(id={self.id}, product_id={self.product_id}, language={self.language_code})>"


class ProductRecommendation(Base):
    """
    Precomputed product recommendations.

    Table: product_recommendations
    """

    __tablename__ = "product_recommendations"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    source_product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recommended_product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Recommendation details
    recommendation_type: str = Column(String(50), nullable=False, index=True)
    score: float = Column(Numeric(5, 4), nullable=False)
    rank: int = Column(Integer, nullable=False)

    # Reasoning
    reason: str | None = Column(Text, nullable=True)

    # Metadata
    algorithm_version: str | None = Column(String(50), nullable=True)
    generated_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 1", name="check_score_range"),
        CheckConstraint("source_product_id != recommended_product_id", name="check_no_self_recommendation"),
    )

    def __repr__(self) -> str:
        return f"<ProductRecommendation(id={self.id}, type={self.recommendation_type}, score={self.score})>"


class CustomerProductInteraction(Base):
    """
    Customer product interactions for personalized recommendations.

    Table: customer_product_interactions
    """

    __tablename__ = "customer_product_interactions"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    customer_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Interaction details
    interaction_type: str = Column(String(50), nullable=False, index=True)
    interaction_count: int = Column(Integer, nullable=False, default=1)

    # Context
    session_id: str | None = Column(String(255), nullable=True)
    source: str | None = Column(String(100), nullable=True)

    # Timestamps
    first_interaction_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    last_interaction_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<CustomerProductInteraction(id={self.id}, type={self.interaction_type}, count={self.interaction_count})>"


class ProductCoOccurrence(Base):
    """
    Products frequently bought together (market basket analysis).

    Table: product_co_occurrences
    """

    __tablename__ = "product_co_occurrences"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    product_a_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_b_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Co-occurrence metrics
    co_occurrence_count: int = Column(Integer, nullable=False, default=1)
    confidence: float | None = Column(Numeric(5, 4), nullable=True)
    lift: float | None = Column(Numeric(8, 4), nullable=True)

    # Time windows
    last_co_occurrence_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    first_co_occurrence_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("product_a_id != product_b_id", name="check_no_self_pairing"),
    )

    def __repr__(self) -> str:
        return f"<ProductCoOccurrence(id={self.id}, count={self.co_occurrence_count})>"


class SearchQuery(Base):
    """
    Search query tracking for analytics.

    Table: search_queries
    """

    __tablename__ = "search_queries"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Query details
    query_text: str = Column(Text, nullable=False, index=True)
    query_language: str = Column(String(10), nullable=False, default="en", index=True)
    query_type: str = Column(String(50), nullable=False, default="semantic")

    # Customer reference
    customer_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_id: str | None = Column(String(255), nullable=True)

    # Results
    results_count: int = Column(Integer, nullable=False, default=0)
    results_product_ids: list[UUID] | None = Column(ARRAY(PGUUID(as_uuid=True)), nullable=True)

    # Performance
    query_time_ms: int | None = Column(Integer, nullable=True)

    # User actions
    clicked_product_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    clicked_rank: int | None = Column(Integer, nullable=True)
    converted: bool = Column(Boolean, default=False, index=True)

    # Timestamps
    searched_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<SearchQuery(id={self.id}, query={self.query_text[:50]}, results={self.results_count})>"


class VoiceSearchSession(Base):
    """
    Voice search session tracking.

    Table: voice_search_sessions
    """

    __tablename__ = "voice_search_sessions"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Session details
    session_id: str = Column(String(255), nullable=False, unique=True, index=True)
    language: str = Column(String(10), nullable=False, default="en")

    # Voice assistant
    assistant_type: str | None = Column(String(50), nullable=True, index=True)

    # Search queries
    query_count: int = Column(Integer, nullable=False, default=0)
    queries: dict | None = Column(JSONB, nullable=True)

    # Results
    total_results_shown: int = Column(Integer, nullable=False, default=0)
    conversion_count: int = Column(Integer, nullable=False, default=0)

    # Session lifecycle
    started_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    ended_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    duration_seconds: int | None = Column(Integer, nullable=True)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<VoiceSearchSession(id={self.id}, session_id={self.session_id}, queries={self.query_count})>"
