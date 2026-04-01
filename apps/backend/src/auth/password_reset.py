"""
Password reset token generation and validation.

Reset tokens are short-lived (1 hour) and single-use only.
"""

import secrets
from datetime import UTC, datetime, timedelta

from jose import jwt

from src.config.settings import get_settings

ALGORITHM = "HS256"


def _get_secret_key() -> str:
    """Get JWT secret key from settings."""
    return get_settings().jwt_secret_key


def create_password_reset_token(email: str) -> str:
    """
    Create a password reset token that expires in 1 hour.

    Args:
        email: User's email address

    Returns:
        Encoded JWT reset token
    """
    # Add random nonce to make each token unique (prevents reuse)
    nonce = secrets.token_urlsafe(32)

    expire = datetime.now(UTC) + timedelta(hours=1)

    payload = {
        "sub": email,
        "exp": expire,
        "type": "password_reset",
        "nonce": nonce,
    }

    token = jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)
    return token


def decode_password_reset_token(token: str) -> dict | None:
    """
    Decode and validate a password reset token.

    Args:
        token: Password reset token string

    Returns:
        Decoded payload dict if valid and is a reset token, None otherwise
    """
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])

        # Verify it's a password reset token
        if payload.get("type") != "password_reset":
            return None

        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None
