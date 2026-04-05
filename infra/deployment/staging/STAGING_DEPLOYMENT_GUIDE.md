# Staging Deployment Guide - CCW-Online ERP

Complete guide for deploying CCW-Online ERP to staging environment.

## Overview

**Objective:** Deploy application to staging environment and validate production readiness

**Success Criteria:**

- ✅ 99.9% uptime for 7 consecutive days
- ✅ Zero P0 incidents
- ✅ All monitoring operational
- ✅ Load balancer health checks passing
- ✅ SSL certificates configured
- ✅ Rollback plan tested

**Timeline:**

- Day 0: Initial deployment
- Day 1-7: Stability monitoring
- Day 7: Go/No-Go decision for production

---

## Prerequisites

### Infrastructure Requirements

**Server Specifications:**

- **OS:** Ubuntu 22.04 LTS
- **CPU:** 4 cores minimum (8 cores recommended)
- **Memory:** 8GB minimum (16GB recommended)
- **Storage:** 100GB SSD minimum (200GB recommended)
- **Network:** 100Mbps minimum bandwidth

**Services Required:**

- Docker 24.0+
- Docker Compose 2.20+
- Nginx 1.24+
- Certbot (for SSL)
- Git
- UFW (firewall)

### DNS Configuration

Create DNS records for staging:

```
staging.ccw-erp.com     →  A record to server IP
api.staging.ccw-erp.com →  A record to server IP
```

### Access Requirements

- SSH access to staging server
- Domain control for SSL certificate
- AWS credentials (for Secrets Manager)
- Docker Hub access (if using private images)

---

## Part 1: Server Provisioning

### Step 1.1: Initial Server Setup

```bash
# SSH into server
ssh ubuntu@staging-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    curl \
    git \
    wget \
    vim \
    htop \
    net-tools \
    ufw

# Set timezone
sudo timedatectl set-timezone UTC

# Set hostname
sudo hostnamectl set-hostname ccw-erp-staging
```

### Step 1.2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
docker compose version
```

### Step 1.3: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify installation
nginx -v
sudo systemctl status nginx
```

### Step 1.4: Configure Firewall

```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Enable firewall
sudo ufw --force enable

# Verify status
sudo ufw status verbose
```

---

## Part 2: SSL Certificate Setup

### Step 2.1: Install Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Verify installation
certbot --version
```

### Step 2.2: Obtain SSL Certificate

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone \
    -d staging.ccw-erp.com \
    -d api.staging.ccw-erp.com \
    --email admin@ccw-erp.com \
    --agree-tos \
    --non-interactive

# Start Nginx
sudo systemctl start nginx

# Verify certificate
sudo ls -la /etc/letsencrypt/live/staging.ccw-erp.com/
```

### Step 2.3: Configure Auto-Renewal

```bash
# Test renewal process
sudo certbot renew --dry-run

# Renewal cron job is automatically created
# Verify:
sudo systemctl list-timers | grep certbot
```

---

## Part 3: Application Deployment

### Step 3.1: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/ccw-erp
sudo chown $USER:$USER /opt/ccw-erp

# Clone repository
cd /opt/ccw-erp
git clone https://github.com/your-org/ccw-online-erp.git .

# Checkout specific release
git checkout tags/v1.0.0  # Or specific commit
```

### Step 3.2: Configure Environment Variables

```bash
# Create .env file
cd /opt/ccw-erp
cp .env.example .env.staging

# Edit environment variables
vim .env.staging
```

**Required Environment Variables:**

```bash
# Environment
ENVIRONMENT=staging
DEBUG=false

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ccw_erp_staging

# JWT
JWT_SECRET_KEY=<generate-secure-256-bit-key>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SendGrid
SENDGRID_API_KEY=SG...

# Sentry
SENTRY_DSN=https://...@sentry.io/...
SENTRY_RELEASE=v1.0.0

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# CORS
CORS_ORIGINS=["https://staging.ccw-erp.com"]

# Secrets Manager (Production)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

### Step 3.3: Generate Production Secrets

```bash
# Generate JWT secret (256-bit)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate webhook secret
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Update .env.staging with generated secrets
```

### Step 3.4: Deploy Application Stack

```bash
# Navigate to project root
cd /opt/ccw-erp

# Build and start services
docker compose -f docker-compose.staging.yml up -d

# Verify all services are running
docker compose -f docker-compose.staging.yml ps

# Check logs
docker compose -f docker-compose.staging.yml logs -f
```

---

## Part 4: Nginx Configuration

### Step 4.1: Configure Load Balancer

