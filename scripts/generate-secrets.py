#!/usr/bin/env python3
"""
Generate secure secrets for production deployment.

This script generates cryptographically secure secrets for:
- JWT signing
- Encryption keys (Fernet AES-256)
- Database passwords
- Redis passwords
- API keys

Usage:
    # Display secrets to console
    python scripts/generate-secrets.py

    # Write secrets to files (Docker secrets format; use a path outside git)
    python scripts/generate-secrets.py --output-dir /path/to/docker-secret-files

    # Generate JSON for AWS Secrets Manager
    python scripts/generate-secrets.py --json > secrets.json

    # Quiet mode (just output the secrets)
    python scripts/generate-secrets.py --quiet
"""

import argparse
import json
import os
import secrets
import string
import sys
from pathlib import Path

try:
    from cryptography.fernet import Fernet

    CRYPTOGRAPHY_AVAILABLE = True
except ImportError:
    CRYPTOGRAPHY_AVAILABLE = False


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

    Raises:
        ImportError: If cryptography library not installed
    """
    if not CRYPTOGRAPHY_AVAILABLE:
        raise ImportError(
            "cryptography library required for encryption key generation. "
            "Install with: pip install cryptography"
        )
    return Fernet.generate_key().decode()


def generate_password(length: int = 32) -> str:
    """Generate strong password.

    Args:
        length: Length of password (default: 32 characters)

    Returns:
        Random password with letters, digits, and safe special characters
    """
    # Use subset of special chars that work well in all contexts (URLs, shells, etc.)
    alphabet = string.ascii_letters + string.digits + "!@#$%_-"
    # Ensure at least one of each type
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%_-"),
    ]
    # Fill rest randomly
    password.extend(secrets.choice(alphabet) for _ in range(length - 4))
    # Shuffle to avoid predictable positions
    secrets.SystemRandom().shuffle(password)
    return "".join(password)


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


def generate_all_secrets() -> dict[str, str]:
    """Generate all required secrets.

    Returns:
        Dictionary of secret names to values
    """
    return {
        # Core authentication
        "JWT_SECRET_KEY": generate_jwt_secret(64),
        # Encryption
        "ENCRYPTION_KEY": generate_encryption_key() if CRYPTOGRAPHY_AVAILABLE else "",
        # Database
        "POSTGRES_PASSWORD": generate_password(32),
        # Redis
        "REDIS_PASSWORD": generate_password(24),
        # Grafana admin
        "GRAFANA_ADMIN_PASSWORD": generate_password(24),
        # Webhook secrets
        "WEBHOOK_SECRET": generate_jwt_secret(32),
        "XERO_WEBHOOK_KEY": generate_jwt_secret(32),
        "STRIPE_WEBHOOK_SECRET": generate_jwt_secret(32),
        "SHOPIFY_WEBHOOK_SECRET": generate_jwt_secret(32),
    }


def write_secret_files(secrets_dict: dict[str, str], output_dir: str) -> list[str]:
    """Write secrets to individual files (Docker secrets format).

    Args:
        secrets_dict: Dictionary of secret names to values
        output_dir: Directory to write files to

    Returns:
        List of created file paths
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    created_files = []
    file_mapping = {
        "JWT_SECRET_KEY": "jwt_secret.txt",
        "ENCRYPTION_KEY": "encryption_key.txt",
        "POSTGRES_PASSWORD": "postgres_password.txt",
        "REDIS_PASSWORD": "redis_password.txt",
        "GRAFANA_ADMIN_PASSWORD": "grafana_admin_password.txt",
        "WEBHOOK_SECRET": "webhook_secret.txt",
    }

    for env_var, filename in file_mapping.items():
        if env_var in secrets_dict and secrets_dict[env_var]:
            file_path = output_path / filename
            file_path.write_text(secrets_dict[env_var], encoding="utf-8")
            created_files.append(str(file_path))

            # Set restrictive permissions on Unix
            if os.name != "nt":  # Not Windows
                os.chmod(file_path, 0o600)

    return created_files


