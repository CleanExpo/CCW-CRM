"""Agents Protocol v1.0 — API Routes.

Provides management endpoints for the protocol governance layer:
- Protocol version info
- Agent card listing and lookup
- Delegation validation
- Protocol health and audit log
"""

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.ai.protocol.governor import get_protocol_governor
from src.ai.protocol.message_bus import get_message_bus
from src.ai.protocol.models import (
    DelegationRequest,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/protocol", tags=["Protocol Governance"])


# ─── Response Models ──────────────────────────────────────────────────────


class ProtocolVersionResponse(BaseModel):
    """Protocol version response."""

    version: str
    major: int
    minor: int
    patch: int


class DelegationValidationRequest(BaseModel):
    """Request to validate a delegation."""

    delegator_id: str
    delegate_id: str
    task: str
    required_capabilities: list[str] = []
    timeout_seconds: int = 120


class DelegationValidationResponse(BaseModel):
    """Delegation validation result."""

    valid: bool
    errors: list[str]


class ProtocolHealthResponse(BaseModel):
    """Protocol health response."""

    status: str
    protocol_version: str
    governor_stats: dict[str, Any]
    message_bus_stats: dict[str, Any]


class AuditLogEntry(BaseModel):
    """Single audit log entry."""

    event_type: str
    data: dict[str, Any]
    timestamp: str
    protocol_version: str


class AuditLogResponse(BaseModel):
    """Audit log response."""

    entries: list[AuditLogEntry]
    total: int


# ─── Endpoints ────────────────────────────────────────────────────────────


@router.get("/version")
async def get_protocol_version() -> ProtocolVersionResponse:
    """Get the current protocol version."""
    governor = get_protocol_governor()
    version = governor.version
    return ProtocolVersionResponse(
        version=str(version),
        major=version.major,
        minor=version.minor,
        patch=version.patch,
    )


@router.get("/agents")
async def list_agent_cards() -> list[dict[str, Any]]:
    """List all registered agent cards."""
    try:
        from src.ai.orchestration import get_agent_registry

        registry = get_agent_registry()
        cards = []
        for metadata in registry.get_all_metadata():
            if metadata.agent_card:
                cards.append(metadata.agent_card.model_dump())
            else:
                # Return basic info for agents without cards
                cards.append({
                    "agent_id": metadata.agent_id,
                    "name": metadata.name,
                    "capabilities": metadata.capabilities,
                    "has_protocol_card": False,
                })
        return cards
    except Exception as e:
        logger.error("Failed to list agent cards", error=str(e))
        return []


@router.get("/agents/{agent_id}")
async def get_agent_card(agent_id: str) -> dict[str, Any]:
    """Get a specific agent's protocol card."""
    governor = get_protocol_governor()
    card = governor.get_agent_card(agent_id)

    if card:
        return card.model_dump()

    # Fall back to basic metadata
    try:
        from src.ai.orchestration import get_agent_registry

        registry = get_agent_registry()
        metadata = registry.get_metadata(agent_id)
        if metadata:
            return {
                "agent_id": metadata.agent_id,
                "name": metadata.name,
                "capabilities": metadata.capabilities,
                "has_protocol_card": False,
                "health_score": metadata.health_score,
                "status": metadata.status.value,
            }
    except Exception as exc:
        logger.warning("agent_protocol_card_error", agent_id=agent_id, error=str(exc))

    raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")


@router.post("/validate-delegation")
async def validate_delegation(
    request: DelegationValidationRequest,
) -> DelegationValidationResponse:
    """Validate a delegation request against protocol rules."""
    governor = get_protocol_governor()

    delegation = DelegationRequest(
        delegator_id=request.delegator_id,
        delegate_id=request.delegate_id,
        task=request.task,
        required_capabilities=request.required_capabilities,
        timeout_seconds=request.timeout_seconds,
    )

    is_valid, _, errors = governor.enforce_delegation(delegation)

    return DelegationValidationResponse(
        valid=is_valid,
        errors=errors,
    )


@router.get("/health")
async def get_protocol_health() -> ProtocolHealthResponse:
    """Get protocol governor health and statistics."""
    governor = get_protocol_governor()
    message_bus = get_message_bus()

    return ProtocolHealthResponse(
        status="healthy",
        protocol_version=str(governor.version),
        governor_stats=governor.get_statistics(),
        message_bus_stats=message_bus.get_statistics(),
    )


@router.get("/audit-log")
async def get_audit_log(limit: int = 50) -> AuditLogResponse:
    """Get recent protocol audit log entries."""
    governor = get_protocol_governor()
    all_entries = governor.audit_log

    # Return most recent entries
    recent = all_entries[-limit:] if len(all_entries) > limit else all_entries

    entries = [
        AuditLogEntry(
            event_type=entry.get("event_type", "unknown"),
            data=entry.get("data", {}),
            timestamp=entry.get("timestamp", ""),
            protocol_version=entry.get("protocol_version", "1.0.0"),
        )
        for entry in recent
    ]

    return AuditLogResponse(
        entries=entries,
        total=len(all_entries),
    )
