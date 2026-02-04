# Production Runbook - CCW-Online ERP

This runbook provides step-by-step instructions for deploying and maintaining CCW-Online ERP in production.

## Pre-Deployment Checklist

- [ ] All 11 security hardening tasks completed
- [ ] Secrets generated with `scripts/generate-secrets.py`
- [ ] Secrets stored in AWS Secrets Manager
- [ ] SendGrid API key configured
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] Firewall rules configured
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] Load testing completed

---

## Deployment Steps

### 1. Server Setup (Ubuntu 20.04+)

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y \
    docker.io \
    docker-compose \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw

# Enable Docker
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. Firewall Configuration

```bash
# Run firewall setup script
sudo bash scripts/configure-firewall.sh

# Verify rules
sudo ufw status numbered

# CRITICAL: Restrict SSH to your IP only
sudo ufw delete allow 22/tcp
sudo ufw allow from YOUR_IP_ADDRESS to any port 22 proto tcp
```

### 3. SSL Certificate Setup

```bash
# Install Let's Encrypt certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### 4. Environment Configuration

```bash
# Create production environment file
cp .env.production.example .env.production

# Load secrets from AWS Secrets Manager
export USE_AWS_SECRETS=true
export AWS_SECRET_NAME=ccw-erp/production
export AWS_REGION=us-east-1
```

### 5. Database Setup

```bash
# Start PostgreSQL via Docker
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for PostgreSQL to be ready
sleep 10

# Run migrations
cd apps/backend
alembic upgrade head

# Verify database
psql -h localhost -U ccw_erp_user -d ccw_erp_prod -c "SELECT version();"
```

### 6. Application Deployment

```bash
# Build containers
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify services
docker-compose ps
```

### 7. Nginx Configuration

```bash
# Configure nginx as reverse proxy
sudo nano /etc/nginx/sites-available/ccw-erp

# Add configuration:
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/ccw-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Monitoring Setup

```bash
# Install monitoring agents
# (CloudWatch, Datadog, or preferred solution)

# Configure log aggregation
# Forward logs to CloudWatch Logs or equivalent
```

---

## Common Operations

### View Application Logs

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f web

# PostgreSQL logs
docker-compose logs -f postgres

# All logs
docker-compose logs -f
```

### Restart Services

```bash
# Restart backend only
docker-compose restart backend

# Restart all services
docker-compose restart

# Hard restart (rebuild)
docker-compose down
docker-compose up -d
```

### Database Backup

```bash
# Manual backup
docker exec postgres pg_dump -U ccw_erp_user ccw_erp_prod > backup-$(date +%Y%m%d-%H%M%S).sql

# Automated daily backups (add to crontab)
0 2 * * * /opt/ccw-erp/scripts/backup-database.sh
```

### Database Restore

```bash
# Stop application
docker-compose stop backend

# Restore from backup
cat backup-20260202-120000.sql | docker exec -i postgres psql -U ccw_erp_user ccw_erp_prod

# Restart application
docker-compose start backend
```

### Secret Rotation

```bash
# Generate new secrets
python scripts/generate-secrets.py > new-secrets.txt

# Update AWS Secrets Manager
aws secretsmanager put-secret-value \
    --secret-id ccw-erp/production \
    --secret-string file://new-secrets.json

# Restart services to load new secrets
docker-compose restart
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database connection failed → Check DATABASE_URL
# 2. Missing secrets → Verify AWS_SECRET_NAME
# 3. Port conflict → Check if port 8000 in use
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Test connection
docker exec postgres pg_isready -U ccw_erp_user

# Check credentials
docker exec -it postgres psql -U ccw_erp_user -d ccw_erp_prod
```

### High Memory Usage

```bash
# Check container resources
docker stats

# Increase memory limits in docker-compose.yml
# backend:
#   deploy:
#     resources:
#       limits:
#         memory: 2G
```

### SSL Certificate Renewal Failed

```bash
# Manual renewal
sudo certbot renew --force-renewal

# Check nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Application Health**
   - HTTP 5xx error rate < 0.1%
   - Response time p95 < 500ms
   - Request rate (baseline for anomaly detection)

2. **Database**
   - Connection pool utilization < 80%
   - Query execution time p95 < 100ms
   - Disk space usage < 80%

3. **Infrastructure**
   - CPU usage < 70%
   - Memory usage < 80%
   - Disk I/O < 80%

4. **Security**
   - Failed login attempts
   - Rate limit violations
   - Invalid webhook signatures

### Alert Thresholds

- **Critical**: HTTP 5xx rate > 1%, Database down, Disk space > 90%
- **High**: Response time p95 > 1s, Memory > 90%, CPU > 90%
- **Medium**: Failed logins > 100/hour, Rate limit violations > 500/hour

---

## Disaster Recovery

### System Down

1. Check system status: `systemctl status docker nginx`
2. Check container health: `docker-compose ps`
3. Review logs: `docker-compose logs --tail=100`
4. Restart services: `docker-compose restart`
5. If persistent, restore from backup

### Data Corruption

1. Stop application immediately
2. Identify affected data
3. Restore from most recent backup
4. Replay transactions if possible
5. Verify data integrity

### Security Breach

1. **Immediate**: Revoke all tokens, disable accounts
2. **Contain**: Isolate affected systems
3. **Investigate**: Review logs, identify entry point
4. **Remediate**: Patch vulnerability, rotate secrets
5. **Notify**: Inform stakeholders, regulators if required

---

## Maintenance Windows

### Scheduled Maintenance

- **Frequency**: Monthly (first Sunday, 2:00 AM - 4:00 AM UTC)
- **Duration**: 2 hours maximum
- **Notification**: 1 week advance notice to users

### Maintenance Checklist

- [ ] Backup database
- [ ] Update application (docker images)
- [ ] Run database migrations
- [ ] Update SSL certificates if needed
- [ ] Review and rotate secrets if scheduled
- [ ] Test critical workflows
- [ ] Verify monitoring and alerts

---

## Contact Information

### Escalation Matrix

| Issue | Contact | Phone | Email |
|-------|---------|-------|-------|
| Application Down | On-Call Engineer | +1-XXX-XXX-XXXX | oncall@company.com |
| Security Incident | Security Team | +1-XXX-XXX-XXXX | security@company.com |
| Database Issues | DBA Team | +1-XXX-XXX-XXXX | dba@company.com |

---

## Appendix A: Environment Variables

See `.env.production.example` for complete list.

---

## Appendix B: Port Reference

| Service | Port | Access |
|---------|------|--------|
| Frontend (Next.js) | 3000 | Nginx only |
| Backend (FastAPI) | 8000 | Nginx only |
| PostgreSQL | 5432 | Localhost only |
| Redis | 6379 | Localhost only |
| Nginx | 80, 443 | Public |

---

**Runbook Version**: 1.0
**Last Updated**: 2026-02-02
