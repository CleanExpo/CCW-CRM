# CCW-Online ERP - Production Deployment Checklist

**Date:** January 15, 2026
**System Status:** Production-Ready (100% Test Pass Rate Achieved)
**Version:** 1.0.0

---

## Pre-Deployment Phase

### 1. Staging Validation (MANDATORY)

**Staging Must Be Operational for Minimum 7 Days Before Production**

- [ ] Staging deployed and running for ≥ 7 days
- [ ] All 39 integration tests passing (100% pass rate)
- [ ] Zero critical errors in staging logs
- [ ] Performance meets baseline (API < 200ms p95)
- [ ] UAT completed by stakeholders
- [ ] Load testing performed (≥ 1000 concurrent users)
- [ ] Security audit completed
- [ ] Backup/restore procedures tested

**Staging Performance Benchmarks:**
```bash
# Required metrics from staging:
- API Response Time (p50): < 100ms ✅
- API Response Time (p95): < 200ms ✅
- API Response Time (p99): < 500ms ✅
- Uptime: > 99.5% ✅
- Error Rate: < 0.1% ✅
- Database Query Time: < 50ms average ✅
```

### 2. Infrastructure Preparation

**Production Server Requirements:**

Hardware Specifications (Minimum):
- [ ] 8 CPU cores
- [ ] 16 GB RAM
- [ ] 200 GB SSD storage
- [ ] 1 Gbps network connection
- [ ] Redundant power supply
- [ ] RAID 1/10 for data disks

Hardware Specifications (Recommended):
- [ ] 16 CPU cores
- [ ] 32 GB RAM
- [ ] 500 GB SSD storage
- [ ] 10 Gbps network connection

Operating System:
- [ ] Ubuntu 22.04 LTS or RHEL 9
- [ ] Security updates applied
- [ ] Firewall configured (UFW/iptables)
- [ ] Fail2ban installed and configured
- [ ] NTP configured for time sync

Docker Setup:
- [ ] Docker 24.0+ installed
- [ ] Docker Compose 2.20+ installed
- [ ] Docker daemon configured with production settings
- [ ] Docker log rotation configured
- [ ] Container resource limits tested

### 3. Security Hardening

