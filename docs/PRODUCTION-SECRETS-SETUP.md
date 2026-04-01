# Production Secrets Setup Guide

**Purpose:** Secure secret management for CCW-Online ERP production deployment

**Last Updated:** February 3, 2026

---

## Overview

In production, all sensitive secrets are stored in **AWS Secrets Manager** and retrieved at runtime. This document explains how to configure production secrets securely.

### Why Secrets Manager?

- ✅ **Encrypted at rest** (AWS KMS)
- ✅ **Automatic rotation** (configurable)
- ✅ **Audit logging** (CloudTrail integration)
- ✅ **Fine-grained access control** (IAM policies)
- ✅ **No secrets in code** (zero hardcoded credentials)

---

## 🔐 Required Secrets

The following secrets must be configured in AWS Secrets Manager before production deployment:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `ccw-erp/jwt-secret` | JWT token signing key | `xcIDlWKptnm3tP6XjYfEO7aor-d1-8hNvvCeg92hnN0` |
| `ccw-erp/webhook-secret` | Webhook signature verification | `UDJHWyWEEgRRMMSv8TuH3xckOWROmFDsiP3JlRfdMFI` |
| `ccw-erp/database-url` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `ccw-erp/encryption-key` | Database field encryption key | `f6MKzHX4IJf2PHHSn-OdVTt3eFsaA6JxN4FWcDGVUdc` |
| `ccw-erp/redis-url` | Redis connection string | `redis://host:6379/0` |
| `ccw-erp/sendgrid-api-key` | Email service API key | `SG.xxxxxxxxxxxxxxxxxx` |
| `ccw-erp/stripe-api-key` | Stripe billing API key | `sk_live_xxxxxxxxxxxxxxxxxx` |
| `ccw-erp/xero-client-id` | Xero integration client ID | `XERO_CLIENT_ID` |
| `ccw-erp/xero-client-secret` | Xero integration secret | `XERO_CLIENT_SECRET` |

---

## 📝 Step-by-Step Setup

### 1. Generate Secure Secrets

**Run this command to generate cryptographically secure secrets:**

```bash
cd apps/backend
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32)); print('WEBHOOK_SECRET=' + secrets.token_urlsafe(32)); print('DATABASE_ENCRYPTION_KEY=' + secrets.token_urlsafe(32))"
```

**Sample Output:**
```
JWT_SECRET_KEY=xcIDlWKptnm3tP6XjYfEO7aor-d1-8hNvvCeg92hnN0
WEBHOOK_SECRET=UDJHWyWEEgRRMMSv8TuH3xckOWROmFDsiP3JlRfdMFI
DATABASE_ENCRYPTION_KEY=f6MKzHX4IJf2PHHSn-OdVTt3eFsaA6JxN4FWcDGVUdc
```

⚠️ **CRITICAL:** Save these values securely. You will need them to configure AWS Secrets Manager.

---

### 2. Create Secrets in AWS Secrets Manager

**Option A: Using AWS CLI**

```bash
# Set AWS region
export AWS_REGION=ap-southeast-2  # Sydney region (or your preferred region)

# Create JWT secret
aws secretsmanager create-secret \
  --name ccw-erp/jwt-secret \
  --description "JWT token signing key for CCW-Online ERP" \
  --secret-string "xcIDlWKptnm3tP6XjYfEO7aor-d1-8hNvvCeg92hnN0" \
  --region $AWS_REGION

# Create webhook secret
aws secretsmanager create-secret \
  --name ccw-erp/webhook-secret \
  --description "Webhook signature verification secret" \
  --secret-string "UDJHWyWEEgRRMMSv8TuH3xckOWROmFDsiP3JlRfdMFI" \
  --region $AWS_REGION

# Create encryption key
aws secretsmanager create-secret \
  --name ccw-erp/encryption-key \
  --description "Database field encryption key (AES-256)" \
  --secret-string "f6MKzHX4IJf2PHHSn-OdVTt3eFsaA6JxN4FWcDGVUdc" \
  --region $AWS_REGION

# Create database URL (replace with actual credentials)
aws secretsmanager create-secret \
  --name ccw-erp/database-url \
  --description "PostgreSQL connection URL" \
  --secret-string "postgresql://ccw_erp_user:REPLACE_WITH_REAL_PASSWORD@ccw-erp-db.region.rds.amazonaws.com:5432/ccw_erp_production" \
  --region $AWS_REGION
```

**Option B: Using AWS Console**

1. Go to [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager/)
2. Click **Store a new secret**
3. Select **Other type of secret**
4. Choose **Plaintext** tab
5. Paste the secret value
6. Click **Next**
7. Enter secret name (e.g., `ccw-erp/jwt-secret`)
8. Add description
9. Click **Next** → **Next** → **Store**

---

### 3. Configure IAM Permissions

