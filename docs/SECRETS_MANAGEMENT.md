# Secrets Management - AWS Secrets Manager Integration

This guide explains how to integrate AWS Secrets Manager with CCW-Online ERP for secure secret storage and retrieval.

## Overview

AWS Secrets Manager provides:
- **Encryption at rest**: All secrets encrypted with AWS KMS
- **Automatic rotation**: Built-in support for secret rotation
- **Access control**: Fine-grained IAM policies
- **Audit logging**: CloudTrail integration for compliance
- **Versioning**: Automatic secret versioning

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  ERP Backend    │────────▶│  AWS Secrets Manager │────────▶│   AWS KMS       │
│  (FastAPI)      │         │                      │         │  (Encryption)   │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
        │                              │
        │                              ▼
        │                    ┌──────────────────────┐
        └───────────────────▶│  CloudTrail Logs     │
                             │  (Audit Trail)       │
                             └──────────────────────┘
```

---

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **IAM Role** or User with secrets access

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecrets"
      ],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:ccw-erp/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_ID"
    }
  ]
}
```

---

## Setup

### Step 1: Generate Secrets

```bash
# Generate all secrets
python scripts/generate-secrets.py > secrets.txt

# Review and edit secrets.txt
# DO NOT commit this file!
```

### Step 2: Create Secret in AWS Secrets Manager

**Option A: Using AWS Console**

1. Go to AWS Secrets Manager console
2. Click "Store a new secret"
3. Select "Other type of secret"
4. Add key-value pairs for each secret
5. Name: `ccw-erp/production`
6. Enable automatic rotation (optional)
7. Click "Store"

**Option B: Using AWS CLI**

```bash
# Create secret from JSON file
aws secretsmanager create-secret \
  --name ccw-erp/production \
  --description "CCW ERP Production Secrets" \
  --secret-string file://secrets.json \
  --region us-east-1

# Or create with key-value pairs
aws secretsmanager create-secret \
  --name ccw-erp/production \
  --description "CCW ERP Production Secrets" \
  --secret-string '{
    "JWT_SECRET_KEY": "your-jwt-secret",
    "ENCRYPTION_KEY": "your-encryption-key",
    "DATABASE_URL": "postgresql+asyncpg://...",
    "SENDGRID_API_KEY": "your-sendgrid-key",
    "XERO_CLIENT_SECRET": "your-xero-secret"
  }' \
  --region us-east-1
```

### Step 3: Install AWS SDK

```bash
cd apps/backend
pip install boto3  # Add to pyproject.toml if not present
```

### Step 4: Configure Application

**Option A: Environment Variables**

```bash
export USE_AWS_SECRETS=true
export AWS_SECRET_NAME=ccw-erp/production
export AWS_REGION=us-east-1
```

**Option B: AWS IAM Role** (recommended for EC2/ECS)

The application will automatically use IAM role credentials.

---

## Implementation

### Secrets Manager Client

File: `apps/backend/src/config/secrets_manager.py`

