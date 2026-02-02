# Load Balancer Configuration Guide

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-013

---

## Overview

This guide documents the Nginx load balancer and reverse proxy configuration for CCW-Online ERP. Nginx serves as the entry point for all traffic, handling SSL termination, rate limiting, caching, and proxying requests to Next.js (frontend) and FastAPI (backend) applications.

## Architecture

```
                        ┌──────────────────────┐
                        │   Internet Traffic   │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   Nginx (Port 443)   │
                        │  Load Balancer &     │
                        │   Reverse Proxy      │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
         ┌──────────▼──────────┐       ┌─────────▼────────┐
         │  Next.js Frontend   │       │ FastAPI Backend  │
         │   (Port 3000)       │       │   (Port 8000)    │
         │  ccw-online.com     │       │ api.ccw-online.com│
         └─────────────────────┘       └──────────────────┘
```

## Features

### 1. SSL/TLS Termination
- TLS 1.2 and 1.3 support
- Automatic HTTP → HTTPS redirect
- HSTS with preload support
- OCSP stapling for improved performance

### 2. Load Balancing
- Round-robin distribution (default)
- Health checks with automatic failover
- Keepalive connections to upstream servers
- Configurable max_fails and fail_timeout

### 3. Rate Limiting
- **General traffic**: 10 requests/second (burst: 20)
- **API traffic**: 30 requests/second (burst: 50)
- **Authentication**: 5 requests/second (burst: 10)
- Connection limiting: 10-20 concurrent per IP

### 4. Caching
- Next.js static assets: 60 minutes
- Next.js images: 7 days
- Cache key: URL + query parameters
- Stale content serving during backend issues

### 5. Security
- Security headers (HSTS, CSP-related, XSS protection)
- CORS configuration for API
- Client body size limits
- DDoS protection via rate limiting

### 6. WebSocket Support
- Upgrade header handling
- Connection upgrade support
- Required for Next.js HMR and real-time features

## Installation

### 1. Install Nginx

```bash
# Update package lists
sudo apt update

# Install Nginx
sudo apt install -y nginx

# Verify installation
nginx -v  # Should show nginx/1.18.0 or newer

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Create Required Directories

```bash
# Create cache directory
sudo mkdir -p /var/cache/nginx/static
sudo chown -R www-data:www-data /var/cache/nginx

# Create log directory (usually exists)
sudo mkdir -p /var/log/nginx

# Create webroot for Let's Encrypt challenges
sudo mkdir -p /var/www/letsencrypt
sudo chown -R www-data:www-data /var/www/letsencrypt
```

### 3. Deploy Configuration

```bash
# Copy production configuration
sudo cp nginx/production.conf /etc/nginx/sites-available/ccw-online-erp

# Remove default site (if it exists)
sudo rm -f /etc/nginx/sites-enabled/default

# Enable the site
sudo ln -s /etc/nginx/sites-available/ccw-online-erp /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Configuration Details

### Upstream Servers

The configuration defines two upstream server pools:

```nginx
upstream nextjs_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream fastapi_backend {
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

**Parameters**:
- `max_fails=3`: Mark server as down after 3 failed attempts
- `fail_timeout=30s`: Try again after 30 seconds
- `keepalive 32`: Maintain 32 idle keepalive connections

**Horizontal Scaling**: To add more application servers, uncomment and configure additional upstream servers:

```nginx
upstream nextjs_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;  # Add additional servers
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

### Rate Limiting Zones

```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
limit_conn_zone $binary_remote_addr zone=addr:10m;
```

**Parameters**:
- `zone`: Memory zone name and size (10m = ~160,000 IP addresses)
- `rate`: Allowed request rate
- `burst`: Allows temporary bursts above the rate limit

**Tuning**: Adjust rates based on your traffic patterns and requirements.

### Caching Strategy

```nginx
proxy_cache_path /var/cache/nginx/static
    levels=1:2
    keys_zone=static_cache:10m
    max_size=1g
    inactive=60m
    use_temp_path=off;
```

**Parameters**:
- `levels=1:2`: Two-level directory hierarchy
- `keys_zone`: 10MB zone (~80,000 keys)
- `max_size=1g`: Maximum cache size (1 GB)
- `inactive=60m`: Remove cached items not accessed for 60 minutes

