#!/bin/bash
# Firewall Configuration Script for CCW-Online ERP (Ubuntu/UFW)
# This script configures firewall rules for production deployment

set -e

echo "=========================================="
echo "CCW-Online ERP - Firewall Configuration"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Please run as root (sudo)"
    exit 1
fi

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
    echo "Installing UFW..."
    apt-get update
    apt-get install -y ufw
fi

echo "Configuring UFW firewall rules..."
echo ""

# Reset UFW to defaults
echo "1. Resetting UFW to defaults..."
ufw --force reset

# Default policies: deny incoming, allow outgoing
echo "2. Setting default policies..."
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (port 22) - RESTRICT TO SPECIFIC IPs IN PRODUCTION
echo "3. Allowing SSH (port 22)..."
ufw allow 22/tcp comment 'SSH access'
# For production, restrict to specific IPs:
# ufw allow from YOUR_IP_ADDRESS to any port 22 proto tcp

# Allow HTTP (port 80)
echo "4. Allowing HTTP (port 80)..."
ufw allow 80/tcp comment 'HTTP traffic'

# Allow HTTPS (port 443)
echo "5. Allowing HTTPS (port 443)..."
ufw allow 443/tcp comment 'HTTPS traffic'

# PostgreSQL (port 5432) - INTERNAL ONLY
echo "6. Configuring PostgreSQL (port 5432) - localhost only..."
# Do NOT expose PostgreSQL to external network
# Only allow from localhost/docker network
# ufw allow from 172.17.0.0/16 to any port 5432 proto tcp comment 'PostgreSQL from Docker'

# Redis (port 6379) - INTERNAL ONLY
echo "7. Configuring Redis (port 6379) - localhost only..."
# Do NOT expose Redis to external network
# ufw allow from 172.17.0.0/16 to any port 6379 proto tcp comment 'Redis from Docker'

# Backend API (port 8000) - INTERNAL ONLY (behind nginx)
echo "8. Backend API (port 8000) - internal only..."
# Backend should NOT be directly exposed
# Access only through nginx reverse proxy

# Rate limiting
echo "9. Configuring rate limiting..."
ufw limit 22/tcp comment 'Rate limit SSH'
ufw limit 80/tcp comment 'Rate limit HTTP'
ufw limit 443/tcp comment 'Rate limit HTTPS'

# Enable UFW
echo "10. Enabling UFW..."
ufw --force enable

echo ""
echo "=========================================="
echo "Firewall configuration complete!"
echo "=========================================="
echo ""
echo "Active rules:"
ufw status numbered

echo ""
echo "IMPORTANT SECURITY NOTES:"
echo "1. SSH (port 22) is open to all IPs - RESTRICT THIS IN PRODUCTION"
echo "   Run: ufw delete allow 22/tcp"
echo "   Then: ufw allow from YOUR_IP to any port 22"
echo ""
echo "2. PostgreSQL and Redis are NOT exposed externally"
echo "3. Backend API (port 8000) should be accessed via nginx only"
echo "4. Configure nginx as reverse proxy for production"
echo ""
echo "To view logs: ufw status verbose"
echo "To disable: ufw disable"
echo ""
