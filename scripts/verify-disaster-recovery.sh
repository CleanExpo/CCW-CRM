#!/bin/bash

################################################################################
# CCW-Online ERP - Disaster Recovery Readiness Verification Script (ISS-016)
#
# Purpose: Verify that disaster recovery procedures are documented and testable
# Usage: ./verify-disaster-recovery.sh
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Header
echo ""
echo "================================================================="
echo "  CCW-Online ERP - Disaster Recovery Readiness Verification"
echo "  Date: $(date)"
echo "================================================================="
echo ""

# 1. Check disaster recovery documentation
info "Checking Disaster Recovery Documentation..."

if [ -f "docs/DISASTER_RECOVERY.md" ]; then
    pass "Disaster recovery documentation exists"

    # Check for key sections
    if grep -q "RTO\|Recovery Time Objective" "docs/DISASTER_RECOVERY.md"; then
        pass "RTO (Recovery Time Objective) documented"
    else
        fail "RTO not documented"
    fi

    if grep -q "RPO\|Recovery Point Objective" "docs/DISASTER_RECOVERY.md"; then
        pass "RPO (Recovery Point Objective) documented"
    else
        fail "RPO not documented"
    fi

    # Check for disaster scenarios
    SCENARIOS=(
        "Database Corruption"
        "Server Failure"
        "Data Deletion"
        "Ransomware"
    )

    for scenario in "${SCENARIOS[@]}"; do
        if grep -qi "$scenario" "docs/DISASTER_RECOVERY.md"; then
            pass "Scenario documented: $scenario"
        else
            warn "Scenario not documented: $scenario"
        fi
    done
else
    fail "Disaster recovery documentation not found: docs/DISASTER_RECOVERY.md"
fi
echo ""

# 2. Check backup infrastructure
info "Checking Backup Infrastructure..."

# Check if backup scripts exist
BACKUP_SCRIPTS=(
    "scripts/backup-database.sh"
    "scripts/restore-backup.sh"
    "scripts/verify-backup.sh"
)

for script in "${BACKUP_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        pass "Backup script exists: $script"
    else
        fail "Backup script missing: $script"
    fi
done

# Check if backups are configured
if [ -f "/opt/ccw-online-erp/config/.backup.env" ] || [ -f "config/.backup.env" ]; then
    pass "Backup configuration file exists"
else
    warn "Backup configuration file not found (backups may not be configured)"
fi
echo ""

# 3. Check restore capability
info "Checking Restore Capability..."

if [ -f "scripts/restore-backup.sh" ]; then
    pass "Restore script exists"

    # Check if restore script is executable
    if [ -x "scripts/restore-backup.sh" ]; then
        pass "Restore script is executable"
    else
        warn "Restore script is not executable"
    fi

    # Check for restore test log
    if [ -f "/var/log/ccw-restore-test.log" ]; then
        pass "Restore test log exists (restore has been tested)"

        # Check when last restore test was performed
        LAST_TEST_DATE=$(stat -c %Y "/var/log/ccw-restore-test.log" 2>/dev/null || stat -f %m "/var/log/ccw-restore-test.log" 2>/dev/null || echo 0)
        DAYS_SINCE_TEST=$(( ($(date +%s) - $LAST_TEST_DATE) / 86400 ))

        if [ $DAYS_SINCE_TEST -le 30 ]; then
            pass "Restore tested recently ($DAYS_SINCE_TEST days ago)"
        elif [ $DAYS_SINCE_TEST -le 90 ]; then
            warn "Restore last tested $DAYS_SINCE_TEST days ago (test quarterly)"
        else
            fail "Restore last tested $DAYS_SINCE_TEST days ago (test overdue)"
        fi
    else
        warn "Restore has not been tested (test restore procedure required)"
    fi
else
    fail "Restore script missing"
fi
echo ""

# 4. Check off-site backup storage
info "Checking Off-Site Backup Storage..."

