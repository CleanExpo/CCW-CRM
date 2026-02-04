# Secrets Generation Guide

This guide explains how to generate, store, and rotate secrets for CCW-Online ERP production deployment.

## Quick Start

```bash
# Generate all secrets at once
python scripts/generate-secrets.py

# Copy output to your secrets manager
# DO NOT store in .env files in production!
```

## Why Secure Secrets Matter

- **JWT Secret**: If leaked, attackers can forge authentication tokens and impersonate users
- **Encryption Key**: If leaked, attackers can decrypt all encrypted data (Xero tokens, etc.)
- **Database Password**: If leaked, attackers gain full access to your database
- **API Keys**: If leaked, attackers can make requests on your behalf

## Secret Types

### 1. JWT Secret Key
**Purpose**: Sign and verify JWT authentication tokens

**Generate**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Strength**: 64 bytes (512 bits) of entropy

**Rotation**: Every 90 days (see rotation section below)

---

### 2. Encryption Key (Fernet)
**Purpose**: Encrypt sensitive data at rest (OAuth tokens, API keys)

**Generate**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Strength**: 256-bit AES encryption

**Rotation**: Every 90 days (requires re-encrypting all existing tokens)

---

### 3. Database Password
**Purpose**: PostgreSQL database authentication

**Generate**:
```bash
python -c "import secrets, string; alphabet = string.ascii_letters + string.digits + '!@#$%^&*()-_=+'; print(''.join(secrets.choice(alphabet) for _ in range(32)))"
```

**Strength**: 32 characters with mixed case, digits, and special characters

**Rotation**: Every 90 days

---

### 4. Webhook Secrets
**Purpose**: HMAC signature verification for incoming webhooks

**Generate** (for each carrier/integration):
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Required for**:
- FedEx webhooks
- UPS webhooks
- USPS webhooks
- Xero webhooks
- Google AP2 webhooks

**Rotation**: Every 180 days

---

## Storage Options

### Option 1: AWS Secrets Manager (Recommended)

**Pros**:
- Automatic encryption at rest
- Fine-grained access control (IAM)
- Audit logging
- Automatic rotation support
- Integration with AWS services

**Setup**:
```bash
# Install AWS CLI
# Configure credentials: aws configure

# Create secret
aws secretsmanager create-secret \
  --name ccw-erp/production \
  --description "CCW ERP Production Secrets" \
  --secret-string file://secrets.json

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id ccw-erp/production \
  --query SecretString \
  --output text
```

**Cost**: ~$0.40/month per secret + $0.05 per 10,000 API calls

---

### Option 2: HashiCorp Vault

**Pros**:
- Self-hosted option
- Dynamic secrets
- Multiple authentication backends
- Advanced secret versioning

**Setup**: See `docs/SECRETS_MANAGEMENT.md`

---

### Option 3: Environment Variables (NOT RECOMMENDED for production)

**Only use for development/staging**

⚠️ **Security Risks**:
- Secrets visible in process list
- Logged to system logs
- Exposed in error messages
- Difficult to rotate

---

## Secret Rotation

### Why Rotate?

- Limit damage from potential breaches
- Industry best practice (PCI-DSS, SOC 2)
- Reduce attack surface over time

### Rotation Schedule

| Secret Type | Rotation Frequency | Complexity |
|-------------|-------------------|------------|
| JWT Secret | 90 days | Medium |
| Encryption Key | 90 days | High (requires re-encryption) |
| Database Password | 90 days | Medium |
| Webhook Secrets | 180 days | Low |
| API Keys (external) | As required by provider | Varies |

---

### JWT Secret Rotation

**Process**:
1. Generate new JWT secret
2. Keep old secret active for overlap period (e.g., 1 hour)
3. Update application config with both secrets
4. Deploy with dual-verification support
5. After overlap period, remove old secret

**Code Example**:
```python
# Support multiple JWT secrets during rotation
JWT_SECRET_KEYS = [
    os.getenv("JWT_SECRET_KEY"),  # Current
    os.getenv("JWT_SECRET_KEY_OLD"),  # Previous (for verification only)
]

def verify_token(token):
    for secret in JWT_SECRET_KEYS:
        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            return payload
        except jwt.InvalidTokenError:
            continue
    raise ValueError("Invalid token")
```

---

### Encryption Key Rotation

**⚠️ Critical**: Requires re-encrypting all existing encrypted data

