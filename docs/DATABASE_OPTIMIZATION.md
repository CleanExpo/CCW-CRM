# Database Optimization Guide

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-D042

---

## Overview

This document provides comprehensive guidance on optimizing PostgreSQL database performance for CCW-Online ERP, including connection pooling, query optimization, indexing strategies, and monitoring.

## Connection Pooling Configuration

### Current Implementation

The application uses SQLAlchemy's built-in connection pooling. Configuration is in `apps/backend/src/config/database.py`:

```python
# Asynchronous engine (for FastAPI endpoints)
async_engine = create_async_engine(
    get_database_url(async_mode=True),
    echo=get_settings().debug,
    pool_pre_ping=True,
    pool_size=20,  # Support 20 concurrent requests
    max_overflow=30,  # Burst up to 50 total connections
    pool_timeout=30,  # Wait 30s before failing connection request
    pool_recycle=3600,  # Recycle connections after 1 hour
)
```

### Production Recommendations

#### Optimal Pool Settings

| Parameter | Development | Production | High-Traffic |
|-----------|-------------|------------|--------------|
| **pool_size** | 10 | 20 | 40 |
| **max_overflow** | 10 | 30 | 60 |
| **pool_timeout** | 10s | 30s | 60s |
| **pool_recycle** | 1800s | 3600s | 3600s |
| **pool_pre_ping** | True | True | True |

#### Calculation Formula

```
Total Connections = pool_size + max_overflow
Recommended: (2 × CPU cores) to (4 × CPU cores)

Example for 8-core server:
pool_size = 20
max_overflow = 30
Total = 50 connections
```

### PostgreSQL Configuration

Edit `/etc/postgresql/15/main/postgresql.conf`:

```conf
# Connection Settings
max_connections = 200              # Total allowed connections
superuser_reserved_connections = 3  # Reserved for superuser

# Connection Pooling (PgBouncer optional)
# See PgBouncer section below
```

### Monitoring Connection Pool

#### Query Active Connections

```sql
-- Current active connections
SELECT COUNT(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

-- Connection breakdown by state
SELECT state, COUNT(*)
FROM pg_stat_activity
GROUP BY state;

-- Long-running queries
SELECT
    pid,
    now() - query_start as duration,
    state,
    query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '1 minute'
ORDER BY duration DESC;
```

#### SQLAlchemy Pool Metrics

```python
# In your FastAPI app (add to monitoring endpoint)
from sqlalchemy import inspect

@router.get("/api/metrics/database")
async def database_metrics():
    engine = async_engine.sync_engine
    pool = engine.pool

    return {
        "pool_size": pool.size(),
        "checked_in_connections": pool.checkedin(),
        "checked_out_connections": pool.checkedout(),
        "overflow_connections": pool.overflow(),
        "total_connections": pool.size() + pool.overflow(),
    }
```

## PgBouncer (Optional - For High Traffic)

### When to Use PgBouncer

- More than 100 concurrent connections needed
- Multiple application servers
- Connection churn is high
- Want to reduce PostgreSQL memory usage

### Installation

```bash
# Install PgBouncer
sudo apt install -y pgbouncer

# Create configuration directory
sudo mkdir -p /etc/pgbouncer
```

### Configuration

#### /etc/pgbouncer/pgbouncer.ini

```ini
[databases]
ccw_production = host=127.0.0.1 port=5432 dbname=ccw_production

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
admin_users = postgres
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 40
min_pool_size = 10
reserve_pool_size = 10
reserve_pool_timeout = 5
max_db_connections = 50
max_user_connections = 50
server_lifetime = 3600
server_idle_timeout = 600
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

#### /etc/pgbouncer/userlist.txt

```
"ccw_user" "md5<hashed_password>"
```

Generate hashed password:

```bash
echo -n "passwordccw_user" | md5sum
```

### Application Configuration

Update database URL to use PgBouncer:

```python
# Change from:
DATABASE_URL=postgresql://ccw_user:password@localhost:5432/ccw_production

# To:
DATABASE_URL=postgresql://ccw_user:password@localhost:6432/ccw_production
```

### PgBouncer Monitoring

```bash
# Connect to PgBouncer admin console
psql -h 127.0.0.1 -p 6432 -U postgres pgbouncer

# Show pool statistics
SHOW POOLS;

# Show database statistics
SHOW DATABASES;

# Show client connections
SHOW CLIENTS;

# Show server connections
SHOW SERVERS;
```

## Query Optimization

### Indexing Strategy

#### Current Indexes

Check existing indexes:

```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

#### Recommended Indexes

