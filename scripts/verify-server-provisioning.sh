#!/bin/bash

################################################################################
# CCW-Online ERP - Server Provisioning Verification Script (ISS-011)
#
# Purpose: Verify that production server has been correctly provisioned
# Usage: sudo ./verify-server-provisioning.sh
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

check_command() {
    if command -v "$1" &> /dev/null; then
        pass "$2 installed"
        return 0
    else
        fail "$2 not found"
        return 1
    fi
}

check_service() {
    if systemctl is-active --quiet "$1"; then
        pass "$2 service running"
        return 0
    else
        fail "$2 service not running"
        return 1
    fi
}

check_file() {
    if [ -f "$1" ]; then
        pass "$2 exists"
        return 0
    else
        fail "$2 not found"
        return 1
    fi
}

check_directory() {
    if [ -d "$1" ]; then
        pass "$2 exists"
        return 0
    else
        fail "$2 not found"
        return 1
    fi
}

# Header
echo ""
echo "================================================================="
echo "  CCW-Online ERP - Server Provisioning Verification"
echo "  Date: $(date)"
echo "  Host: $(hostname)"
echo "================================================================="
echo ""

# 1. Operating System Check
info "Checking Operating System..."
if grep -q "Ubuntu 22.04" /etc/os-release; then
    pass "Ubuntu 22.04 LTS detected"
else
    fail "Ubuntu 22.04 LTS not detected"
fi
echo ""

# 2. System Resources Check
info "Checking System Resources..."

# CPU cores
CPU_CORES=$(nproc)
if [ "$CPU_CORES" -ge 8 ]; then
    pass "CPU cores: $CPU_CORES (meets requirement: 8+)"
elif [ "$CPU_CORES" -ge 4 ]; then
    warn "CPU cores: $CPU_CORES (recommended: 8+)"
else
    fail "CPU cores: $CPU_CORES (minimum: 8)"
fi

# RAM
TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -ge 16 ]; then
    pass "RAM: ${TOTAL_RAM}GB (meets requirement: 16GB+)"
elif [ "$TOTAL_RAM" -ge 8 ]; then
    warn "RAM: ${TOTAL_RAM}GB (recommended: 16GB+)"
else
    fail "RAM: ${TOTAL_RAM}GB (minimum: 16GB)"
fi

# Disk space
DISK_SPACE=$(df -BG / | awk 'NR==2 {print $2}' | sed 's/G//')
if [ "$DISK_SPACE" -ge 200 ]; then
    pass "Disk space: ${DISK_SPACE}GB (meets requirement: 200GB+)"
elif [ "$DISK_SPACE" -ge 100 ]; then
    warn "Disk space: ${DISK_SPACE}GB (recommended: 200GB+)"
else
    fail "Disk space: ${DISK_SPACE}GB (minimum: 200GB)"
fi

# Swap
SWAP_TOTAL=$(free -g | awk '/^Swap:/{print $2}')
if [ "$SWAP_TOTAL" -ge 1 ]; then
    pass "Swap configured: ${SWAP_TOTAL}GB"
else
    warn "Swap not configured (recommended: 4GB)"
fi

echo ""

# 3. Essential Packages Check
info "Checking Essential Packages..."
check_command curl "curl"
check_command wget "wget"
check_command git "git"
check_command vim "vim"
check_command htop "htop"
echo ""

# 4. Docker Check
info "Checking Docker..."
if check_command docker "Docker"; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    info "Docker version: $DOCKER_VERSION"

    if systemctl is-active --quiet docker; then
        pass "Docker service running"
    else
        fail "Docker service not running"
    fi

    # Check Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version | awk '{print $4}')
        pass "Docker Compose installed: $COMPOSE_VERSION"
    else
        fail "Docker Compose not installed"
    fi
fi
echo ""

# 5. User Configuration Check
info "Checking User Configuration..."
if id -u ccwapp &> /dev/null; then
    pass "User 'ccwapp' exists"

    # Check if user is in docker group
    if groups ccwapp | grep -q docker; then
        pass "User 'ccwapp' in docker group"
    else
        fail "User 'ccwapp' not in docker group"
    fi

    # Check home directory
    if [ -d "/home/ccwapp" ]; then
        pass "Home directory exists: /home/ccwapp"
    else
        warn "Home directory not found: /home/ccwapp"
    fi