```bash
# Create Nginx configuration
sudo vim /etc/nginx/sites-available/ccw-erp-staging

# Enable site
sudo ln -s /etc/nginx/sites-available/ccw-erp-staging /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

**Nginx configuration file:** See `deployment/nginx/staging.conf`

### Step 4.2: Verify Load Balancer

```bash
# Test HTTP → HTTPS redirect
curl -I http://staging.ccw-erp.com

# Test HTTPS
curl -I https://staging.ccw-erp.com

# Test API endpoint
curl -I https://api.staging.ccw-erp.com/api/health
```

---

## Part 5: Monitoring Setup

### Step 5.1: Deploy Monitoring Stack

```bash
cd /opt/ccw-erp/monitoring

# Configure environment
cp .env.example .env.monitoring
vim .env.monitoring

# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Verify services
docker compose -f docker-compose.monitoring.yml ps
```

### Step 5.2: Configure Grafana

```bash
# Access Grafana
# http://staging.ccw-erp.com:3001

# Login: admin / (password from .env.monitoring)

# Import dashboards:
# 1. Navigate to Dashboards → Import
# 2. Upload: monitoring/grafana/dashboards/api-performance-dashboard.json
# 3. Select Prometheus datasource
# 4. Import
```

### Step 5.3: Verify Monitoring

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Check alerts
curl http://localhost:9090/api/v1/alerts

# Test Sentry
python3 -c "import sentry_sdk; sentry_sdk.init('your-dsn'); sentry_sdk.capture_message('Staging deployment test')"
```

---

## Part 6: Smoke Tests

### Step 6.1: API Health Check

```bash
# Backend health
curl https://api.staging.ccw-erp.com/api/health

# Expected response:
# {"status":"healthy","environment":"staging"}
```

### Step 6.2: Database Connection

```bash
# Check database connectivity
docker compose -f docker-compose.staging.yml exec backend \
    python -c "from src.config.database import test_connection; test_connection()"
```

### Step 6.3: Authentication Flow

```bash
# Test login
curl -X POST https://api.staging.ccw-erp.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@demo.com","password":"demo123"}'

# Should return JWT token
```

### Step 6.4: Run Full Smoke Test Suite

```bash
cd /opt/ccw-erp

# Run smoke tests
./deployment/scripts/smoke-tests.sh https://api.staging.ccw-erp.com
```

---

## Part 7: 7-Day Stability Monitoring

### Day 0: Initial Deployment

**Tasks:**

- ✅ Deploy application
- ✅ Configure monitoring
- ✅ Run smoke tests
- ✅ Verify all services healthy

**Monitoring:**

- Check dashboards every 2 hours
- Monitor error rates
- Review logs for warnings

### Day 1-6: Continuous Monitoring

**Daily Tasks:**

- [ ] Check Grafana dashboards (morning & evening)
- [ ] Review Sentry errors
- [ ] Check disk space
- [ ] Verify SSL certificate expiry
- [ ] Review application logs
- [ ] Check database performance

**Metrics to Track:**

```
Date: ___________
Uptime: _____%
Error Rate: _____%
p95 Response Time: _____ms
Incidents: _____
```

### Day 7: Go/No-Go Decision

**Go-Live Checklist:**

- [ ] 99.9% uptime achieved (max 43 seconds downtime)
- [ ] Zero P0 incidents
- [ ] Error rate <1%
- [ ] p95 response time <500ms
- [ ] All monitoring operational
- [ ] Rollback plan tested
- [ ] Team trained

**Decision:**

- ✅ GO: Proceed to production deployment
- ❌ NO-GO: Investigate issues, extend monitoring period

---

## Part 8: Rollback Procedures

### Rollback Scenario 1: Application Issue

```bash
# Stop current deployment
docker compose -f docker-compose.staging.yml down

# Checkout previous version
git checkout tags/v0.9.0  # Previous stable version

# Rebuild and restart
docker compose -f docker-compose.staging.yml up -d --build

# Verify rollback
curl https://api.staging.ccw-erp.com/api/health
```

### Rollback Scenario 2: Database Migration Issue

```bash
# Restore database from backup
docker compose -f docker-compose.staging.yml exec postgres \
    psql -U starter_user -d starter_db_staging < backup_YYYYMMDD.sql

# Restart application
docker compose -f docker-compose.staging.yml restart backend
```

### Rollback Scenario 3: Configuration Issue

```bash
# Restore previous configuration
cp .env.staging.backup .env.staging

# Restart services
docker compose -f docker-compose.staging.yml restart
```

---

## Part 9: Troubleshooting

### Problem: Application won't start

**Symptoms:** Docker containers keep restarting

**Diagnosis:**

```bash
# Check container logs
docker compose -f docker-compose.staging.yml logs backend

# Check container status
docker compose -f docker-compose.staging.yml ps
```

