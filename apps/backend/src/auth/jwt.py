"""
JWT Authentication Module
Simple, self-contained JWT token generation and validation
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from src.config.settings import get_settings

# JWT settings from config
ALGORITHM = "HS256"


def _get_secret_key() -> str:
    """Get JWT secret key from settings."""
    return get_settings().jwt_secret_key


def _get_expire_minutes() -> int:
    """Get JWT expiration minutes from settings."""
    return get_settings().jwt_expire_minutes


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary containing claims (e.g., {"sub": user_email})
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=_get_expire_minutes())

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)

    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded payload dict if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None


def extract_user_email(token: str) -> Optional[str]:
    """
    Extract user email from JWT token.

    Args:
        token: JWT token string

    Returns:
        User email if valid token, None otherwise
    """
    payload = decode_access_token(token)
    if payload is None:
        return None

    return payload.get("sub")
