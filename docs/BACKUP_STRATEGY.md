# Backup Strategy

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-015, ISS-016

---

## Overview

This document outlines the comprehensive backup strategy for CCW-Online ERP, including automated backups, retention policies, encryption, and restoration procedures.

## Backup Strategy Summary

| Backup Type | Frequency | Retention | Target | RTO* | RPO* |
|-------------|-----------|-----------|--------|------|------|
| **Full Database** | Daily (2:00 AM) | 30 days | S3/Object Storage | 4 hours | 24 hours |
| **Incremental Database** | Hourly | 7 days | S3/Object Storage | 2 hours | 1 hour |
| **WAL Archives** | Continuous | 7 days | S3/Object Storage | 1 hour | ~5 minutes |
| **Application Files** | Daily (3:00 AM) | 14 days | S3/Object Storage | 2 hours | 24 hours |
| **Configuration** | Daily (3:30 AM) | 30 days | S3/Object Storage | 1 hour | 24 hours |

*RTO: Recovery Time Objective | *RPO: Recovery Point Objective

## Backup Components

### 1. Database Backups (PostgreSQL)

#### Full Backups (Daily)

**Schedule**: Every day at 2:00 AM
**Method**: `pg_dump` with custom format
**Compression**: gzip compression
**Encryption**: GPG encryption with AES-256

```bash
# Full backup command
pg_dump -Fc -h localhost -U ccw_user ccw_production | \
    gzip | \
    gpg --symmetric --cipher-algo AES256 > \
    backup_full_$(date +%Y%m%d_%H%M%S).sql.gz.gpg
```

**Backup Script**: `/opt/ccw-online-erp/scripts/backup-database.sh`

#### Incremental Backups (Hourly)

**Schedule**: Every hour
**Method**: PostgreSQL WAL (Write-Ahead Logging) archiving
**Storage**: Continuous WAL shipping to object storage

#### Point-in-Time Recovery (PITR)

Enabled via WAL archiving, allowing recovery to any point in time within the retention window.

### 2. Application Files

**Components**:
- Uploaded files (`/opt/ccw-online-erp/uploads/`)
- Configuration files (`/opt/ccw-online-erp/config/`)
- Environment files (`.env.production`)
- SSL certificates (`/etc/letsencrypt/`)
- Nginx configuration (`/etc/nginx/`)
- Docker volumes

**Method**: rsync with compression and encryption

### 3. System Configuration

**Components**:
- Operating system configuration
- Installed packages list
- Systemd services
- Cron jobs
- Firewall rules

## Backup Storage

### Primary Storage: AWS S3 (or S3-Compatible)

**Configuration**:
- Bucket: `ccw-online-erp-backups`
- Region: `us-east-1` (or nearest to production)
- Storage Class: Standard (recent), Glacier (older)
- Versioning: Enabled
- Lifecycle Rules: Automatic transition to cheaper storage

**S3 Bucket Structure**:
```
s3://ccw-online-erp-backups/
├── database/
│   ├── full/
│   │   ├── backup_full_20260202_020000.sql.gz.gpg
│   │   ├── backup_full_20260201_020000.sql.gz.gpg
│   │   └── ...
│   ├── incremental/
│   │   ├── 2026/02/02/
│   │   └── ...
│   └── wal/
│       ├── 000000010000000000000001
│       └── ...
├── application/
│   ├── uploads/
│   ├── config/
│   └── ...
└── system/
    ├── nginx/
    ├── ssl/
    └── ...
```

### Secondary Storage: Off-site Copy

**Purpose**: Disaster recovery
**Method**: Cross-region replication
**Frequency**: Continuous (S3 replication)

## Backup Automation

### Cron Schedule