S3_BUCKET="${S3_BUCKET:-s3://ccw-online-erp-backups}"

if command -v aws &> /dev/null; then
    if aws sts get-caller-identity &> /dev/null; then
        pass "AWS CLI configured"

        # Check S3 bucket accessibility
        if aws s3 ls "$S3_BUCKET" &> /dev/null; then
            pass "Off-site backup storage accessible: $S3_BUCKET"

            # Check for recent backups
            BACKUP_COUNT=$(aws s3 ls "$S3_BUCKET/database/full/" 2>/dev/null | wc -l || echo 0)
            if [ "$BACKUP_COUNT" -gt 0 ]; then
                pass "Found $BACKUP_COUNT backup(s) in off-site storage"
            else
                fail "No backups found in off-site storage"
            fi

            # Check cross-region replication
            REPLICATION=$(aws s3api get-bucket-replication --bucket "${S3_BUCKET#s3://}" 2>/dev/null || echo "NotConfigured")
            if [ "$REPLICATION" != "NotConfigured" ]; then
                pass "Cross-region replication configured (enhanced DR)"
            else
                warn "Cross-region replication not configured (recommended for DR)"
            fi
        else
            fail "Off-site backup storage not accessible: $S3_BUCKET"
        fi
    else
        warn "AWS credentials not configured (cannot verify off-site backups)"
    fi
else
    warn "AWS CLI not installed (cannot verify off-site backups)"
fi
echo ""

# 5. Check server provisioning capability
info "Checking Server Provisioning Capability..."

if [ -f "scripts/provision-server.sh" ]; then
    pass "Server provisioning script exists"

    # Check if executable
    if [ -x "scripts/provision-server.sh" ]; then
        pass "Provisioning script is executable"
    else
        warn "Provisioning script is not executable"
    fi
else
    fail "Server provisioning script missing (needed for server failure recovery)"
fi

if [ -f "docs/SERVER_PROVISIONING.md" ]; then
    pass "Server provisioning documentation exists"
else
    warn "Server provisioning documentation missing"
fi
echo ""

# 6. Check database tools
info "Checking Database Recovery Tools..."

if command -v pg_dump &> /dev/null; then
    pass "pg_dump installed (required for backups)"
else
    fail "pg_dump not installed"
fi

if command -v pg_restore &> /dev/null; then
    pass "pg_restore installed (required for restores)"
else
    fail "pg_restore not installed"
fi

if command -v psql &> /dev/null; then
    pass "psql installed (required for database operations)"
else
    fail "psql not installed"
fi
echo ""

# 7. Check monitoring and alerting
info "Checking Monitoring and Alerting..."

# Check for monitoring configuration
if [ -f "monitoring/backup-alerts.yml" ] || [ -f "/etc/prometheus/rules/backup-alerts.yml" ]; then
    pass "Backup alert rules configured"
else
    warn "Backup alert rules not configured (failures won't generate alerts)"
fi

# Check if Prometheus is available
if command -v prometheus &> /dev/null || [ -f "/etc/prometheus/prometheus.yml" ]; then
    pass "Prometheus monitoring available"

    # Check if Prometheus is running
    if curl -s http://localhost:9090/-/healthy &> /dev/null; then
        pass "Prometheus is running"
    else
        warn "Prometheus is not running"
    fi
else
    warn "Prometheus not installed (monitoring not available)"
fi
echo ""

# 8. Check emergency contacts
info "Checking Emergency Contacts..."

if grep -q "Emergency Contacts" "docs/DISASTER_RECOVERY.md"; then
    pass "Emergency contacts section exists"

    # Check if contacts are filled in
    if grep -q "\[Name\]\|\[Phone\]\|\[Email\]" "docs/DISASTER_RECOVERY.md"; then
        warn "Emergency contacts contain placeholders (update with real contacts)"
    else
        pass "Emergency contacts appear to be filled in"
    fi
