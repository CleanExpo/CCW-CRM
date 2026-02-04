# Server Provisioning Guide

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-011

---

## Overview

This guide documents the production server provisioning process for CCW-Online ERP. The application requires Ubuntu 22.04 LTS servers with Docker containerization.

## Server Requirements

### Minimum Production Specifications

| Component | Specification |
|-----------|---------------|
| **Operating System** | Ubuntu 22.04 LTS (Jammy Jellyfish) |
| **CPU** | 8 cores (x86_64) |
| **RAM** | 16 GB |
| **Storage** | 200 GB SSD (NVMe preferred) |
| **Network** | 1 Gbps connection, static IP |
| **Backup Storage** | 500 GB (S3-compatible or equivalent) |

### Multi-Server Architecture

For high availability, the recommended architecture is:

```
┌─────────────────────────────────────────────┐
│ Load Balancer (Nginx)                       │
│ - 2 vCPU, 4GB RAM                           │
│ - Ubuntu 22.04 LTS                          │
└─────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────────┐   ┌─────────────┐
│ App Server 1│   │ App Server 2│
│ 8 cores     │   │ 8 cores     │
│ 16GB RAM    │   │ 16GB RAM    │
│ 200GB SSD   │   │ 200GB SSD   │
└─────────────┘   └─────────────┘
    │                   │
    └─────────┬─────────┘
              ▼
┌─────────────────────────────────────────────┐
│ Database Server (PostgreSQL 15)            │
│ - 8 cores, 32GB RAM, 500GB SSD             │
│ - Ubuntu 22.04 LTS                          │
└─────────────────────────────────────────────┘
```

## Server Setup Process

### 1. Initial System Setup

```bash
# Run the automated provisioning script
./scripts/provision-server.sh

# Or follow manual steps below
```

### 2. Manual Provisioning Steps

#### Update System Packages

```bash
# Update package lists
sudo apt update

# Upgrade all packages
sudo apt upgrade -y

# Install essential utilities
sudo apt install -y \
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
    fail2ban
```

#### Configure System User

```bash
# Create application user
sudo useradd -m -s /bin/bash ccwapp
sudo usermod -aG sudo ccwapp
sudo usermod -aG docker ccwapp

# Set strong password
sudo passwd ccwapp

# Configure SSH key authentication (recommended)
sudo -u ccwapp mkdir -p /home/ccwapp/.ssh
sudo -u ccwapp chmod 700 /home/ccwapp/.ssh

# Add your public key to authorized_keys
sudo -u ccwapp vim /home/ccwapp/.ssh/authorized_keys
sudo -u ccwapp chmod 600 /home/ccwapp/.ssh/authorized_keys
```

#### Install Docker

```bash
# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
sudo docker --version
sudo docker compose version

# Enable Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker
```

#### Configure Firewall (UFW)

```bash
# Reset firewall to default
sudo ufw --force reset

# Default policies: deny incoming, allow outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if using non-standard)
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow application ports (internal)
# Note: These should only be accessible via load balancer in production
sudo ufw allow from 10.0.0.0/8 to any port 3000 proto tcp comment 'Next.js'
sudo ufw allow from 10.0.0.0/8 to any port 8000 proto tcp comment 'FastAPI'

# Enable firewall
sudo ufw --force enable

# Verify status
sudo ufw status verbose
```

#### Configure Fail2ban

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Create local configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Configure SSH protection
sudo tee /etc/fail2ban/jail.d/sshd.conf > /dev/null <<EOF
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

# Start and enable fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
```

#### System Tuning

```bash
# Increase system limits for Docker
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF

# CCW-Online ERP Production Tuning
vm.max_map_count=262144
fs.file-max=65536
net.core.somaxconn=1024
net.ipv4.tcp_max_syn_backlog=2048
EOF

# Apply changes
sudo sysctl -p

# Increase file descriptor limits
sudo tee -a /etc/security/limits.conf > /dev/null <<EOF
* soft nofile 65536
* hard nofile 65536
EOF
```

### 3. Application Deployment Directory Structure

```bash
# Create application directory structure
sudo mkdir -p /opt/ccw-online-erp
sudo chown ccwapp:ccwapp /opt/ccw-online-erp

