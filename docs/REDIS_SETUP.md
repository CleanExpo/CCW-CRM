# Redis Cluster Setup Guide

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-D043

---

## Overview

This document provides comprehensive guidance on setting up Redis with Sentinel for high availability in CCW-Online ERP. Redis is used for session storage, caching, and real-time features.

## Architecture

### Redis Sentinel Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│              (FastAPI + Next.js)                         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ Redis Client (with Sentinel support)
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐              ┌───────▼────────┐
│   Sentinel 1   │              │   Sentinel 2   │
│   (Port 26379) │◄────────────►│   (Port 26380) │
└───────┬────────┘              └───────┬────────┘
        │                               │
        │         ┌───────────────┐    │
        └────────►│   Sentinel 3  │◄───┘
                  │   (Port 26381)│
                  └───────┬───────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
      ┌─────▼──────┐            ┌──────▼─────┐
      │   Master   │            │  Replica 1 │
      │ (Port 6379)│───────────►│(Port 6380) │
      └─────┬──────┘            └────────────┘
            │
            │
      ┌─────▼──────┐
      │  Replica 2 │
      │(Port 6381) │
      └────────────┘
```

### Components

1. **Redis Master**: Primary Redis instance accepting writes
2. **Redis Replicas**: 2 replicas for read scaling and failover
3. **Redis Sentinel**: 3 Sentinel processes monitoring Redis instances
4. **Automatic Failover**: Sentinel promotes replica to master if master fails

### High Availability Features

- **Automatic Failover**: Sentinel detects master failure and promotes replica
- **Configuration Provider**: Clients discover current master via Sentinel
- **Monitoring**: Continuous health checks on all Redis instances
- **Notification**: Alerts when failover occurs
- **Quorum**: Requires majority (2/3) of Sentinels to agree on failover

## Installation and Setup

### Prerequisites

- Docker and Docker Compose installed
- At least 6GB RAM available
- Ports 6379-6381, 26379-26381 available

### Step 1: Create Redis Configuration Directory

```bash
# Create directory for Redis configurations
mkdir -p /opt/ccw-online-erp/redis

# Set proper permissions
chown -R ccwapp:ccwapp /opt/ccw-online-erp/redis
```

### Step 2: Create Sentinel Configuration Files

#### Sentinel 1 Configuration

Create `/opt/ccw-online-erp/redis/sentinel-1.conf`:

```conf
# Sentinel Configuration - Instance 1
port 26379
dir /data

# Monitor the master
sentinel monitor ccw-redis redis-master 6379 2

# Master password
sentinel auth-pass ccw-redis redis_password_change_me

# Timeouts and thresholds
sentinel down-after-milliseconds ccw-redis 5000
sentinel parallel-syncs ccw-redis 1
sentinel failover-timeout ccw-redis 10000

# Notification scripts (optional)
# sentinel notification-script ccw-redis /usr/local/bin/notify.sh
# sentinel client-reconfig-script ccw-redis /usr/local/bin/reconfig.sh

# Logging
sentinel deny-scripts-reconfig yes
```

#### Sentinel 2 Configuration

Create `/opt/ccw-online-erp/redis/sentinel-2.conf`:

```conf
# Sentinel Configuration - Instance 2
port 26379
dir /data

sentinel monitor ccw-redis redis-master 6379 2
sentinel auth-pass ccw-redis redis_password_change_me
sentinel down-after-milliseconds ccw-redis 5000
sentinel parallel-syncs ccw-redis 1
sentinel failover-timeout ccw-redis 10000
sentinel deny-scripts-reconfig yes
```

#### Sentinel 3 Configuration

Create `/opt/ccw-online-erp/redis/sentinel-3.conf`:

```conf
# Sentinel Configuration - Instance 3
port 26379
dir /data

