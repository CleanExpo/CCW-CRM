#!/bin/bash
# SSL/TLS Certificate Setup Script for CCW-Online ERP
# Version: 1.0
# Description: Automated Let's Encrypt SSL certificate setup
# Related: ISS-012

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Configuration
FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-ccw-online.com}"
FRONTEND_WWW="${FRONTEND_WWW:-www.ccw-online.com}"
BACKEND_DOMAIN="${BACKEND_DOMAIN:-api.ccw-online.com}"
EMAIL="${SSL_EMAIL:-admin@ccw-online.com}"
WEBROOT="/var/www/letsencrypt"

log_info "SSL/TLS Certificate Setup for CCW-Online ERP"
echo ""
log_info "Configuration:"
echo "  Frontend domain: $FRONTEND_DOMAIN"
echo "  Frontend www: $FRONTEND_WWW"
echo "  Backend domain: $BACKEND_DOMAIN"
echo "  Contact email: $EMAIL"
echo ""

# Prompt for confirmation
read -p "Is this configuration correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_error "Setup cancelled. Set environment variables and try again:"
    echo "  export FRONTEND_DOMAIN=yourdomain.com"
    echo "  export BACKEND_DOMAIN=api.yourdomain.com"
    echo "  export SSL_EMAIL=your@email.com"
    exit 1
fi

# Install certbot if not present
log_info "Checking for certbot..."
if ! command -v certbot &> /dev/null; then
    log_info "Installing certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
    log_info "Certbot installed successfully"
else
    log_info "Certbot already installed: $(certbot --version)"
fi

# Create webroot directory for ACME challenges
log_info "Creating webroot directory..."
mkdir -p "$WEBROOT"
chown -R www-data:www-data "$WEBROOT"

# Check DNS resolution
log_info "Checking DNS resolution..."
check_dns() {
    local domain=$1
    local ip=$(dig +short "$domain" A | head -1)
    if [ -z "$ip" ]; then
        log_error "DNS resolution failed for $domain"
        return 1
    else
        log_info "DNS resolved: $domain -> $ip"
        return 0
    fi
}

dns_ok=true
check_dns "$FRONTEND_DOMAIN" || dns_ok=false
check_dns "$FRONTEND_WWW" || dns_ok=false
check_dns "$BACKEND_DOMAIN" || dns_ok=false

if [ "$dns_ok" = false ]; then
    log_error "DNS resolution failed for one or more domains"
    log_warn "Please configure DNS records and try again"
    exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    log_error "Nginx is not installed. Please install Nginx first:"
    echo "  sudo apt install nginx"
    exit 1
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    log_warn "Nginx is not running. Starting Nginx..."
    systemctl start nginx
fi

# Obtain certificate for frontend domain
log_info "Obtaining SSL certificate for frontend ($FRONTEND_DOMAIN, $FRONTEND_WWW)..."
if certbot certonly --nginx \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$FRONTEND_DOMAIN" \
    -d "$FRONTEND_WWW"; then
    log_info "Frontend certificate obtained successfully"
else
    log_error "Failed to obtain frontend certificate"
    exit 1
fi

# Obtain certificate for backend domain
log_info "Obtaining SSL certificate for backend ($BACKEND_DOMAIN)..."
if certbot certonly --nginx \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$BACKEND_DOMAIN"; then
    log_info "Backend certificate obtained successfully"
else
    log_error "Failed to obtain backend certificate"
    exit 1
fi

# Display certificate information
log_info "Certificate information:"
certbot certificates

# Create renewal hook to reload Nginx
log_info "Creating renewal hooks..."
mkdir -p /etc/letsencrypt/renewal-hooks/post

cat > /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh <<'EOF'
#!/bin/bash
systemctl reload nginx
logger "SSL certificates renewed and Nginx reloaded"
EOF

chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
log_info "Renewal hook created"

# Test automatic renewal
log_info "Testing automatic renewal (dry run)..."
if certbot renew --dry-run; then
    log_info "Renewal test passed"
else
    log_warn "Renewal test failed. Please check certbot configuration"
fi

# Create SSL expiry monitoring script
log_info "Creating SSL expiry monitoring script..."
cat > /usr/local/bin/check-ssl-expiry.sh <<'SCRIPT'
#!/bin/bash
# Check SSL certificate expiry and alert if < 14 days