else
    fail "User 'ccwapp' not found"
fi
echo ""

# 6. Firewall Check
info "Checking Firewall (UFW)..."
if check_command ufw "UFW"; then
    if ufw status | grep -q "Status: active"; then
        pass "UFW firewall active"

        # Check essential rules
        if ufw status | grep -q "22/tcp"; then
            pass "SSH port (22) allowed"
        else
            warn "SSH port (22) not explicitly allowed"
        fi

        if ufw status | grep -q "80/tcp"; then
            pass "HTTP port (80) allowed"
        else
            warn "HTTP port (80) not allowed"
        fi

        if ufw status | grep -q "443/tcp"; then
            pass "HTTPS port (443) allowed"
        else
            warn "HTTPS port (443) not allowed"
        fi
    else
        fail "UFW firewall not active"
    fi
fi
echo ""

# 7. Fail2ban Check
info "Checking Fail2ban..."
if check_command fail2ban-client "Fail2ban"; then
    check_service fail2ban "Fail2ban"

    # Check if SSH jail is enabled
    if fail2ban-client status sshd &> /dev/null; then
        pass "SSH jail enabled"
    else
        warn "SSH jail not enabled"
    fi
fi
echo ""

# 8. SSH Configuration Check
info "Checking SSH Configuration..."
if check_file "/etc/ssh/sshd_config" "SSH config"; then
    # Check PermitRootLogin
    if grep -q "^PermitRootLogin no" /etc/ssh/sshd_config; then
        pass "Root login disabled"
    else
        warn "Root login not explicitly disabled"
    fi

    # Check PasswordAuthentication
    if grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config || grep -q "^#PasswordAuthentication yes" /etc/ssh/sshd_config; then
        if grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config; then
            pass "Password authentication disabled"
        else
            warn "Password authentication not explicitly disabled"
        fi
    fi
fi

check_service sshd "SSH"
echo ""

# 9. System Tuning Check
info "Checking System Tuning..."
if grep -q "vm.max_map_count=262144" /etc/sysctl.conf; then
    pass "vm.max_map_count configured"
else
    warn "vm.max_map_count not configured"
fi

if grep -q "fs.file-max=65536" /etc/sysctl.conf; then
    pass "fs.file-max configured"
else
    warn "fs.file-max not configured"
fi

if grep -q "net.core.somaxconn" /etc/sysctl.conf; then
    pass "net.core.somaxconn configured"
else
    warn "net.core.somaxconn not configured"
fi

# Check file limits
if grep -q "nofile 65536" /etc/security/limits.conf; then
    pass "File descriptor limits configured"
else
    warn "File descriptor limits not configured"
fi
echo ""

# 10. Application Directory Structure Check
info "Checking Application Directories..."
check_directory "/opt/ccw-online-erp" "Application root directory"
check_directory "/opt/ccw-online-erp/logs" "Logs directory"
check_directory "/opt/ccw-online-erp/backups" "Backups directory"
check_directory "/opt/ccw-online-erp/uploads" "Uploads directory"
check_directory "/opt/ccw-online-erp/config" "Config directory"

# Check directory ownership
if [ -d "/opt/ccw-online-erp" ]; then
    OWNER=$(stat -c '%U' /opt/ccw-online-erp)
    if [ "$OWNER" = "ccwapp" ]; then
        pass "Application directory owned by ccwapp"
    else
        warn "Application directory not owned by ccwapp (owner: $OWNER)"
    fi
fi
echo ""

# 11. Environment Configuration Check
info "Checking Environment Configuration..."
if [ -f "/opt/ccw-online-erp/config/.env.production" ]; then
    pass "Production environment file exists"

    # Check file permissions
    PERMS=$(stat -c '%a' /opt/ccw-online-erp/config/.env.production)
    if [ "$PERMS" = "600" ]; then
        pass "Environment file has secure permissions (600)"
    else
        warn "Environment file permissions: $PERMS (recommended: 600)"
    fi
elif [ -f "/opt/ccw-online-erp/config/.env.production.sample" ]; then
    warn "Only sample environment file exists (needs configuration)"
else
    warn "No environment file found"
fi
echo ""