**Common Causes:**

1. Database connection failure
2. Missing environment variables
3. Port conflicts
4. Insufficient memory

**Solution:**

```bash
# Verify database is running
docker compose -f docker-compose.staging.yml logs postgres

# Check environment variables
docker compose -f docker-compose.staging.yml config

# Check memory usage
free -h
docker stats
```

### Problem: High error rate

**Symptoms:** Error rate >5%

**Diagnosis:**

```bash
# Check Sentry for errors
# Navigate to: https://sentry.io/your-project

# Check application logs
docker compose -f docker-compose.staging.yml logs backend | grep ERROR

# Check Grafana dashboards
# Navigate to: http://staging.ccw-erp.com:3001
```

**Solution:**

1. Identify error pattern
2. Check related code changes
3. Review recent deployments
4. Consider rollback if critical

### Problem: Slow response times

**Symptoms:** p95 >500ms

**Diagnosis:**

```bash
# Check database slow queries
docker compose -f docker-compose.staging.yml exec postgres \
    psql -U starter_user -d starter_db_staging -c \
    "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check CPU usage
top

# Check memory usage
free -h
```

**Solution:**

1. Add missing database indexes
2. Enable Redis caching
3. Optimize slow queries
4. Scale horizontally if needed

---

## Part 10: Deployment Checklist

### Pre-Deployment Checklist

- [ ] Server provisioned (Ubuntu 22.04, 8GB RAM, 4 cores)
- [ ] DNS records configured
- [ ] SSL certificate obtained
- [ ] Firewall configured (SSH, HTTP, HTTPS)
- [ ] Docker installed and running
- [ ] Nginx installed and running
- [ ] Environment variables configured
- [ ] Production secrets generated
- [ ] Repository cloned
- [ ] Monitoring stack configured

### Deployment Checklist

- [ ] Application deployed via Docker Compose
- [ ] All containers running
- [ ] Database migrations applied
- [ ] Nginx load balancer configured
- [ ] Health check endpoint responding
- [ ] Authentication working
- [ ] Smoke tests passing
- [ ] Monitoring dashboards operational
- [ ] Alerting configured
- [ ] Logs accessible

### Post-Deployment Checklist

- [ ] 24-hour stability verified
- [ ] Error rate <1%
- [ ] p95 response time <500ms
- [ ] Uptime >99.9%
- [ ] Rollback plan tested
- [ ] Team notified
- [ ] Documentation updated

### 7-Day Stability Checklist

- [ ] Day 1: Uptime **_%, Incidents: _**
- [ ] Day 2: Uptime **_%, Incidents: _**
- [ ] Day 3: Uptime **_%, Incidents: _**
- [ ] Day 4: Uptime **_%, Incidents: _**
- [ ] Day 5: Uptime **_%, Incidents: _**
- [ ] Day 6: Uptime **_%, Incidents: _**
- [ ] Day 7: Uptime **_%, Incidents: _**

**Overall Uptime:** **\_**%
**Decision:** GO / NO-GO

---

## Appendix A: Server Access

**SSH Access:**

```bash
ssh ubuntu@staging-server-ip
# Or
ssh ubuntu@staging.ccw-erp.com
```

**Application Paths:**

- Application: `/opt/ccw-erp`
- Logs: `/var/log/ccw-erp/`
- Backups: `/var/backups/ccw-erp/`
- SSL Certificates: `/etc/letsencrypt/live/staging.ccw-erp.com/`

**Service Endpoints:**

- Frontend: https://staging.ccw-erp.com
- API: https://api.staging.ccw-erp.com
- Health Check: https://api.staging.ccw-erp.com/api/health
- Grafana: http://staging.ccw-erp.com:3001
- Prometheus: http://staging.ccw-erp.com:9090

---

## Appendix B: Emergency Contacts

**On-Call Rotation:**

- Week 1: Developer A (phone, email)
- Week 2: Developer B (phone, email)
- Escalation: Team Lead (phone, email)

**Notification Channels:**

- Slack: #ccw-erp-critical
- Email: ops@ccw-erp.com
- PagerDuty: (if configured)

---

## Appendix C: Maintenance Windows

**Scheduled Maintenance:**

- Day: Sunday
- Time: 2:00 AM - 6:00 AM UTC
- Frequency: Monthly
- Notification: 48 hours advance

**Emergency Maintenance:**

- Approval: Team Lead
- Notification: Immediate
- Duration: As needed

---

**Last Updated:** February 3, 2026
**Document Owner:** DevOps Team
**Review Frequency:** Monthly
**Next Review:** March 3, 2026