**Cache Locations**:
- `/_next/static/`: Next.js static assets (1 year TTL)
- `/_next/image`: Next.js optimized images (7 days TTL)
- `/static/`: Public static files (7 days TTL)

### SSL/TLS Configuration

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
```

**Security Features**:
- Only modern TLS protocols (1.2, 1.3)
- Forward secrecy with ECDHE ciphers
- Session caching for performance
- OCSP stapling for certificate validation

### Health Check Endpoints

Nginx doesn't natively support active health checks (available only in Nginx Plus), but we configure passive health checks via `max_fails` and `fail_timeout`.

Health check endpoints are exempted from rate limiting:

```nginx
location /health {
    limit_req off;
    access_log off;
    proxy_pass http://fastapi_backend;
}
```

**Backend Health Endpoints**:
- `/health`: Comprehensive health check (API + database)
- `/ready`: Readiness check for container orchestration

## Load Balancing Algorithms

### Default: Round Robin

Nginx uses round-robin by default, distributing requests evenly across upstream servers.

### Alternative Algorithms

To use different load balancing methods, modify the upstream block:

#### Least Connections
```nginx
upstream fastapi_backend {
    least_conn;
    server 127.0.0.1:8000;
    server 10.0.1.11:8000;
}
```

#### IP Hash (session affinity)
```nginx
upstream fastapi_backend {
    ip_hash;
    server 127.0.0.1:8000;
    server 10.0.1.11:8000;
}
```

#### Weighted Distribution
```nginx
upstream fastapi_backend {
    server 127.0.0.1:8000 weight=3;  # 75% of traffic
    server 10.0.1.11:8000 weight=1;  # 25% of traffic
}
```

## Monitoring and Logging

### Log Files

```bash
# Frontend access log
/var/log/nginx/ccw-frontend-access.log

# Frontend error log
/var/log/nginx/ccw-frontend-error.log

# Backend access log
/var/log/nginx/ccw-backend-access.log

# Backend error log
/var/log/nginx/ccw-backend-error.log

# Nginx error log (main)
/var/log/nginx/error.log
```

### Log Analysis

```bash
# Monitor real-time access logs
sudo tail -f /var/log/nginx/ccw-frontend-access.log

# Check for errors
sudo tail -f /var/log/nginx/ccw-frontend-error.log

# Count requests by status code
awk '{print $9}' /var/log/nginx/ccw-frontend-access.log | sort | uniq -c

# Top 10 IP addresses by request count
awk '{print $1}' /var/log/nginx/ccw-frontend-access.log | sort | uniq -c | sort -rn | head -10

# Check rate limiting denials
grep "limiting requests" /var/log/nginx/error.log
```

### Cache Statistics

```bash
# Check cache size
du -sh /var/cache/nginx/static

# Count cached items
find /var/cache/nginx/static -type f | wc -l

# Clear cache
sudo rm -rf /var/cache/nginx/static/*
```

## Performance Tuning

### System-Level Tuning

```bash
# Edit /etc/sysctl.conf
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF
# Nginx performance tuning
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
EOF

# Apply changes
sudo sysctl -p
```

### Nginx Configuration Tuning

Edit `/etc/nginx/nginx.conf`:

```nginx
user www-data;
worker_processes auto;  # One per CPU core
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;  # Total: worker_processes * worker_connections
    use epoll;  # Efficient event model for Linux
    multi_accept on;
}

http {
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 100;

    # File uploads
    client_body_buffer_size 128k;
    client_max_body_size 50m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    send_timeout 10;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # Include site configurations
    include /etc/nginx/sites-enabled/*;
}
```

## Troubleshooting

### Configuration Test Failed

```bash
# Test configuration syntax
sudo nginx -t

# Check for conflicting server blocks
sudo nginx -T | grep "server_name"

# Verify SSL certificate paths
sudo ls -la /etc/letsencrypt/live/*/fullchain.pem
```

### 502 Bad Gateway

**Cause**: Upstream server (Next.js or FastAPI) is down or not responding.

```bash
# Check if upstream servers are running
sudo netstat -tlnp | grep -E ':(3000|8000)'

