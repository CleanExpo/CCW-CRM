# Secrets Directory

This directory contains secret files for Docker secrets and local development.

**IMPORTANT: DO NOT commit actual secret files to git!**

## Files in this Directory

This directory should contain the following files (created manually or via script):

### Development Secrets

- `postgres_password.txt` - PostgreSQL password
- `redis_password.txt` - Redis password (if authentication enabled)
- `jwt_secret.txt` - JWT signing key
- `encryption_key.txt` - Database field encryption key

### Integration Secrets (Optional)

- `sendgrid_api_key.txt` - SendGrid API key for emails
- `sentry_dsn.txt` - Sentry error tracking DSN
- `slack_webhook_url.txt` - Slack webhook for alerts
- `xero_client_secret.txt` - Xero integration secret
- `stripe_secret_key.txt` - Stripe payment key

## Creating Secret Files

### Option 1: Use the Generation Script (Recommended)

```bash
# Generate all secrets
python scripts/generate-secrets.py --output-dir secrets/

# Or use PowerShell
.\scripts\generate-secrets.ps1
```

### Option 2: Manual Creation

```bash
# Generate individual secrets
# PostgreSQL password (32 characters)
python -c "import secrets; print(secrets.token_urlsafe(24))" > secrets/postgres_password.txt

# Redis password (24 characters)
python -c "import secrets; print(secrets.token_urlsafe(18))" > secrets/redis_password.txt

# JWT secret (64 bytes, URL-safe base64)
python -c "import secrets; print(secrets.token_urlsafe(64))" > secrets/jwt_secret.txt

# Encryption key (Fernet compatible)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > secrets/encryption_key.txt
```

## File Permissions

Ensure secret files have restrictive permissions:

```bash
# Linux/macOS
chmod 600 secrets/*.txt

# Windows (PowerShell as admin)
icacls secrets\*.txt /inheritance:r /grant:r "$env:USERNAME:(R)"
```

## Docker Secrets Usage

When using Docker Compose with secrets:

```yaml
# docker-compose.yml
secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt

services:
  postgres:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
```

## Security Checklist

- [ ] Never commit actual secrets to git
- [ ] Verify `.gitignore` excludes this directory
- [ ] Use different secrets for dev/staging/production
- [ ] Rotate secrets every 90 days
- [ ] Store production secrets in AWS Secrets Manager

## Verification

Run the verification script:

```bash
./scripts/verify-secrets.sh
```

## Production Deployment

For production, use AWS Secrets Manager instead of file-based secrets.
See: `docs/PRODUCTION-SECRETS-SETUP.md`