```python
"""AWS Secrets Manager integration."""

import json
import os
from typing import Any

import boto3
import structlog
from botocore.exceptions import ClientError

logger = structlog.get_logger(__name__)


class SecretsManager:
    """AWS Secrets Manager client."""

    def __init__(self, region: str = "us-east-1"):
        """Initialize Secrets Manager client.

        Args:
            region: AWS region (default: us-east-1)
        """
        self.region = region
        self.client = boto3.client("secretsmanager", region_name=region)
        self._cache: dict[str, Any] = {}

    def get_secret(self, secret_name: str, use_cache: bool = True) -> dict[str, Any]:
        """Get secret from AWS Secrets Manager.

        Args:
            secret_name: Name of the secret
            use_cache: Whether to use cached value (default: True)

        Returns:
            Dictionary of secret key-value pairs

        Raises:
            ClientError: If secret retrieval fails
        """
        if use_cache and secret_name in self._cache:
            logger.debug("Using cached secret", secret_name=secret_name)
            return self._cache[secret_name]

        try:
            response = self.client.get_secret_value(SecretId=secret_name)

            if "SecretString" in response:
                secret_data = json.loads(response["SecretString"])
            else:
                # Binary secret (not used for this application)
                secret_data = response["SecretBinary"]

            self._cache[secret_name] = secret_data

            logger.info("Secret retrieved successfully", secret_name=secret_name)

            return secret_data

        except ClientError as e:
            error_code = e.response["Error"]["Code"]

            if error_code == "ResourceNotFoundException":
                logger.error("Secret not found", secret_name=secret_name)
                raise ValueError(f"Secret {secret_name} not found in AWS Secrets Manager")

            elif error_code == "InvalidRequestException":
                logger.error("Invalid request", secret_name=secret_name)
                raise ValueError(f"Invalid request for secret {secret_name}")

            elif error_code == "InvalidParameterException":
                logger.error("Invalid parameter", secret_name=secret_name)
                raise ValueError(f"Invalid parameter for secret {secret_name}")

            elif error_code == "DecryptionFailure":
                logger.error("Decryption failed", secret_name=secret_name)
                raise ValueError(f"Failed to decrypt secret {secret_name}")

            elif error_code == "InternalServiceError":
                logger.error("AWS internal error", secret_name=secret_name)
                raise ValueError(f"AWS internal error retrieving secret {secret_name}")

            else:
                logger.error("Unexpected error", error_code=error_code, secret_name=secret_name)
                raise

    def update_secret(self, secret_name: str, secret_data: dict[str, Any]) -> None:
        """Update secret in AWS Secrets Manager.

        Args:
            secret_name: Name of the secret
            secret_data: Dictionary of secret key-value pairs
        """
        try:
            self.client.put_secret_value(
                SecretId=secret_name,
                SecretString=json.dumps(secret_data),
            )

            # Invalidate cache
            if secret_name in self._cache:
                del self._cache[secret_name]

            logger.info("Secret updated successfully", secret_name=secret_name)

        except ClientError as e:
            logger.error("Failed to update secret", secret_name=secret_name, error=str(e))
            raise

    def rotate_secret(self, secret_name: str) -> None:
        """Trigger secret rotation.

        Args:
            secret_name: Name of the secret

        Note:
            Requires Lambda function configured for rotation
        """
        try:
            self.client.rotate_secret(SecretId=secret_name)
            logger.info("Secret rotation initiated", secret_name=secret_name)

        except ClientError as e:
            logger.error("Failed to rotate secret", secret_name=secret_name, error=str(e))
            raise


# Global instance
_secrets_manager: SecretsManager | None = None


def get_secrets_manager(region: str | None = None) -> SecretsManager:
    """Get or create Secrets Manager instance.

    Args:
        region: AWS region (default: from environment or us-east-1)

    Returns:
        SecretsManager instance
    """
    global _secrets_manager

    if _secrets_manager is None:
        region = region or os.getenv("AWS_REGION", "us-east-1")
        _secrets_manager = SecretsManager(region=region)

    return _secrets_manager


def load_secrets_from_aws(secret_name: str) -> dict[str, Any]:
    """Load secrets from AWS Secrets Manager and set as environment variables.

    Args:
        secret_name: Name of the secret in AWS Secrets Manager

    Returns:
        Dictionary of secrets
    """
    manager = get_secrets_manager()
    secrets = manager.get_secret(secret_name)

    # Set as environment variables
    for key, value in secrets.items():
        os.environ[key] = str(value)

    logger.info("Secrets loaded from AWS Secrets Manager", count=len(secrets))

    return secrets
```

### Update Settings Configuration

File: `apps/backend/src/config/settings.py` (add to existing file)

```python
# Add to imports
from src.config.secrets_manager import load_secrets_from_aws
import os

# Add to Settings class or at module level
USE_AWS_SECRETS = os.getenv("USE_AWS_SECRETS", "false").lower() == "true"
AWS_SECRET_NAME = os.getenv("AWS_SECRET_NAME", "ccw-erp/production")

if USE_AWS_SECRETS:
    try:
        load_secrets_from_aws(AWS_SECRET_NAME)
        logger.info("Loaded secrets from AWS Secrets Manager")
    except Exception as e:
        logger.error("Failed to load secrets from AWS", error=str(e))
        raise
```

---

## Usage in Application

### Automatic Loading (Recommended)

When `USE_AWS_SECRETS=true`, secrets are loaded automatically on application startup and set as environment variables.

```python
# app/backend/src/api/main.py
from src.config.settings import get_settings

settings = get_settings()  # Secrets already loaded from AWS
```

### Manual Loading

```python
from src.config.secrets_manager import get_secrets_manager

manager = get_secrets_manager()
secrets = manager.get_secret("ccw-erp/production")

jwt_secret = secrets["JWT_SECRET_KEY"]
encryption_key = secrets["ENCRYPTION_KEY"]
```

---

## Secret Rotation

### Automatic Rotation with Lambda

1. **Create Lambda Function** for rotation logic
2. **Configure Rotation** in Secrets Manager:
   ```bash
   aws secretsmanager rotate-secret \
     --secret-id ccw-erp/production \
     --rotation-lambda-arn arn:aws:lambda:REGION:ACCOUNT:function:SecretsManagerRotation \
     --rotation-rules AutomaticallyAfterDays=90
   ```

### Manual Rotation

```bash
# Generate new secrets
python scripts/generate-secrets.py > new_secrets.json

# Update secret in AWS
aws secretsmanager put-secret-value \
  --secret-id ccw-erp/production \
  --secret-string file://new_secrets.json

# Restart application to load new secrets
sudo systemctl restart ccw-erp-backend
```