**Create IAM policy for ECS task role:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:ccw-erp/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:ap-southeast-2:123456789012:key/*"
      ],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": [
            "secretsmanager.ap-southeast-2.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

**Attach policy to ECS task role:**

```bash
aws iam put-role-policy \
  --role-name ccw-erp-task-role \
  --policy-name SecretsManagerAccess \
  --policy-document file://iam-secrets-policy.json
```

---

### 4. Set Environment Variable

**In production ECS task definition:**

```json
{
  "environment": [
    {
      "name": "ENVIRONMENT",
      "value": "production"
    },
    {
      "name": "AWS_REGION",
      "value": "ap-southeast-2"
    }
  ]
}
```

The backend will automatically detect `ENVIRONMENT=production` and use AWS Secrets Manager.

---

## 🔄 Secret Rotation

### Enable Automatic Rotation (Recommended)

```bash
aws secretsmanager rotate-secret \
  --secret-id ccw-erp/jwt-secret \
  --rotation-lambda-arn arn:aws:lambda:ap-southeast-2:123456789012:function:SecretsManagerRotation \
  --rotation-rules AutomaticallyAfterDays=90
```

### Manual Rotation

**When to rotate:**
- Every 90 days (recommended)
- After suspected compromise
- After team member departure

**How to rotate:**

1. Generate new secret:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. Update secret in AWS:
   ```bash
   aws secretsmanager update-secret \
     --secret-id ccw-erp/jwt-secret \
     --secret-string "NEW_SECRET_VALUE"
   ```

3. Restart application to pick up new secret:
   ```bash
   aws ecs update-service \
     --cluster ccw-erp-cluster \
     --service ccw-erp-service \
     --force-new-deployment
   ```

⚠️ **WARNING:** Rotating JWT secret will invalidate all existing user sessions. Plan rotation during low-traffic windows.

---

## 🧪 Testing Secrets Locally

### Development Mode (Environment Variables)

Create `.env` file in `apps/backend/`:

```bash
# .env (DO NOT COMMIT TO GIT)
ENVIRONMENT=development
JWT_SECRET_KEY=dev-jwt-secret-not-for-production
WEBHOOK_SECRET=dev-webhook-secret-not-for-production
DATABASE_ENCRYPTION_KEY=dev-encryption-key-not-for-production
DATABASE_URL=postgresql://starter_user:local_dev_password@localhost:5432/starter_db
```

### Testing AWS Secrets Manager Locally

```bash
# Set environment to trigger AWS mode
export ENVIRONMENT=production
export AWS_REGION=ap-southeast-2
export AWS_PROFILE=ccw-erp-dev  # Use your AWS profile

# Install boto3
pip install boto3

# Test secret retrieval
cd apps/backend
python -c "from src.integrations.secrets_manager import get_jwt_secret; print(get_jwt_secret())"
```

**Expected output:**
```
2026-02-03 10:30:00 [info     ] AWS Secrets Manager client initialized
xcIDlWKptnm3tP6XjYfEO7aor-d1-8hNvvCeg92hnN0
```

---

## 🚨 Emergency Procedures

### Suspected Secret Compromise

**Immediate actions:**

1. **Revoke compromised secret:**
   ```bash
   aws secretsmanager update-secret \
     --secret-id ccw-erp/jwt-secret \
     --secret-string "$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
   ```

2. **Force application restart:**
   ```bash
   aws ecs update-service --cluster ccw-erp-cluster --service ccw-erp-service --force-new-deployment
   ```

3. **Invalidate all user sessions** (if JWT compromised):
   - New JWT secret automatically invalidates old tokens
   - Users will need to log in again

4. **Audit CloudTrail logs:**
   ```bash
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=ResourceName,AttributeValue=ccw-erp/jwt-secret \
     --max-results 50
   ```

5. **Notify security team and stakeholders**

---

## 📊 Monitoring & Alerts

### CloudWatch Alarms

**Secret Access Monitoring:**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ccw-erp-secret-access-anomaly \
  --alarm-description "Alert on unusual secret access patterns" \
  --metric-name SecretAccessCount \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### CloudTrail Logging

Ensure CloudTrail is enabled for Secrets Manager API calls:

```bash
aws cloudtrail create-trail \
  --name ccw-erp-secrets-audit \
  --s3-bucket-name ccw-erp-cloudtrail-logs
```

---

## ✅ Verification Checklist

Before production deployment:

- [ ] All 9 required secrets created in AWS Secrets Manager
- [ ] IAM policy attached to ECS task role
- [ ] Environment variable `ENVIRONMENT=production` set
- [ ] boto3 installed in production Docker image (`pip install boto3`)
- [ ] Secrets tested locally with AWS profile
- [ ] CloudWatch alarms configured
- [ ] CloudTrail logging enabled
- [ ] Secret rotation schedule configured (90 days)
- [ ] Emergency procedure documented and team trained
- [ ] No hardcoded secrets in codebase (run `git grep -i "secret.*=" | grep -v ".md"`)

---

## 📞 Support

**Questions?**
- AWS Secrets Manager Documentation: https://docs.aws.amazon.com/secretsmanager/
- Internal: Contact DevOps team (#devops Slack channel)

**Emergency?**
- On-call rotation: See PagerDuty schedule
- Security incident: security@ccw-erp.com

---

*Last reviewed: February 3, 2026*
*Next review: May 3, 2026 (quarterly)*
