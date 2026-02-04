# SSL/TLS Certificate Setup Guide

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-012

---

## Overview

This guide documents the SSL/TLS certificate setup process for CCW-Online ERP using Let's Encrypt. The system will use TLS 1.3 with automatic certificate renewal and HSTS headers for enhanced security.

## Prerequisites

- Domain names pointed to server IP address:
  - `ccw-online.com` (frontend)
  - `api.ccw-online.com` (backend API)
- Server provisioned with Ubuntu 22.04 LTS
- Nginx installed (see `LOAD_BALANCER.md`)
- Ports 80 and 443 open in firewall

## Domains and Certificate Strategy

### Domain Configuration

| Domain | Purpose | Port | Service |
|--------|---------|------|---------|
| `ccw-online.com` | Frontend (Next.js) | 443 | Web Application |
| `www.ccw-online.com` | Redirect to main | 443 | Redirect |
| `api.ccw-online.com` | Backend (FastAPI) | 443 | API Server |

### Certificate Type

**Recommendation**: Use separate certificates for each domain (not wildcard) for better security isolation and easier management.

## Installation Process

### 1. Install Certbot

```bash
# Install certbot and Nginx plugin
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Verify installation
certbot --version
```

### 2. Configure DNS Records

Before obtaining certificates, ensure DNS is properly configured:

```bash
# Check DNS resolution
dig ccw-online.com A
dig www.ccw-online.com A
dig api.ccw-online.com A

# All should point to your server's public IP address
```

**Expected Output**:
```
ccw-online.com.         300     IN      A       203.0.113.10
www.ccw-online.com.     300     IN      A       203.0.113.10
api.ccw-online.com.     300     IN      A       203.0.113.10
```

### 3. Obtain SSL Certificates

#### Method A: Automatic Nginx Configuration (Recommended)

```bash
# Obtain certificate for main domain
sudo certbot --nginx -d ccw-online.com -d www.ccw-online.com

# Obtain certificate for API domain
sudo certbot --nginx -d api.ccw-online.com

# Follow the interactive prompts:
# 1. Enter email address for renewal notifications
# 2. Agree to Terms of Service
# 3. Choose whether to redirect HTTP to HTTPS (recommended: yes)
```

#### Method B: Manual Webroot Configuration

If you prefer manual configuration or already have Nginx configured:

```bash
# Create webroot directory for challenges
sudo mkdir -p /var/www/letsencrypt

# Obtain certificate without modifying Nginx
sudo certbot certonly --webroot \
    -w /var/www/letsencrypt \
    -d ccw-online.com \
    -d www.ccw-online.com

sudo certbot certonly --webroot \
    -w /var/www/letsencrypt \
    -d api.ccw-online.com

# Then manually configure Nginx (see nginx configuration section)
```

### 4. Verify Certificate Installation

```bash
# Check certificate details
sudo certbot certificates

# Test SSL configuration
curl -I https://ccw-online.com
curl -I https://api.ccw-online.com

# Use online SSL checker
# Visit: https://www.ssllabs.com/ssltest/
```

## Nginx SSL Configuration

### Frontend Configuration (`ccw-online.com`)

