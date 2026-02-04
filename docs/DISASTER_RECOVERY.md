# Disaster Recovery Procedures

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-016

---

## Overview

This document provides step-by-step disaster recovery procedures for CCW-Online ERP. It covers various failure scenarios, recovery objectives, and detailed restoration procedures.

## Recovery Objectives

| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| **RTO** (Recovery Time Objective) | 4 hours | 2-8 hours |
| **RPO** (Recovery Point Objective) | 1 hour | 0-4 hours |
| **Service Uptime** | 99.9% | 99.5-99.95% |
| **Data Loss Tolerance** | Minimal | < 4 hours |

## Disaster Scenarios

### 1. Database Corruption
### 2. Complete Server Failure
### 3. Accidental Data Deletion
### 4. Ransomware Attack
### 5. Network Outage
### 6. Application Crash

---

## Scenario 1: Database Corruption

### Symptoms
- Database queries failing
- Data integrity errors
- PostgreSQL crashes on startup
- Corrupted index files

### Impact
- **Severity**: Critical
- **Service Availability**: Down
- **Data at Risk**: All database data

### Recovery Procedure

#### Step 1: Assess the Damage

```bash
# Check PostgreSQL logs
sudo tail -100 /var/log/postgresql/postgresql-15-main.log

# Check database connectivity
pg_isready -h localhost -U ccw_user

# Attempt to connect to database
psql -h localhost -U ccw_user -d ccw_production
```

#### Step 2: Stop Application Services

```bash
# Stop Docker containers
cd /opt/ccw-online-erp
docker compose down

# Or stop systemd services
sudo systemctl stop ccw-frontend
sudo systemctl stop ccw-backend
```

#### Step 3: Identify Latest Valid Backup

```bash
# List available backups from S3
aws s3 ls s3://ccw-online-erp-backups/database/full/ --recursive | tail -20

# Download backup metadata
aws s3 cp s3://ccw-online-erp-backups/database/full/backup_full_YYYYMMDD_HHMMSS.sql.gz.gpg.sha256 /tmp/
```

#### Step 4: Restore from Backup

```bash
# Run restore script
cd /opt/ccw-online-erp
sudo ./scripts/restore-backup.sh backup_full_20260202_020000.sql.gz.gpg

# Follow prompts and confirm restore
```

#### Step 5: Verify Database Integrity

```bash
# Connect to database
psql -h localhost -U ccw_user -d ccw_production

# Run integrity checks
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM orders;

# Check for corruption
\dt+  -- List tables with sizes
```

#### Step 6: Replay WAL Files (Point-in-Time Recovery)

If you need to recover to a specific point in time:

```bash
# List available WAL files
aws s3 ls s3://ccw-online-erp-backups/database/wal/ --recursive

# Download WAL files
aws s3 sync s3://ccw-online-erp-backups/database/wal/ /tmp/wal-restore/

# Configure PostgreSQL for PITR
# Edit /var/lib/postgresql/15/main/postgresql.conf
restore_command = 'cp /tmp/wal-restore/%f %p'
recovery_target_time = '2026-02-02 14:30:00'

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Step 7: Restart Application Services

```bash
# Start Docker containers
cd /opt/ccw-online-erp
docker compose up -d

# Or start systemd services
sudo systemctl start ccw-backend
sudo systemctl start ccw-frontend
```

#### Step 8: Verify Application Functionality

```bash
# Test health endpoints
curl https://api.ccw-online.com/health
curl https://ccw-online.com

# Check application logs
docker logs ccw-backend
docker logs ccw-frontend
```

### Expected Recovery Time
- **Assessment**: 15 minutes
- **Restore**: 1-2 hours (depending on database size)
- **Verification**: 30 minutes
- **Total RTO**: 2-3 hours

### Post-Recovery Actions
- [ ] Document the incident
- [ ] Investigate root cause of corruption
- [ ] Update backup procedures if needed
- [ ] Notify stakeholders

---

## Scenario 2: Complete Server Failure

### Symptoms
- Server unresponsive
- Cannot SSH into server
- Application completely down
- Hardware failure or catastrophic OS failure

### Impact
- **Severity**: Critical
- **Service Availability**: Down
- **Data at Risk**: Depends on last backup

### Recovery Procedure

#### Step 1: Provision New Server

```bash
# Run server provisioning script on new Ubuntu 22.04 LTS server
sudo ./scripts/provision-server.sh