def output_console(secrets_dict: dict[str, str], quiet: bool = False) -> None:
    """Output secrets to console in .env format.

    Args:
        secrets_dict: Dictionary of secret names to values
        quiet: If True, only output the secrets without extra text
    """
    if not quiet:
        print("=" * 80)
        print("PRODUCTION SECRETS GENERATION")
        print("=" * 80)
        print()
        print("CRITICAL: Store these secrets securely!")
        print("   - Use AWS Secrets Manager, HashiCorp Vault, or Docker secrets")
        print("   - Never commit these to version control")
        print("   - Rotate regularly (every 90 days recommended)")
        print()
        print("=" * 80)
        print()
        print("# Copy these to your .env.production file or secrets manager")
        print("#" * 80)
        print()

    # JWT Authentication
    print("# JWT Authentication")
    print(f"JWT_SECRET_KEY={secrets_dict['JWT_SECRET_KEY']}")
    print()

    # Encryption
    if secrets_dict.get("ENCRYPTION_KEY"):
        print("# Encryption (Fernet AES-256)")
        print(f"ENCRYPTION_KEY={secrets_dict['ENCRYPTION_KEY']}")
        print()
    elif not quiet:
        print("# Encryption (cryptography library not installed)")
        print("# ENCRYPTION_KEY=<install cryptography: pip install cryptography>")
        print()

    # Database
    db_password = secrets_dict["POSTGRES_PASSWORD"]
    print("# Database")
    print(f"POSTGRES_PASSWORD={db_password}")
    print(f"DATABASE_URL=postgresql+asyncpg://ccw_erp_user:{db_password}@<HOST>:5432/ccw_erp_prod")
    print()

    # Redis
    print("# Redis")
    print(f"REDIS_PASSWORD={secrets_dict['REDIS_PASSWORD']}")
    print()

    # Grafana
    print("# Grafana")
    print(f"GRAFANA_ADMIN_PASSWORD={secrets_dict['GRAFANA_ADMIN_PASSWORD']}")
    print()

    # Webhooks
    print("# Webhook Secrets")
    print(f"WEBHOOK_SECRET={secrets_dict['WEBHOOK_SECRET']}")
    print(f"XERO_WEBHOOK_KEY={secrets_dict['XERO_WEBHOOK_KEY']}")
    print(f"STRIPE_WEBHOOK_SECRET={secrets_dict['STRIPE_WEBHOOK_SECRET']}")
    print(f"SHOPIFY_WEBHOOK_SECRET={secrets_dict['SHOPIFY_WEBHOOK_SECRET']}")
    print()

    if not quiet:
        print("#" * 80)
        print()
        print("Secrets generated successfully!")
        print()
        print("NEXT STEPS:")
        print("1. Store in AWS Secrets Manager: aws secretsmanager create-secret ...")
        print(
            "   OR create Docker secret files: python scripts/generate-secrets.py --output-dir /path/to/secret-files"
        )
        print("2. Update deployment configuration to load from secrets")
        print("3. Set up secret rotation schedule (90 days)")
        print("4. Clear terminal history: history -c")
        print()
        print("=" * 80)


def output_json(secrets_dict: dict[str, str]) -> None:
    """Output secrets as JSON for AWS Secrets Manager.

    Args:
        secrets_dict: Dictionary of secret names to values
    """
    # Filter out empty values
    filtered = {k: v for k, v in secrets_dict.items() if v}
    print(json.dumps(filtered, indent=2))


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success)
    """
    parser = argparse.ArgumentParser(
        description="Generate secure secrets for production deployment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/generate-secrets.py                     # Display to console
  python scripts/generate-secrets.py --output-dir /path/to/secret-files  # Write to files
  python scripts/generate-secrets.py --json              # Output JSON for AWS
  python scripts/generate-secrets.py --quiet             # Minimal output
        """,
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        help="Write secrets to files in this directory (Docker secrets format)",
    )
    parser.add_argument(
        "--json",
        "-j",
        action="store_true",
        help="Output as JSON (for AWS Secrets Manager)",
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Quiet mode - only output secrets without extra text",
    )

    args = parser.parse_args()

    # Generate all secrets
    try:
        secrets_dict = generate_all_secrets()
    except ImportError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    # Output based on arguments
    if args.output_dir:
        created_files = write_secret_files(secrets_dict, args.output_dir)
        if not args.quiet:
            print(f"Created {len(created_files)} secret files in {args.output_dir}:")
            for f in created_files:
                print(f"  - {f}")
            print()
            print("IMPORTANT: Set restrictive permissions on these files!")
            print("  Linux/macOS: chmod 600 <output-dir>/*.txt")
            print("  Windows: Use icacls to restrict access")
    elif args.json:
        output_json(secrets_dict)
    else:
        output_console(secrets_dict, quiet=args.quiet)

    return 0


if __name__ == "__main__":
    sys.exit(main())