```sql
-- Products table
CREATE INDEX CONCURRENTLY idx_products_sku ON products(sku);
CREATE INDEX CONCURRENTLY idx_products_category ON products(category);
CREATE INDEX CONCURRENTLY idx_products_is_active ON products(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Customers table
CREATE INDEX CONCURRENTLY idx_customers_email ON customers(email);
CREATE INDEX CONCURRENTLY idx_customers_customer_number ON customers(customer_number);
CREATE INDEX CONCURRENTLY idx_customers_company_name ON customers(company_name);

-- Orders table
CREATE INDEX CONCURRENTLY idx_orders_customer_id ON orders(customer_id);
CREATE INDEX CONCURRENTLY idx_orders_order_date ON orders(order_date DESC);
CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status);
CREATE INDEX CONCURRENTLY idx_orders_order_number ON orders(order_number);

-- Order Items table
CREATE INDEX CONCURRENTLY idx_order_items_order_id ON order_items(order_id);
CREATE INDEX CONCURRENTLY idx_order_items_product_id ON order_items(product_id);

-- Quotes table
CREATE INDEX CONCURRENTLY idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX CONCURRENTLY idx_quotes_quote_date ON quotes(quote_date DESC);
CREATE INDEX CONCURRENTLY idx_quotes_status ON quotes(status);
CREATE INDEX CONCURRENTLY idx_quotes_valid_until ON quotes(valid_until);

-- Quote Items table
CREATE INDEX CONCURRENTLY idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX CONCURRENTLY idx_quote_items_product_id ON quote_items(product_id);

-- Users table
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_organization_id ON users(organization_id);

-- Translations table (if using i18n)
CREATE INDEX CONCURRENTLY idx_translations_namespace_key_lang ON translations(namespace, key, language_code);
CREATE INDEX CONCURRENTLY idx_translations_language_code ON translations(language_code);
```

#### Composite Indexes for Common Queries

```sql
-- Orders by customer and date
CREATE INDEX CONCURRENTLY idx_orders_customer_date ON orders(customer_id, order_date DESC);

-- Active products by category
CREATE INDEX CONCURRENTLY idx_products_active_category ON products(is_active, category) WHERE is_active = true;

-- Order items with order status
CREATE INDEX CONCURRENTLY idx_order_items_with_status ON order_items(order_id, product_id) INCLUDE (quantity, unit_price);
```

### Analyze Query Performance

#### Using EXPLAIN ANALYZE

```sql
-- Example: Find slow query
EXPLAIN ANALYZE
SELECT o.*, c.company_name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.order_date >= '2026-01-01'
  AND o.status = 'pending'
ORDER BY o.order_date DESC
LIMIT 50;
```

#### Identify Missing Indexes

```sql
-- Find tables with sequential scans
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_tup_read / seq_scan AS avg_seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Find unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_%'
ORDER BY indexrelname;
```

### Query Optimization Tips

1. **Use Appropriate Data Types**
   ```sql
   -- Bad: Using VARCHAR for numeric IDs
   customer_id VARCHAR(50)

   -- Good: Using UUID or INTEGER
   customer_id UUID
   ```

2. **Avoid SELECT ***
   ```python
   # Bad
   products = await db.execute(select(Product))

   # Good
   products = await db.execute(
       select(Product.id, Product.name, Product.price)
   )
   ```

3. **Use Pagination**
   ```python
   # Implement LIMIT/OFFSET or cursor-based pagination
   query = select(Product).limit(50).offset(page * 50)
   ```

4. **Batch Operations**
   ```python
   # Bad: Individual inserts
   for item in items:
       await db.execute(insert(OrderItem).values(item))

   # Good: Bulk insert
   await db.execute(insert(OrderItem).values(items))
   ```

## Database Maintenance

### VACUUM and ANALYZE

```sql
-- Manual VACUUM
VACUUM ANALYZE;

-- VACUUM specific table
VACUUM ANALYZE orders;

-- Check table bloat
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Autovacuum Configuration

Edit `/etc/postgresql/15/main/postgresql.conf`:

```conf
# Autovacuum Settings
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min

# More aggressive autovacuum for high-traffic tables
autovacuum_vacuum_scale_factor = 0.1  # Default: 0.2
autovacuum_analyze_scale_factor = 0.05  # Default: 0.1
```

### Reindexing

```sql
-- Reindex table
REINDEX TABLE orders;

-- Reindex all tables
REINDEX DATABASE ccw_production;

