"""Security settings models — org-level security policy configuration (UNI-1865)."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from .models_base import Base


class SecuritySettings(Base):
    """Singleton row holding the organisation's security policy.

    Currently stores `session_timeout_minutes` — the idle window after which
    the client-side watcher auto-logs-out the user. Expected range
    1–1440 minutes (1 minute to 24 hours). Defaults to 60.

    Read/written via `/api/settings/security` (see `api.routes.settings`).
    Enforcement is client-side (see `useSessionTimeout` hook); locked auth
    middleware is not touched.
    """

    __tablename__ = "security_settings"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_timeout_minutes: int = Column(Integer, nullable=False, default=60)

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
        return f"<SecuritySettings(session_timeout_minutes={self.session_timeout_minutes})>"