sentinel monitor ccw-redis redis-master 6379 2
sentinel auth-pass ccw-redis redis_password_change_me
sentinel down-after-milliseconds ccw-redis 5000
sentinel parallel-syncs ccw-redis 1
sentinel failover-timeout ccw-redis 10000
sentinel deny-scripts-reconfig yes
```

### Step 3: Set Redis Password

```bash
# Generate strong password
REDIS_PASSWORD=$(openssl rand -base64 32)

# Store in environment file
echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> /opt/ccw-online-erp/config/.env.production

# Update docker-compose.redis-cluster.yml with password
```

### Step 4: Deploy Redis Cluster

```bash
# Navigate to project directory
cd /opt/ccw-online-erp

# Start Redis cluster
docker compose -f docker-compose.redis-cluster.yml up -d

# Verify all containers are running
docker ps | grep redis

# Expected output: 6 containers (1 master, 2 replicas, 3 sentinels)
```

### Step 5: Verify Cluster Status

```bash
# Check master status
docker exec ccw-redis-master redis-cli -a redis_password_change_me INFO replication

# Check replica status
docker exec ccw-redis-replica-1 redis-cli -p 6380 -a redis_password_change_me INFO replication

# Check Sentinel status
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 SENTINEL masters
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 SENTINEL replicas ccw-redis
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 SENTINEL sentinels ccw-redis
```

## Configuration Details

### Redis Master Configuration

```yaml
command: >
  redis-server
  --port 6379
  --appendonly yes              # Enable AOF persistence
  --appendfsync everysec        # Sync to disk every second
  --save 900 1                  # RDB snapshot: 1 change in 15 minutes
  --save 300 10                 # RDB snapshot: 10 changes in 5 minutes
  --save 60 10000               # RDB snapshot: 10000 changes in 1 minute
  --maxmemory 2gb               # Maximum memory limit
  --maxmemory-policy allkeys-lru # Eviction policy
  --requirepass PASSWORD        # Authentication
  --masterauth PASSWORD         # For replication
```

### Redis Replica Configuration

```yaml
command: >
  redis-server
  --port 6380                   # Different port for replica
  --appendonly yes
  --appendfsync everysec
  --replicaof redis-master 6379 # Replicate from master
  --masterauth PASSWORD
  --requirepass PASSWORD
  --maxmemory 2gb
  --maxmemory-policy allkeys-lru
```

### Sentinel Configuration Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| **port** | 26379 | Sentinel listening port |
| **sentinel monitor** | ccw-redis redis-master 6379 2 | Monitor master, quorum=2 |
| **down-after-milliseconds** | 5000 | Consider master down after 5s |
| **parallel-syncs** | 1 | Number of replicas to sync simultaneously |
| **failover-timeout** | 10000 | Failover timeout (10s) |
| **quorum** | 2 | Minimum Sentinels needed to trigger failover |

## Application Configuration

### Python (FastAPI) - Redis Client with Sentinel

Update `apps/backend/src/config/redis.py`:

```python
from redis.sentinel import Sentinel
from redis import Redis
import os

# Sentinel configuration
SENTINEL_HOSTS = [
    ('localhost', 26379),
    ('localhost', 26380),
    ('localhost', 26381),
]

SENTINEL_SERVICE_NAME = 'ccw-redis'
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', 'redis_password_change_me')

# Create Sentinel connection
sentinel = Sentinel(
    SENTINEL_HOSTS,
    socket_timeout=0.5,
    sentinel_kwargs={'password': REDIS_PASSWORD},
)

# Get master and replica connections
redis_master = sentinel.master_for(
    SENTINEL_SERVICE_NAME,
    socket_timeout=0.5,
    password=REDIS_PASSWORD,
    decode_responses=True,
)

redis_replica = sentinel.slave_for(
    SENTINEL_SERVICE_NAME,
    socket_timeout=0.5,
    password=REDIS_PASSWORD,
    decode_responses=True,
)