# Create required subdirectories
sudo -u ccwapp mkdir -p /opt/ccw-online-erp/{logs,backups,uploads,config}

# Set permissions
sudo chmod 755 /opt/ccw-online-erp
sudo chmod 750 /opt/ccw-online-erp/{logs,backups,uploads,config}
```

### 4. Install Node.js (for Next.js application)

```bash
# Install Node.js 20.x LTS via nvm (as ccwapp user)
sudo -u ccwapp bash <<'EOF'
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Install pnpm
npm install -g pnpm
EOF
```

### 5. Install Python (for FastAPI backend)

```bash
# Install Python 3.12
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3.12-dev python3-pip

# Make Python 3.12 the default
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1

# Verify installation
python3 --version  # Should show Python 3.12.x

# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.cargo/env
```

## Environment Configuration

### Create Environment Files

```bash
# Production environment file
sudo -u ccwapp tee /opt/ccw-online-erp/config/.env.production > /dev/null <<EOF
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

# Set strict permissions
sudo chmod 600 /opt/ccw-online-erp/config/.env.production
```

## Docker Configuration

### Docker Daemon Configuration

```bash
# Configure Docker logging and resource limits
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
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

# Restart Docker to apply changes
sudo systemctl restart docker
```

## Security Hardening

### SSH Configuration

```bash
# Harden SSH configuration
sudo tee -a /etc/ssh/sshd_config > /dev/null <<EOF

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

# Restart SSH service
sudo systemctl restart sshd
```

### Automatic Security Updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Configure automatic security updates
sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null <<EOF
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

# Enable automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Monitoring Setup

### Install Node Exporter (for Prometheus)

```bash
# Download and install Node Exporter
cd /tmp
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
sudo cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
sudo chown root:root /usr/local/bin/node_exporter

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
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

# Create prometheus user
sudo useradd --no-create-home --shell /bin/false prometheus

# Start and enable service
sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter
```

## Verification Checklist

After provisioning, verify the following:

- [ ] Ubuntu 22.04 LTS installed and updated
- [ ] Docker and Docker Compose installed (`docker --version`, `docker compose version`)
- [ ] Application user (ccwapp) created and configured
- [ ] Firewall (UFW) configured and enabled
- [ ] Fail2ban installed and protecting SSH
- [ ] System tuning applied (`sysctl -p`)
- [ ] Node.js 20.x installed (`node --version`)
- [ ] Python 3.12 installed (`python3 --version`)
- [ ] Application directories created (`/opt/ccw-online-erp/`)
- [ ] Environment file created and secured (`.env.production`)
- [ ] SSH hardened (root login disabled, key-only auth)
- [ ] Automatic security updates enabled
- [ ] Node Exporter running for monitoring

```bash
# Run comprehensive verification
./scripts/verify-server-provisioning.sh
```

## Troubleshooting

### Docker Permission Issues

```bash
# If ccwapp user cannot run docker commands
sudo usermod -aG docker ccwapp
# User must log out and back in for group change to take effect
```

### Firewall Blocking Legitimate Traffic

```bash
# Check firewall logs
sudo tail -f /var/log/ufw.log

# Temporarily disable to test
sudo ufw disable
# Re-enable after testing
sudo ufw enable
```

### System Resource Exhaustion

```bash
# Check system resources
htop
df -h
free -h

# Check Docker resource usage
docker stats
```

## Next Steps

After server provisioning is complete:

1. **SSL/TLS Setup**: Configure Let's Encrypt certificates (see `SSL_SETUP.md`)
2. **Load Balancer**: Configure Nginx reverse proxy (see `LOAD_BALANCER.md`)
3. **Database Setup**: Initialize PostgreSQL database
4. **Application Deployment**: Deploy Docker containers
5. **Backup Configuration**: Set up automated backups (see `BACKUP_STRATEGY.md`)

## References

- [Ubuntu 22.04 LTS Documentation](https://ubuntu.com/server/docs)
- [Docker Documentation](https://docs.docker.com/)
- [UFW Documentation](https://help.ubuntu.com/community/UFW)
- [Fail2ban Documentation](https://www.fail2ban.org/)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or when infrastructure requirements change
