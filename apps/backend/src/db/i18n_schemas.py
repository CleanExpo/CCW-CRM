"""Pydantic schemas for internationalization (i18n) models.

Comprehensive validation, serialization, and type safety for:
- Language
- ProductTranslation
- CategoryTranslation
- UITranslation
- EmailTemplateTranslation
- TranslationQueue
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_serializer,
    field_validator,
    model_validator,
)

# =============================================================================
# ENUMS (as Literal types for Pydantic compatibility)
# =============================================================================

TranslationStatus = Literal["pending", "in_progress", "completed", "reviewed", "rejected"]
"""Status options for translation workflow."""

EntityType = Literal["product", "category", "ui", "email_template"]
"""Entity types that can be translated."""

QueueStatus = Literal["pending", "processing", "completed", "failed"]
"""Status options for translation queue items."""


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

ISO_639_1_PATTERN = re.compile(r"^[a-z]{2}$")
"""ISO 639-1 language code pattern (2 lowercase letters)."""

NAMESPACE_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
"""Pattern for namespace and key validation (lowercase, underscore-separated)."""

TEMPLATE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_-]*$")
"""Pattern for email template names."""

# Extended language codes that may include regional variants
LANGUAGE_CODE_PATTERN = re.compile(r"^[a-z]{2}(-[A-Z]{2})?$")
"""Language code pattern with optional region (e.g., en, en-US, zh-CN)."""


def validate_language_code(code: str) -> str:
    """Validate language code format.

    Accepts ISO 639-1 codes (e.g., 'en', 'zh') and regional variants (e.g., 'en-US', 'zh-CN').

    Args:
        code: The language code to validate.

    Returns:
        The validated language code.

    Raises:
        ValueError: If language code format is invalid.
    """
    if not LANGUAGE_CODE_PATTERN.match(code):
        raise ValueError(
            f"Language code '{code}' is invalid. Use ISO 639-1 format (e.g., 'en') "
            "or with region (e.g., 'en-US')"
        )
    return code


def validate_namespace(namespace: str) -> str:
    """Validate namespace format.

    Args:
        namespace: The namespace to validate.

    Returns:
        The validated namespace.

    Raises:
        ValueError: If namespace format is invalid.
    """
    if not NAMESPACE_KEY_PATTERN.match(namespace):
        raise ValueError(
            f"Namespace '{namespace}' is invalid. Use lowercase letters, numbers, "
            "and underscores, starting with a letter"
        )
    return namespace


def validate_key(key: str) -> str:
    """Validate translation key format.

    Args:
        key: The key to validate.

    Returns:
        The validated key.

    Raises:
        ValueError: If key format is invalid.
    """
    # Allow dots in keys for nested structures
    parts = key.split(".")
    for part in parts:
        if not NAMESPACE_KEY_PATTERN.match(part):
            raise ValueError(
                f"Key part '{part}' is invalid. Use lowercase letters, numbers, "
                "and underscores, starting with a letter"
            )
    return key


def validate_template_name(name: str) -> str:
    """Validate email template name format.

    Args:
        name: The template name to validate.

    Returns:
        The validated template name.

    Raises:
        ValueError: If template name format is invalid.
    """
    if not TEMPLATE_NAME_PATTERN.match(name):
        raise ValueError(
            f"Template name '{name}' is invalid. Use lowercase letters, numbers, "
            "hyphens, and underscores, starting with a letter"
        )
    return name


# =============================================================================
# LANGUAGE SCHEMAS
# =============================================================================


class LanguageBase(BaseModel):
    """Base schema for language configuration.

    Contains shared fields for create and update operations.
    """

    code: str = Field(
        ...,
        min_length=2,
        max_length=10,
        description="ISO 639-1 language code (e.g., 'en', 'zh-CN')"
    )
    name: str = Field(..., min_length=1, max_length=100, description="Language name in English")
    native_name: str = Field(
        ..., min_length=1, max_length=100, description="Language name in native script"
    )
    is_active: bool = Field(default=True, description="Whether language is enabled")
    is_rtl: bool = Field(default=False, description="Right-to-left text direction")
    sort_order: int = Field(default=0, ge=0, description="Display order in language selector")

    @field_validator("code")
    @classmethod
    def validate_code_format(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "code": "ja",
                "name": "Japanese",
                "native_name": "日本語",
                "is_active": True,
                "is_rtl": False,
                "sort_order": 5,
            }
        },
    )


class LanguageCreate(LanguageBase):
    """Schema for creating a language."""

    pass


class LanguageUpdate(BaseModel):
    """Schema for updating a language.

    All fields are optional for partial updates.
    """

    name: str | None = Field(None, min_length=1, max_length=100)
    native_name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None
    is_rtl: bool | None = None
    sort_order: int | None = Field(None, ge=0)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class LanguageInDB(LanguageBase):
    """Schema for language from database.

    Includes timestamps and computed fields.
    """

    id: UUID = Field(..., description="Unique identifier")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    # Computed field for translation statistics (mock for now)
    @computed_field
    @property
    def translation_count(self) -> int:
        """Count of active translations for this language.

        Note: This is a placeholder. Actual count should be computed via query.
        """
        # This would typically be populated via a JOIN or subquery
        return 0

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedLanguage(BaseModel):
    """Paginated response for language queries."""

    data: list[LanguageInDB] = Field(..., description="List of language records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# PRODUCT TRANSLATION SCHEMAS
# =============================================================================


class ProductTranslationBase(BaseModel):
    """Base schema for product translations."""

    name: str = Field(..., min_length=1, max_length=255, description="Translated product name")
    description: str | None = Field(None, description="Translated product description")
    short_description: str | None = Field(
        None, max_length=500, description="Translated short description"
    )
    specifications: dict[str, Any] | None = Field(
        None, description="Translated specifications as key-value pairs"
    )
    meta_title: str | None = Field(None, max_length=255, description="SEO meta title")
    meta_description: str | None = Field(None, max_length=500, description="SEO meta description")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "name": "Heavy-Duty Power Drill",
                "description": "Professional-grade power drill with variable speed...",
                "short_description": "18V cordless power drill with lithium battery",
                "specifications": {
                    "power": "18V",
                    "battery": "Lithium-ion 4.0Ah",
                    "max_rpm": "2000",
                },
                "meta_title": "Heavy-Duty 18V Power Drill | CCW Equipment",
                "meta_description": "Professional cordless drill with variable speed...",
            }
        },
    )


class ProductTranslationCreate(ProductTranslationBase):
    """Schema for creating a product translation."""

    product_id: UUID = Field(..., description="Product ID reference")
    language_code: str = Field(..., min_length=2, max_length=10, description="Language code")
    translation_status: TranslationStatus = Field(
        default="pending", description="Translation workflow status"
    )
    translated_by: str | None = Field(None, max_length=100, description="Translator identifier")

    @field_validator("language_code")
    @classmethod
    def validate_lang_code(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)


class ProductTranslationUpdate(BaseModel):
    """Schema for updating a product translation."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    short_description: str | None = Field(None, max_length=500)
    specifications: dict[str, Any] | None = None
    translation_status: TranslationStatus | None = None
    translated_by: str | None = Field(None, max_length=100)
    translated_at: datetime | None = None
    reviewed_by: str | None = Field(None, max_length=100)
    reviewed_at: datetime | None = None
    meta_title: str | None = Field(None, max_length=255)
    meta_description: str | None = Field(None, max_length=500)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class ProductTranslationInDB(ProductTranslationBase):
    """Schema for product translation from database."""

    id: UUID = Field(..., description="Unique identifier")
    product_id: UUID = Field(..., description="Product ID reference")
    language_code: str = Field(..., description="Language code")
    translation_status: TranslationStatus = Field(..., description="Translation workflow status")
    translated_by: str | None = Field(None, description="Translator identifier")
    translated_at: datetime | None = Field(None, description="Translation timestamp")
    reviewed_by: str | None = Field(None, description="Reviewer identifier")
    reviewed_at: datetime | None = Field(None, description="Review timestamp")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @computed_field
    @property
    def is_complete(self) -> bool:
        """Check if translation is complete and reviewed."""
        return self.translation_status in ("completed", "reviewed")

    @computed_field
    @property
    def needs_review(self) -> bool:
        """Check if translation needs review."""
        return self.translation_status == "completed" and self.reviewed_at is None

    @field_serializer("created_at", "updated_at", "translated_at", "reviewed_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "product_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedProductTranslation(BaseModel):
    """Paginated response for product translation queries."""

    data: list[ProductTranslationInDB] = Field(..., description="List of translation records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# CATEGORY TRANSLATION SCHEMAS
# =============================================================================


class CategoryTranslationBase(BaseModel):
    """Base schema for category translations."""

    name: str = Field(..., min_length=1, max_length=255, description="Translated category name")
    description: str | None = Field(None, description="Translated category description")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "name": "Power Tools",
                "description": "Electric and battery-powered tools for professionals",
            }
        },
    )