---

## Monitoring & Auditing

### Enable CloudTrail Logging

```bash
# Create trail if not exists
aws cloudtrail create-trail \
  --name ccw-erp-audit \
  --s3-bucket-name ccw-erp-audit-logs

# Enable logging
aws cloudtrail start-logging --name ccw-erp-audit
```

### Query Audit Logs

```bash
# List secret access events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=ccw-erp/production \
  --max-results 50
```

### Set Up Alarms

```bash
# Create CloudWatch alarm for unauthorized access
aws cloudwatch put-metric-alarm \
  --alarm-name UnauthorizedSecretsAccess \
  --alarm-description "Alert on unauthorized secrets access" \
  --metric-name UnauthorizedAccess \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold
```

---

## Cost Optimization

### Pricing (as of 2024)

- **Secret storage**: $0.40 per secret per month
- **API calls**: $0.05 per 10,000 API calls
- **Rotation**: Included (Lambda costs separate)

### Reduce Costs

1. **Use caching**: Cache secrets in application memory (TTL: 5 minutes)
2. **Batch secrets**: Store related secrets together
3. **Limit API calls**: Load secrets once on startup

**Example Caching**:
```python
# apps/backend/src/config/secrets_manager.py
from datetime import datetime, timedelta

class SecretsManager:
    def __init__(self):
        self._cache = {}
        self._cache_ttl = timedelta(minutes=5)
        self._cache_time = {}

    def get_secret(self, secret_name: str) -> dict:
        # Check cache freshness
        if secret_name in self._cache:
            cache_age = datetime.now() - self._cache_time[secret_name]
            if cache_age < self._cache_ttl:
                return self._cache[secret_name]

        # Fetch from AWS
        secrets = self._fetch_from_aws(secret_name)
        self._cache[secret_name] = secrets
        self._cache_time[secret_name] = datetime.now()

        return secrets
```

---

## Troubleshooting

### "ResourceNotFoundException"

**Cause**: Secret doesn't exist in AWS Secrets Manager

**Fix**:
```bash
# Verify secret exists
aws secretsmanager list-secrets

# Create if missing
aws secretsmanager create-secret --name ccw-erp/production --secret-string '{}'
```

### "AccessDeniedException"

**Cause**: IAM role/user lacks permissions

**Fix**:
1. Verify IAM policy attached
2. Check resource ARN matches
3. Verify KMS key permissions

```bash
# Test access
aws secretsmanager get-secret-value --secret-id ccw-erp/production
```

### "DecryptionFailure"

**Cause**: KMS key permissions issue

**Fix**:
1. Verify KMS key policy allows decrypt
2. Check IAM role has kms:Decrypt permission

---

## Security Best Practices

✅ **DO**:
- Use IAM roles (not access keys) for EC2/ECS
- Enable CloudTrail logging
- Use VPC endpoints for Secrets Manager (private connectivity)
- Implement least-privilege IAM policies
- Enable secret rotation
- Use separate secrets for dev/staging/prod

❌ **DON'T**:
- Share IAM access keys
- Disable CloudTrail logging
- Use overly permissive IAM policies
- Store secrets in code or config files
- Use same secret across environments

---

## Disaster Recovery

### Backup Secrets

```bash
# Export all secrets
aws secretsmanager list-secrets --query 'SecretList[*].Name' --output text | \
  xargs -I {} aws secretsmanager get-secret-value --secret-id {} > secrets_backup.json
```

### Restore Secrets

```bash
# Restore from backup
jq -r 'to_entries[] | .key + "=" + .value' secrets_backup.json | \
  xargs -I {} aws secretsmanager create-secret --name {} --secret-string {}
```

---

## Alternative: HashiCorp Vault

If AWS Secrets Manager is not suitable, consider HashiCorp Vault:

**Pros**:
- Self-hosted (no AWS dependency)
- Dynamic secrets
- Advanced access control
- Multi-cloud support

**Cons**:
- More complex setup
- Requires infrastructure management
- Separate authentication system

**Setup Guide**: See [Vault Documentation](https://www.vaultproject.io/docs)

---

## Checklist for Production

- [ ] AWS account configured
- [ ] IAM role/user created with proper permissions
- [ ] KMS key configured for encryption
- [ ] Secret created in AWS Secrets Manager
- [ ] Application configured with `USE_AWS_SECRETS=true`
- [ ] CloudTrail logging enabled
- [ ] Secret rotation configured (90 days)
- [ ] Backup process documented
- [ ] Monitoring and alarms set up
- [ ] Cost tracking enabled

---

## Resources

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [Boto3 Secrets Manager API](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/secretsmanager.html)
- [Secret Rotation with Lambda](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
