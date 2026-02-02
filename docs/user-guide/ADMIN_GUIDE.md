# CCW-Online ERP - Administrator Guide

## Table of Contents

1. [Introduction](#introduction)
2. [User Management](#user-management)
3. [System Configuration](#system-configuration)
4. [Database Maintenance](#database-maintenance)
5. [Security Settings](#security-settings)
6. [Monitoring and Logs](#monitoring-and-logs)
7. [Backup and Recovery](#backup-and-recovery)
8. [Performance Tuning](#performance-tuning)

---

## Introduction

This guide covers system administration tasks for CCW-Online ERP including user management, system configuration, security settings, database maintenance, and troubleshooting.

**Prerequisites:**
- System administrator access credentials
- Familiarity with web-based applications
- Basic understanding of database concepts (PostgreSQL)
- Command line access for advanced tasks
- SSH access to production servers

**Administrator Responsibilities:**

As a CCW-Online ERP administrator, you are responsible for:

- **User Management**: Creating and managing user accounts, roles, and permissions
- **System Configuration**: Configuring environment variables, API settings, email services
- **Database Maintenance**: Managing backups, running migrations, optimizing queries
- **Security**: Ensuring system security, managing secrets, monitoring unauthorized access
- **Performance**: Monitoring system performance, optimizing slow queries, scaling resources
- **Support**: Troubleshooting user issues, investigating errors, coordinating with support team

**Access Levels:**

- **Full Admin**: Complete system access (you have this)
- **Read-Only Admin**: View-only access to admin functions
- **Module Admin**: Admin access to specific modules only

---

## User Management

### Creating User Accounts

User accounts allow team members to access the CCW-Online ERP system with appropriate permissions based on their role.

**Steps to Create User**:

1. **Navigate to Admin Panel**
   - Click your name (top right)
   - Select **Admin** → **Users**

2. **Click "Create User" button**

3. **Fill in required fields**:

   **Account Information:**
   - **Email***: User's company email address
     - Must be unique (each user needs different email)
     - Format: user@company.com
     - Used for login and notifications

   - **Full Name***: User's display name
     - First and last name (e.g., "John Smith")
     - Displayed in UI throughout system

   - **Initial Password***: Temporary password
     - Minimum 8 characters
     - Mix of letters, numbers, and symbols
     - User must change on first login
     - Best practice: Use password generator

   **Role Assignment:**
   - **Role***: Select from dropdown (see roles below)
     - Determines what user can access and modify
     - Can be changed later if needed

   **Organization:**
   - **Organization***: Assign to organization
     - Multi-tenant systems only
     - Single-tenant: Select your organization

4. **Click "Create User"**

**Result**:
- User account created
- Email sent to user with:
  - Login URL
  - Temporary password
  - Instructions for first login
- User must change password on first login

**First-Time Login Instructions for New User**:
1. Check email for credentials
2. Navigate to login URL
3. Enter email and temporary password
4. System prompts: "Change Password Required"
5. Enter new password (8+ characters)
6. Click "Update Password"
7. Logged in to dashboard

### User Roles and Permissions

CCW-Online ERP uses role-based access control (RBAC). Each role has specific permissions for each module.

**Available Roles**:

#### 1. Admin Role

**Access**: Complete system access

**Permissions**:
- **Products**: Read, Write, Delete
- **Customers**: Read, Write, Delete
- **Orders**: Read, Write, Delete, Change Status
- **Quotes**: Read, Write, Delete, Convert to Order
- **Users**: Create, Edit, Delete, Manage Roles
- **System**: All Configuration, Database, Logs, Backups

**Use Case**: System administrators, IT staff, business owners

#### 2. Sales Role

**Access**: Sales-focused modules

**Permissions**:
- **Products**: Read only
- **Customers**: Read, Write, Edit (cannot delete)
- **Orders**: Read, Write, Create, Edit
- **Quotes**: Read, Write, Create, Edit, Convert to Order
- **Users**: None (cannot manage users)
- **System**: None

**Use Case**: Sales representatives, account managers

#### 3. Warehouse Role

**Access**: Order fulfillment and inventory

**Permissions**:
- **Products**: Read, Write (stock adjustments only)
- **Customers**: Read only
- **Orders**: Read, Update Status, View (cannot create or delete)
- **Quotes**: None
- **Users**: None
- **System**: None

**Use Case**: Warehouse staff, inventory managers, shipping personnel

#### 4. Customer Service Role

**Access**: Customer support functions

**Permissions**:
- **Products**: Read only
- **Customers**: Read, Write, Edit (cannot delete)
- **Orders**: Read, View Status (cannot edit or create)
- **Quotes**: Read only
- **Users**: None
- **System**: None

**Use Case**: Customer service representatives, support staff

**Choosing the Right Role**:

- Need full control? → **Admin**
- Creating orders and quotes? → **Sales**
- Managing inventory and shipping? → **Warehouse**
- Answering customer questions? → **Customer Service**

### Managing Existing Users

#### Viewing All Users

1. **Admin Panel** → **Users**
2. **User list displays**:
   - Email, full name, role
   - Status (active/inactive)
   - Last login date
   - Created date

3. **Filter and search**:
   - Filter by role
   - Filter by status (active/inactive)
   - Search by name or email

#### Editing User Information

1. **Find user** in user list
2. **Click "Edit" button**
3. **Update fields**:
   - Full name (if changed)
   - Role (promote/demote)
   - Status (active/inactive)
4. **Click "Update User"**

**Common Edit Scenarios**:

- **Role Change**: User promoted from Sales to Admin
- **Name Change**: User's name changed (marriage, correction)
- **Deactivation**: User left company (see below)

#### Resetting User Passwords

**When to Reset**:
- User forgot password
- Account locked after failed login attempts
- Security incident requiring password reset

**Steps**:

1. **Find user** in user list
2. **Click "Reset Password" button**
3. **Generate new temporary password**:
   - **Option A**: System generates random password (recommended)
   - **Option B**: Enter custom temporary password
4. **Check "Require password change on next login"** (recommended)
5. **Click "Reset"**

**Result**:
- User's password changed to temporary password
- Email sent to user with new password
- User must change password on next login

**Security Best Practices**:
- Always require password change after reset
- Don't share passwords via phone or insecure channels
- User should check email for reset instructions

#### Deactivating User Accounts

**When to Deactivate**:
- User left company
- User no longer needs access
- Security incident (immediate deactivation)

**Important**: Do NOT delete users. Deactivation preserves audit trail.

**Steps**:

1. **Find user** in user list
2. **Click "Deactivate" button**
3. **Confirm deactivation**
   - Warning: "User will not be able to log in"
   - Message: "Historical data will be preserved"
4. **Click "Deactivate"**

**Result**:
- User cannot log in
- Active sessions terminated immediately
- Historical data intact (orders, quotes created by user)
- User marked as inactive in user list

**Reactivating Users**:

1. **Filter users** by status: Inactive
2. **Find deactivated user**
3. **Click "Reactivate" button**
4. **User can log in** with existing credentials (may need password reset)

### Bulk User Operations

**Import Users from CSV**:

1. **Admin Panel** → **Users** → **Import**
2. **Download CSV template**
3. **Fill in user information**:
   - Columns: email, full_name, role
   - Example: john@company.com, John Smith, sales
4. **Upload CSV file**
5. **Review import preview**
6. **Click "Import Users"**

**Result**: Users created in bulk, emails sent with temporary passwords

**Export Users to CSV**:

1. **Admin Panel** → **Users** → **Export**
2. **Select filters** (optional - export all or filtered subset)
3. **Click "Export"**
4. **CSV file downloads**

**Use Cases**: User list for reports, compliance audits, directory exports

---

## System Configuration

### Environment Variables

The CCW-Online ERP system uses environment variables for configuration. These are set in the `.env` file (local development) or environment settings (production).

**Location**:
- **Local Development**: `.env` file in project root
- **Production**: Environment variables in hosting platform (AWS, Azure, etc.)

**Required Variables**:

#### Database Configuration

```bash
# PostgreSQL Connection
DATABASE_URL=postgresql://user:password@localhost:5432/ccw_erp
DATABASE_POOL_SIZE=20           # Connection pool size (default: 20)
DATABASE_MAX_OVERFLOW=10        # Additional connections during peak (default: 10)
DATABASE_POOL_TIMEOUT=30        # Connection wait timeout in seconds (default: 30)
DATABASE_POOL_RECYCLE=3600      # Recycle connections after 1 hour (default: 3600)
```

**Explanation**:
- `DATABASE_URL`: Full connection string (host, port, database name, credentials)
- `DATABASE_POOL_SIZE`: Number of persistent connections (increase for high traffic)
- `DATABASE_MAX_OVERFLOW`: Additional connections for burst traffic
- `DATABASE_POOL_TIMEOUT`: How long to wait for available connection
- `DATABASE_POOL_RECYCLE`: Recycle old connections to prevent stale connections

#### JWT Authentication

```bash
# JWT Configuration
JWT_SECRET_KEY=your-256-bit-secret-key-here-do-not-share
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60   # 1 hour (default)
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7      # 7 days (default)
```

**Explanation**:
- `JWT_SECRET_KEY`: Secret key for signing tokens (CRITICAL - keep secure)
- `JWT_ALGORITHM`: Hashing algorithm (HS256 recommended)
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`: Token lifespan (increase for longer sessions)
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token lifespan

**Security**: NEVER commit JWT_SECRET_KEY to Git. Use environment variables or secrets manager.

#### API Configuration

```bash
# API Server Configuration
API_HOST=0.0.0.0                     # Listen on all interfaces
API_PORT=8000                        # Backend API port
BACKEND_CORS_ORIGINS=["http://localhost:3000", "https://ccw-online.com"]

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=100            # Authenticated users
RATE_LIMIT_ANON_PER_MINUTE=10        # Unauthenticated users
```

**Explanation**:
- `BACKEND_CORS_ORIGINS`: Allowed origins for CORS (must include frontend URL)
- `RATE_LIMIT_ENABLED`: Enable/disable rate limiting
- `RATE_LIMIT_PER_MINUTE`: Requests per minute for authenticated users

#### Frontend Configuration

```bash
# Frontend (Next.js)
NEXT_PUBLIC_BACKEND_URL=https://api.ccw-online.com
NODE_ENV=production                   # production, development, or test
```

**Explanation**:
- `NEXT_PUBLIC_BACKEND_URL`: Backend API base URL (frontend calls this)
- `NODE_ENV`: Environment mode (affects logging, optimizations)

#### Email Configuration (SendGrid)

```bash
# SendGrid Email Service
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@ccw-online.com
SENDGRID_FROM_NAME=CCW-Online ERP
```

**Explanation**:
- `SENDGRID_API_KEY`: SendGrid API key (get from SendGrid dashboard)
- `SENDGRID_FROM_EMAIL`: Sender email address (must be verified in SendGrid)
- `SENDGRID_FROM_NAME`: Sender display name

**Setting Up SendGrid**:

1. **Create SendGrid account**: https://sendgrid.com
2. **Verify sender email**: Settings → Sender Authentication → Verify Single Sender
3. **Generate API key**: Settings → API Keys → Create API Key
   - Name: CCW-Online ERP
   - Permission: Full Access (or Mail Send only)
   - Copy API key (shown once only)
4. **Add to environment**: `SENDGRID_API_KEY=your-key-here`
5. **Test email**: Run backend test command

```bash
cd apps/backend
python -m src.services.email_service --test
```

#### Redis Configuration (Optional)

```bash
# Redis (for caching and sessions)
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=3600                 # Cache TTL in seconds (1 hour)
REDIS_MAX_CONNECTIONS=50             # Connection pool size
```

**Explanation**:
- `REDIS_URL`: Redis connection string
- `REDIS_CACHE_TTL`: How long to cache data (seconds)
- `REDIS_MAX_CONNECTIONS`: Redis connection pool size

**Installing Redis** (Docker):

```bash
# Docker Compose (included in project)
docker compose up -d redis

# Verify Redis is running
docker compose exec redis redis-cli PING
# Should return: PONG
```

### Changing Configuration

**⚠️ IMPORTANT**: Changing configuration requires service restart.

**Steps**:

1. **Edit `.env` file** (local) or environment variables (production)
2. **Example**: Increase token expiry to 2 hours

```bash
# Before
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# After
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=120
```

3. **Restart services**:

**Local Development:**
```bash
# Stop services (Ctrl+C)
# Restart
pnpm dev
```

**Production (Docker):**
```bash
# Restart backend only
docker compose restart backend

# Restart frontend only
docker compose restart web

# Restart all services
docker compose restart
```

4. **Verify changes**:
   - Check application logs
   - Test affected functionality
   - Monitor for errors

---

## Database Maintenance

### Backup Procedures

Regular backups are critical for disaster recovery and data protection.

**Automated Daily Backups**:

The system automatically backs up the database:
- **Schedule**: Daily at 2 AM UTC
- **Location**: `backups/postgresql/ccw_erp_YYYYMMDD.sql.gz`
- **Retention**: 30 days (older backups automatically deleted)
- **Type**: Full database backup (all tables, data, schema)

**Backup Script**: `scripts/backup-database.sh`

**Manual Backup**:

```bash
# Full database backup
./scripts/backup-database.sh

# Output: backups/postgresql/ccw_erp_20260202_143022.sql.gz
```

**Backup Specific Tables**:

```bash
# Backup products and customers tables only
pg_dump -U ccw_user -d ccw_erp -t products -t customers -F c -f backup_products_customers.dump
```

**Off-Site Backup**:

For production, always store backups off-site:

```bash
# Upload to AWS S3 (example)
aws s3 cp backups/postgresql/ccw_erp_20260202.sql.gz s3://ccw-backups/postgresql/

# Or use rsync to remote server
rsync -avz backups/postgresql/ backup-server:/backups/ccw-erp/
```

### Restore Procedures

**⚠️ CRITICAL**: Restoring a backup will overwrite current database. Test on staging first.

**Full Restore**:

```bash
# 1. Stop application (prevents data corruption)
docker compose down

# 2. Restore database
./scripts/restore-backup.sh backups/postgresql/ccw_erp_20260202.sql.gz

# 3. Verify restore
docker compose up -d postgres
docker compose exec postgres psql -U ccw_user -d ccw_erp -c "SELECT COUNT(*) FROM products;"

# 4. Start application
docker compose up -d
```

**Partial Restore** (single table):

```bash
# Restore only products table from backup
pg_restore -U ccw_user -d ccw_erp -t products backup_products_customers.dump
```

**Point-in-Time Recovery**:

If you have WAL (Write-Ahead Logging) enabled:

```bash
# Restore to specific timestamp
pg_restore --target-time="2026-02-02 14:30:00" ccw_erp_backup.dump
```

### Database Migrations

Database schema changes are managed with **Alembic** migrations (for Python/SQLAlchemy).

**Checking Current Migration Version**:

```bash
cd apps/backend
alembic current
# Output: 003_add_semantic_search (head)
```

**Applying Pending Migrations**:

```bash
cd apps/backend
alembic upgrade head
```

**Creating New Migration** (advanced):

```bash
cd apps/backend

# Auto-generate migration from model changes
alembic revision --autogenerate -m "Add new field to products table"

# Edit generated migration file (apps/backend/alembic/versions/XXX_add_new_field.py)
# Review changes carefully

# Apply migration
alembic upgrade head
```

**Rolling Back Migration**:

```bash
cd apps/backend

# Rollback one migration
alembic downgrade -1

# Rollback to specific version
alembic downgrade 002_add_semantic_search

# Rollback all migrations (⚠️ DANGEROUS)
alembic downgrade base
```

**Best Practices**:
- Always backup database before applying migrations
- Test migrations on staging environment first
- Review auto-generated migrations (may need manual edits)
- Never edit applied migrations (create new migration instead)

### Database Performance Tuning

**Analyzing Slow Queries**:

```sql
-- Enable query logging (PostgreSQL)
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries >1 second
SELECT pg_reload_conf();

-- View slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**Creating Indexes**:

Indexes speed up queries but slow down writes. Create indexes for frequently queried columns.

```sql
-- Add index for products name (for search)
CREATE INDEX idx_products_name ON products(name);

-- Add index for customers company_name
CREATE INDEX idx_customers_company_name ON customers(company_name);

-- Add index for orders customer_id (for joins)
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Add compound index for orders (status + order_date)
CREATE INDEX idx_orders_status_date ON orders(status, order_date);
```

**Checking Index Usage**:

```sql
-- Show indexes on products table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'products';

-- Show index usage statistics
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'products'
ORDER BY idx_scan DESC;
```

**Vacuum and Analyze**:

PostgreSQL requires periodic maintenance:

```bash
# Analyze tables (updates statistics for query planner)
docker compose exec postgres psql -U ccw_user -d ccw_erp -c "ANALYZE;"

# Vacuum tables (reclaims space)
docker compose exec postgres psql -U ccw_user -d ccw_erp -c "VACUUM;"

# Vacuum and analyze all tables
docker compose exec postgres psql -U ccw_user -d ccw_erp -c "VACUUM ANALYZE;"
```

**Automatic Vacuum** (should be enabled by default):

```sql
-- Check autovacuum settings
SHOW autovacuum;
-- Should be: on

-- Configure autovacuum (if needed)
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_naptime = '1min';
SELECT pg_reload_conf();
```

---

## Security Settings

### Managing Secrets

**Critical Secrets** (MUST be kept secure):

1. **JWT_SECRET_KEY**: Used for signing authentication tokens
2. **DATABASE_URL**: Database credentials
3. **SENDGRID_API_KEY**: Email service API key
4. **REDIS_URL**: Redis credentials (if applicable)

**Best Practices**:

1. **Never commit secrets to Git**
   - Add `.env` to `.gitignore` (already done)
   - Use environment variables or secrets manager

2. **Rotate secrets regularly**
   - JWT secret: Every 90 days
   - Database password: Every 180 days
   - API keys: When compromised or annually

3. **Use secrets manager** (production):
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault

**Rotating JWT Secret**:

```bash
# 1. Generate new secret (256-bit recommended)
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: New secret key

# 2. Update .env or environment variable
JWT_SECRET_KEY=new-secret-key-here

# 3. Restart backend service
docker compose restart backend

# 4. All users will be logged out (tokens invalid)
# 5. Users must log in again
```

### Rate Limiting

Protects against abuse and DoS attacks.

**Current Limits**:
- **Authenticated users**: 100 requests/minute
- **Unauthenticated users**: 10 requests/minute

**Adjusting Rate Limits**:

Edit `.env`:

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=200         # Increase for high-traffic
RATE_LIMIT_ANON_PER_MINUTE=20     # Increase if legitimate users hit limit
```

**Monitoring Rate Limits**:

Check logs for rate limit violations:

```bash
# View recent rate limit errors
docker compose logs backend | grep "429 Too Many Requests"
```

### SSL/TLS Configuration

**Production Deployment** requires HTTPS (SSL/TLS).

**Setting Up Let's Encrypt SSL**:

```bash
# Run SSL setup script
./scripts/setup-ssl.sh

# Prompts for:
# - Domain name (ccw-online.com)
# - Email address (admin@ccw-online.com)

# Installs certificates:
# - /etc/letsencrypt/live/ccw-online.com/fullchain.pem
# - /etc/letsencrypt/live/ccw-online.com/privkey.pem

# Configures Nginx to use SSL
# Enables auto-renewal (cron job)
```

**Manual SSL Setup** (if script doesn't work):

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d ccw-online.com -d www.ccw-online.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose: Redirect HTTP to HTTPS (recommended)

# Test auto-renewal
sudo certbot renew --dry-run
```

**Nginx SSL Configuration**:

```nginx
# /etc/nginx/sites-available/ccw-online
server {
    listen 443 ssl http2;
    server_name ccw-online.com www.ccw-online.com;

    ssl_certificate /etc/letsencrypt/live/ccw-online.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ccw-online.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8000;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name ccw-online.com www.ccw-online.com;
    return 301 https://$server_name$request_uri;
}
```

### Firewall Configuration

**Setting Up UFW** (Ubuntu Firewall):

```bash
# Run firewall configuration script
./scripts/configure-firewall.sh

# Or manual setup:
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT: Do this first or you'll lock yourself out)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (only from localhost)
sudo ufw allow from 127.0.0.1 to any port 5432

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

**Production Security Checklist**:

- [ ] SSL/TLS enabled and auto-renewing
- [ ] Firewall configured (only necessary ports open)
- [ ] Rate limiting enabled
- [ ] Strong JWT secret (256-bit)
- [ ] Database password strong (16+ characters)
- [ ] Secrets in secrets manager (not in .env files)
- [ ] Regular security updates (OS, packages)
- [ ] Audit logs enabled
- [ ] Failed login monitoring
- [ ] Regular security audits

---

## Monitoring and Logs

### Viewing Application Logs

**Backend Logs** (FastAPI):

```bash
# View recent logs
docker compose logs backend --tail=100

# Follow logs in real-time
docker compose logs backend -f

# View logs for specific time range
docker compose logs backend --since="2026-02-02T14:00:00"

# Search logs for errors
docker compose logs backend | grep "ERROR"

# Search logs for specific user
docker compose logs backend | grep "user@example.com"
```

**Frontend Logs** (Next.js):

```bash
# View frontend logs
docker compose logs web --tail=100

# Follow logs
docker compose logs web -f
```

**PostgreSQL Logs**:

```bash
# View database logs
docker compose logs postgres --tail=100

# View slow query logs (if enabled)
docker compose exec postgres cat /var/log/postgresql/postgresql-14-main.log
```

### System Health Checks

**Health Endpoint**:

The system provides a health check endpoint:

```bash
# Check backend health
curl https://api.ccw-online.com/api/health

# Response:
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-02-02T14:30:00Z"
}
```

**Monitoring Script**:

```bash
# Run health check script
./scripts/health-check.ps1

# Checks:
# - Backend API responding
# - Database connection
# - Redis connection (if configured)
# - Disk space
# - Memory usage
# - CPU usage
```

### Performance Monitoring

**Key Metrics to Monitor**:

1. **Response Times**:
   - API endpoint response times (target: <200ms p95)
   - Database query times (target: <100ms p95)
   - Page load times (target: <3s)

2. **Error Rates**:
   - 4xx errors (client errors): <5%
   - 5xx errors (server errors): <1%

3. **Resource Usage**:
   - CPU: <80% sustained
   - Memory: <80% capacity
   - Disk: <80% capacity
   - Database connections: <90% of pool

4. **Business Metrics**:
   - Active users (concurrent)
   - Orders created per hour
   - Quotes generated per day

**Monitoring Tools**:

- **Grafana + Prometheus**: Metrics visualization
- **Sentry**: Error tracking and alerting
- **UptimeRobot**: Uptime monitoring
- **New Relic**: APM (Application Performance Monitoring)

---

## Backup and Recovery

### Disaster Recovery Plan

**Recovery Time Objective (RTO)**: <4 hours
**Recovery Point Objective (RPO)**: <1 hour

**Scenarios and Procedures**:

#### Scenario 1: Complete Server Failure

1. **Provision new server** (or failover to standby)
2. **Install dependencies**: Docker, Docker Compose
3. **Clone repository**: Git clone from GitHub
4. **Restore environment variables**: From secrets manager
5. **Restore database**: Latest backup from S3
6. **Start services**: `docker compose up -d`
7. **Verify**: Run health checks
8. **Update DNS**: Point to new server IP

**Time**: 2-4 hours

#### Scenario 2: Database Corruption

1. **Stop application**: `docker compose stop backend web`
2. **Identify corruption**: Check PostgreSQL logs
3. **Restore database**: From latest backup
4. **Verify restoration**: Check data integrity
5. **Start application**: `docker compose up -d`
6. **Test**: Manual testing of critical functions

**Time**: 30 minutes - 2 hours

#### Scenario 3: Accidental Data Deletion

1. **Identify scope**: What was deleted? When?
2. **Find backup**: Backup from before deletion
3. **Extract deleted data**: Query backup for specific records
4. **Restore data**: INSERT statements to production
5. **Verify**: Confirm data restored correctly

**Time**: 15 minutes - 1 hour

**Best Practices**:
- Test disaster recovery quarterly
- Document procedures (this guide)
- Keep off-site backups
- Monitor backup success/failure

---

## Performance Tuning

### Database Optimization

**Connection Pooling**:

Current settings (adjust in `DATABASE_*` env vars):
- Pool Size: 20 connections
- Max Overflow: 10 connections
- Timeout: 30 seconds
- Recycle: 3600 seconds

**When to Increase Pool Size**:
- High concurrent user count (>100 simultaneous)
- Slow response times during peak
- "Connection pool exhausted" errors in logs

**How to Increase**:

```bash
# Edit .env
DATABASE_POOL_SIZE=40          # Increased from 20
DATABASE_MAX_OVERFLOW=20       # Increased from 10

# Restart backend
docker compose restart backend
```

**When to Increase Recycle Time**:
- Long-running queries (>1 hour)
- Batch operations

### Application Performance

**Caching**:

Enable Redis caching for frequently accessed data:

```bash
# Install Redis (if not already)
docker compose up -d redis

# Configure in .env
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=3600  # 1 hour cache

# Restart backend
docker compose restart backend
```

**What Gets Cached**:
- Product listings (most frequently accessed)
- Customer directory (for search)
- Static configuration data

**CDN for Static Assets**:

Use CDN for images, CSS, JavaScript:
- CloudFlare (free tier available)
- AWS CloudFront
- Azure CDN

**Benefits**: Faster page loads, reduced server load

---

## Next Steps

**For More Information**:

- **User Guide**: [USER_GUIDE.md](USER_GUIDE.md) - End-user operations
- **API Documentation**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Developer reference
- **Troubleshooting**: [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md) - Common issues

**Questions?** Contact: admin@ccw-online.com

---

**Last Updated**: February 2, 2026
**Version**: 1.0.0
**Feedback**: documentation@ccw-online.com