# Use master for writes, replica for reads
def get_redis_connection(readonly: bool = False) -> Redis:
    """Get Redis connection (master for writes, replica for reads)."""
    return redis_replica if readonly else redis_master
```

### Node.js (Next.js) - Redis Client with Sentinel

Update `apps/web/lib/redis.ts`:

```typescript
import Redis from 'ioredis';

const sentinelConfig = {
  sentinels: [
    { host: 'localhost', port: 26379 },
    { host: 'localhost', port: 26380 },
    { host: 'localhost', port: 26381 },
  ],
  name: 'ccw-redis',
  password: process.env.REDIS_PASSWORD || 'redis_password_change_me',
  sentinelPassword: process.env.REDIS_PASSWORD || 'redis_password_change_me',
};

// Master connection (for writes)
export const redisMaster = new Redis(sentinelConfig);

// Replica connection (for reads)
export const redisReplica = new Redis({
  ...sentinelConfig,
  role: 'slave',
});
```

## Failover Testing

### Manual Failover Test

#### Step 1: Identify Current Master

```bash
# Check current master
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 SENTINEL get-master-addr-by-name ccw-redis

# Output: Current master IP and port
```

#### Step 2: Simulate Master Failure

```bash
# Stop master container
docker stop ccw-redis-master

# Or crash Redis process
docker exec ccw-redis-master redis-cli -a redis_password_change_me DEBUG sleep 30
```

#### Step 3: Monitor Failover

```bash
# Watch Sentinel logs
docker logs -f ccw-redis-sentinel-1

# Expected output:
# +sdown master ccw-redis 172.18.0.2 6379
# +odown master ccw-redis 172.18.0.2 6379 #quorum 2/2
# +failover-triggered master ccw-redis 172.18.0.2 6379
# +failover-state-wait-start master ccw-redis 172.18.0.2 6379
# +failover-state-select-slave master ccw-redis 172.18.0.2 6379
# +selected-slave slave 172.18.0.3:6380 172.18.0.3 6380 @ ccw-redis 172.18.0.2 6379
# +failover-state-send-slaveof-noone slave 172.18.0.3:6380 172.18.0.3 6380 @ ccw-redis 172.18.0.2 6379
# +failover-end master ccw-redis 172.18.0.2 6379
# +switch-master ccw-redis 172.18.0.2 6379 172.18.0.3 6380
```

#### Step 4: Verify New Master

```bash
# Check new master
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 SENTINEL get-master-addr-by-name ccw-redis

# Verify replication
docker exec ccw-redis-replica-1 redis-cli -p 6380 -a redis_password_change_me INFO replication
```

#### Step 5: Restart Old Master (becomes replica)

```bash
# Start old master
docker start ccw-redis-master

# It will automatically become a replica
docker exec ccw-redis-master redis-cli -a redis_password_change_me INFO replication
```

### Expected Failover Time

- **Detection**: 5 seconds (down-after-milliseconds)
- **Consensus**: 1-2 seconds (Sentinel quorum)
- **Promotion**: 2-3 seconds
- **Total**: ~8-10 seconds downtime

## Monitoring and Maintenance

### Monitoring Commands

#### Check Cluster Health

```bash
# Check all Sentinels
for port in 26379 26380 26381; do
    echo "=== Sentinel on port $port ==="
    docker exec ccw-redis-sentinel-1 redis-cli -p $port SENTINEL masters
done

# Check master and replicas
docker exec ccw-redis-master redis-cli -a redis_password_change_me INFO replication

# Check memory usage
docker exec ccw-redis-master redis-cli -a redis_password_change_me INFO memory

# Check connected clients
docker exec ccw-redis-master redis-cli -a redis_password_change_me CLIENT LIST
```

#### Sentinel Metrics

```bash
# Get Sentinel info
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 SENTINEL master ccw-redis

# Check Sentinel status
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 INFO sentinel