else
    warn "Emergency contacts section not found in documentation"
fi
echo ""

# 9. Check communication plan
info "Checking Communication Plan..."

# Check for communication procedures
if grep -qi "notif\|stakeholder\|communication" "docs/DISASTER_RECOVERY.md"; then
    pass "Communication procedures mentioned in documentation"
else
    warn "Communication procedures not documented"
fi

# Check for status page or notification system
if command -v curl &> /dev/null; then
    # Placeholder - check if status page exists
    if curl -s -o /dev/null -w "%{http_code}" https://status.ccw-online.com 2>/dev/null | grep -q "200\|301\|302"; then
        pass "Status page available (for user communication)"
    else
        warn "Status page not configured (recommended for user communication)"
    fi
fi
echo ""

# 10. Check RTO/RPO objectives
info "Checking RTO/RPO Objectives..."

if grep -q "RTO.*4 hours\|Recovery Time.*4 hours" "docs/DISASTER_RECOVERY.md"; then
    pass "RTO target documented (4 hours)"
else
    warn "RTO target not clearly documented"
fi

if grep -q "RPO.*1 hour\|Recovery Point.*1 hour" "docs/DISASTER_RECOVERY.md"; then
    pass "RPO target documented (1 hour)"
else
    warn "RPO target not clearly documented"
fi

# Check if backup frequency supports RPO
if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
    BACKUP_FREQUENCY=$(crontab -l 2>/dev/null | grep "backup-database.sh" | head -1 | awk '{print $1, $2}')
    pass "Automated backups configured: $BACKUP_FREQUENCY"

    if crontab -l 2>/dev/null | grep "backup-database.sh" | grep -q "0 \*"; then
        pass "Hourly backups configured (supports < 1h RPO)"
    else
        warn "Hourly backups not configured (may not meet < 1h RPO)"
    fi
else
    fail "Automated backups not configured in cron"
fi
echo ""

# 11. Check disaster recovery testing schedule
info "Checking DR Testing Schedule..."

# Check if testing schedule is documented
if grep -qi "test.*schedule\|quarterly.*test\|monthly.*test" "docs/DISASTER_RECOVERY.md"; then
    pass "DR testing schedule documented"

    if grep -qi "monthly.*test" "docs/DISASTER_RECOVERY.md"; then
        pass "Monthly testing documented"
    else
        warn "Monthly testing not documented"
    fi

    if grep -qi "quarterly.*test" "docs/DISASTER_RECOVERY.md"; then
        pass "Quarterly testing documented"
    else
        warn "Quarterly testing not documented"
    fi
else
    warn "DR testing schedule not documented"
fi

# Check if DR test has been performed
DR_TEST_LOG="/var/log/ccw-dr-test.log"
if [ -f "$DR_TEST_LOG" ]; then
    pass "DR test log exists (DR drill has been performed)"

    LAST_TEST_DATE=$(stat -c %Y "$DR_TEST_LOG" 2>/dev/null || stat -f %m "$DR_TEST_LOG" 2>/dev/null || echo 0)
    DAYS_SINCE_TEST=$(( ($(date +%s) - $LAST_TEST_DATE) / 86400 ))

    if [ $DAYS_SINCE_TEST -le 90 ]; then
        pass "DR drill performed recently ($DAYS_SINCE_TEST days ago)"
    else
        warn "DR drill last performed $DAYS_SINCE_TEST days ago (quarterly recommended)"
    fi
else
    warn "DR drill has not been performed (schedule first drill)"
fi
echo ""

# 12. Check security and encryption
info "Checking Security and Encryption..."

# Check if encryption key is configured
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    pass "Backup encryption key is set"
else
    if [ -f "/opt/ccw-online-erp/config/.backup.env" ]; then
        source "/opt/ccw-online-erp/config/.backup.env" 2>/dev/null || true
        if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
            pass "Backup encryption key is set in config file"
        else
            fail "Backup encryption key not configured"
        fi
    else
        warn "Backup encryption key not found"
    fi
