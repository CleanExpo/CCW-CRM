"""
Org context switching — UNI-1855.

POST /api/auth/switch-org

On a valid request the current access + refresh tokens are invalidated by
the act of replacing them (HMAC-signed, stateless JWTs — the old tokens
expire at their original TTL; the new tokens carry the new org_id claim).
The window of overlap is bounded by the access-token TTL (default 8 h).
For tighter revocation, pair this with a token-blocklist (Redis) in future.

Security contract:
  • Caller must be authenticated (AuthMiddleware enforces this).
  • The requested target_org_id must match the user's own organization_id
    persisted in the database.  Users cannot switch into a foreign org.
  • New tokens are issued only after DB validation succeeds.
  • Old auth_token + refresh_token cookies are overwritten atomically.
"""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.jwt import create_access_token, create_refresh_token
from src.config.database import get_async_db
from src.config.settings import get_settings
from src.db.demo_models import Organization

logger = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class SwitchOrgRequest(BaseModel):
    """Body for POST /api/auth/switch-org."""

    target_org_id: UUID


class SwitchOrgResponse(BaseModel):
    """Response after a successful org switch."""

    access_token: str
    token_type: str = "bearer"
    org_id: str
    org_name: str


@router.post(
    "/switch-org",
    response_model=SwitchOrgResponse,
    summary="Switch active organisation context",
    description=(
        "Re-issues JWT tokens scoped to the requested organisation. "
        "The target_org_id must equal the authenticated user's own organisation_id. "
        "Cross-org switches are rejected with 403."
    ),
)
async def switch_org(
    body: SwitchOrgRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SwitchOrgResponse:
    """
    Invalidate current tokens and issue new ones scoped to *target_org_id*.

    The AuthMiddleware has already verified the caller's JWT and populated
    request.state.user_id / request.state.organization_id from the database.
    """
    # ── 1. Retrieve authenticated identity from request state ──────────────────
    user_id: str | None = getattr(request.state, "user_id", None)
    current_org_id_raw: str | None = getattr(request.state, "organization_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # ── 2. Validate caller's DB-sourced org matches the requested target ───────
    # Only allow switching into the org the user actually belongs to.
    # This prevents a compromised token from being used to pivot into another org.
    if current_org_id_raw is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with any organisation.",
        )

    try:
        current_org_uuid = UUID(current_org_id_raw) if isinstance(current_org_id_raw, str) else current_org_id_raw
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organisation ID in session.",
        )

    if body.target_org_id != current_org_uuid:
        logger.warning(
            "Cross-org switch attempt blocked",
            user_id=user_id,
            session_org_id=str(current_org_uuid),
            requested_org_id=str(body.target_org_id),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to the requested organisation.",
        )

    # ── 3. Confirm target org exists and is active ─────────────────────────────
    result = await db.execute(
        select(Organization).where(
            Organization.id == body.target_org_id,
            Organization.is_active.is_(True),
        )
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found or inactive.",
        )

    # ── 4. Issue new tokens scoped to the validated org ───────────────────────
    token_data = {
        "sub": getattr(request.state, "email", None) or str(user_id),
        "user_id": str(user_id),
        "organization_id": str(org.id),
        "is_admin": getattr(getattr(request.state, "user", {}), "get", lambda k, d=None: d)("role") == "admin",
    }

    # Safely pull is_admin from request.state.user dict (populated by auth middleware)
    state_user: dict = getattr(request.state, "user", {}) or {}
    token_data["is_admin"] = state_user.get("role") == "admin"
    # Also respect legacy is_admin flag if role is absent
    if not token_data["is_admin"] and "is_admin" in state_user:
        token_data["is_admin"] = bool(state_user.get("is_admin", False))

    new_access_token = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(
        data={
            "sub": token_data["sub"],
            "user_id": str(user_id),
            "organization_id": str(org.id),
        }
    )

    # ── 5. Overwrite cookies — old tokens are displaced ───────────────────────
    response.set_cookie(
        key="auth_token",
        value=new_access_token,
        httponly=True,
        max_age=settings.jwt_expire_minutes * 60,
        samesite="lax",
        secure=settings.should_use_secure_cookies,
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        max_age=settings.jwt_refresh_expire_days * 24 * 60 * 60,
        samesite="lax",
        secure=settings.should_use_secure_cookies,
        path="/api/auth/refresh",
    )

    logger.info(
        "Org context switch successful",
        user_id=user_id,
        org_id=str(org.id),
        org_name=org.name,
    )

    return SwitchOrgResponse(
        access_token=new_access_token,
        org_id=str(org.id),
        org_name=org.name,
    )