```nginx
# /etc/nginx/sites-available/ccw-online-frontend
server {
    listen 80;
    listen [::]:80;
    server_name ccw-online.com www.ccw-online.com;

    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ccw-online.com www.ccw-online.com;

    # SSL Certificate Configuration
    ssl_certificate /etc/letsencrypt/live/ccw-online.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ccw-online.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/ccw-online.com/chain.pem;

    # SSL Protocol and Cipher Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # SSL Session Configuration
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Next.js application proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Backend API Configuration (`api.ccw-online.com`)

```nginx
# /etc/nginx/sites-available/ccw-online-backend
server {
    listen 80;
    listen [::]:80;
    server_name api.ccw-online.com;

    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.ccw-online.com;

    # SSL Certificate Configuration
    ssl_certificate /etc/letsencrypt/live/api.ccw-online.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ccw-online.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/api.ccw-online.com/chain.pem;

    # SSL Protocol and Cipher Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # SSL Session Configuration
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # CORS Headers (if needed)
    add_header Access-Control-Allow-Origin "https://ccw-online.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;

    # FastAPI application proxy
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Automatic Certificate Renewal

### Certbot Renewal Configuration

Certbot automatically installs a systemd timer for certificate renewal. Verify it's enabled:

```bash
# Check renewal timer status
sudo systemctl status certbot.timer

# List timers
sudo systemctl list-timers | grep certbot

# Test renewal (dry run)
sudo certbot renew --dry-run
```

### Manual Renewal Test

```bash
# Force renewal (if certificate is close to expiry)
sudo certbot renew --force-renewal

# Reload Nginx after renewal
sudo systemctl reload nginx
```

### Renewal Hooks

Create a renewal hook to automatically reload Nginx:

```bash
# Create renewal hook script
sudo mkdir -p /etc/letsencrypt/renewal-hooks/post

sudo tee /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh > /dev/null <<'EOF'
#!/bin/bash
systemctl reload nginx
logger "SSL certificates renewed and Nginx reloaded"
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
```

### Monitor Renewal

Set up monitoring to alert if renewal fails:

```bash
# Create monitoring script
sudo tee /usr/local/bin/check-ssl-expiry.sh > /dev/null <<'EOF'
#!/bin/bash
# Check SSL certificate expiry and alert if < 14 days

DOMAINS=("ccw-online.com" "api.ccw-online.com")
ALERT_DAYS=14

for DOMAIN in "${DOMAINS[@]}"; do
    EXPIRY=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | \
             openssl x509 -noout -enddate | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

    if [ $DAYS_LEFT -lt $ALERT_DAYS ]; then
        echo "WARNING: SSL certificate for $DOMAIN expires in $DAYS_LEFT days"
        # Send alert (integrate with monitoring system)
        logger -p user.warning "SSL certificate for $DOMAIN expires in $DAYS_LEFT days"
    else
        echo "OK: SSL certificate for $DOMAIN expires in $DAYS_LEFT days"
    fi
done
EOF

sudo chmod +x /usr/local/bin/check-ssl-expiry.sh

# Add to crontab (run daily at 9 AM)
echo "0 9 * * * /usr/local/bin/check-ssl-expiry.sh" | sudo tee -a /etc/crontab
```

## SSL Configuration Testing

### Test SSL Strength

```bash
# Test TLS versions
openssl s_client -connect ccw-online.com:443 -tls1_2
openssl s_client -connect ccw-online.com:443 -tls1_3

# Test HSTS headers
curl -I https://ccw-online.com | grep -i strict

# Expected output:
# strict-transport-security: max-age=63072000; includeSubDomains; preload
```

### Online SSL Testing Tools

1. **SSL Labs**: https://www.ssllabs.com/ssltest/
   - Target Grade: A+ rating

2. **Security Headers**: https://securityheaders.com/
   - Target Grade: A rating

3. **Mozilla Observatory**: https://observatory.mozilla.org/
   - Target Score: 95+ / 100

## Security Best Practices

### 1. TLS Configuration

- **Use TLS 1.2 and 1.3 only** (disable TLS 1.0 and 1.1)
- **Modern cipher suites** (prioritize ECDHE and GCM)
- **Disable SSL session tickets** (prevents key compromise)
- **Enable OCSP stapling** (improves performance and privacy)

### 2. HSTS Configuration

```nginx
# HSTS with preload (requires domain registration at hstspreload.org)
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

**Note**: Only add `preload` directive after registering at https://hstspreload.org/

### 3. Certificate Transparency

Let's Encrypt automatically logs certificates to CT logs. Verify:

```bash
# Check CT logs
curl -s "https://crt.sh/?q=ccw-online.com&output=json" | jq
```

### 4. Security Headers Checklist

- [x] `Strict-Transport-Security` (HSTS)
- [x] `X-Frame-Options` (clickjacking protection)
- [x] `X-Content-Type-Options` (MIME sniffing protection)
- [x] `X-XSS-Protection` (XSS protection)
- [x] `Referrer-Policy` (referrer leakage protection)
- [ ] `Content-Security-Policy` (optional, configure based on app needs)

## Troubleshooting

### Certificate Acquisition Fails

```bash
# Check DNS resolution
dig ccw-online.com A

# Check port 80 accessibility
curl -I http://ccw-online.com

# Check Nginx configuration
sudo nginx -t

# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Renewal Fails

```bash
# Check renewal configuration
sudo cat /etc/letsencrypt/renewal/ccw-online.com.conf

# Test renewal with verbose output
sudo certbot renew --dry-run --verbose

# Manually renew
sudo certbot renew --force-renewal
```

### Mixed Content Warnings

If you see mixed content warnings in the browser:

1. Ensure all resources load via HTTPS
2. Check for hardcoded HTTP URLs in code
3. Use relative URLs or HTTPS URLs only

```bash
# Search for HTTP URLs in codebase
grep -r "http://" apps/ | grep -v "localhost"
```

### Certificate Mismatch

If you see certificate mismatch errors:

```bash
# Check which certificate Nginx is serving
echo | openssl s_client -servername ccw-online.com -connect ccw-online.com:443 2>/dev/null | \
    openssl x509 -noout -text | grep -A2 "Subject:"

# Verify Nginx configuration
sudo nginx -T | grep ssl_certificate
```

## Monitoring and Alerts

### Prometheus Metrics

Configure SSL certificate expiry monitoring in Prometheus:

```yaml
# Add to prometheus/prometheus.yml
scrape_configs:
  - job_name: 'blackbox'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - https://ccw-online.com
        - https://api.ccw-online.com
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: 127.0.0.1:9115  # Blackbox exporter
```

### Email Alerts

Certbot sends renewal failure emails to the address provided during setup. Ensure this email is monitored.

## Emergency Certificate Revocation

If a private key is compromised:

```bash
# Revoke certificate immediately
sudo certbot revoke --cert-path /etc/letsencrypt/live/ccw-online.com/cert.pem

# Obtain new certificate
sudo certbot --nginx -d ccw-online.com -d www.ccw-online.com --force-renewal
```

## Automation Script

Use the provided automation script for easy setup:

```bash
# Run SSL setup script
sudo ./scripts/setup-ssl.sh
```

## Verification Checklist

After SSL setup, verify:

- [ ] Certificates obtained for all domains
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header present
- [ ] SSL Labs grade A or A+
- [ ] OCSP stapling enabled
- [ ] Automatic renewal configured and tested
- [ ] Renewal hooks created
- [ ] Monitoring alerts configured
- [ ] No mixed content warnings
- [ ] All security headers present

## References

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot User Guide](https://eff-certbot.readthedocs.io/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or when security standards change