# Check application logs
journalctl -u ccw-frontend -n 50
journalctl -u ccw-backend -n 50

# Test direct connection to backend
curl http://localhost:8000/health
curl http://localhost:3000
```

### 504 Gateway Timeout

**Cause**: Upstream server is taking too long to respond.

**Solution**: Increase proxy timeouts in Nginx configuration:

```nginx
location /api/ {
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
    # ...
}
```

### Rate Limiting Too Aggressive

**Symptoms**: Legitimate users getting 503 errors.

**Solution**: Adjust rate limiting zones:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;  # Increase rate
limit_req zone=api burst=100 nodelay;  # Increase burst
```

### Cache Not Working

```bash
# Check cache hit rate
grep "X-Cache-Status" /var/log/nginx/ccw-frontend-access.log | \
    awk '{print $NF}' | sort | uniq -c

# Expected statuses: HIT, MISS, BYPASS, EXPIRED

# Verify cache directory permissions
sudo ls -la /var/cache/nginx/static/

# Clear cache and test
sudo rm -rf /var/cache/nginx/static/*
sudo systemctl reload nginx
```

### WebSocket Connection Failing

**Symptoms**: Next.js HMR not working, real-time features fail.

**Solution**: Verify upgrade headers are configured:

```nginx
location / {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;
}
```

## Security Best Practices

### 1. Regular Security Updates

```bash
# Update Nginx regularly
sudo apt update
sudo apt upgrade nginx

# Check Nginx version
nginx -v
```

### 2. Hide Nginx Version

Edit `/etc/nginx/nginx.conf`:

```nginx
http {
    server_tokens off;  # Don't expose Nginx version
}
```

### 3. Implement Additional Rate Limiting

For sensitive endpoints:

```nginx
location /api/admin {
    limit_req zone=auth burst=5 nodelay;
    # ... rest of configuration
}
```

### 4. IP Whitelisting (if needed)

```nginx
location /api/admin {
    allow 203.0.113.0/24;  # Allow specific network
    deny all;              # Deny everyone else
}
```

### 5. Monitor Failed Auth Attempts

```bash
# Count 401/403 responses
awk '$9 ~ /40[13]/ {print $1}' /var/log/nginx/ccw-backend-access.log | \
    sort | uniq -c | sort -rn | head -20
```

## Horizontal Scaling

### Adding Application Servers

1. **Provision new application servers** (see `SERVER_PROVISIONING.md`)

2. **Update upstream configuration**:

```nginx
upstream nextjs_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream fastapi_backend {
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

3. **Test and reload**:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

4. **Monitor distribution**:

```bash
# Check request distribution across upstreams
grep "upstream" /var/log/nginx/ccw-backend-access.log
```

## Verification Checklist

After deploying the load balancer:

- [ ] Nginx installed and running (`systemctl status nginx`)
- [ ] Configuration syntax valid (`nginx -t`)
- [ ] SSL certificates in place (see `SSL_SETUP.md`)
- [ ] HTTP redirects to HTTPS (`curl -I http://ccw-online.com`)
- [ ] Health checks responding (`curl https://api.ccw-online.com/health`)
- [ ] Rate limiting configured (`grep "limit_req" /etc/nginx/sites-enabled/*`)
- [ ] Caching working (check `X-Cache-Status` header)
- [ ] Logs being written (`ls -la /var/log/nginx/`)
- [ ] WebSocket support working (test Next.js HMR)
- [ ] CORS headers present for API (`curl -I https://api.ccw-online.com/api/`)
- [ ] Security headers present (`curl -I https://ccw-online.com`)

## Next Steps

1. **SSL/TLS Configuration**: Complete SSL setup (see `SSL_SETUP.md`)
2. **Monitoring**: Set up Prometheus scraping of Nginx metrics
3. **Alerting**: Configure alerts for 5xx errors and high latency
4. **Auto-scaling**: Implement auto-scaling for application servers (see `AUTO_SCALING.md`)
5. **CDN**: Consider adding Cloudflare or similar CDN for static assets

## References

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Nginx Load Balancing](https://nginx.org/en/docs/http/load_balancing.html)
- [Nginx Caching Guide](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache)
- [Nginx Rate Limiting](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or when scaling requirements change