# See docs/SERVER_PROVISIONING.md for manual steps
```

#### Step 2: Configure SSL Certificates

```bash
# Set up SSL certificates
sudo ./scripts/setup-ssl.sh

# Configure environment variables
export FRONTEND_DOMAIN=ccw-online.com
export BACKEND_DOMAIN=api.ccw-online.com
export SSL_EMAIL=admin@ccw-online.com
```

#### Step 3: Deploy Application Code

```bash
# Clone repository
cd /opt/ccw-online-erp
git clone https://github.com/your-org/ccw-online-erp.git .

# Or restore from backup
aws s3 sync s3://ccw-online-erp-backups/application/ /opt/ccw-online-erp/
```

#### Step 4: Restore Configuration Files

```bash
# Restore environment files
aws s3 cp s3://ccw-online-erp-backups/system/config/.env.production \
    /opt/ccw-online-erp/config/

# Restore nginx configuration
aws s3 cp s3://ccw-online-erp-backups/system/nginx/ /etc/nginx/sites-available/ --recursive

# Enable site
sudo ln -s /etc/nginx/sites-available/ccw-online-erp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

#### Step 5: Restore Database

```bash
# Install PostgreSQL
sudo apt install -y postgresql-15

# Restore database from backup
sudo ./scripts/restore-backup.sh backup_full_20260202_020000.sql.gz.gpg
```

#### Step 6: Start Application Services

```bash
# Start Docker containers
cd /opt/ccw-online-erp
docker compose up -d

# Verify services are running
docker ps
```

#### Step 7: Update DNS (if IP changed)

```bash
# Update DNS A records to point to new server IP
# This can be done via DNS provider dashboard or API

# Verify DNS propagation
dig ccw-online.com A
dig api.ccw-online.com A
```

#### Step 8: Verify Full Application Functionality

```bash
# Run comprehensive health checks
./scripts/health-check.ps1

# Test critical user flows
# - Login
# - View products
# - Create order
# - View dashboard
```

### Expected Recovery Time
- **Server Provisioning**: 1-2 hours
- **Application Deployment**: 1 hour
- **Database Restore**: 1-2 hours
- **DNS Propagation**: 0-2 hours (may be cached)
- **Total RTO**: 4-8 hours

### Post-Recovery Actions
- [ ] Investigate cause of server failure
- [ ] Review server monitoring and alerting
- [ ] Consider high-availability setup
- [ ] Update disaster recovery documentation

---

## Scenario 3: Accidental Data Deletion

### Symptoms
- User reports missing data
- Specific records deleted accidentally
- Recent data not visible

### Impact
- **Severity**: High
- **Service Availability**: Operational
- **Data at Risk**: Specific records

### Recovery Procedure

#### Step 1: Identify Deletion Time

```bash
# Check application logs for deletion timestamp
docker logs ccw-backend | grep -i delete | tail -50

# Check database logs
sudo tail -100 /var/log/postgresql/postgresql-15-main.log | grep DELETE
```

#### Step 2: Identify Affected Records

```bash
# Connect to database
psql -h localhost -U ccw_user -d ccw_production

# Check audit logs (if available)
SELECT * FROM audit_log WHERE action = 'DELETE' AND timestamp > '2026-02-02 14:00:00';

# Identify specific records that need recovery
SELECT id, name, deleted_at FROM products WHERE deleted_at IS NOT NULL;
```

#### Step 3: Prepare for Point-in-Time Recovery

```bash
# Identify backup before deletion occurred
aws s3 ls s3://ccw-online-erp-backups/database/full/ | grep $(date +%Y%m%d)

# Find WAL files for PITR
aws s3 ls s3://ccw-online-erp-backups/database/wal/2026/02/02/
```

#### Step 4: Restore to Temporary Database

```bash
# Create temporary database for recovery
psql -h localhost -U ccw_user -d postgres <<EOF
CREATE DATABASE ccw_recovery;
EOF

# Restore backup to temporary database
sudo DB_NAME=ccw_recovery ./scripts/restore-backup.sh backup_full_20260202_020000.sql.gz.gpg
```