class CategoryTranslationCreate(CategoryTranslationBase):
    """Schema for creating a category translation."""

    category_code: str = Field(
        ..., min_length=1, max_length=100, description="Category identifier"
    )
    language_code: str = Field(..., min_length=2, max_length=10, description="Language code")

    @field_validator("language_code")
    @classmethod
    def validate_lang_code(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)


class CategoryTranslationUpdate(BaseModel):
    """Schema for updating a category translation."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class CategoryTranslationInDB(CategoryTranslationBase):
    """Schema for category translation from database."""

    id: UUID = Field(..., description="Unique identifier")
    category_code: str = Field(..., description="Category identifier")
    language_code: str = Field(..., description="Language code")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedCategoryTranslation(BaseModel):
    """Paginated response for category translation queries."""

    data: list[CategoryTranslationInDB] = Field(..., description="List of translation records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# UI TRANSLATION SCHEMAS
# =============================================================================


class UITranslationBase(BaseModel):
    """Base schema for UI translations (key-value store for frontend strings)."""

    namespace: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Translation namespace (e.g., 'common', 'dashboard')"
    )
    key: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Translation key (e.g., 'button.submit', 'error.required')"
    )
    value: str = Field(..., min_length=1, description="Translated string value")
    context: str | None = Field(
        None, description="Context hint for translators (where/how it's used)"
    )

    @field_validator("namespace")
    @classmethod
    def validate_namespace_format(cls, v: str) -> str:
        """Validate namespace format."""
        return validate_namespace(v)

    @field_validator("key")
    @classmethod
    def validate_key_format(cls, v: str) -> str:
        """Validate key format."""
        return validate_key(v)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "namespace": "common",
                "key": "button.submit",
                "value": "Submit",
                "context": "Generic submit button text used across forms",
            }
        },
    )


class UITranslationCreate(UITranslationBase):
    """Schema for creating a UI translation."""

    language_code: str = Field(..., min_length=2, max_length=10, description="Language code")

    @field_validator("language_code")
    @classmethod
    def validate_lang_code(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)


class UITranslationUpdate(BaseModel):
    """Schema for updating a UI translation."""

    value: str | None = Field(None, min_length=1)
    context: str | None = None

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class UITranslationInDB(UITranslationBase):
    """Schema for UI translation from database."""

    id: UUID = Field(..., description="Unique identifier")
    language_code: str = Field(..., description="Language code")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @computed_field
    @property
    def full_key(self) -> str:
        """Get full translation key in format namespace.key."""
        return f"{self.namespace}.{self.key}"

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedUITranslation(BaseModel):
    """Paginated response for UI translation queries."""

    data: list[UITranslationInDB] = Field(..., description="List of translation records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


class UITranslationBulkExport(BaseModel):
    """Schema for bulk export of UI translations."""

    language_code: str = Field(..., description="Language code")
    translations: dict[str, dict[str, str]] = Field(
        ..., description="Nested dict: namespace -> key -> value"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "language_code": "ja",
                "translations": {
                    "common": {
                        "button.submit": "送信",
                        "button.cancel": "キャンセル",
                        "error.required": "必須項目です",
                    },
                    "dashboard": {
                        "title": "ダッシュボード",
                        "welcome": "ようこそ",
                    },
                },
            }
        }
    )


class UITranslationBulkImport(BaseModel):
    """Schema for bulk import of UI translations."""

    language_code: str = Field(..., min_length=2, max_length=10, description="Language code")
    translations: dict[str, dict[str, str]] = Field(
        ..., description="Nested dict: namespace -> key -> value"
    )
    overwrite: bool = Field(
        default=False, description="Whether to overwrite existing translations"
    )

    @field_validator("language_code")
    @classmethod
    def validate_lang_code(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)

    model_config = ConfigDict(str_strip_whitespace=True)


class UITranslationBulkImportResult(BaseModel):
    """Result schema for bulk import operation."""

    created: int = Field(..., ge=0, description="Number of new translations created")
    updated: int = Field(..., ge=0, description="Number of translations updated")
    skipped: int = Field(..., ge=0, description="Number of translations skipped")
    errors: list[str] = Field(default_factory=list, description="Error messages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# EMAIL TEMPLATE TRANSLATION SCHEMAS
# =============================================================================


class EmailTemplateTranslationBase(BaseModel):
    """Base schema for email template translations."""

    subject: str = Field(..., min_length=1, max_length=255, description="Email subject line")
    body_html: str = Field(..., min_length=1, description="HTML email body")
    body_text: str | None = Field(None, description="Plain text email body (fallback)")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "subject": "Your order has been shipped!",
                "body_html": "<h1>Order Shipped</h1><p>Your order {{order_number}} is on its way...</p>",
                "body_text": "Order Shipped\n\nYour order {{order_number}} is on its way...",
            }
        },
    )


class EmailTemplateTranslationCreate(EmailTemplateTranslationBase):
    """Schema for creating an email template translation."""

    template_name: str = Field(
        ..., min_length=1, max_length=100, description="Template identifier"
    )
    language_code: str = Field(..., min_length=2, max_length=10, description="Language code")

    @field_validator("template_name")
    @classmethod
    def validate_template_format(cls, v: str) -> str:
        """Validate template name format."""
        return validate_template_name(v)

    @field_validator("language_code")
    @classmethod
    def validate_lang_code(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)


class EmailTemplateTranslationUpdate(BaseModel):
    """Schema for updating an email template translation."""

    subject: str | None = Field(None, min_length=1, max_length=255)
    body_html: str | None = Field(None, min_length=1)
    body_text: str | None = None

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class EmailTemplateTranslationInDB(EmailTemplateTranslationBase):
    """Schema for email template translation from database."""

    id: UUID = Field(..., description="Unique identifier")
    template_name: str = Field(..., description="Template identifier")
    language_code: str = Field(..., description="Language code")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @computed_field
    @property
    def has_text_fallback(self) -> bool:
        """Check if plain text fallback is available."""
        return self.body_text is not None and len(self.body_text.strip()) > 0

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedEmailTemplateTranslation(BaseModel):
    """Paginated response for email template translation queries."""

    data: list[EmailTemplateTranslationInDB] = Field(
        ..., description="List of translation records"
    )
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# TRANSLATION QUEUE SCHEMAS
# =============================================================================


class TranslationQueueBase(BaseModel):
    """Base schema for translation queue items."""

    entity_type: EntityType = Field(..., description="Type of entity to translate")
    priority: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Translation priority (1=highest, 10=lowest)"
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "entity_type": "product",
                "priority": 3,
            }
        },
    )


class TranslationQueueCreate(TranslationQueueBase):
    """Schema for creating a translation queue item."""

    entity_id: UUID = Field(..., description="ID of entity to translate")
    target_language: str = Field(..., min_length=2, max_length=10, description="Target language")
    status: QueueStatus = Field(default="pending", description="Queue item status")

    @field_validator("target_language")
    @classmethod
    def validate_lang_code(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)


class TranslationQueueUpdate(BaseModel):
    """Schema for updating a translation queue item."""

    status: QueueStatus | None = None
    priority: int | None = Field(None, ge=1, le=10)
    error_message: str | None = None
    attempts: int | None = Field(None, ge=0)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class TranslationQueueInDB(TranslationQueueBase):
    """Schema for translation queue item from database."""

    id: UUID = Field(..., description="Unique identifier")
    entity_id: UUID = Field(..., description="ID of entity to translate")
    target_language: str = Field(..., description="Target language code")
    status: QueueStatus = Field(..., description="Queue item status")
    error_message: str | None = Field(None, description="Error message if failed")
    attempts: int = Field(default=0, ge=0, description="Number of translation attempts")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @computed_field
    @property
    def is_failed(self) -> bool:
        """Check if translation has failed."""
        return self.status == "failed"

    @computed_field
    @property
    def can_retry(self) -> bool:
        """Check if translation can be retried (max 3 attempts)."""
        return self.status == "failed" and self.attempts < 3

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "entity_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedTranslationQueue(BaseModel):
    """Paginated response for translation queue queries."""

    data: list[TranslationQueueInDB] = Field(..., description="List of queue items")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# DASHBOARD / REPORT SCHEMAS
# =============================================================================


class TranslationStats(BaseModel):
    """Translation progress statistics for dashboard."""

    total_products: int = Field(..., ge=0, description="Total number of products")
    translated_products: dict[str, int] = Field(
        ..., description="Count of translated products by language code"
    )
    pending_queue: int = Field(..., ge=0, description="Items pending in translation queue")
    processing_queue: int = Field(..., ge=0, description="Items currently being processed")
    failed_queue: int = Field(..., ge=0, description="Items that failed translation")
    completion_percentage: dict[str, float] = Field(
        ..., description="Translation completion percentage by language"
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "total_products": 500,
                "translated_products": {
                    "ja": 450,
                    "zh": 400,
                    "de": 350,
                    "fr": 425,
                },
                "pending_queue": 25,
                "processing_queue": 5,
                "failed_queue": 3,
                "completion_percentage": {
                    "ja": 90.0,
                    "zh": 80.0,
                    "de": 70.0,
                    "fr": 85.0,
                },
            }
        },
    )


class LanguageProgress(BaseModel):
    """Translation progress for a specific language."""

    language_code: str = Field(..., description="Language code")
    language_name: str = Field(..., description="Language name")
    total_strings: int = Field(..., ge=0, description="Total strings to translate")
    translated_strings: int = Field(..., ge=0, description="Strings translated")
    reviewed_strings: int = Field(..., ge=0, description="Strings reviewed/approved")
    pending_strings: int = Field(..., ge=0, description="Strings pending translation")
    completion_percentage: float = Field(
        ..., ge=0, le=100, description="Overall completion percentage"
    )
    review_percentage: float = Field(
        ..., ge=0, le=100, description="Review completion percentage"
    )

    @model_validator(mode="after")
    def validate_counts(self) -> LanguageProgress:
        """Validate that counts are consistent."""
        if self.translated_strings > self.total_strings:
            raise ValueError("Translated strings cannot exceed total strings")
        if self.reviewed_strings > self.translated_strings:
            raise ValueError("Reviewed strings cannot exceed translated strings")
        return self

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "language_code": "ja",
                "language_name": "Japanese",
                "total_strings": 1500,
                "translated_strings": 1350,
                "reviewed_strings": 1200,
                "pending_strings": 150,
                "completion_percentage": 90.0,
                "review_percentage": 80.0,
            }
        },
    )


class TranslationSummary(BaseModel):
    """Overall translation summary for all languages."""

    total_languages: int = Field(..., ge=0, description="Total active languages")
    active_languages: int = Field(..., ge=0, description="Languages with translations")
    languages_progress: list[LanguageProgress] = Field(
        ..., description="Progress per language"
    )
    overall_completion: float = Field(
        ..., ge=0, le=100, description="Average completion across all languages"
    )
    queue_stats: dict[str, int] = Field(
        ..., description="Queue statistics by status"
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "total_languages": 10,
                "active_languages": 8,
                "languages_progress": [],
                "overall_completion": 82.5,
                "queue_stats": {
                    "pending": 45,
                    "processing": 12,
                    "completed": 890,
                    "failed": 8,
                },
            }
        },
    )


# =============================================================================
# BULK OPERATION SCHEMAS
# =============================================================================


class BulkTranslationRequest(BaseModel):
    """Request schema for bulk translation operations."""

    entity_type: EntityType = Field(..., description="Type of entities to translate")
    entity_ids: list[UUID] = Field(
        ..., min_length=1, max_length=100, description="IDs of entities to translate"
    )
    target_languages: list[str] = Field(
        ..., min_length=1, max_length=10, description="Target language codes"
    )
    priority: int = Field(default=5, ge=1, le=10, description="Translation priority")

    @field_validator("target_languages")
    @classmethod
    def validate_languages(cls, v: list[str]) -> list[str]:
        """Validate all language codes."""
        return [validate_language_code(code) for code in v]

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "entity_type": "product",
                "entity_ids": [
                    "123e4567-e89b-12d3-a456-426614174000",
                    "123e4567-e89b-12d3-a456-426614174001",
                ],
                "target_languages": ["ja", "zh", "de"],
                "priority": 3,
            }
        },
    )


class BulkTranslationResult(BaseModel):
    """Result schema for bulk translation operation."""

    queued: int = Field(..., ge=0, description="Number of items queued for translation")
    skipped: int = Field(..., ge=0, description="Number of items skipped (already translated)")
    errors: list[str] = Field(default_factory=list, description="Error messages")
    queue_ids: list[UUID] = Field(
        default_factory=list, description="IDs of created queue items"
    )

    @field_serializer("queue_ids")
    def serialize_uuids(self, uuids: list[UUID]) -> list[str]:
        """Serialize UUID list to string list."""
        return [str(u) for u in uuids]

    model_config = ConfigDict(from_attributes=True)


class TranslationRetryRequest(BaseModel):
    """Request schema for retrying failed translations."""

    queue_ids: list[UUID] | None = Field(
        None,
        max_length=100,
        description="Specific queue IDs to retry (None = retry all failed)"
    )
    reset_attempts: bool = Field(
        default=False, description="Whether to reset attempt counter"
    )

    model_config = ConfigDict(str_strip_whitespace=True)


class TranslationRetryResult(BaseModel):
    """Result schema for translation retry operation."""

    retried: int = Field(..., ge=0, description="Number of items queued for retry")
    skipped: int = Field(..., ge=0, description="Number of items skipped (max attempts)")
    errors: list[str] = Field(default_factory=list, description="Error messages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# LOOKUP / UTILITY SCHEMAS
# =============================================================================


class TranslationLookup(BaseModel):
    """Schema for looking up translations by key."""

    namespace: str = Field(..., description="Translation namespace")
    keys: list[str] = Field(..., min_length=1, max_length=100, description="Keys to look up")
    language_code: str = Field(..., min_length=2, max_length=10, description="Language code")

    @field_validator("language_code")
    @classmethod
    def validate_lang_code(cls, v: str) -> str:
        """Validate language code format."""
        return validate_language_code(v)

    model_config = ConfigDict(str_strip_whitespace=True)


class TranslationLookupResult(BaseModel):
    """Result schema for translation lookup."""

    language_code: str = Field(..., description="Language code")
    namespace: str = Field(..., description="Translation namespace")
    translations: dict[str, str | None] = Field(
        ..., description="Key-value pairs (None if not found)"
    )
    missing_keys: list[str] = Field(default_factory=list, description="Keys not found")

    model_config = ConfigDict(from_attributes=True)


class AvailableLanguage(BaseModel):
    """Lightweight schema for language selection dropdown."""

    code: str = Field(..., description="Language code")
    name: str = Field(..., description="Language name in English")
    native_name: str = Field(..., description="Language name in native script")
    is_rtl: bool = Field(default=False, description="Right-to-left text direction")

    model_config = ConfigDict(from_attributes=True)


class LanguageList(BaseModel):
    """Schema for list of available languages."""

    languages: list[AvailableLanguage] = Field(..., description="Available languages")
    default_language: str = Field(default="en", description="Default language code")

    model_config = ConfigDict(from_attributes=True)
