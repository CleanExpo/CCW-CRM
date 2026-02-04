#!/usr/bin/env python3
"""
Generate secure secrets for production deployment.

This script generates cryptographically secure secrets for:
- JWT signing
- Encryption keys
- Database passwords
- API keys

Usage:
    python scripts/generate-secrets.py
"""

import secrets
import string

from cryptography.fernet import Fernet


def generate_jwt_secret(length: int = 64) -> str:
    """Generate JWT secret key.

    Args:
        length: Length of the secret (default: 64 bytes)

    Returns:
        URL-safe base64-encoded secret
    """
    return secrets.token_urlsafe(length)


def generate_encryption_key() -> str:
    """Generate Fernet encryption key for AES-256 encryption.

    Returns:
        Base64-encoded Fernet key
    """
    return Fernet.generate_key().decode()


def generate_database_password(length: int = 32) -> str:
    """Generate strong database password.

    Args:
        length: Length of password (default: 32 characters)

    Returns:
        Random password with letters, digits, and special characters
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}|;:,.<>?"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_api_key(prefix: str = "sk", length: int = 48) -> str:
    """Generate API key with prefix.

    Args:
        prefix: Prefix for the key (e.g., 'sk' for secret key)
        length: Length of the random part

    Returns:
        API key in format: prefix_randomstring
    """
    random_part = secrets.token_urlsafe(length)
    return f"{prefix}_{random_part}"


def main():
    """Generate and display all secrets."""
    print("=" * 80)
    print("PRODUCTION SECRETS GENERATION")
    print("=" * 80)
    print()
    print("⚠️  CRITICAL: Store these secrets securely!")
    print("   - Use AWS Secrets Manager, HashiCorp Vault, or similar")
    print("   - Never commit these to version control")
    print("   - Rotate regularly (every 90 days recommended)")
    print()
    print("=" * 80)
    print()

    # Generate secrets
    jwt_secret = generate_jwt_secret()
    encryption_key = generate_encryption_key()
    db_password = generate_database_password()
    sendgrid_api_key_placeholder = generate_api_key("sg", 48)
    xero_client_secret = generate_jwt_secret(32)
    ap2_client_secret = generate_jwt_secret(32)

    # Display in .env format
    print("# Copy these to your .env.production file")
    print("#" * 80)
    print()

    print("# JWT Authentication")
    print(f"JWT_SECRET_KEY={jwt_secret}")
    print(f"JWT_ALGORITHM=HS256")
    print(f"JWT_EXPIRE_MINUTES=480")
    print(f"JWT_REFRESH_EXPIRE_DAYS=30")
    print()

    print("# Encryption")
    print(f"ENCRYPTION_KEY={encryption_key}")
    print()

    print("# Database")
    print(f"DATABASE_URL=postgresql+asyncpg://ccw_erp_user:{db_password}@localhost:5432/ccw_erp_prod")
    print(f"POSTGRES_PASSWORD={db_password}")
    print()

    print("# SendGrid (Email)")
    print(f"SENDGRID_API_KEY=<YOUR_ACTUAL_SENDGRID_KEY>")
    print(f"# Example format: SENDGRID_API_KEY={sendgrid_api_key_placeholder}")
    print(f"SENDGRID_FROM_EMAIL=noreply@ccw-erp.com")
    print(f"SENDGRID_FROM_NAME=CCW Equipment ERP")
    print()

    print("# Xero Integration")
    print(f"XERO_CLIENT_ID=<YOUR_XERO_CLIENT_ID>")
    print(f"XERO_CLIENT_SECRET={xero_client_secret}")
    print(f"XERO_REDIRECT_URI=https://your-domain.com/api/integrations/xero/callback")
    print(f"XERO_WEBHOOK_KEY={generate_jwt_secret(32)}")
    print()

    print("# Google AP2 Integration")
    print(f"AP2_CLIENT_ID=<YOUR_AP2_CLIENT_ID>")
    print(f"AP2_CLIENT_SECRET={ap2_client_secret}")
    print(f"AP2_WEBHOOK_SECRET={generate_jwt_secret(32)}")
    print()

    print("# Carrier Webhooks")
    print(f"FEDEX_WEBHOOK_SECRET={generate_jwt_secret(32)}")
    print(f"UPS_WEBHOOK_SECRET={generate_jwt_secret(32)}")
    print(f"USPS_WEBHOOK_SECRET={generate_jwt_secret(32)}")
    print()

    print("# Redis (Rate Limiting & Caching)")
    print(f"REDIS_URL=redis://localhost:6379/0")
    print(f"REDIS_PASSWORD={generate_database_password(24)}")
    print()

    print("# Security")
    print(f"ENVIRONMENT=production")
    print(f"DEBUG=false")
    print(f"SECURE_COOKIES=true")
    print(f"CORS_ORIGINS=https://your-domain.com")
    print()

    print("#" * 80)
    print()
    print("✅ Secrets generated successfully!")
    print()
    print("NEXT STEPS:")
    print("1. Copy these values to your secrets manager (AWS Secrets Manager recommended)")
    print("2. Update your deployment configuration to load from secrets manager")
    print("3. Set up secret rotation (see docs/SECRETS_MANAGEMENT.md)")
    print("4. Delete this output from your terminal history")
    print()
    print("=" * 80)


if __name__ == "__main__":
    main()
