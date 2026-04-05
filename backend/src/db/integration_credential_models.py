"""Generic integration credential storage model.

Stores API credentials for integrations that don't have their own dedicated
model (e.g. SendGrid, OpenAI). Credentials are stored as a JSON string in a
TEXT column so the table is SQLite-compatible for CI/testing.

In production, the credentials_json field should be encrypted at rest.
"""

import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class IntegrationCredential(Base):
    """Stores credentials for a named integration (one row per integration)."""

    __tablename__ = "integration_credentials"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # e.g. "sendgrid", "openai", "anthropic"
    integration_name: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )

    # JSON string — avoids JSONB so this table works in SQLite CI
    credentials_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def get_credentials(self) -> dict:
        """Deserialise stored credentials."""
        try:
            return json.loads(self.credentials_json)
        except (json.JSONDecodeError, TypeError):
            return {}

    def set_credentials(self, data: dict) -> None:
        """Serialise credentials for storage."""
        self.credentials_json = json.dumps(data)

    def __repr__(self) -> str:
        return f"<IntegrationCredential(name={self.integration_name}, active={self.is_active})>"
