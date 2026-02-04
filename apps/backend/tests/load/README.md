# Load Testing Framework - CCW-Online ERP

Comprehensive load testing suite for performance validation and capacity planning.

## Overview

This load testing framework uses **Locust** (Python-based load testing tool) to simulate thousands of concurrent users interacting with the CCW-Online ERP system.

### Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| **p95 Response Time** | <500ms | 95th percentile response time |
| **Success Rate** | >95% | Percentage of successful requests |
| **Error Rate** | <5% | Percentage of failed requests |
| **Concurrent Users** | 10,000+ | Maximum concurrent users supported |
| **Sustained Load** | 10+ minutes | Duration system can handle peak load |

---

## Quick Start

### 1. Install Dependencies

```bash
# Install Locust
pip install locust

# Or using requirements file
pip install -r load_test_requirements.txt
```

### 2. Start Backend Server

```bash
# Ensure backend is running
cd apps/backend
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Run Load Tests

**Using Scripts (Recommended):**

```bash
# Linux/Mac
cd apps/backend/tests/load
chmod +x load_test_scenarios.sh
./load_test_scenarios.sh smoke          # Quick smoke test
./load_test_scenarios.sh normal         # Normal load (100 users)
./load_test_scenarios.sh stress         # Stress test (10,000 users)
./load_test_scenarios.sh all            # Run all scenarios

# Windows PowerShell
cd apps\backend\tests\load
.\load_test_scenarios.ps1 -Scenario smoke
.\load_test_scenarios.ps1 -Scenario stress
```

**Using Locust Directly:**

```bash
# Web UI mode (interactive dashboard at http://localhost:8089)
locust -f locustfile.py --host=http://localhost:8000

# Headless mode (no UI, for automation)
locust -f locustfile.py --host=http://localhost:8000 \
       --users 1000 --spawn-rate 50 --run-time 5m --headless
```

---

## Test Scenarios

### 1. Smoke Test
**Purpose:** Quick validation of endpoints
- **Users:** 10
- **Duration:** 1 minute
- **Use Case:** Pre-deployment smoke test

```bash
./load_test_scenarios.sh smoke
```

### 2. Normal Load Test
**Purpose:** Simulate typical production traffic
- **Users:** 100
- **Duration:** 5 minutes
- **Use Case:** Baseline performance validation

```bash
./load_test_scenarios.sh normal
```

### 3. High Load Test
**Purpose:** Simulate peak traffic conditions
- **Users:** 1,000
- **Duration:** 10 minutes
- **Use Case:** Peak hour capacity planning

```bash
./load_test_scenarios.sh high
```

### 4. Stress Test
**Purpose:** Test system limits
- **Users:** 10,000
- **Duration:** 10 minutes
- **Target:** 95%+ success rate, p95 <500ms
- **Use Case:** Maximum capacity validation

```bash
./load_test_scenarios.sh stress
```

### 5. Multi-Tenant Isolation Test
**Purpose:** Verify tenant data isolation under load
- **Users:** 1,000 (across 100+ organizations)
- **Duration:** 10 minutes
- **Use Case:** Security validation

```bash
./load_test_scenarios.sh multi-tenant
```

### 6. Sustained Load Test
**Purpose:** Long-duration stability test
- **Users:** 500
- **Duration:** 30 minutes
- **Use Case:** Stability and memory leak detection

```bash
./load_test_scenarios.sh sustained
```

### 7. Read-Heavy Workload
**Purpose:** Simulate browsing/searching behavior
- **Users:** 500
- **Duration:** 10 minutes
- **Workload:** 80% reads, 20% writes

```bash
./load_test_scenarios.sh read-heavy
```

### 8. Write-Heavy Workload
**Purpose:** Simulate order/quote creation spikes
- **Users:** 200
- **Duration:** 10 minutes
- **Workload:** 70% writes, 30% reads

```bash
./load_test_scenarios.sh write-heavy
```

---

## User Classes

### NormalUser (Balanced Workload)
Mixed read/write operations simulating typical user behavior:
- 30% Product browsing
- 25% Quote management
- 20% Order processing
- 15% Billing/subscription
- 10% Dashboard views

### ReadHeavyUser
Mostly browsing and searching (minimal writes):
- 40% Product browsing
- 20% Quote viewing
- 20% Order viewing
- 20% Dashboard

### WriteHeavyUser
Frequent creation of quotes, orders, products:
- 35% Quote creation
- 35% Order creation
- 30% Product creation

### MultiTenantUser
Focuses on tenant isolation verification:
- 100% Multi-tenant isolation tests

---

## Tested Endpoints

### Products Module
- `GET /api/products` - List products with pagination and filters
- `POST /api/products` - Create new product
- `GET /api/products/{id}` - Get product details

### Quotes Module
- `GET /api/quotes` - List quotes with filters
- `POST /api/quotes` - Create new quote
- `GET /api/quotes/{id}` - Get quote details

### Orders Module
- `GET /api/orders` - List orders with filters
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order details

### Billing Module
- `GET /api/billing` - Get current subscription
- `GET /api/billing/invoices` - List invoices

### Dashboard Module
- `GET /api/dashboard/metrics` - Get dashboard metrics

---

## Results Analysis

### HTML Reports
After each test run, Locust generates an HTML report:
```
load_test_results/
├── smoke_20260203_143022.html
├── normal_load_20260203_143522.html
└── stress_test_20260203_144822.html
```

Open these files in a browser to view:
- Request statistics (median, p95, p99 response times)
- Success/failure rates
- Requests per second
- Response time charts
- Failure distribution

### CSV Data
Raw data is also exported to CSV for custom analysis:
```
load_test_results/
├── stress_test_20260203_144822_stats.csv
├── stress_test_20260203_144822_stats_history.csv
└── stress_test_20260203_144822_failures.csv
```

### Key Metrics to Monitor

**Response Time:**
```
Median:  <200ms (Good)
p95:     <500ms (Target)
p99:     <1000ms (Acceptable)
```

**Success Rate:**
```
>99%:  Excellent
>95%:  Good (Target)
<95%:  Needs investigation
```

**Requests Per Second (RPS):**
```
Normal load:  ~500 RPS
High load:    ~2,000 RPS
Stress test:  ~5,000+ RPS
```

---

## Performance Optimization Tips

### If p95 > 500ms:
1. **Database:** Check slow queries with `EXPLAIN ANALYZE`
2. **Indexes:** Ensure foreign keys and search fields are indexed
3. **Caching:** Enable Redis caching for frequently accessed data
4. **Connection Pooling:** Increase SQLAlchemy pool size

### If Error Rate > 5%:
1. **Rate Limiting:** Ensure Redis is running (not in-memory mode)
2. **Database Connections:** Increase max_connections in PostgreSQL
3. **Timeouts:** Increase request timeout settings
4. **Resource Limits:** Check CPU/memory constraints

### If RPS Plateaus:
1. **Horizontal Scaling:** Add more backend instances
2. **Load Balancing:** Configure Nginx/HAProxy
3. **Database Replication:** Set up read replicas
4. **CDN:** Offload static assets

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2am
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: pip install locust
      - name: Start backend
        run: |
          cd apps/backend
          uvicorn src.api.main:app --host 0.0.0.0 --port 8000 &
          sleep 10
      - name: Run stress test
        run: |
          cd apps/backend/tests/load
          ./load_test_scenarios.sh stress
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: apps/backend/tests/load/load_test_results/
```

