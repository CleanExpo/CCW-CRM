"""Anthropic (Claude) integration — configure API key and check status.

Follows the same pattern as the SendGrid integration.
"""

import os
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.integration_credential_models import IntegrationCredential

logger = structlog.get_logger()

router = APIRouter(prefix="/api/integrations/anthropic")


class AnthropicConfigureRequest(BaseModel):
    """Request body for configuring the Anthropic API key."""

    api_key: str = Field(
        ...,
        min_length=1,
        description="Anthropic API key (starts with sk-ant-)",
    )

    @field_validator("api_key")
    @classmethod
    def validate_api_key_format(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("sk-ant-"):
            raise ValueError("Anthropic API keys must start with sk-ant-")
        return v


@router.get("/status")
async def anthropic_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Check Anthropic integration status.

    Checks the database for a stored key first, then falls back to the
    ANTHROPIC_API_KEY environment variable.
    """
    try:
        result = await db.execute(
            select(IntegrationCredential).where(
                IntegrationCredential.integration_name == "anthropic"
            )
        )
        cred = result.scalar_one_or_none()
        if cred and cred.is_active:
            stored = cred.get_credentials()
            if stored.get("api_key"):
                return {
                    "connected": True,
                    "mode": "production",
                    "model": "claude-sonnet-4-6",
                    "source": "database",
                }
    except Exception:
        # DB not available — fall through to env var check
        pass

    env_key = os.getenv("ANTHROPIC_API_KEY", "")
    if env_key:
        return {
            "connected": True,
            "mode": "production",
            "model": "claude-sonnet-4-6",
            "source": "environment",
        }

    return {
        "connected": False,
        "mode": "not_configured",
        "message": "Enter your Anthropic API key to enable Claude AI features",
    }


@router.post("/configure")
async def configure_anthropic(
    request: AnthropicConfigureRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Save Anthropic API key to the database."""
    logger.info("configuring_anthropic_credentials")

    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.integration_name == "anthropic"
        )
    )
    cred = result.scalar_one_or_none()

    if cred:
        cred.set_credentials({"api_key": request.api_key})
        cred.is_active = True
    else:
        cred = IntegrationCredential(
            integration_name="anthropic", is_active=True
        )
        cred.set_credentials({"api_key": request.api_key})
        db.add(cred)

    await db.commit()

    logger.info("anthropic_credentials_saved")
    return {
        "connected": True,
        "mode": "production",
        "model": "claude-sonnet-4-6",
        "message": "Anthropic API key saved successfully",
    }