```bash
# /etc/crontab (or user crontab for ccwapp)

# Full database backup (daily at 2:00 AM)
0 2 * * * /opt/ccw-online-erp/scripts/backup-database.sh full

# Incremental backup (hourly)
0 * * * * /opt/ccw-online-erp/scripts/backup-database.sh incremental

# Application files backup (daily at 3:00 AM)
0 3 * * * /opt/ccw-online-erp/scripts/backup-application.sh

# Configuration backup (daily at 3:30 AM)
30 3 * * * /opt/ccw-online-erp/scripts/backup-configuration.sh

# Backup verification (daily at 9:00 AM)
0 9 * * * /opt/ccw-online-erp/scripts/verify-backup.sh

# Cleanup old backups (weekly on Sunday at 4:00 AM)
0 4 * * 0 /opt/ccw-online-erp/scripts/cleanup-backups.sh
```

### Backup Scripts

All backup scripts are located in: `/opt/ccw-online-erp/scripts/`

1. **backup-database.sh**: Database backup (full and incremental)
2. **backup-application.sh**: Application files backup
3. **backup-configuration.sh**: System configuration backup
4. **verify-backup.sh**: Automated backup verification
5. **cleanup-backups.sh**: Remove old backups per retention policy
6. **restore-backup.sh**: Restore from backup

## Encryption

### Encryption at Rest

**Method**: GPG symmetric encryption with AES-256
**Key Management**: Stored securely in environment variables

```bash
# Set encryption passphrase (do this once during setup)
export BACKUP_ENCRYPTION_KEY="your-strong-passphrase-here"

# Store in secure location
echo "BACKUP_ENCRYPTION_KEY=your-strong-passphrase-here" | \
    sudo tee -a /opt/ccw-online-erp/config/.backup.env
sudo chmod 600 /opt/ccw-online-erp/config/.backup.env
```

### Encryption in Transit

**Method**: TLS/SSL for S3 uploads
**AWS CLI Configuration**: Always use HTTPS endpoints

## Retention Policies

### Database Backups

```
Full Backups:
├── Last 7 days: Keep all (daily)
├── Last 30 days: Keep weekly snapshots
└── Older than 30 days: Delete

Incremental Backups:
├── Last 7 days: Keep all
└── Older than 7 days: Delete

WAL Archives:
├── Last 7 days: Keep all
└── Older than 7 days: Delete
```

### Application & Configuration Backups

```
├── Last 14 days: Keep all
├── Last 30 days: Keep weekly snapshots
└── Older than 30 days: Delete
```

### Lifecycle Management

Implemented via S3 Lifecycle Rules:

```json
{
  "Rules": [
    {
      "Id": "Transition old backups to Glacier",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 90
      }
    }
  ]
}
```

## Backup Verification

### Automated Verification (Daily)

**Script**: `/opt/ccw-online-erp/scripts/verify-backup.sh`

**Verification Steps**:
1. Check backup file existence
2. Verify file integrity (checksums)
3. Test decryption (without full restore)
4. Validate backup metadata
5. Confirm S3 upload success
6. Log results to monitoring system

### Manual Verification (Monthly)

**Procedure**:
1. Select random backup from last 30 days
2. Restore to staging environment
3. Verify data integrity
4. Test application functionality
5. Document results

**Schedule**: First Sunday of each month

## Monitoring and Alerts

### Backup Success/Failure Alerts

**Monitoring**: Via custom script that checks backup logs

**Alert Conditions**:
- Backup script fails to run
- Backup file not created
- S3 upload fails
- Backup file size is unusually small (< 10% of previous)
- Backup verification fails

**Notification Methods**:
- Email to: `devops@ccw-online.com`
- Slack webhook (if configured)
- Log to monitoring system (Prometheus/Alertmanager)

### Backup Metrics

**Prometheus Metrics**:
```
# Database backup size (bytes)
ccw_backup_database_size_bytes

# Backup duration (seconds)
ccw_backup_duration_seconds

# Last successful backup timestamp
ccw_backup_last_success_timestamp

# Backup failure count
ccw_backup_failures_total
```

## Disaster Recovery Scenarios

### Scenario 1: Database Corruption

**Impact**: Database is corrupted or data loss occurred
**Recovery Method**: Restore from full backup + WAL replay
**RTO**: 2-4 hours
**RPO**: < 1 hour

**Procedure**: See `DISASTER_RECOVERY.md`

### Scenario 2: Complete Server Failure

