#!/bin/bash
# Server Provisioning Script for CCW-Online ERP
# Version: 1.0
# Description: Automated Ubuntu 22.04 LTS server provisioning
# Related: ISS-011

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

# Check Ubuntu version
if ! grep -q "22.04" /etc/os-release; then
    log_error "This script requires Ubuntu 22.04 LTS"
    exit 1
fi

log_info "Starting CCW-Online ERP server provisioning..."

# Update system packages
log_info "Updating system packages..."
apt update
apt upgrade -y

# Install essential utilities
log_info "Installing essential utilities..."
apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    unattended-upgrades

# Create application user
log_info "Creating application user (ccwapp)..."
if ! id -u ccwapp >/dev/null 2>&1; then
    useradd -m -s /bin/bash ccwapp
    usermod -aG sudo ccwapp
    log_info "User 'ccwapp' created successfully"
else
    log_warn "User 'ccwapp' already exists, skipping..."
fi

# Install Docker
log_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add ccwapp user to docker group
    usermod -aG docker ccwapp

    # Enable Docker to start on boot
    systemctl enable docker
    systemctl start docker

    log_info "Docker installed successfully: $(docker --version)"
else
    log_warn "Docker already installed, skipping..."
fi

# Configure Docker daemon
log_info "Configuring Docker daemon..."
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true,
  "userland-proxy": false,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
EOF

systemctl restart docker

# Configure Firewall (UFW)
log_info "Configuring firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow application ports from private networks only
ufw allow from 10.0.0.0/8 to any port 3000 proto tcp comment 'Next.js'
ufw allow from 10.0.0.0/8 to any port 8000 proto tcp comment 'FastAPI'
ufw allow from 172.16.0.0/12 to any port 3000 proto tcp comment 'Next.js'
ufw allow from 172.16.0.0/12 to any port 8000 proto tcp comment 'FastAPI'
ufw allow from 192.168.0.0/16 to any port 3000 proto tcp comment 'Next.js'
ufw allow from 192.168.0.0/16 to any port 8000 proto tcp comment 'FastAPI'

# Enable firewall
ufw --force enable

log_info "Firewall configured and enabled"

# Configure Fail2ban
log_info "Configuring Fail2ban..."
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

cat > /etc/fail2ban/jail.d/sshd.conf <<EOF
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl restart fail2ban

log_info "Fail2ban configured and started"

# System tuning
log_info "Applying system tuning..."
cat >> /etc/sysctl.conf <<EOF

# CCW-Online ERP Production Tuning
vm.max_map_count=262144
fs.file-max=65536
net.core.somaxconn=1024
net.ipv4.tcp_max_syn_backlog=2048
EOF

sysctl -p

# Increase file descriptor limits
cat >> /etc/security/limits.conf <<EOF
* soft nofile 65536
* hard nofile 65536
EOF

log_info "System tuning applied"

# Create application directory structure
log_info "Creating application directories..."
mkdir -p /opt/ccw-online-erp/{logs,backups,uploads,config}
chown -R ccwapp:ccwapp /opt/ccw-online-erp
chmod 755 /opt/ccw-online-erp
chmod 750 /opt/ccw-online-erp/{logs,backups,uploads,config}

log_info "Application directories created"

# Install Node.js via nvm (as ccwapp user)
log_info "Installing Node.js 20.x LTS..."
sudo -u ccwapp bash <<'SCRIPT'
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
    npm install -g pnpm
    echo "Node.js installed: $(node --version)"
    echo "pnpm installed: $(pnpm --version)"
else
    echo "Node.js already installed, skipping..."
fi
SCRIPT

# Install Python 3.12
log_info "Installing Python 3.12..."
if ! command -v python3.12 &> /dev/null; then
    add-apt-repository -y ppa:deadsnakes/ppa
    apt update
    apt install -y python3.12 python3.12-venv python3.12-dev python3-pip

    # Make Python 3.12 the default
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1

    log_info "Python installed: $(python3 --version)"