fi

# Check GPG availability
if command -v gpg &> /dev/null; then
    pass "GPG installed (required for encryption)"
else
    fail "GPG not installed (required for backup encryption)"
fi
echo ""

# 13. Check runbook completeness
info "Checking Runbook Completeness..."

RUNBOOK_SECTIONS=(
    "Step.*1"
    "Step.*2"
    "Expected Recovery Time"
    "Post-Recovery Actions"
)

COMPLETE_SCENARIOS=0
for scenario in "Database Corruption" "Server Failure" "Data Deletion" "Ransomware"; do
    if grep -q "$scenario" "docs/DISASTER_RECOVERY.md"; then
        SCENARIO_COMPLETE=true
        for section in "${RUNBOOK_SECTIONS[@]}"; do
            if ! grep -A 50 "$scenario" "docs/DISASTER_RECOVERY.md" | grep -q "$section"; then
                SCENARIO_COMPLETE=false
                break
            fi
        done

        if $SCENARIO_COMPLETE; then
            ((COMPLETE_SCENARIOS++))
        fi
    fi
done

if [ $COMPLETE_SCENARIOS -ge 3 ]; then
    pass "$COMPLETE_SCENARIOS scenario runbooks are complete"
else
    warn "Only $COMPLETE_SCENARIOS scenario runbooks are complete"
fi
echo ""

# 14. Check high availability considerations
info "Checking High Availability Considerations..."

# Check if load balancer is configured
if [ -f "/etc/nginx/sites-enabled/ccw-online-erp" ] || [ -f "docs/LOAD_BALANCER.md" ]; then
    pass "Load balancer configured or documented"
else
    warn "Load balancer not configured (single point of failure)"
fi

# Check for database replication
if command -v psql &> /dev/null; then
    if psql -h localhost -U postgres -c "SELECT * FROM pg_stat_replication" &> /dev/null; then
        REPLICA_COUNT=$(psql -h localhost -U postgres -t -c "SELECT COUNT(*) FROM pg_stat_replication" 2>/dev/null | xargs || echo 0)
        if [ "$REPLICA_COUNT" -gt 0 ]; then
            pass "Database replication configured ($REPLICA_COUNT replica(s))"
        else
            warn "Database replication not configured (single point of failure)"
        fi
    else
        warn "Cannot check database replication status"
    fi
else
    warn "Cannot check database replication (psql not available)"
fi
echo ""

# 15. Check documentation currency
info "Checking Documentation Currency..."

if [ -f "docs/DISASTER_RECOVERY.md" ]; then
    # Check last modified date
    LAST_MODIFIED=$(stat -c %Y "docs/DISASTER_RECOVERY.md" 2>/dev/null || stat -f %m "docs/DISASTER_RECOVERY.md" 2>/dev/null || echo 0)
    DAYS_SINCE_UPDATE=$(( ($(date +%s) - $LAST_MODIFIED) / 86400 ))

    if [ $DAYS_SINCE_UPDATE -le 90 ]; then
        pass "Documentation updated recently ($DAYS_SINCE_UPDATE days ago)"
    elif [ $DAYS_SINCE_UPDATE -le 180 ]; then
        warn "Documentation updated $DAYS_SINCE_UPDATE days ago (review quarterly)"
    else
        fail "Documentation updated $DAYS_SINCE_UPDATE days ago (update overdue)"
    fi

    # Check for last tested date field
    if grep -q "Last Tested:" "docs/DISASTER_RECOVERY.md"; then
        pass "Last tested date field exists"

        if grep "Last Tested:" "docs/DISASTER_RECOVERY.md" | grep -q "\[Date\]"; then
            warn "Last tested date is a placeholder (update after testing)"
        else
            pass "Last tested date appears to be filled in"
        fi
    else
        warn "Last tested date field not found"
    fi
