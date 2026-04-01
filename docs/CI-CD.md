# CI/CD Pipeline Documentation

Complete guide for the CCW-Online ERP CI/CD pipeline.

## Overview

The CI/CD pipeline automates testing, building, and deployment of the CCW-Online ERP application. It consists of four main workflows:

1. **CI (Continuous Integration)** - Automated testing on every push/PR
2. **Deploy to Staging** - Auto-deploy to staging on merge to main
3. **Deploy to Production** - Manual trigger with approval gates
4. **Emergency Rollback** - Quick revert on failures

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Push/PR    │───▶│     CI       │───▶│   Tests      │          │
│  │   to main    │    │   Workflow   │    │   Pass?      │          │
│  └──────────────┘    └──────────────┘    └──────┬───────┘          │
│                                                  │                   │
│                                         ┌───────▼───────┐           │
│                                         │ Build Docker  │           │
│                                         │   Images      │           │
│                                         └───────┬───────┘           │
│                                                 │                    │
│  ┌──────────────────────────────────────────────▼───────────────┐   │
│  │                    Deploy to Staging                          │   │
│  │  • Push images to GHCR                                        │   │
│  │  • SSH deploy to staging server                               │   │
│  │  • Run smoke tests                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Deploy to Production                       │   │
│  │  • Manual trigger required                                    │   │
│  │  • Requires confirmation checkboxes                          │   │
│  │  • GitHub Environment approval                                │   │
│  │  • Auto-rollback on health check failure                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Emergency Rollback                         │   │
│  │  • Manual trigger                                             │   │
│  │  • Code and/or database rollback                             │   │
│  │  • Requires "ROLLBACK" confirmation                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `ai-updates` branches
- Pull requests to `main` or `ai-updates` branches

**Jobs:**

| Job | Description | Duration |
|-----|-------------|----------|
| `backend-tests` | Run pytest with PostgreSQL & Redis | ~3 min |
| `frontend-tests` | Run Vitest unit tests | ~2 min |
| `build` | Build Next.js application | ~3 min |
| `docker-build` | Build Docker images (push only) | ~5 min |
| `e2e-tests` | Run Playwright E2E tests | ~5 min |
| `accessibility-tests` | Run accessibility tests | ~3 min |
| `ci-summary` | Generate summary report | ~1 min |

**Success Criteria:**
- All tests pass
- Type checking passes
- Linting passes
- Docker images build successfully

### 2. Deploy to Staging (`.github/workflows/deploy-staging.yml`)

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Jobs:**

1. **validate** - Verify version exists
2. **test** - Run full test suite
3. **build-images** - Build and push to GHCR
4. **deploy** - SSH deploy to staging server
5. **smoke-tests** - Verify deployment
6. **notify** - Send Slack notification

**Deployment Process:**
```bash
1. Create database backup
2. Pull latest code from Git
3. Pull Docker images from GHCR
4. Stop current services
5. Start new services
6. Run database migrations
7. Verify health checks
8. Run smoke tests
```

### 3. Deploy to Production (`.github/workflows/deploy-production.yml`)

**Triggers:**
- Manual workflow dispatch only

**Required Inputs:**
- `version` - Git tag or commit SHA
- `confirm_staging_tested` - Must be checked
- `confirm_rollback_plan` - Must be checked

**Safety Features:**
- GitHub Environment approval required
- Must confirm staging was tested
- Must confirm rollback plan exists
- Automatic rollback on health check failure
- Creates pre-deployment backup

### 4. Emergency Rollback (`.github/workflows/rollback.yml`)

**Triggers:**
- Manual workflow dispatch only

**Inputs:**
- `environment` - staging or production
- `rollback_type` - code_only, code_and_database, or database_only
- `version` - Target version (optional, defaults to previous)
- `backup_file` - Database backup to restore (optional)
- `confirm_rollback` - Must type "ROLLBACK"

