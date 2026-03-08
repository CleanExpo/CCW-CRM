"""
Signup endpoint — creates an Organization + User in one transaction,
then issues JWT cookies so the user is immediately authenticated.

This is a separate file from demo_auth.py (which is locked) so we can
extend the registration flow to include company creation.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.rate_limit import RateLimits, limiter
from src.auth.jwt import create_access_token, create_refresh_token, get_password_hash
from src.config.database import get_async_db
from src.config.settings import get_settings
from src.db.demo_models import Organization
from src.db.models import User

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Signup"])
settings = get_settings()


class SignupRequest(BaseModel):
    """Signup request — creates org + user in one go."""

    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    company_name: str = Field(..., min_length=2, max_length=255)


class SignupResponse(BaseModel):
    """Signup response — mirrors login response shape."""

    access_token: str
    token_type: str = "bearer"
    user: dict
    organization: dict


def _slugify(name: str) -> str:
    """Convert a company name to a URL-safe slug."""
    slug = name.lower().strip().replace(" ", "-")
    return "".join(c for c in slug if c.isalnum() or c == "-")


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RateLimits.REGISTER)
async def signup(
    request: Request,
    data: SignupRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SignupResponse:
    """
    Register a new organization and its first admin user.

    - Creates a unique slug from company_name (collision-safe)
    - Flushes org to get id, then creates user
    - Issues auth_token + refresh_token cookies
    """
    # Reject duplicate emails
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with that email already exists.",
        )

    # Build a unique org slug
    base_slug = _slugify(data.company_name) or "org"
    slug = base_slug
    counter = 1
    while True:
        dup = await db.execute(select(Organization).where(Organization.slug == slug))
        if not dup.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create org first (need id for any future FK)
    org = Organization(name=data.company_name, slug=slug, is_active=True)
    db.add(org)
    await db.flush()  # assigns org.id without committing

    # Create user (no organization_id FK on User model, org tracked via JWT)
    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        is_active=True,
        is_admin=True,  # First user of an org is admin
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await db.refresh(org)

    logger.info(
        "New signup",
        user_id=str(user.id),
        org_id=str(org.id),
        email=data.email,
        company=data.company_name,
    )

    # Issue JWT tokens (include org_id for future tenant middleware)
    token_data = {
        "sub": user.email,
        "user_id": str(user.id),
        "is_admin": user.is_admin,
        "organization_id": str(org.id),
    }
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(
        data={"sub": user.email, "user_id": str(user.id)}
    )

    # Set cookies (same pattern as demo_auth.py login)
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        max_age=settings.jwt_expire_minutes * 60,
        samesite="lax",
        secure=settings.should_use_secure_cookies,
        domain="localhost",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.jwt_refresh_expire_days * 24 * 60 * 60,
        samesite="lax",
        secure=settings.should_use_secure_cookies,
        path="/api/auth/refresh",
        domain="localhost",
    )

    return SignupResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
        },
        organization={
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
        },
    )