# 12. Node.js Check
info "Checking Node.js..."
if sudo -u ccwapp bash -c 'source ~/.nvm/nvm.sh && node --version' &> /dev/null; then
    NODE_VERSION=$(sudo -u ccwapp bash -c 'source ~/.nvm/nvm.sh && node --version')
    pass "Node.js installed: $NODE_VERSION"

    # Check if pnpm is installed
    if sudo -u ccwapp bash -c 'source ~/.nvm/nvm.sh && pnpm --version' &> /dev/null; then
        PNPM_VERSION=$(sudo -u ccwapp bash -c 'source ~/.nvm/nvm.sh && pnpm --version')
        pass "pnpm installed: $PNPM_VERSION"
    else
        warn "pnpm not installed"
    fi
else
    warn "Node.js not installed or not accessible"
fi
echo ""

# 13. Python Check
info "Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    if [[ "$PYTHON_VERSION" == 3.12* ]]; then
        pass "Python 3.12 installed: $PYTHON_VERSION"
    else
        warn "Python installed but not 3.12: $PYTHON_VERSION"
    fi

    # Check if uv is installed
    if sudo -u ccwapp bash -c 'command -v uv' &> /dev/null; then
        pass "uv (Python package manager) installed"
    else
        warn "uv not installed"
    fi
else
    fail "Python not installed"
fi
echo ""

# 14. Docker Configuration Check
info "Checking Docker Configuration..."
if check_file "/etc/docker/daemon.json" "Docker daemon configuration"; then
    # Check logging configuration
    if grep -q "log-driver" /etc/docker/daemon.json; then
        pass "Docker logging configured"
    else
        warn "Docker logging not configured"
    fi

    # Check live-restore
    if grep -q "live-restore" /etc/docker/daemon.json; then
        pass "Docker live-restore enabled"
    else
        warn "Docker live-restore not enabled"
    fi
fi
echo ""

# 15. Automatic Updates Check
info "Checking Automatic Updates..."
if check_file "/etc/apt/apt.conf.d/50unattended-upgrades" "Unattended upgrades configuration"; then
    if grep -q "distro_codename}-security" /etc/apt/apt.conf.d/50unattended-upgrades; then
        pass "Automatic security updates configured"
    else
        warn "Automatic security updates may not be properly configured"
    fi
fi

if check_file "/etc/apt/apt.conf.d/20auto-upgrades" "Auto-upgrades configuration"; then
    pass "Auto-upgrades enabled"
else
    warn "Auto-upgrades configuration not found"
fi
echo ""

# 16. Monitoring Tools Check
info "Checking Monitoring Tools..."
check_command htop "htop"
check_command sysstat "sysstat"
check_command iotop "iotop" || true
check_command iftop "iftop" || true
check_command nethogs "nethogs" || true
check_command ncdu "ncdu" || true

# Check Node Exporter
if check_command node_exporter "Node Exporter"; then
    check_service node_exporter "Node Exporter"
fi
echo ""

# 17. Docker Networks Check
info "Checking Docker Networks..."
if docker network inspect ccw-network &>/dev/null; then
    pass "Docker network 'ccw-network' exists"
else
    warn "Docker network 'ccw-network' not created"
fi
echo ""

# 18. Helper Scripts Check
info "Checking Helper Scripts..."
if [ -f "/usr/local/bin/ccw-health-check" ]; then
    pass "Health check script exists"

    # Check if executable
    if [ -x "/usr/local/bin/ccw-health-check" ]; then
        pass "Health check script is executable"
    else
        warn "Health check script not executable"
    fi
else
    warn "Health check script not found"
fi

if [ -f "/usr/local/bin/ccw-backup" ]; then
    pass "Backup script exists"

    # Check if executable
    if [ -x "/usr/local/bin/ccw-backup" ]; then
        pass "Backup script is executable"
    else
        warn "Backup script not executable"
    fi
else
    warn "Backup script not found"
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

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Server provisioning verified successfully!${NC}"
    echo ""
    info "Server is ready for application deployment."
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Server provisioning verified with warnings.${NC}"
    echo ""
    warn "Review warnings above and address if necessary."
    exit 0
else
    echo -e "${RED}✗ Server provisioning verification failed.${NC}"
    echo ""
    fail "Critical issues found. Please review failed checks above."
    exit 1
fi