#### Step 5: Extract Deleted Records

```bash
# Connect to recovery database
psql -h localhost -U ccw_user -d ccw_recovery

# Export deleted records to CSV
COPY (SELECT * FROM products WHERE id IN (123, 456, 789))
TO '/tmp/recovered_products.csv' WITH CSV HEADER;

# Export as SQL INSERT statements
pg_dump -h localhost -U ccw_user -d ccw_recovery \
    --table products --data-only --column-inserts \
    --where="id IN (123, 456, 789)" > /tmp/recovered_products.sql
```

#### Step 6: Import Records to Production Database

```bash
# Review SQL statements before importing
cat /tmp/recovered_products.sql

# Import to production database
psql -h localhost -U ccw_user -d ccw_production < /tmp/recovered_products.sql

# Verify import
psql -h localhost -U ccw_user -d ccw_production
SELECT * FROM products WHERE id IN (123, 456, 789);
```

#### Step 7: Clean Up

```bash
# Drop temporary database
psql -h localhost -U ccw_user -d postgres <<EOF
DROP DATABASE ccw_recovery;
EOF

# Remove temporary files
rm /tmp/recovered_products.csv /tmp/recovered_products.sql
```

### Expected Recovery Time
- **Identification**: 15-30 minutes
- **Restore to Temp DB**: 1-2 hours
- **Data Extraction**: 15-30 minutes
- **Import**: 5-15 minutes
- **Total RTO**: 1.5-3 hours

### Post-Recovery Actions
- [ ] Implement soft delete (if not already in place)
- [ ] Add confirmation dialogs for delete operations
- [ ] Review user permissions
- [ ] Add audit logging for all delete operations

---

## Scenario 4: Ransomware Attack

### Symptoms
- Files encrypted with unknown extensions
- Ransom note on server
- Cannot access application files
- Database files encrypted

### Impact
- **Severity**: Critical
- **Service Availability**: Down
- **Data at Risk**: All data on infected server

### Recovery Procedure

#### Step 1: Immediate Actions

```bash
# IMMEDIATELY disconnect server from network
sudo ifconfig eth0 down

# DO NOT pay ransom
# DO NOT turn off server (may lose memory evidence)

# Take memory dump (if forensics required)
sudo dd if=/dev/mem of=/tmp/memory-dump.img

# Document everything
ls -laR /opt/ccw-online-erp > /tmp/file-inventory.txt
```

#### Step 2: Isolate and Assess

```bash
# Check which files are encrypted
find /opt/ccw-online-erp -name "*.encrypted" -o -name "*.locked"

# Check for ransom notes
find / -name "*README*" -o -name "*DECRYPT*" 2>/dev/null

# Check running processes
ps aux | grep -E "(crypt|ransom|malware)"
```

#### Step 3: Provision Clean Server

```bash
# Provision completely new server (DO NOT reuse infected server)
# Follow SERVER_PROVISIONING.md

# Ensure all security patches are applied
sudo apt update && sudo apt upgrade -y
```

#### Step 4: Restore from Off-Site Backup

```bash
# Restore ONLY from off-site backups (not local or network-attached)
# Ensure backups pre-date the infection

# Check backup dates
aws s3 ls s3://ccw-online-erp-backups/database/full/ | tail -30

# Identify last known good backup (before infection)
# Restore database
sudo ./scripts/restore-backup.sh backup_full_20260201_020000.sql.gz.gpg

# Restore application files
aws s3 sync s3://ccw-online-erp-backups/application/20260201/ /opt/ccw-online-erp/
```

#### Step 5: Verify Backup Integrity

```bash
# Scan restored files for malware
sudo apt install -y clamav
sudo freshclam  # Update virus definitions
sudo clamscan -r /opt/ccw-online-erp

# Check for suspicious cron jobs
crontab -l
sudo cat /etc/crontab

# Check for rootkits
sudo apt install -y rkhunter
sudo rkhunter --update
sudo rkhunter --check
```

#### Step 6: Harden Security