# Count known sentinels
docker exec ccw-redis-sentinel-1 redis-cli -p 26379 SENTINEL sentinels ccw-redis | grep name
```

### Performance Monitoring

```bash
# Monitor commands in real-time
docker exec ccw-redis-master redis-cli -a redis_password_change_me MONITOR

# Get slow log (queries > 10ms)
docker exec ccw-redis-master redis-cli -a redis_password_change_me SLOWLOG GET 20

# Get statistics
docker exec ccw-redis-master redis-cli -a redis_password_change_me INFO stats
```

### Prometheus Metrics

Redis Exporter is already configured in `docker-compose.yml`:

```yaml
redis-exporter:
  image: oliver006/redis_exporter:v1.55.0
  environment:
    REDIS_ADDR: "redis:6379"
    REDIS_PASSWORD: "${REDIS_PASSWORD}"
  ports:
    - "9121:9121"
```

**Metrics endpoint**: `http://localhost:9121/metrics`

**Key metrics**:
- `redis_up` - Redis availability
- `redis_connected_clients` - Number of connected clients
- `redis_used_memory_bytes` - Memory usage
- `redis_commands_processed_total` - Total commands processed
- `redis_keyspace_hits_total` - Cache hits
- `redis_keyspace_misses_total` - Cache misses

### Maintenance Tasks

#### Flush Cache (Use with Caution)

```bash
# Flush all keys (USE WITH CAUTION - deletes all data)
docker exec ccw-redis-master redis-cli -a redis_password_change_me FLUSHALL

# Flush specific database
docker exec ccw-redis-master redis-cli -a redis_password_change_me -n 0 FLUSHDB
```

#### Backup Redis Data

```bash
# Trigger RDB snapshot
docker exec ccw-redis-master redis-cli -a redis_password_change_me BGSAVE

# Copy RDB file
docker cp ccw-redis-master:/data/dump.rdb /opt/ccw-online-erp/backups/redis/

# Backup AOF file
docker cp ccw-redis-master:/data/appendonly.aof /opt/ccw-online-erp/backups/redis/
```

#### Restore Redis Data

```bash
# Stop Redis
docker stop ccw-redis-master

# Copy backup to data volume
docker cp /opt/ccw-online-erp/backups/redis/dump.rdb ccw-redis-master:/data/

# Start Redis
docker start ccw-redis-master
```

## Troubleshooting

### Issue 1: Sentinel Cannot Reach Master

**Symptoms**: Sentinels show master as down (`+sdown`)

**Diagnosis**:
```bash
# Check network connectivity
docker exec ccw-redis-sentinel-1 ping redis-master

# Check Redis master is running
docker exec ccw-redis-master redis-cli -a redis_password_change_me PING
```

**Solution**:
```bash
# Restart master
docker restart ccw-redis-master

# Check Sentinel logs
docker logs ccw-redis-sentinel-1
```

### Issue 2: Failover Loop

**Symptoms**: Continuous failovers, master keeps changing

**Diagnosis**:
```bash
# Check Sentinel logs for errors
docker logs ccw-redis-sentinel-1 | grep failover

# Check for network issues
docker network inspect ccw-online-erp_redis-network
```

**Solution**:
```bash
# Increase down-after-milliseconds (reduce sensitivity)
# Edit sentinel config: down-after-milliseconds 10000

# Restart all Sentinels
docker restart ccw-redis-sentinel-1 ccw-redis-sentinel-2 ccw-redis-sentinel-3
```

### Issue 3: Replica Not Syncing

**Symptoms**: Replica shows lag or not connected

**Diagnosis**:
```bash
# Check replica status
docker exec ccw-redis-replica-1 redis-cli -p 6380 -a redis_password_change_me INFO replication

# Check master logs
docker logs ccw-redis-master | grep -i sync
```

**Solution**:
```bash
# Restart replica
docker restart ccw-redis-replica-1

# Force resync
docker exec ccw-redis-replica-1 redis-cli -p 6380 -a redis_password_change_me REPLICAOF redis-master 6379
```