**Impact**: Server is completely unavailable
**Recovery Method**: Provision new server, restore all data
**RTO**: 4-8 hours
**RPO**: < 24 hours

**Procedure**: See `DISASTER_RECOVERY.md`

### Scenario 3: Accidental Data Deletion

**Impact**: User accidentally deleted critical data
**Recovery Method**: Point-in-time recovery to before deletion
**RTO**: 1-2 hours
**RPO**: < 1 hour

**Procedure**: See `DISASTER_RECOVERY.md`

### Scenario 4: Ransomware Attack

**Impact**: Files encrypted by ransomware
**Recovery Method**: Restore from off-site backup
**RTO**: 4-8 hours
**RPO**: < 24 hours

**Procedure**: See `DISASTER_RECOVERY.md`

## Backup Testing Schedule

| Test Type | Frequency | Purpose |
|-----------|-----------|---------|
| **Automated Verification** | Daily | Verify backup integrity |
| **Staging Restore** | Monthly | Test full restore procedure |
| **Disaster Recovery Drill** | Quarterly | Test complete DR process |
| **Point-in-Time Recovery** | Quarterly | Test PITR capability |

## S3 Configuration

### AWS CLI Setup

```bash
# Install AWS CLI
sudo apt install -y awscli

# Configure AWS credentials (as ccwapp user)
sudo -u ccwapp aws configure
# AWS Access Key ID: [your-access-key]
# AWS Secret Access Key: [your-secret-key]
# Default region: us-east-1
# Default output format: json

# Test access
aws s3 ls s3://ccw-online-erp-backups/
```

### S3 Bucket Creation

```bash
# Create backup bucket
aws s3 mb s3://ccw-online-erp-backups --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket ccw-online-erp-backups \
    --versioning-configuration Status=Enabled

# Configure lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
    --bucket ccw-online-erp-backups \
    --lifecycle-configuration file://lifecycle.json

# Enable encryption
aws s3api put-bucket-encryption \
    --bucket ccw-online-erp-backups \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }'
```

### S3 Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBackupUserAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:user/ccw-backup-user"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::ccw-online-erp-backups/*",
        "arn:aws:s3:::ccw-online-erp-backups"
      ]
    }
  ]
}
```

## Backup Script Examples

### Full Database Backup

```bash
#!/bin/bash
# /opt/ccw-online-erp/scripts/backup-database.sh

set -euo pipefail

# Load configuration
source /opt/ccw-online-erp/config/.backup.env

# Variables
BACKUP_DIR="/opt/ccw-online-erp/backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="ccw_production"
DB_USER="ccw_user"
S3_BUCKET="s3://ccw-online-erp-backups/database/full"

# Create backup
pg_dump -Fc -h localhost -U "$DB_USER" "$DB_NAME" | \
    gzip | \
    gpg --symmetric --cipher-algo AES256 --passphrase "$BACKUP_ENCRYPTION_KEY" \
    > "$BACKUP_DIR/backup_full_$TIMESTAMP.sql.gz.gpg"

# Upload to S3
aws s3 cp "$BACKUP_DIR/backup_full_$TIMESTAMP.sql.gz.gpg" "$S3_BUCKET/"

# Verify upload
if aws s3 ls "$S3_BUCKET/backup_full_$TIMESTAMP.sql.gz.gpg"; then
    echo "Backup successful: backup_full_$TIMESTAMP.sql.gz.gpg"
    # Clean up local backup (optional)
    rm "$BACKUP_DIR/backup_full_$TIMESTAMP.sql.gz.gpg"
else
    echo "ERROR: Backup upload failed"
    exit 1
fi
```

### Restore from Backup

```bash
#!/bin/bash
# /opt/ccw-online-erp/scripts/restore-backup.sh

set -euo pipefail

# Load configuration
source /opt/ccw-online-erp/config/.backup.env

# Variables
BACKUP_FILE="$1"
S3_BUCKET="s3://ccw-online-erp-backups/database/full"
RESTORE_DIR="/tmp/restore"