else
    log_warn "Python 3.12 already installed, skipping..."
fi

# Install uv (Python package manager)
log_info "Installing uv..."
sudo -u ccwapp bash <<'SCRIPT'
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    echo "uv installed successfully"
else
    echo "uv already installed, skipping..."
fi
SCRIPT

# Harden SSH configuration
log_info "Hardening SSH configuration..."
cat >> /etc/ssh/sshd_config <<EOF

# CCW-Online ERP SSH Hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
MaxSessions 5
EOF

systemctl restart sshd

log_info "SSH hardened"

# Configure automatic security updates
log_info "Configuring automatic security updates..."
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

dpkg-reconfigure -plow unattended-upgrades

log_info "Automatic security updates enabled"

# Install Node Exporter for Prometheus
log_info "Installing Node Exporter..."
if ! command -v node_exporter &> /dev/null; then
    cd /tmp
    wget -q https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
    tar xzf node_exporter-1.7.0.linux-amd64.tar.gz
    cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
    chown root:root /usr/local/bin/node_exporter
    rm -rf node_exporter-1.7.0.linux-amd64*

    # Create prometheus user
    useradd --no-create-home --shell /bin/false prometheus || true

    # Create systemd service
    cat > /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl start node_exporter
    systemctl enable node_exporter

    log_info "Node Exporter installed and started"
else
    log_warn "Node Exporter already installed, skipping..."
fi

# Create a sample environment file
log_info "Creating sample environment file..."
cat > /opt/ccw-online-erp/config/.env.production.sample <<EOF
# Database
DATABASE_URL=postgresql://ccw_user:CHANGEME@localhost:5432/ccw_production

# Redis
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.ccw-online.com
BACKEND_URL=http://localhost:8000

# Security
JWT_SECRET=CHANGEME_GENERATE_STRONG_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440

# AI Providers (optional)
AI_PROVIDER=openai
OPENAI_API_KEY=CHANGEME_IF_USING_OPENAI

# Monitoring
PROMETHEUS_ENABLED=true
METRICS_PORT=9090

# Email (for alerts)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@ccw-online.com
SMTP_PASSWORD=CHANGEME
SMTP_FROM=noreply@ccw-online.com
EOF

chown ccwapp:ccwapp /opt/ccw-online-erp/config/.env.production.sample
chmod 600 /opt/ccw-online-erp/config/.env.production.sample

log_info "Sample environment file created at /opt/ccw-online-erp/config/.env.production.sample"

# Display summary
echo ""
log_info "========================================"
log_info "Server Provisioning Complete!"
log_info "========================================"
echo ""
log_info "Summary:"
echo "  - Ubuntu 22.04 LTS: Updated"
echo "  - Docker: $(docker --version)"
echo "  - Docker Compose: $(docker compose version)"
echo "  - Application user: ccwapp"
echo "  - Firewall: Enabled (UFW)"
echo "  - Fail2ban: Active"
echo "  - SSH: Hardened"
echo "  - Automatic updates: Enabled"
echo "  - Node.js: Installed (run 'sudo -u ccwapp node --version' to verify)"
echo "  - Python: $(python3 --version)"
echo "  - Application directory: /opt/ccw-online-erp"
echo ""
log_warn "IMPORTANT NEXT STEPS:"
echo "  1. Set password for ccwapp user: sudo passwd ccwapp"
echo "  2. Configure SSH key authentication for ccwapp"
echo "  3. Copy and configure environment file:"
echo "     cp /opt/ccw-online-erp/config/.env.production.sample /opt/ccw-online-erp/config/.env.production"
echo "     vim /opt/ccw-online-erp/config/.env.production"
echo "  4. Configure SSL/TLS certificates (see docs/SSL_SETUP.md)"
echo "  5. Set up Nginx load balancer (see docs/LOAD_BALANCER.md)"
echo "  6. Initialize database and deploy application"
echo ""
log_info "Provisioning script completed successfully!"