## Required GitHub Secrets

### Authentication Secrets

| Secret | Description | Required For |
|--------|-------------|--------------|
| `STAGING_SSH_KEY` | Private SSH key for staging | Staging deploy |
| `STAGING_SSH_HOST` | Staging server hostname | Staging deploy |
| `STAGING_SSH_USER` | SSH username | Staging deploy |
| `PRODUCTION_SSH_KEY` | Private SSH key for production | Production deploy |
| `PRODUCTION_SSH_HOST` | Production server hostname | Production deploy |
| `PRODUCTION_SSH_USER` | SSH username | Production deploy |

### Application Secrets

| Secret | Description | Required For |
|--------|-------------|--------------|
| `STAGING_API_URL` | Staging API URL | Docker build |
| `PRODUCTION_API_URL` | Production API URL | Docker build |
| `SLACK_WEBHOOK_URL` | Slack notifications | Notifications |

### Environment Variables (Set on Server)

These should be set in `.env` files on the deployment servers:

```bash
# Database
POSTGRES_USER=starter_user
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=starter_db

# Redis
REDIS_PASSWORD=<secure-password>

# JWT
JWT_SECRET_KEY=<256-bit-key>

# External Services
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG...
SENTRY_DSN=https://...

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Setting Up GitHub Secrets

### Method 1: GitHub Web Interface

1. Navigate to your repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret

### Method 2: GitHub CLI

```bash
# Authentication secrets
gh secret set STAGING_SSH_KEY < ~/.ssh/staging_key
gh secret set STAGING_SSH_HOST -b "staging.ccw-erp.com"
gh secret set STAGING_SSH_USER -b "ubuntu"

gh secret set PRODUCTION_SSH_KEY < ~/.ssh/production_key
gh secret set PRODUCTION_SSH_HOST -b "ccw-erp.com"
gh secret set PRODUCTION_SSH_USER -b "ubuntu"

# Application secrets
gh secret set STAGING_API_URL -b "https://api.staging.ccw-erp.com"
gh secret set PRODUCTION_API_URL -b "https://api.ccw-erp.com"
gh secret set SLACK_WEBHOOK_URL -b "https://hooks.slack.com/..."
```

## GitHub Environments

Create two environments with protection rules:

### Staging Environment

1. Go to **Settings** → **Environments**
2. Click **New environment** → Name: `staging`
3. No required reviewers (auto-deploy)
4. Add deployment branches: `main`

### Production Environment

1. Go to **Settings** → **Environments**
2. Click **New environment** → Name: `production`
3. **Required reviewers:** Add team members who can approve
4. **Wait timer:** 0 minutes (or add delay if desired)
5. Add deployment branches: `main`, tags: `v*`

## Deployment Commands

### Deploy to Staging

```bash
# Automatic: Push to main
git push origin main

# Manual: Trigger workflow
gh workflow run deploy-staging.yml
```

### Deploy to Production

```bash
# Via GitHub UI
# 1. Go to Actions → Deploy to Production
# 2. Click "Run workflow"
# 3. Enter version (e.g., v1.2.0 or commit SHA)
# 4. Check both confirmation boxes
# 5. Click "Run workflow"

# Via GitHub CLI
gh workflow run deploy-production.yml \
  -f version=v1.2.0 \
  -f confirm_staging_tested=true \
  -f confirm_rollback_plan=true
```

### Emergency Rollback

```bash
# Via GitHub UI
# 1. Go to Actions → Emergency Rollback
# 2. Click "Run workflow"
# 3. Select environment (staging/production)
# 4. Select rollback type
# 5. Type "ROLLBACK" to confirm
# 6. Click "Run workflow"

# Via GitHub CLI
gh workflow run rollback.yml \
  -f environment=staging \
  -f rollback_type=code_only \
  -f confirm_rollback=ROLLBACK
