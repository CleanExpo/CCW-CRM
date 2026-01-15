"""
Portal authentication endpoints for customer access via magic links.

Customers receive a magic link via email to access the portal without passwords.
Secure, time-limited tokens ensure safe authentication.
"""

import os
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import Customer

router = APIRouter(prefix="/api/portal/auth", tags=["Portal Auth"])

# Environment configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
MAGIC_LINK_EXPIRE_MINUTES = 60  # Magic links valid for 1 hour
SESSION_EXPIRE_DAYS = 7  # Portal sessions valid for 7 days
FRONTEND_URL = os.getenv("NEXT_PUBLIC_FRONTEND_URL", "http://localhost:3000")


class MagicLinkRequest(BaseModel):
    """Request body for sending magic link."""
    email: EmailStr


class MagicLinkResponse(BaseModel):
    """Response after magic link sent."""
    message: str
    success: bool


def create_magic_link_token(customer_id: UUID, email: str) -> str:
    """
    Create a time-limited magic link token.

    Args:
        customer_id: Customer UUID
        email: Customer email address

    Returns:
        JWT token string
    """
    expire = datetime.now(UTC) + timedelta(minutes=MAGIC_LINK_EXPIRE_MINUTES)
    payload = {
        "sub": str(customer_id),
        "email": email,
        "exp": expire,
        "type": "magic_link",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_session_token(customer_id: UUID, email: str) -> str:
    """
    Create a long-lived session token for portal access.

    Args:
        customer_id: Customer UUID
        email: Customer email address

    Returns:
        JWT token string
    """
    expire = datetime.now(UTC) + timedelta(days=SESSION_EXPIRE_DAYS)
    payload = {
        "sub": str(customer_id),
        "email": email,
        "exp": expire,
        "type": "portal_session",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    """
    Decode and validate JWT token.

    Args:
        token: JWT token string
        expected_type: Expected token type ("magic_link" or "portal_session")

    Returns:
        Token payload dict

    Raises:
        HTTPException: If token invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if payload.get("type") != expected_type:
            raise HTTPException(status_code=401, detail="Invalid token type")

        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/send-magic-link", response_model=MagicLinkResponse)
async def send_magic_link(
    request: MagicLinkRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> MagicLinkResponse:
    """
    Send magic link to customer email for portal access.

    Security: Always returns success even if email not found (prevents email enumeration).
    """
    # Find customer by email
    result = await db.execute(
        select(Customer).where(Customer.email == request.email).where(Customer.is_active)
    )
    customer = result.scalar_one_or_none()

    if customer:
        # Generate magic link token
        token = create_magic_link_token(customer.id, customer.email)
        magic_link = f"{FRONTEND_URL}/portal/auth/verify?token={token}"

        # TODO: Send email via SendGrid/notification service
        # For now, log the magic link (development only)
        print(f"[MAGIC LINK] Customer: {customer.email}")
        print(f"[MAGIC LINK] Link: {magic_link}")
        print(f"[MAGIC LINK] Valid for: {MAGIC_LINK_EXPIRE_MINUTES} minutes")

        # In production:
        # from src.services.notification_service import get_notification_service
        # notification_service = get_notification_service()
        # await notification_service.send_magic_link_email(
        #     to_email=customer.email,
        #     to_name=customer.contact_name or customer.company_name,
        #     magic_link=magic_link,
        # )

    # Always return success (security: don't reveal if email exists)
    return MagicLinkResponse(
        message="If that email address is registered, we've sent you a magic link to access your portal.",  # noqa: E501
        success=True,
    )


@router.get("/verify")
async def verify_magic_link(
    token: str,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Verify magic link token and create portal session.

    Sets HttpOnly cookie with session token and redirects to portal.
    """
    # Decode and validate magic link token
    payload = decode_token(token, "magic_link")
    customer_id = UUID(payload["sub"])
    email = payload["email"]

    # Verify customer still exists and is active
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id).where(Customer.is_active)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found or inactive")

    # Create long-lived session token
    session_token = create_session_token(customer_id, email)

    # Set secure HttpOnly cookie
    response.set_cookie(
        key="portal_session",
        value=session_token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",  # HTTPS only in production
        samesite="lax",
        max_age=SESSION_EXPIRE_DAYS * 24 * 60 * 60,  # 7 days in seconds
        path="/portal",  # Cookie only sent to /portal routes
    )

    return {
        "message": "Authentication successful",
        "customer_id": str(customer_id),
        "customer_name": customer.contact_name or customer.company_name,
        "redirect_url": "/portal/orders",
    }


@router.post("/logout")
async def logout(response: Response) -> dict:
    """
    Logout customer by deleting session cookie.
    """
    response.delete_cookie(key="portal_session", path="/portal")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_customer(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    portal_session: str | None = Header(None),
) -> dict:
    """
    Get current authenticated customer from session token.

    Used to verify authentication status and get customer info.
    """
    if not portal_session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Decode session token
    try:
        payload = decode_token(portal_session, "portal_session")
        customer_id = UUID(payload["sub"])
    except HTTPException:
        raise HTTPException(status_code=401, detail="Invalid session")

    # Fetch customer
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id).where(Customer.is_active)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {
        "id": str(customer.id),
        "email": customer.email,
        "company_name": customer.company_name,
        "contact_name": customer.contact_name,
        "customer_number": customer.customer_number,
    }