---

## Troubleshooting

### Problem: "Connection refused" errors
**Solution:** Ensure backend is running on port 8000

```bash
curl http://localhost:8000/api/health
```

### Problem: High failure rate on auth endpoints
**Solution:** Reduce spawn rate or pre-create test users

```bash
# Lower spawn rate
locust -f locustfile.py --spawn-rate 10 --users 100
```

### Problem: Database connection errors
**Solution:** Increase PostgreSQL max_connections

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Increase max_connections (postgresql.conf)
max_connections = 200
```

### Problem: Redis connection errors
**Solution:** Ensure Redis is running

```bash
redis-cli ping  # Should return "PONG"
```

### Problem: Out of memory errors
**Solution:** Reduce concurrent users or increase server memory

```bash
# Check memory usage
free -h

# Reduce users
locust -f locustfile.py --users 1000  # Instead of 10000
```

---

## Advanced Usage

### Custom Scenarios

Create a custom user class in `locustfile.py`:

```python
class CustomUser(AuthenticatedUser):
    """Custom workflow for specific testing."""

    wait_time = between(0.5, 2)  # Faster requests

    @task(10)
    def my_custom_task(self):
        with self.client.get("/api/my-endpoint") as response:
            if response.status_code == 200:
                response.success()
```

Run with:
```bash
locust -f locustfile.py --user-classes=CustomUser
```

### Distributed Load Testing

Run load tests across multiple machines:

```bash
# On master machine
locust -f locustfile.py --master --expect-workers=3

# On worker machines
locust -f locustfile.py --worker --master-host=192.168.1.100
```

### Parameterized Testing

Override host via environment variable:

```bash
export LOAD_TEST_HOST=https://staging.ccw-erp.com
./load_test_scenarios.sh stress
```

---

## Best Practices

1. **Baseline First:** Run normal load test to establish baseline
2. **Gradual Ramp:** Use appropriate spawn rates (don't spike to 10k instantly)
3. **Monitor Resources:** Watch CPU, memory, disk I/O during tests
4. **Cleanup Data:** Clear test data between runs to avoid skew
5. **Realistic Workflows:** Match user behavior patterns
6. **Document Results:** Track performance over time
7. **Test in Staging:** Never run load tests in production
8. **Database Seeding:** Ensure adequate test data exists

---

## Performance Regression Testing

Track performance metrics over time:

```bash
# Run stress test and save results
./load_test_scenarios.sh stress

# Compare with previous run
diff load_test_results/stress_test_20260203.csv \
     load_test_results/stress_test_20260201.csv
```

Set up alerts if metrics degrade:
- p95 response time increases >20%
- Error rate increases >2%
- RPS decreases >15%

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Locust documentation: https://docs.locust.io
3. Open an issue in the project repository

---

**Last Updated:** February 3, 2026
**Framework Version:** 1.0.0
**Locust Version:** 2.x
