"""SQLAlchemy models for internationalization (i18n) tables."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from .models_base import Base


class Language(Base):
    """Supported languages configuration."""

    __tablename__ = "languages"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    code = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    native_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_rtl = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    product_translations = relationship("ProductTranslation", back_populates="language", cascade="all, delete-orphan")
    category_translations = relationship("CategoryTranslation", back_populates="language", cascade="all, delete-orphan")
    ui_translations = relationship("UITranslation", back_populates="language", cascade="all, delete-orphan")
    email_template_translations = relationship(
        "EmailTemplateTranslation", back_populates="language", cascade="all, delete-orphan"
    )
    translation_queue = relationship("TranslationQueue", back_populates="language", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        """String representation."""
        return f"<Language(code={self.code}, name={self.name})>"


class ProductTranslation(Base):
    """Translated product content for each language."""

    __tablename__ = "product_translations"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id = Column(PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    language_code = Column(String(10), ForeignKey("languages.code", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    short_description = Column(String(500))
    specifications = Column(JSONB)

    # Translation metadata
    translation_status = Column(String(50), nullable=False, default="pending", index=True)
    translated_by = Column(String(100))
    translated_at = Column(DateTime)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)

    # SEO fields
    meta_title = Column(String(255))
    meta_description = Column(String(500))

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    language = relationship("Language", back_populates="product_translations")
    product = relationship("Product", back_populates="translations")

    def __repr__(self) -> str:
        """String representation."""
        return f"<ProductTranslation(product_id={self.product_id}, lang={self.language_code})>"


class CategoryTranslation(Base):
    """Translated category names and descriptions."""

    __tablename__ = "category_translations"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    category_code = Column(String(100), nullable=False, index=True)
    language_code = Column(String(10), ForeignKey("languages.code", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    language = relationship("Language", back_populates="category_translations")

    def __repr__(self) -> str:
        """String representation."""
        return f"<CategoryTranslation(category={self.category_code}, lang={self.language_code})>"


class UITranslation(Base):
    """Key-value store for frontend UI strings."""

    __tablename__ = "ui_translations"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    namespace = Column(String(100), nullable=False, index=True)
    key = Column(String(255), nullable=False, index=True)
    language_code = Column(String(10), ForeignKey("languages.code", ondelete="CASCADE"), nullable=False, index=True)
    value = Column(Text, nullable=False)
    context = Column(Text)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    language = relationship("Language", back_populates="ui_translations")

    def __repr__(self) -> str:
        """String representation."""
        return f"<UITranslation(namespace={self.namespace}, key={self.key}, lang={self.language_code})>"


class EmailTemplateTranslation(Base):
    """Translated email templates."""

    __tablename__ = "email_template_translations"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    template_name = Column(String(100), nullable=False, index=True)
    language_code = Column(String(10), ForeignKey("languages.code", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    language = relationship("Language", back_populates="email_template_translations")

    def __repr__(self) -> str:
        """String representation."""
        return f"<EmailTemplateTranslation(template={self.template_name}, lang={self.language_code})>"


class TranslationQueue(Base):
    """Translation queue for AI translation workflow."""

    __tablename__ = "translation_queue"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    target_language = Column(String(10), ForeignKey("languages.code"), nullable=False)
    status = Column(String(50), nullable=False, default="pending", index=True)
    priority = Column(Integer, nullable=False, default=5)
    error_message = Column(Text)
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    language = relationship("Language", back_populates="translation_queue")

    def __repr__(self) -> str:
        """String representation."""
        return f"<TranslationQueue(entity_type={self.entity_type}, entity_id={self.entity_id}, lang={self.target_language})>"