fi
echo ""

# 16. Check post-mortem template
info "Checking Post-Mortem Template..."

if grep -qi "post-mortem\|post recovery\|lessons learned" "docs/DISASTER_RECOVERY.md"; then
    pass "Post-recovery analysis mentioned"
else
    warn "Post-recovery analysis not documented"
fi

# Check if post-mortem directory exists
if [ -d "docs/post-mortems" ] || [ -d "post-mortems" ]; then
    pass "Post-mortem directory exists"

    POSTMORTEM_COUNT=$(find docs/post-mortems post-mortems -name "*.md" 2>/dev/null | wc -l || echo 0)
    if [ "$POSTMORTEM_COUNT" -gt 0 ]; then
        pass "Found $POSTMORTEM_COUNT post-mortem document(s)"
    else
        info "No post-mortem documents yet (created after incidents)"
    fi
else
    info "Post-mortem directory not created yet (recommended for incident tracking)"
fi
echo ""

# 17. Check infrastructure as code
info "Checking Infrastructure as Code..."

# Check for infrastructure automation
if [ -f "terraform/main.tf" ] || [ -f "infrastructure/terraform/main.tf" ]; then
    pass "Terraform configuration exists (infrastructure as code)"
elif [ -f "cloudformation.yml" ] || [ -f "infrastructure/cloudformation.yml" ]; then
    pass "CloudFormation template exists (infrastructure as code)"
else
    warn "No infrastructure as code detected (manual provisioning increases RTO)"
fi

# Check for Docker Compose
if [ -f "docker-compose.yml" ]; then
    pass "Docker Compose configuration exists (simplified deployment)"
else
    warn "Docker Compose configuration not found"
fi
echo ""

# 18. Check access to critical systems
info "Checking Access to Critical Systems..."

# Check SSH access
if [ -f ~/.ssh/id_rsa ] || [ -f ~/.ssh/id_ed25519 ]; then
    pass "SSH keys configured"
else
    warn "SSH keys not configured (needed for server access)"
fi

# Check if production server details are documented
if grep -qi "production.*server\|server.*hostname\|server.*ip" "docs/DISASTER_RECOVERY.md" "docs/SERVER_PROVISIONING.md" 2>/dev/null; then
    pass "Production server details documented"
else
    warn "Production server details not clearly documented"
fi
echo ""

# Summary
echo "================================================================="
echo "  Verification Summary"
echo "================================================================="
echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

# Readiness assessment
if [ $FAILED -eq 0 ] && [ $WARNINGS -lt 10 ]; then
    echo -e "${GREEN}✓ Disaster recovery readiness looks good!${NC}"
    echo ""
    info "Recommended next steps:"
    echo "  1. Schedule first DR drill: Quarterly test"
    echo "  2. Update emergency contacts with real names/phones"
    echo "  3. Configure monitoring alerts"
    echo "  4. Document last tested date after DR drill"
    echo "  5. Consider high availability setup for critical systems"
    echo ""
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Disaster recovery has some gaps.${NC}"
    echo ""
    warn "Review warnings above and improve DR readiness."
    echo ""
    info "Key recommendations:"
    echo "  - Perform DR drill (restore test)"
    echo "  - Configure cross-region replication"
    echo "  - Update emergency contacts"
    echo "  - Set up monitoring and alerts"
    echo "  - Document last tested date"
    exit 0
else
    echo -e "${RED}✗ Disaster recovery readiness has critical issues.${NC}"
    echo ""
    fail "Critical issues found. Please review failed checks above."
    echo ""
    info "Critical actions needed:"
    echo "  - Install required tools (pg_dump, pg_restore, gpg)"
    echo "  - Create disaster recovery documentation"
    echo "  - Configure automated backups"
    echo "  - Set up off-site backup storage"
    echo "  - Create and test restore procedures"
    exit 1
fi