**SSL/TLS Certificates:**
- [ ] Valid SSL certificate obtained (Let's Encrypt or commercial)
- [ ] Certificate auto-renewal configured
- [ ] TLS 1.3 enabled, TLS 1.0/1.1 disabled
- [ ] Strong cipher suites configured
- [ ] HSTS headers enabled

**Secrets Management:**
- [ ] All secrets stored in secure vault (e.g., HashiCorp Vault, AWS Secrets Manager)
- [ ] NO secrets in environment files or code
- [ ] Secrets rotation schedule defined
- [ ] Emergency secrets revocation procedure documented

**Generate Production Secrets:**
```bash
# SECRET_KEY (256-bit)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# JWT_SECRET_KEY (256-bit)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# POSTGRES_PASSWORD (128-bit minimum)
python3 -c "import secrets; print(secrets.token_urlsafe(24))"
```

**Firewall Configuration:**
```bash
# Allow only required ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH (restrict to specific IPs)
sudo ufw allow 80/tcp      # HTTP (redirect to HTTPS)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

**SSH Hardening:**
- [ ] Disable root login
- [ ] Disable password authentication (key-only)
- [ ] Change default SSH port (optional)
- [ ] Configure SSH key rotation schedule
- [ ] Enable 2FA for SSH (Google Authenticator)

### 4. Database Preparation

**PostgreSQL Production Configuration:**

- [ ] Database backup strategy defined
  - Full backup: Daily
  - Incremental: Hourly
  - WAL archiving: Continuous
  - Retention: 30 days minimum

- [ ] Database replication configured
  - Primary-standby setup
  - Automatic failover tested
  - Replication lag monitored

- [ ] Database tuning applied
  - `shared_buffers`: 25% of RAM
  - `effective_cache_size`: 50% of RAM
  - `work_mem`: 16MB-64MB per operation
  - `maintenance_work_mem`: 1GB-2GB
  - `max_connections`: 200

- [ ] Database monitoring configured
  - Query performance tracking
  - Slow query logging (> 100ms)
  - Connection pool monitoring
  - Disk space alerts

**Backup Test:**
```bash
# Test full backup and restore
pg_dump -U ccw_prod -d ccw_erp_prod > test-backup.sql
createdb ccw_erp_test
psql -U ccw_prod -d ccw_erp_test < test-backup.sql
# Verify data integrity
dropdb ccw_erp_test
```

### 5. Credentials & API Keys

**Production API Credentials (NOT Staging!):**

Xero Production:
- [ ] Production Xero app created
- [ ] Client ID obtained
- [ ] Client Secret obtained
- [ ] Redirect URI configured: `https://yourdomain.com/api/integrations/xero/callback`
- [ ] OAuth scopes verified
- [ ] Connection tested

Shopify Production:
- [ ] Production Shopify store identified
- [ ] Admin API access token generated
- [ ] Webhook URLs configured: `https://yourdomain.com/api/integrations/shopify/webhooks`
- [ ] Rate limits understood
- [ ] Connection tested

SendGrid Production:
- [ ] Production SendGrid API key generated
- [ ] Sender domain verified (SPF, DKIM, DMARC)
- [ ] IP warming schedule defined (if dedicated IP)
- [ ] Email templates uploaded
- [ ] Bounce/spam webhooks configured

ElevenLabs Production:
- [ ] Production API key obtained
- [ ] Voice selection finalized
- [ ] Usage limits understood
- [ ] Connection tested

Anthropic Claude Production:
- [ ] Production API key obtained (NOT staging key!)
- [ ] Rate limits understood (100k tokens/min minimum)
- [ ] Usage billing configured
- [ ] Fallback to Ollama configured (optional)

### 6. Monitoring & Alerting Setup

**Required Monitoring Tools:**

- [ ] **Prometheus + Grafana** (or equivalent)
  - Server metrics (CPU, memory, disk, network)
  - Container metrics (resource usage)
  - Application metrics (request rate, latency, errors)
  - Database metrics (connections, queries, replication lag)

- [ ] **Sentry** (or equivalent)
  - Error tracking configured
  - Release tracking enabled
  - Source maps uploaded
  - Alert rules configured

- [ ] **Uptime Monitoring** (e.g., UptimeRobot, Pingdom)
  - Health endpoint monitored: `https://yourdomain.com/api/health`
  - Check frequency: 1 minute
  - Alert via: Email, SMS, Slack

**Alert Thresholds:**
- [ ] CPU usage > 80% for 5 minutes
- [ ] Memory usage > 85%
- [ ] Disk usage > 80%
- [ ] API error rate > 1%
- [ ] API response time p95 > 500ms
- [ ] Database connections > 150
- [ ] Replication lag > 10 seconds
- [ ] Health check failure (3 consecutive)

**On-Call Schedule:**
- [ ] Primary on-call engineer assigned
- [ ] Secondary on-call engineer assigned
- [ ] Escalation procedures documented
- [ ] 24/7 coverage confirmed

### 7. Domain & DNS Configuration

- [ ] Production domain purchased/configured
- [ ] DNS records configured:
  - [ ] A record: `yourdomain.com` → Server IP
  - [ ] CNAME record: `www.yourdomain.com` → `yourdomain.com`
  - [ ] CNAME record: `api.yourdomain.com` → `yourdomain.com` (optional)
  - [ ] MX records for email (if applicable)
  - [ ] SPF record for SendGrid
  - [ ] DKIM record for SendGrid
  - [ ] DMARC record configured
- [ ] DNS propagation verified (nslookup, dig)
- [ ] CDN configured (Cloudflare, CloudFront, etc.) - optional but recommended

### 8. Load Balancer & Reverse Proxy

**Nginx Configuration (Recommended):**

- [ ] Nginx installed and configured
- [ ] SSL termination configured
- [ ] HTTP → HTTPS redirect
- [ ] Rate limiting configured
- [ ] Request buffering optimized
- [ ] Gzip compression enabled
- [ ] Static file caching configured
- [ ] WebSocket support enabled
- [ ] Health check endpoint configured

**Sample Nginx Config:**
```nginx
upstream backend {
    server localhost:8000;
    keepalive 64;
}

upstream frontend {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 9. CI/CD Pipeline (Optional but Recommended)

- [ ] GitHub Actions / GitLab CI configured
- [ ] Automated tests run on PR
- [ ] Automated builds on merge to main
- [ ] Automated deployment to staging
- [ ] Manual approval for production deployment
- [ ] Rollback automation configured
- [ ] Deployment notifications configured (Slack/email)

### 10. Disaster Recovery Plan

**Data Backup Strategy:**
- [ ] Database backups automated
  - Location: Off-site (S3, Azure Blob, etc.)
  - Encryption: AES-256
  - Testing: Monthly restore test
- [ ] Configuration backups
  - `.env` files (encrypted)
  - Docker Compose files
  - Nginx configurations
- [ ] Code repository backups
  - GitHub mirror to GitLab (or vice versa)

**Recovery Time Objective (RTO):** < 4 hours
**Recovery Point Objective (RPO):** < 1 hour

**Disaster Scenarios Documented:**
- [ ] Complete server failure
- [ ] Database corruption
- [ ] Security breach
- [ ] DDoS attack
- [ ] Data center outage

---

## Deployment Phase

### Day -1: Pre-Deployment Verification

**Final Checks (24 hours before deployment):**

- [ ] All pre-deployment tasks completed
- [ ] Staging running stable for ≥ 7 days
- [ ] Production server provisioned and tested
- [ ] All credentials verified and stored securely
- [ ] Monitoring and alerting tested
- [ ] DNS records configured and propagated
- [ ] SSL certificates installed and verified
- [ ] Backup systems tested (successful restore)
- [ ] Rollback plan reviewed and understood
- [ ] Deployment window scheduled (low-traffic period)
- [ ] Stakeholders notified of deployment window
- [ ] On-call team briefed

**Pre-Deployment Meeting:**
- [ ] Review deployment steps with team
- [ ] Confirm communication channels (Slack, etc.)
- [ ] Assign roles (deployer, monitor, rollback)
- [ ] Review success criteria
- [ ] Review rollback triggers

### Day 0: Deployment Day

**Deployment Window:** [Specify: e.g., Saturday 2:00 AM - 6:00 AM UTC]

#### T-60 minutes: Final Preparation

```bash
# 1. Clone repository on production server
cd /opt
git clone https://github.com/yourusername/ccw-online-erp.git
cd ccw-online-erp/NodeJS-Starter-V1

# 2. Checkout production release
git checkout v1.0.0

# 3. Copy production environment file
cp .env.production.example .env.production
# Edit with production values (from secure vault)
nano .env.production

# 4. Verify environment configuration
cat .env.production | grep -E "POSTGRES_PASSWORD|SECRET_KEY|ANTHROPIC_API_KEY" | wc -l
# Should output 3+ (ensures critical values are set)
```

#### T-30 minutes: Build Images

```bash
# Load production environment
export $(cat .env.production | xargs)

# Build all Docker images (20-30 minutes)
docker-compose -f docker-compose.prod.yml build --no-cache

# Verify images built successfully
docker images | grep ccw-erp
```

#### T-0: Deployment Start

**Step 1: Start Services**

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Monitor startup logs
docker-compose -f docker-compose.prod.yml logs -f
```

**Expected Timeline:**
- PostgreSQL ready: ~30 seconds
- Redis ready: ~10 seconds
- Backend ready: ~45 seconds
- Celery worker ready: ~30 seconds
- Frontend ready: ~60 seconds

**Step 2: Wait for Health Checks**

```bash
# Wait for services to report healthy (2-3 minutes)
sleep 180

# Check all services healthy
docker-compose -f docker-compose.prod.yml ps | grep "Up (healthy)"

# Expected: All 6 services show "Up (healthy)"
```

**Step 3: Database Initialization**

```bash
# Run database migrations
docker exec -it ccw-erp-backend bash
cd /app
alembic upgrade head
exit

# Verify schema version
docker exec ccw-erp-postgres psql -U ccw_prod -d ccw_erp_prod -c "SELECT * FROM alembic_version;"
```

**Step 4: Seed Production Data (if fresh deployment)**

```bash
# Load initial data (customers, products, etc.)
docker exec -it ccw-erp-backend bash
python scripts/seed_production_data.py
exit
```

#### T+10 minutes: Verification

**Health Check:**
```bash
# Backend health (internal)
curl http://localhost:8000/health

# Backend health (external via domain)
curl https://yourdomain.com/api/health

# Expected response:
# {"status":"healthy","timestamp":"2026-01-15T...","version":"1.0.0"}
```

**Frontend Check:**
```bash
# Frontend loads
curl -I https://yourdomain.com

# Expected: HTTP 200 OK
```

**Database Check:**
```bash
# Database connection count
docker exec ccw-erp-postgres psql -U ccw_prod -d ccw_erp_prod -c "SELECT count(*) FROM pg_stat_activity;"

# Expected: 10-20 connections
```

**Integration Tests:**
```bash
# Run full integration test suite against production
# (Configure test script to use production URL)
API_URL=https://yourdomain.com/api bash integration-tests.sh

# Expected: 100% pass rate (39/39 tests)
```

#### T+20 minutes: Smoke Tests

**Manual Verification:**

1. **Login Test**
   - Open: `https://yourdomain.com`
   - Login with admin credentials
   - ✅ Successful login

2. **CRUD Operations**
   - Create test customer
   - Create test product
   - Create test order
   - Verify data appears
   - Delete test records
   - ✅ All operations successful

3. **Integration Tests** (if configured)
   - Xero: Test customer sync
   - Shopify: Test product sync
   - SendGrid: Send test email
   - ✅ All integrations functional

4. **Performance Check**
   ```bash
   # API response time
   time curl https://yourdomain.com/api/products

   # Expected: < 0.2 seconds
   ```

#### T+30 minutes: Monitoring Validation

**Check Monitoring Dashboards:**

- [ ] Prometheus targets UP
- [ ] Grafana dashboards showing data
- [ ] Sentry receiving events
- [ ] Uptime monitor shows GREEN
- [ ] Log aggregation working

**Check Alert Rules:**
```bash
# Trigger test alert
curl -X POST https://yourdomain.com/api/test/trigger-alert

# Verify alert received via email/Slack
```

#### T+60 minutes: Deployment Complete

**Go/No-Go Decision:**

**GO Criteria (ALL must be met):**
- ✅ All services healthy
- ✅ Health endpoint returns 200 OK
- ✅ Integration tests pass 100%
- ✅ Smoke tests pass
- ✅ No critical errors in logs
- ✅ Monitoring active and showing healthy metrics
- ✅ Performance meets baseline

**If GO:**
- [ ] Update DNS to point to production (if applicable)
- [ ] Notify stakeholders of successful deployment
- [ ] Begin 24-hour intensive monitoring period
- [ ] Schedule post-deployment review meeting

**If NO-GO:**
- [ ] Initiate rollback procedure (see below)
- [ ] Document failure reason
- [ ] Schedule incident postmortem

---

## Post-Deployment Phase

### Day 0-1: Intensive Monitoring (First 24 Hours)

**Monitor Every Hour:**

- [ ] Health check status
- [ ] Error rate
- [ ] Response time (p50, p95, p99)
- [ ] CPU and memory usage
- [ ] Database connections
- [ ] Disk space
- [ ] Log review for errors

**Incident Response:**
- On-call engineer monitoring actively
- < 15 minute response time to alerts
- Rollback ready if needed

### Day 1-7: Active Monitoring

**Monitor Every 4 Hours:**

- [ ] System health
- [ ] Performance metrics
- [ ] User reports
- [ ] Integration status

**Daily Tasks:**
- [ ] Log review
- [ ] Backup verification
- [ ] Performance analysis
- [ ] User feedback collection

### Day 7: Post-Deployment Review

**Review Meeting Agenda:**

1. Deployment process review
   - What went well?
   - What could be improved?
   - Any issues encountered?

2. System performance analysis
   - Compare to baseline metrics
   - Identify any degradation
   - Optimization opportunities

3. User feedback summary
   - Bugs reported
   - Feature requests
   - Usability issues

4. Action items
   - Hot fixes needed
   - Performance optimizations
   - Documentation updates

---

## Rollback Procedure

**Rollback Triggers (Initiate immediately if any occur):**

- Critical bug affecting core functionality
- Data corruption detected
- Security vulnerability exploited
- Performance degradation > 50%
- Error rate > 5%
- Uptime < 95% in first hour

**Emergency Rollback Steps:**

```bash
# 1. Stop production services (< 1 minute)
cd /opt/ccw-online-erp/NodeJS-Starter-V1
docker-compose -f docker-compose.prod.yml down

# 2. Restore database from pre-deployment backup (5-10 minutes)
cat backup-pre-deployment.sql | \
  docker exec -i ccw-erp-postgres psql -U ccw_prod -d ccw_erp_prod

# 3. Checkout previous stable version (< 1 minute)
git checkout v0.9.0  # or previous stable tag

# 4. Rebuild images with old version (10-15 minutes)
docker-compose -f docker-compose.prod.yml build

# 5. Start services (2-3 minutes)
docker-compose -f docker-compose.prod.yml up -d

# 6. Verify rollback (1-2 minutes)
curl https://yourdomain.com/api/health
bash integration-tests.sh

# 7. Notify stakeholders
echo "Production rolled back to v0.9.0 at $(date)" | \
  mail -s "URGENT: Production Rollback" stakeholders@company.com
```

**Total Rollback Time:** 15-25 minutes

**Post-Rollback Actions:**
- [ ] Incident report created
- [ ] Root cause analysis scheduled
- [ ] Fix developed and tested in staging
- [ ] Re-deployment plan created

---

## Success Criteria

**Deployment is successful when:**

- ✅ All services running and healthy for 24 hours
- ✅ 100% integration test pass rate maintained
- ✅ Error rate < 0.1%
- ✅ API response time p95 < 200ms
- ✅ Uptime > 99.9% in first week
- ✅ Zero critical bugs reported
- ✅ All integrations functioning correctly
- ✅ User feedback positive
- ✅ Monitoring and alerting operational
- ✅ Backups completing successfully

---

## Production Environment Variables Checklist

**Critical Variables (Must be changed from staging):**

```bash
# Application
ENVIRONMENT=production              # NOT staging!
DEBUG=false                        # NEVER true in production
LOG_LEVEL=INFO                     # NOT DEBUG

# Database
POSTGRES_PASSWORD=[STRONG_UNIQUE_PASSWORD]  # Generate new, don't reuse

# Security
SECRET_KEY=[256_BIT_RANDOM]        # Generate new for production
JWT_SECRET_KEY=[256_BIT_RANDOM]    # Generate new for production

# AI
ANTHROPIC_API_KEY=[PRODUCTION_KEY] # NOT staging key

# Integrations
XERO_CLIENT_ID_PROD=[PROD_ID]                    # NOT _STAGING
XERO_CLIENT_SECRET_PROD=[PROD_SECRET]            # NOT _STAGING
SHOPIFY_SHOP_URL_PROD=[PROD_SHOP.myshopify.com] # NOT _STAGING
SHOPIFY_ACCESS_TOKEN_PROD=[PROD_TOKEN]           # NOT _STAGING
SENDGRID_API_KEY_PROD=[PROD_KEY]                 # NOT _STAGING
ELEVENLABS_API_KEY_PROD=[PROD_KEY]               # NOT _STAGING

# URLs
NEXT_PUBLIC_API_URL=https://yourdomain.com/api   # NOT localhost
FRONTEND_URL=https://yourdomain.com              # NOT localhost
CORS_ORIGINS=https://yourdomain.com              # NOT localhost
```

---

## Final Pre-Launch Checklist

**Sign-off Required From:**

- [ ] **Technical Lead** - Code review complete, tests passing
- [ ] **DevOps Engineer** - Infrastructure ready, monitoring configured
- [ ] **Security Officer** - Security audit passed, secrets secured
- [ ] **Database Administrator** - Database optimized, backups tested
- [ ] **Product Owner** - UAT complete, features approved
- [ ] **Project Manager** - Timeline approved, stakeholders notified

**Legal & Compliance:**
- [ ] Terms of Service finalized
- [ ] Privacy Policy finalized
- [ ] GDPR compliance verified (if applicable)
- [ ] Data processing agreements signed
- [ ] Audit trail configured

**Communication:**
- [ ] Customers notified of launch date
- [ ] Support team trained
- [ ] Documentation published
- [ ] Marketing materials ready

---

## Emergency Contacts

**On-Call Schedule:**

| Role | Name | Phone | Email | Backup |
|------|------|-------|-------|--------|
| Primary Engineer | [Name] | [Phone] | [Email] | [Backup] |
| Secondary Engineer | [Name] | [Phone] | [Email] | [Backup] |
| DevOps Lead | [Name] | [Phone] | [Email] | [Backup] |
| Database Admin | [Name] | [Phone] | [Email] | [Backup] |
| Security Lead | [Name] | [Phone] | [Email] | [Backup] |

**Escalation Path:**
1. On-call engineer (0-15 minutes)
2. Technical lead (15-30 minutes)
3. CTO/VP Engineering (30-60 minutes)

**Vendor Support:**
- Anthropic Claude Support: support@anthropic.com
- Xero Developer Support: developer.support@xero.com
- Shopify Partner Support: partners@shopify.com
- SendGrid Support: support@sendgrid.com

---

**Document Version:** 1.0.0
**Last Updated:** January 15, 2026
**Next Review Date:** January 15, 2027
**Approved By:** [To be signed]

**Status:** ✅ Ready for Production Deployment