# Download backup from S3
mkdir -p "$RESTORE_DIR"
aws s3 cp "$S3_BUCKET/$BACKUP_FILE" "$RESTORE_DIR/"

# Decrypt and decompress
gpg --decrypt --passphrase "$BACKUP_ENCRYPTION_KEY" \
    "$RESTORE_DIR/$BACKUP_FILE" | \
    gunzip > "$RESTORE_DIR/restore.sql"

# Restore database
pg_restore -h localhost -U ccw_user -d ccw_production \
    --clean --if-exists "$RESTORE_DIR/restore.sql"

echo "Restore complete"
```

## Backup Monitoring Dashboard

### Metrics to Track

1. **Backup Success Rate**: % of successful backups
2. **Backup Duration**: Time taken for each backup
3. **Backup Size**: Size of each backup (trend over time)
4. **Storage Usage**: Total S3 storage used
5. **Failed Backups**: Count and reasons for failures
6. **Last Successful Backup**: Timestamp of last successful backup

### Grafana Dashboard

Create a Grafana dashboard with the following panels:
- Backup success rate (last 30 days)
- Backup duration trend
- Storage usage over time
- Backup size trend
- Alert history

## Compliance and Auditing

### Audit Log

All backup operations are logged to:
- `/var/log/ccw-backup.log`
- Syslog (for centralized logging)
- S3 access logs (for backup downloads)

### Compliance Requirements

- **GDPR**: Encrypted backups, secure deletion after retention period
- **SOC 2**: Documented backup procedures, regular testing
- **HIPAA** (if applicable): Encrypted backups, access controls, audit logging

## Cost Optimization

### S3 Storage Costs

**Current Strategy**:
- Standard storage (0-30 days): ~$0.023/GB/month
- Glacier storage (30-90 days): ~$0.004/GB/month
- Intelligent-Tiering: Automatic cost optimization

**Estimated Monthly Cost** (for 500GB total backups):
```
Standard (200GB): $4.60
Glacier (300GB): $1.20
Total: ~$5.80/month
```

### Cost Reduction Strategies

1. **Compression**: Reduce backup sizes by 60-80%
2. **Incremental Backups**: Only backup changed data
3. **Lifecycle Policies**: Automatic transition to cheaper storage
4. **Retention Tuning**: Adjust retention based on compliance needs

## Troubleshooting

### Backup Script Fails

```bash
# Check backup logs
tail -f /var/log/ccw-backup.log

# Test database connection
pg_isready -h localhost -U ccw_user

# Test S3 access
aws s3 ls s3://ccw-online-erp-backups/

# Verify encryption key
echo "test" | gpg --symmetric --cipher-algo AES256 --passphrase "$BACKUP_ENCRYPTION_KEY"
```

### Backup Verification Fails

```bash
# Download backup manually
aws s3 cp s3://ccw-online-erp-backups/database/full/backup_full_20260202_020000.sql.gz.gpg /tmp/

# Test decryption
gpg --decrypt --passphrase "$BACKUP_ENCRYPTION_KEY" /tmp/backup_full_20260202_020000.sql.gz.gpg | gunzip > /tmp/test.sql

# Check file size
ls -lh /tmp/test.sql
```

### S3 Upload Slow or Fails

```bash
# Check network connectivity
ping s3.amazonaws.com

# Test S3 upload speed
time aws s3 cp /tmp/test-file s3://ccw-online-erp-backups/test/

# Use multipart upload for large files
aws s3 cp --storage-class STANDARD_IA large-file.gz.gpg s3://bucket/
```

## Verification Checklist

- [ ] Backup scripts created and executable
- [ ] Cron jobs configured
- [ ] S3 bucket created and configured
- [ ] Encryption keys generated and stored securely
- [ ] AWS CLI configured with proper credentials
- [ ] Backup verification script tested
- [ ] Monitoring alerts configured
- [ ] Restoration procedure documented
- [ ] Test restore performed successfully
- [ ] Backup logs being written
- [ ] S3 lifecycle policies configured
- [ ] Off-site replication enabled

## References

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [GPG Documentation](https://gnupg.org/documentation/)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or after infrastructure changes
