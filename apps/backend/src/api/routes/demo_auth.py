"""
Demo authentication endpoints.

Login endpoint for overnight demo.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.jwt import create_access_token, verify_password, decode_access_token
from src.config.database import get_async_db
from src.db.models import User


router = APIRouter(prefix="/api/auth", tags=["Demo Auth"])


class LoginRequest(BaseModel):
    """Login request model."""

    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response model."""

    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login", response_model=LoginResponse)
async def login(
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

    # Create JWT token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": str(user.id),
            "is_admin": user.is_admin,
        }
    )

    # Set cookie with JWT token
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        max_age=28800,  # 8 hours (480 minutes)
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
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

