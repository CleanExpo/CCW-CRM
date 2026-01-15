"""
Demo authentication endpoints.

Login endpoint for overnight demo.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)
from src.auth.password_reset import (
    create_password_reset_token,
    decode_password_reset_token,
)
from src.config.database import get_async_db
from src.config.settings import get_settings
from src.db.models import User
from src.api.middleware.rate_limit import RateLimits, limiter

router = APIRouter(prefix="/api/auth", tags=["Demo Auth"])
settings = get_settings()


class LoginRequest(BaseModel):
    """Login request model."""

    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response model."""

    access_token: str
    token_type: str = "bearer"
    user: dict


class ForgotPasswordRequest(BaseModel):
    """Forgot password request model."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password request model."""

    token: str
    new_password: str = Field(min_length=8, description="New password (min 8 characters)")


@router.post("/login", response_model=LoginResponse)
@limiter.limit(RateLimits.LOGIN)
async def login(
    request: Request,
    credentials: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> LoginResponse:
    """
    Authenticate user and return JWT token.

    Demo credentials: admin@demo.com / demo123
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Create JWT access token (8 hours)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": str(user.id),
            "is_admin": user.is_admin,
        }
    )

    # Create JWT refresh token (30 days)
    refresh_token = create_refresh_token(
        data={
            "sub": user.email,
            "user_id": str(user.id),
        }
    )

    # Set access token cookie (secure flag auto-enabled in production)
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        max_age=settings.jwt_expire_minutes * 60,  # Convert minutes to seconds
        samesite="lax",
        secure=settings.should_use_secure_cookies,  # Auto-enabled in production
    )

    # Set refresh token cookie (30 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.jwt_refresh_expire_days * 24 * 60 * 60,  # Convert days to seconds
        samesite="lax",
        secure=settings.should_use_secure_cookies,  # Auto-enabled in production
        path="/api/auth/refresh",  # Only send to refresh endpoint
    )

    return LoginResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
        },
    )


@router.get("/me")
async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Get current user information from JWT token.
    Accepts token from either Authorization header or cookie.
    """
    # Try to get token from Authorization header first
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    # Fallback to cookie if no Authorization header
    if not token:
        token = request.cookies.get("auth_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Decode token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Get user from database
    email = payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_admin": user.is_admin,
    }


@router.post("/refresh", response_model=LoginResponse)
@limiter.limit(RateLimits.REFRESH)
async def refresh_access_token(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> LoginResponse:
    """
    Refresh access token using a valid refresh token.

    The refresh token must be provided in the refresh_token cookie.
    Returns a new access token with updated expiration.
    """
    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )

    # Decode and validate refresh token
    payload = decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user from database
    email = payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Check if user is still active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Create new access token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": str(user.id),
            "is_admin": user.is_admin,
        }
    )

    # Set new access token cookie
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        max_age=settings.jwt_expire_minutes * 60,
        samesite="lax",
        secure=settings.should_use_secure_cookies,
    )

    return LoginResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
        },
    )


@router.post("/logout")
async def logout(response: Response) -> dict:
    """
    Logout user by clearing auth cookies.
    """
    # Clear access token cookie
    response.delete_cookie(key="auth_token")

    # Clear refresh token cookie
    response.delete_cookie(key="refresh_token", path="/api/auth/refresh")

    return {"message": "Successfully logged out"}


@router.post("/forgot-password")
@limiter.limit(RateLimits.PASSWORD_RESET)
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Request a password reset email.

    Generates a password reset token and sends it via email.
    Rate limited to 3 requests per hour per IP.

    Note: Always returns success even if email doesn't exist (prevents user enumeration).
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        # Generate reset token (1 hour expiration)
        reset_token = create_password_reset_token(user.email)

        # TODO: Send email with reset link
        # In production, use SendGrid to send email:
        # reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"
        # await send_password_reset_email(user.email, user.full_name, reset_url)

        # For now, log the token (DEVELOPMENT ONLY - REMOVE IN PRODUCTION)
        import structlog
        logger = structlog.get_logger()
        logger.info(
            "Password reset requested",
            email=user.email,
            token=reset_token,
            message="In production, this would be sent via email"
        )

    # Always return success (prevents user enumeration attacks)
    return {
        "message": "If an account exists with that email, a password reset link has been sent."
    }


@router.post("/reset-password")
@limiter.limit(RateLimits.PASSWORD_RESET)
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Reset password using a valid reset token.

    The token must be valid and not expired (1 hour expiration).
    """
    # Decode and validate reset token
    payload = decode_password_reset_token(data.token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Get user from database
    email = payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Hash new password and update
    user.password_hash = get_password_hash(data.new_password)

    # Commit changes
    await db.commit()

    return {"message": "Password has been reset successfully"}