DOMAINS=("ccw-online.com" "api.ccw-online.com")
ALERT_DAYS=14

for DOMAIN in "${DOMAINS[@]}"; do
    if ! EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | \
             openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2); then
        echo "ERROR: Failed to check certificate for $DOMAIN"
        logger -p user.error "Failed to check SSL certificate for $DOMAIN"
        continue
    fi

    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

    if [ $DAYS_LEFT -lt $ALERT_DAYS ]; then
        echo "WARNING: SSL certificate for $DOMAIN expires in $DAYS_LEFT days"
        logger -p user.warning "SSL certificate for $DOMAIN expires in $DAYS_LEFT days"
    else
        echo "OK: SSL certificate for $DOMAIN expires in $DAYS_LEFT days"
    fi
done
SCRIPT

chmod +x /usr/local/bin/check-ssl-expiry.sh
log_info "SSL expiry monitoring script created"

# Add to crontab if not already present
if ! crontab -l 2>/dev/null | grep -q "check-ssl-expiry.sh"; then
    (crontab -l 2>/dev/null; echo "0 9 * * * /usr/local/bin/check-ssl-expiry.sh") | crontab -
    log_info "Added SSL expiry check to crontab (runs daily at 9 AM)"
fi

# Verify certbot timer is enabled
log_info "Verifying certbot renewal timer..."
if systemctl is-enabled --quiet certbot.timer; then
    log_info "Certbot renewal timer is enabled"
else
    log_warn "Certbot renewal timer is not enabled. Enabling now..."
    systemctl enable certbot.timer
    systemctl start certbot.timer
fi

# Generate DH parameters for enhanced security (this takes a while)
log_info "Checking for DH parameters..."
if [ ! -f /etc/ssl/certs/dhparam.pem ]; then
    log_info "Generating DH parameters (this may take several minutes)..."
    openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
    log_info "DH parameters generated"
else
    log_info "DH parameters already exist"
fi

# Test SSL configuration
log_info "Testing SSL configuration..."
test_ssl() {
    local domain=$1
    if curl -sSf -I "https://$domain" > /dev/null 2>&1; then
        log_info "SSL test passed for $domain"
        return 0
    else
        log_warn "SSL test failed for $domain (Nginx may not be configured yet)"
        return 1
    fi
}

# Wait a moment for Nginx to reload
sleep 2

# Run SSL tests (may fail if Nginx not fully configured yet)
test_ssl "$FRONTEND_DOMAIN" || true
test_ssl "$BACKEND_DOMAIN" || true

# Display summary
echo ""
log_info "========================================"
log_info "SSL/TLS Setup Complete!"
log_info "========================================"
echo ""
log_info "Certificates obtained for:"
echo "  - $FRONTEND_DOMAIN"
echo "  - $FRONTEND_WWW"
echo "  - $BACKEND_DOMAIN"
echo ""
log_info "Certificate locations:"
echo "  Frontend: /etc/letsencrypt/live/$FRONTEND_DOMAIN/"
echo "  Backend: /etc/letsencrypt/live/$BACKEND_DOMAIN/"
echo ""
log_info "Automatic renewal:"
echo "  - Certbot timer: $(systemctl is-enabled certbot.timer)"
echo "  - Next run: $(systemctl list-timers | grep certbot | awk '{print $1, $2}')"
echo "  - Renewal hook: /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh"
echo ""
log_info "Monitoring:"
echo "  - Expiry check: /usr/local/bin/check-ssl-expiry.sh"
echo "  - Runs daily at 9 AM via cron"
echo ""
log_warn "IMPORTANT NEXT STEPS:"
echo "  1. Configure Nginx with SSL certificates (see docs/LOAD_BALANCER.md)"
echo "  2. Reload Nginx: sudo systemctl reload nginx"
echo "  3. Test SSL configuration: curl -I https://$FRONTEND_DOMAIN"
echo "  4. Check SSL grade: https://www.ssllabs.com/ssltest/analyze.html?d=$FRONTEND_DOMAIN"
echo "  5. Consider HSTS preload: https://hstspreload.org/"
echo ""
log_info "SSL setup script completed successfully!"