### Issue 4: Memory Limit Reached

**Symptoms**: Redis rejecting writes (OOM errors)

**Diagnosis**:
```bash
# Check memory usage
docker exec ccw-redis-master redis-cli -a redis_password_change_me INFO memory
```

**Solution**:
```bash
# Option 1: Increase memory limit
# Edit docker-compose.redis-cluster.yml: --maxmemory 4gb

# Option 2: Flush old keys
docker exec ccw-redis-master redis-cli -a redis_password_change_me --scan --pattern "old:*" | xargs docker exec ccw-redis-master redis-cli -a redis_password_change_me DEL

# Option 3: Check eviction policy
docker exec ccw-redis-master redis-cli -a redis_password_change_me CONFIG GET maxmemory-policy
```

### Issue 5: Authentication Errors

**Symptoms**: "NOAUTH Authentication required"

**Solution**:
```bash
# Verify password in environment file
cat /opt/ccw-online-erp/config/.env.production | grep REDIS_PASSWORD

# Update docker-compose environment variables
docker compose -f docker-compose.redis-cluster.yml down
docker compose -f docker-compose.redis-cluster.yml up -d
```

## Best Practices

### 1. Security

- ✅ Always use strong passwords (`REDIS_PASSWORD`)
- ✅ Do not expose Redis ports publicly (use VPN or private network)
- ✅ Enable `requirepass` and `masterauth`
- ✅ Use firewall rules to restrict access
- ✅ Regularly rotate passwords

### 2. Performance

- ✅ Use connection pooling in application
- ✅ Set appropriate `maxmemory` based on available RAM
- ✅ Use `allkeys-lru` eviction policy for caching
- ✅ Monitor slow queries and optimize
- ✅ Use pipelining for bulk operations

### 3. High Availability

- ✅ Always run odd number of Sentinels (3 or 5)
- ✅ Deploy Sentinels on separate hosts/availability zones
- ✅ Set quorum to majority (2 for 3 Sentinels)
- ✅ Test failover regularly (monthly)
- ✅ Monitor Sentinel health

### 4. Data Persistence

- ✅ Enable both AOF and RDB persistence
- ✅ Use `appendfsync everysec` for balance of safety and performance
- ✅ Schedule regular backups
- ✅ Test restore procedures

### 5. Monitoring

- ✅ Monitor memory usage (alert at 80%)
- ✅ Track cache hit ratio (target > 90%)
- ✅ Monitor replication lag
- ✅ Set up alerts for failovers
- ✅ Track command latency

## Production Deployment Checklist

- [ ] Redis cluster deployed with 1 master + 2 replicas
- [ ] 3 Sentinel instances running
- [ ] Strong password configured
- [ ] Firewall rules configured (ports 6379-6381, 26379-26381)
- [ ] Persistence enabled (AOF + RDB)
- [ ] Memory limits configured (maxmemory)
- [ ] Eviction policy set (allkeys-lru)
- [ ] Application configured to use Sentinel
- [ ] Monitoring configured (Prometheus + Grafana)
- [ ] Backup strategy in place
- [ ] Failover tested successfully
- [ ] Documentation updated with passwords and configuration
- [ ] Team trained on failover procedures

## Performance Benchmarking

### Run Redis Benchmark

```bash
# Benchmark master
docker exec ccw-redis-master redis-benchmark -a redis_password_change_me -q -n 100000

# Expected output:
# PING_INLINE: 80000+ requests per second
# PING_BULK: 80000+ requests per second
# SET: 70000+ requests per second
# GET: 80000+ requests per second
# INCR: 75000+ requests per second
```

## References

- [Redis Sentinel Documentation](https://redis.io/docs/management/sentinel/)
- [Redis Replication](https://redis.io/docs/management/replication/)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Redis Client Libraries](https://redis.io/clients)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or after infrastructure changes
**Last Tested Failover**: [Date]