**Process**:
1. Generate new encryption key
2. Deploy application with **both** keys (new for encryption, old for decryption)
3. Run migration script to re-encrypt all data:
   ```bash
   python scripts/rotate-encryption-key.py --old-key <OLD> --new-key <NEW>
   ```
4. Verify all data re-encrypted
5. Remove old key from configuration

**Affected Data**:
- Xero OAuth tokens
- API keys
- Any other encrypted fields

**Migration Script** (to be created if rotation needed):
```python
# scripts/rotate-encryption-key.py
from src.security.encryption import EncryptionService
from src.db.xero_models import XeroConnection

async def rotate_xero_tokens():
    old_service = EncryptionService(OLD_KEY)
    new_service = EncryptionService(NEW_KEY)

    connections = await db.execute(select(XeroConnection))
    for conn in connections.scalars():
        # Decrypt with old key
        access_token = old_service.decrypt(conn.access_token)
        refresh_token = old_service.decrypt(conn.refresh_token)

        # Re-encrypt with new key
        conn.access_token = new_service.encrypt(access_token)
        conn.refresh_token = new_service.encrypt(refresh_token)

    await db.commit()
```

---

### Database Password Rotation

**Process**:
1. Create new database user with new password:
   ```sql
   CREATE USER ccw_erp_user_new WITH PASSWORD 'new_password';
   GRANT ALL PRIVILEGES ON DATABASE ccw_erp_prod TO ccw_erp_user_new;
   ```
2. Update application config with new credentials
3. Deploy application
4. Verify application connectivity
5. Drop old user:
   ```sql
   DROP USER ccw_erp_user_old;
   ```

---

### Webhook Secret Rotation

**Process**:
1. Generate new webhook secret
2. Update secret in your webhook provider (Xero, FedEx, etc.)
3. Update application config
4. Deploy application
5. Test webhook delivery

**Testing**:
```bash
# Test webhook signature verification
curl -X POST https://your-domain.com/api/webhooks/test \
  -H "X-Webhook-Signature: <HMAC_SIGNATURE>" \
  -d '{"test": "data"}'
```

---

## Security Best Practices

### DO ✅

- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Generate secrets with cryptographically secure random generators
- Use different secrets for each environment (dev/staging/prod)
- Rotate secrets regularly (90-180 days)
- Audit secret access (who accessed what and when)
- Use principle of least privilege (IAM policies)
- Monitor for secret leaks (GitHub secret scanning, GitGuardian)

### DON'T ❌

- Commit secrets to version control (`.env` files, config files)
- Share secrets via email, Slack, or other insecure channels
- Reuse secrets across environments
- Use weak or predictable secrets
- Store secrets in plain text files
- Log secrets to application logs
- Expose secrets in error messages

---

## Checklist for Production Deployment

- [ ] All secrets generated using `scripts/generate-secrets.py`
- [ ] Secrets stored in AWS Secrets Manager (or equivalent)
- [ ] `.env.production` file deleted (not committed to repo)
- [ ] Encryption key set in environment
- [ ] JWT secret verified (length >= 64 bytes)
- [ ] Database password verified (length >= 32 characters)
- [ ] Webhook secrets configured for all carriers
- [ ] Secret rotation schedule documented
- [ ] Access to secrets manager restricted (IAM policies)
- [ ] Secret access audit logging enabled

---

## Troubleshooting

### "Encryption key not provided" Error

**Cause**: `ENCRYPTION_KEY` environment variable not set

**Fix**:
```bash
export ENCRYPTION_KEY="<your_fernet_key>"
```

---

### "Invalid token or wrong key" Error

**Cause**: Trying to decrypt data with wrong encryption key

**Fix**:
1. Verify encryption key matches the one used to encrypt
2. If key was rotated, run migration script
3. Check for typos in environment variables

---

### "Database connection failed" Error

**Cause**: Incorrect database password

**Fix**:
```bash
# Verify password in PostgreSQL
psql -U ccw_erp_user -d ccw_erp_prod -h localhost

# If fails, reset password
ALTER USER ccw_erp_user WITH PASSWORD 'new_password';
```

---

## Additional Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Cryptography Best Practices](https://docs.python.org/3/library/secrets.html)

---

## Support

For questions or issues with secrets management, contact the infrastructure team or refer to `docs/SECRETS_MANAGEMENT.md`.