```

## Health Checks

### Automated Health Checks

The pipeline runs health checks at multiple stages:

1. **After deployment** - Basic endpoint availability
2. **Smoke tests** - API functionality
3. **Continuous monitoring** - External monitoring

### Manual Health Check

```bash
# Run health check script
./scripts/health-check.sh https://api.staging.ccw-erp.com

# Quick health check
curl https://api.staging.ccw-erp.com/api/health
```

### Expected Health Response

```json
{
  "status": "healthy",
  "timestamp": "2026-02-12T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "environment": "staging"
}
```

## Rollback Procedures

### Automatic Rollback

Production deployments automatically rollback if:
- Health checks fail after 15 attempts
- Services don't become healthy within 5 minutes

### Manual Rollback Steps

#### Code-Only Rollback

```bash
# On server
cd /opt/ccw-erp
git checkout <previous-version>
docker compose -f docker-compose.staging.yml down
docker compose -f docker-compose.staging.yml up -d
```

#### Database Rollback

```bash
# List available backups
ls -la /var/backups/ccw-erp/

# Restore specific backup
docker compose exec postgres \
  psql -U starter_user -d starter_db < /var/backups/ccw-erp/backup_20260210.sql
```

#### Full Rollback (Code + Database)

Use the Emergency Rollback workflow with `rollback_type=code_and_database`.

## Monitoring Deployments

### GitHub Actions UI

- View workflow runs: `https://github.com/<org>/<repo>/actions`
- Check deployment status
- View logs for each job
- Download artifacts

### Slack Notifications

Deployments send notifications to configured Slack channel:
- Deployment started
- Deployment succeeded/failed
- Rollback initiated

### Grafana Dashboards

Access deployment metrics:
- Staging: `http://staging.ccw-erp.com:3001`
- Production: `http://ccw-erp.com:3001`

## Troubleshooting

### Common Issues

#### SSH Connection Failed

```
Error: Cannot connect to staging server via SSH
```

**Solution:**
1. Verify SSH key is correct in GitHub Secrets
2. Check server firewall allows GitHub Actions IPs
3. Verify SSH user has correct permissions

#### Docker Build Failed

```
Error: failed to build image
```

**Solution:**
1. Check Dockerfile syntax
2. Verify all dependencies are available
3. Check disk space on runner

#### Health Check Failed

```
Error: Health check failed after 15 attempts
```

**Solution:**
1. Check container logs: `docker compose logs backend`
2. Verify environment variables are set
3. Check database connection

#### Database Migration Failed

```
Error: Database migration failed
```

**Solution:**
1. Check migration files
2. Verify database is healthy
3. Review migration logs

### Debug Mode

Enable verbose logging:

```yaml
# In workflow file
- name: Deploy
  run: |
    set -x  # Enable debug mode
    ./deployment/scripts/deploy-staging.sh
```

## Best Practices

### Pre-Deployment

1. Always test on staging first
2. Review database migrations
3. Check for breaking changes
4. Prepare rollback plan

### During Deployment

1. Monitor logs in real-time
2. Watch error tracking (Sentry)
3. Check health endpoints

### Post-Deployment

1. Run smoke tests
2. Monitor error rates
3. Verify key functionality
4. Document changes

## Security Considerations

1. **SSH Keys** - Use dedicated deploy keys, rotate regularly
2. **Secrets** - Never commit secrets, use GitHub Secrets
3. **Access** - Limit who can approve production deployments
4. **Audit** - GitHub Actions logs all deployments
5. **Network** - Use private networks between containers

## Related Documentation

- [Staging Deployment Guide](../deployment/staging/STAGING_DEPLOYMENT_GUIDE.md)
- [Operations Runbook](../deployment/OPERATIONS_RUNBOOK.md)
- [GitHub Secrets Reference](../.github/SECRETS.md)

---

**Last Updated:** February 12, 2026
**Document Owner:** DevOps Team
**Review Frequency:** Monthly
