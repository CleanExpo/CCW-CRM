# Quick Start: Production Database Setup

**Estimated Time**: 15-20 minutes
**Recommended**: Supabase (easiest, generous free tier)

---

## Option A: Supabase (RECOMMENDED) ⭐

### Step 1: Create Supabase Account

1. Visit: https://supabase.com/
2. Click "Start your project"
3. Sign up with GitHub (easiest) or email

### Step 2: Create New Project

1. Click "New Project"
2. Fill in details:
   - **Organization**: Select your organization or create new
   - **Name**: `CCW-ERP-Production` (or your preferred name)
   - **Database Password**: Click "Generate a password" or create your own
     - **IMPORTANT**: Save this password! You'll need it.
   - **Region**: Choose closest to your users
     - US East: `us-east-1` (Virginia)
     - US West: `us-west-1` (N. California)
     - Europe: `eu-central-1` (Frankfurt)
     - Asia: `ap-southeast-1` (Singapore)
   - **Pricing Plan**: Free (good for MVP) or Pro ($25/month for production)

3. Click "Create new project"
4. Wait 2-3 minutes for provisioning (grab a coffee ☕)

### Step 3: Get Database Connection String

Once project is created:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **Database** in the left menu
3. Scroll to **Connection String** section
4. Select **URI** tab (not Transaction or Session)
5. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijk.supabase.co:5432/postgres
   ```
6. **IMPORTANT**: Replace `[YOUR-PASSWORD]` with your actual password from Step 2

### Step 4: Verify Connection (Optional but Recommended)

Test the connection string works:

```bash
# Install PostgreSQL client if you don't have it
# Windows: Download from https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: apt install postgresql-client

# Test connection
psql "postgresql://postgres:YOUR-PASSWORD@db.abcdefghijk.supabase.co:5432/postgres"

# If connected successfully, you'll see:
# postgres=>

# Type \q to exit
```

### Step 5: Save Connection String

**SAVE THIS VALUE** - you'll add it to `.env.production` in Task 5:

```bash
DATABASE_URL="postgresql://postgres:YOUR-PASSWORD@db.abcdefghijk.supabase.co:5432/postgres"
```

---

## Option B: Railway (Alternative)

### Step 1: Sign Up

1. Visit: https://railway.app/
2. Click "Login" → "Login with GitHub"
3. Authorize Railway

### Step 2: Create Project with PostgreSQL

1. Click "New Project"
2. Select "Provision PostgreSQL"
3. Wait 30 seconds for provisioning

### Step 3: Get Connection String

1. Click on the PostgreSQL service card
2. Go to **Variables** tab
3. Find `DATABASE_URL` variable
4. Click "Copy" button

The URL looks like:
```
postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway
```

### Step 4: Save Connection String

**SAVE THIS VALUE**:

```bash
DATABASE_URL="postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway"
```

---

## Option C: Self-Hosted (Advanced)

Only choose this if you already have a server and PostgreSQL expertise.

### Requirements
- Ubuntu 22.04 server
- PostgreSQL 15 installed
- SSH access

### Quick Setup

```bash
# SSH to your server
ssh root@your-server-ip

# Install PostgreSQL 15
apt update
apt install -y postgresql-15 postgresql-contrib

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE ccw_erp_production;
CREATE USER ccw_admin WITH PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE ccw_erp_production TO ccw_admin;
ALTER DATABASE ccw_erp_production OWNER TO ccw_admin;
\q
EOF

# Allow remote connections (if needed)
# Edit /etc/postgresql/15/main/postgresql.conf
# Change: listen_addresses = '*'

# Edit /etc/postgresql/15/main/pg_hba.conf
# Add: host all all 0.0.0.0/0 md5

# Restart PostgreSQL
systemctl restart postgresql

# Test connection
psql -h localhost -U ccw_admin -d ccw_erp_production
```

### Connection String

```bash
DATABASE_URL="postgresql://ccw_admin:your_strong_password_here@your-server-ip:5432/ccw_erp_production"
```

---

## What's Next?

Once you have your `DATABASE_URL`, proceed to **Task 5: Create .env.production**

---

## Troubleshooting

### Issue: "Connection refused"

**Supabase**: Wait 5 minutes - project may still be provisioning
**Railway**: Check if database is running in dashboard
**Self-hosted**: Check if PostgreSQL is running: `systemctl status postgresql`

### Issue: "Password authentication failed"

- Double-check password is correct
- Ensure you replaced `[YOUR-PASSWORD]` in connection string
- In self-hosted: Check pg_hba.conf allows password auth

### Issue: "SSL required"

Add `?sslmode=require` to end of connection string:
```
postgresql://user:pass@host:5432/db?sslmode=require
```

---

**Time to complete**: 15-20 minutes
**Cost**: Free (Supabase/Railway free tier) or $15-25/month (production tier)
**Output**: `DATABASE_URL` connection string for .env.production