-- Reindex concurrently (doesn't lock table)
REINDEX INDEX CONCURRENTLY idx_orders_customer_id;
```

## Performance Monitoring

### Key Metrics to Monitor

1. **Connection Metrics**
   - Active connections
   - Idle connections
   - Connection wait time

2. **Query Performance**
   - Average query duration
   - Slow queries (> 1 second)
   - Query throughput

3. **Database Size**
   - Total database size
   - Table sizes
   - Index sizes

4. **Cache Hit Ratio**
   - Should be > 99%

5. **Transaction Rate**
   - Commits per second
   - Rollbacks per second

### Monitoring Queries

```sql
-- Cache hit ratio (should be > 99%)
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
FROM pg_statio_user_tables;

-- Database size
SELECT
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;

-- Top 10 largest tables
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC
LIMIT 10;

-- Transaction statistics
SELECT
    sum(xact_commit) AS commits,
    sum(xact_rollback) AS rollbacks,
    sum(xact_commit) / (sum(xact_commit) + sum(xact_rollback)) * 100 AS commit_ratio
FROM pg_stat_database
WHERE datname = 'ccw_production';
```

### PostgreSQL Exporter for Prometheus

Already configured in `docker-compose.yml`:

```yaml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:v0.15.0
  environment:
    DATA_SOURCE_NAME: "postgresql://starter_user:local_dev_password@postgres:5432/starter_db?sslmode=disable"
  ports:
    - "9187:9187"
```

**Metrics exposed**: `http://localhost:9187/metrics`

## PostgreSQL Configuration Tuning

### Memory Settings

Edit `/etc/postgresql/15/main/postgresql.conf`:

```conf
# Memory Settings (for 16GB RAM server)
shared_buffers = 4GB                # 25% of total RAM
effective_cache_size = 12GB         # 75% of total RAM
maintenance_work_mem = 1GB          # For VACUUM, CREATE INDEX
work_mem = 64MB                     # Per operation (sort, hash)
wal_buffers = 16MB                  # WAL buffer size

# For 8GB RAM server
# shared_buffers = 2GB
# effective_cache_size = 6GB
# maintenance_work_mem = 512MB
# work_mem = 32MB
```

### Checkpoint Settings

```conf
# Checkpoint Settings
checkpoint_completion_target = 0.9  # Spread checkpoints over 90% of interval
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Query Planner Settings

```conf
# Query Planner
random_page_cost = 1.1              # For SSD (default: 4.0 for HDD)
effective_io_concurrency = 200      # For SSD (default: 1)
default_statistics_target = 100     # Default: 100 (increase for better query plans)
```

### Apply Configuration Changes

```bash
# Reload configuration (no restart needed for most settings)
sudo systemctl reload postgresql

# Check configuration
psql -U postgres -c "SHOW shared_buffers;"
psql -U postgres -c "SHOW effective_cache_size;"
```

## Backup Impact on Performance

### pg_dump Performance

```bash
# Use parallel dump for faster backups
pg_dump -Fd -j 4 -f /backup/dir ccw_production

# -Fd: directory format
# -j 4: 4 parallel jobs
```

### Reduce Backup Impact

1. **Run backups during off-peak hours** (2:00 AM)
2. **Use streaming replication** and backup from replica
3. **Use snapshot-based backups** (if using cloud storage)

## Troubleshooting

### High CPU Usage

```sql
-- Find CPU-intensive queries
SELECT
    pid,
    now() - query_start as duration,
    state,
    query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Kill long-running query
SELECT pg_terminate_backend(pid);
```

### High Memory Usage

```sql
-- Check memory usage by query
SELECT
    pid,
    usename,
    pg_size_pretty(pg_backend_memory_contexts.total_bytes) as memory
FROM pg_backend_memory_contexts
JOIN pg_stat_activity ON pg_backend_memory_contexts.pid = pg_stat_activity.pid
ORDER BY total_bytes DESC;
```

### Slow Queries

```sql
-- Enable slow query logging
ALTER DATABASE ccw_production SET log_min_duration_statement = 1000;  -- 1 second

-- Check slow query log
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Note: Requires pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### Connection Exhaustion

```sql
-- Check connection limit
SHOW max_connections;

-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Terminate idle connections (older than 1 hour)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < now() - interval '1 hour';
```

## Verification Checklist

- [ ] Connection pool configured optimally for server specs
- [ ] All recommended indexes created
- [ ] Autovacuum enabled and tuned
- [ ] Query performance monitored (slow query log)
- [ ] Cache hit ratio > 99%
- [ ] No unused indexes
- [ ] No table bloat
- [ ] PostgreSQL configuration tuned for hardware
- [ ] Monitoring in place (Prometheus + Grafana)
- [ ] Backup performance acceptable
- [ ] No long-running queries blocking operations

## References

- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [SQLAlchemy Connection Pooling](https://docs.sqlalchemy.org/en/latest/core/pooling.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/usage.html)
- [PostgreSQL Query Optimization](https://www.postgresql.org/docs/current/using-explain.html)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or when performance issues arise