```bash
# Change all passwords
sudo passwd ccwapp

# Regenerate SSH keys
rm ~/.ssh/id_rsa*
ssh-keygen -t ed25519

# Regenerate application secrets
./scripts/generate-secrets.ps1

# Update firewall rules
sudo ufw reset
sudo ufw default deny incoming
sudo ufw allow 22/tcp  # SSH only from specific IPs
sudo ufw allow 443/tcp
sudo ufw enable
```

#### Step 7: Deploy Application

```bash
# Deploy application with fresh code (from version control)
git clone --depth 1 https://github.com/your-org/ccw-online-erp.git /opt/ccw-online-erp

# Start services
cd /opt/ccw-online-erp
docker compose up -d
```

#### Step 8: Monitor for Reinfection

```bash
# Set up monitoring
./scripts/security-audit.ps1

# Monitor logs for suspicious activity
sudo tail -f /var/log/syslog | grep -E "(crypt|encrypt|ransom)"

# Enable fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Expected Recovery Time
- **Assessment**: 1-2 hours
- **Clean Server Provisioning**: 2-3 hours
- **Restore**: 2-4 hours
- **Security Hardening**: 1-2 hours
- **Total RTO**: 6-12 hours

### Post-Recovery Actions
- [ ] Conduct security audit
- [ ] Implement intrusion detection system (IDS)
- [ ] Review and update backup procedures
- [ ] Conduct security training for team
- [ ] Consider cyber insurance
- [ ] Report to authorities (if required)
- [ ] Conduct forensic analysis of infected server

---

## Disaster Recovery Testing

### Monthly Test (Light)

**Duration**: 1 hour
**Scope**: Verify backup integrity

```bash
# Run automated backup verification
sudo ./scripts/verify-backup.sh

# Test restore to staging database
sudo DB_NAME=ccw_staging ./scripts/restore-backup.sh --latest
```

### Quarterly Test (Comprehensive)

**Duration**: 4 hours
**Scope**: Full disaster recovery drill

1. **Simulate server failure**
2. **Provision new server**
3. **Restore all data**
4. **Verify application functionality**
5. **Document results and lessons learned**

### Annual Test (Full Drill)

**Duration**: 8 hours
**Scope**: Complete disaster recovery scenario

1. **Simulate multiple failures**
2. **Test failover procedures**
3. **Test communication plan**
4. **Verify RTO/RPO targets**
5. **Update disaster recovery documentation**

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| **System Administrator** | [Name] | [Phone] | [Email] |
| **Database Administrator** | [Name] | [Phone] | [Email] |
| **DevOps Lead** | [Name] | [Phone] | [Email] |
| **CTO** | [Name] | [Phone] | [Email] |
| **AWS Support** | - | - | Support case via AWS Console |
| **Hosting Provider** | - | [Phone] | [Email] |

## Runbook Checklist

### Pre-Recovery

- [ ] Identify disaster scenario
- [ ] Assess impact and severity
- [ ] Notify stakeholders
- [ ] Activate disaster recovery team
- [ ] Document incident details

### During Recovery

- [ ] Follow scenario-specific procedures
- [ ] Document all actions taken
- [ ] Communicate progress to stakeholders
- [ ] Verify each step before proceeding
- [ ] Monitor system metrics

### Post-Recovery

- [ ] Verify full application functionality
- [ ] Test all critical user flows
- [ ] Notify users that service is restored
- [ ] Conduct post-mortem analysis
- [ ] Update documentation
- [ ] Implement preventive measures

## Service Level Agreements (SLA)

| Service Level | Uptime | Monthly Downtime | Recovery Time |
|---------------|--------|------------------|---------------|
| **Critical** | 99.9% | 43.2 minutes | < 4 hours |
| **High** | 99.5% | 3.6 hours | < 8 hours |
| **Standard** | 99.0% | 7.2 hours | < 24 hours |

## References

- [Backup Strategy Documentation](BACKUP_STRATEGY.md)
- [Server Provisioning Guide](SERVER_PROVISIONING.md)
- [PostgreSQL Backup and Recovery](https://www.postgresql.org/docs/current/backup.html)
- [AWS Disaster Recovery](https://aws.amazon.com/disaster-recovery/)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or after any disaster recovery event
**Last Tested**: [Date]
**Next Test Due**: [Date]
