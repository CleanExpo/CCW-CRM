# CCW-ERP/CRM Load Testing

**Linear Issue**: UNI-481 - Backend Load Testing (100 scenarios)
**Priority**: P1 (HIGH)
**Status**: Ready to Execute

---

## Overview

Comprehensive load testing suite for the CCW-ERP/CRM backend API. This test suite covers 100+ scenarios across all major endpoints to validate production readiness and identify performance bottlenecks.

### Test Coverage

- **Authentication** (10 scenarios): Login, token refresh, logout, permissions
- **Products** (15 scenarios): CRUD, search, filters, pagination
- **Customers** (15 scenarios): CRUD, search, filters, history
- **Orders** (20 scenarios): CRUD, workflows, status updates, items
- **Quotes** (15 scenarios): CRUD, conversion, approval, expiry
- **Invoices** (10 scenarios): Generation, PDF export, payments
- **AI Features** (10 scenarios): Insights, predictions, automation
- **Search** (5 scenarios): Global search, autocomplete, facets

**Total**: 100+ unique test scenarios

---

## Prerequisites

### 1. Install k6

**Windows** (Chocolatey):

```powershell
choco install k6
```

**Windows** (Manual):

1. Download from https://k6.io/docs/getting-started/installation/
2. Extract and add to PATH

**macOS** (Homebrew):

```bash
brew install k6
```

**Linux**:

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. Ensure Backend is Running

```bash
# Start backend
cd apps/backend
uv run uvicorn src.api.main:app --reload

# Or use Docker
docker compose up -d
```

### 3. Verify API is Accessible

```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

---

## Quick Start

### Run Quick Test (2 minutes)

```powershell
# Windows
cd tests/load-testing
.\run-tests.ps1 -Test quick

# macOS/Linux
chmod +x run-tests.sh
./run-tests.sh quick
```

### Run Comprehensive Test (20 minutes)

```powershell
# Windows
.\run-tests.ps1 -Test comprehensive

# macOS/Linux
./run-tests.sh comprehensive
```

### Run All Tests

```powershell
# Windows
.\run-tests.ps1 -Test all

# macOS/Linux
./run-tests.sh all
```

---

## Test Scenarios

### 1. Baseline Test

**Purpose**: Establish performance baseline with single user
**Duration**: 1 minute
**VUs**: 1

```bash
k6 run --vus 1 --duration 1m scenarios/quick-test.js
```

**Thresholds**:

- 95% of requests < 500ms
- Error rate < 1%

### 2. Smoke Test

**Purpose**: Verify basic functionality under light load
**Duration**: 2 minutes
**VUs**: 5

```bash
k6 run --vus 5 --duration 2m scenarios/quick-test.js
```

**Thresholds**:

- 95% of requests < 500ms
- 99% of requests < 1000ms
- Error rate < 1%

### 3. Load Test

**Purpose**: Simulate normal usage patterns
**Duration**: 15 minutes
**VUs**: Ramping 0 → 10 → 20

```bash
k6 run scenarios/comprehensive-test.js
```

**Thresholds**:

- 95% of requests < 500ms
- 99% of requests < 1000ms
- Error rate < 1%
- Min requests/second > 10

### 4. Stress Test

**Purpose**: Push system to limits
**Duration**: 20 minutes
**VUs**: Ramping 0 → 20 → 50 → 100

```bash
k6 run --vus 100 --duration 20m scenarios/comprehensive-test.js
```

**Thresholds**:

- Identify breaking point
- Document degradation patterns
- Error rate < 5%

### 5. Spike Test

**Purpose**: Test sudden traffic surge
**Duration**: 5 minutes
**VUs**: 10 → 100 (spike) → 10

```bash
k6 run scenarios/comprehensive-test.js
```

**Thresholds**:

- System recovers from spike
- No crashes or hangs
- Error rate < 5% during spike

### 6. Soak Test

**Purpose**: Extended duration for memory leaks
**Duration**: 30 minutes
**VUs**: 15 (constant)

```bash
k6 run --vus 15 --duration 30m scenarios/comprehensive-test.js
```

**Thresholds**:

- Performance doesn't degrade over time
- Memory doesn't grow continuously
- Error rate < 1%

---

## Configuration

### Environment Variables

```bash
# Set API URL (default: http://localhost:8000)
export API_URL=http://localhost:8000

# Set test credentials
export TEST_USER_EMAIL=admin@demo.com
export TEST_USER_PASSWORD=demo123
```

### Test Config

Edit `config/test-config.js` to modify:

- Performance thresholds
- Test scenarios
- Load patterns
- Test data ranges

---

## Understanding Results

### Key Metrics

#### HTTP Request Duration

- **p(95)**: 95th percentile response time (should be < 500ms)
- **p(99)**: 99th percentile response time (should be < 1000ms)
- **max**: Maximum response time (identify outliers)

#### Request Rate

- **http_reqs**: Total requests per second
- **http_req_failed**: Percentage of failed requests (should be < 1%)

#### Virtual Users

- **vus**: Number of concurrent virtual users
- **vus_max**: Maximum VUs reached during test

### Sample Output

```
✓ http_req_duration...: avg=234ms min=12ms med=189ms max=1.2s p(95)=456ms p(99)=789ms
✓ http_req_failed.....: 0.23% ✓ 12 ✗ 5123
✓ http_reqs...........: 5135 (85.6/s)
  vus..................: 20
  vus_max..............: 50
```

**Interpretation**:

- ✅ 95% of requests completed in < 456ms (Good)
- ✅ Error rate is 0.23% (Excellent)
- ✅ Throughput: 85.6 requests/second (Good for 20 users)

---

## Performance Thresholds

### Expected Performance

| Metric                  | Target     | Good       | Warning    | Critical   |
| ----------------------- | ---------- | ---------- | ---------- | ---------- |
| **Response Time (p95)** | < 300ms    | < 500ms    | < 1000ms   | > 1000ms   |
| **Response Time (p99)** | < 500ms    | < 1000ms   | < 2000ms   | > 2000ms   |
| **Error Rate**          | < 0.1%     | < 1%       | < 5%       | > 5%       |
| **Throughput**          | > 50 req/s | > 20 req/s | > 10 req/s | < 10 req/s |
| **Max Response Time**   | < 2s       | < 5s       | < 10s      | > 10s      |

### Endpoint-Specific Thresholds

| Endpoint Type        | p(95) Target | p(99) Target |
| -------------------- | ------------ | ------------ |
| **Authentication**   | < 300ms      | < 500ms      |
| **Read Operations**  | < 200ms      | < 400ms      |
| **Write Operations** | < 500ms      | < 1000ms     |
| **Search**           | < 300ms      | < 600ms      |
| **Reports**          | < 1000ms     | < 2000ms     |
| **AI Operations**    | < 2000ms     | < 5000ms     |

---

## Results Analysis

### 1. View Results

Results are saved in `results/` directory:

- JSON format: `results/test-name-timestamp.json`
- HTML report: `results/test-name-timestamp.html`

### 2. Generate HTML Report

```bash
# Install k6 HTML reporter
npm install -g k6-reporter

# Generate report
k6-reporter results/comprehensive-test-20260211.json
```

### 3. Analyze Bottlenecks

Look for:

- **High p(99) times**: Outliers that need investigation
- **Increasing response times**: Potential memory leaks
- **High error rates**: Bugs or capacity issues
- **Failed requests**: Specific endpoints breaking

### 4. Common Issues

| Issue                        | Symptom                           | Solution             |
| ---------------------------- | --------------------------------- | -------------------- |
| **Database Connection Pool** | Timeouts at high load             | Increase pool size   |
| **Memory Leak**              | Response time increases over time | Profile memory usage |
| **N+1 Queries**              | Slow list endpoints               | Add eager loading    |
| **Missing Indexes**          | Slow search/filter                | Add database indexes |
| **API Rate Limiting**        | 429 errors                        | Adjust rate limits   |

---

## Troubleshooting

### k6 Doesn't Start

```bash
# Check k6 is installed
k6 version

# Check PATH
echo $env:PATH  # Windows
echo $PATH      # macOS/Linux
```

### API Not Accessible

```bash
# Check backend is running
curl http://localhost:8000/health

# Check Docker
docker compose ps

# Check logs
docker compose logs backend
```

### Authentication Fails

```bash
# Verify credentials
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'

# Check user exists in database
docker compose exec postgres psql -U starter_user -d starter_db \
  -c "SELECT email FROM users WHERE email='admin@demo.com';"
```

### Out of Memory

```bash
# Reduce VUs
k6 run --vus 5 scenarios/quick-test.js

# Reduce duration
k6 run --duration 2m scenarios/comprehensive-test.js

# Run one scenario at a time
k6 run scenarios/quick-test.js
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2am
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Start backend
        run: |
          docker compose up -d
          sleep 10

      - name: Run load tests
        run: |
          cd tests/load-testing
          k6 run --vus 10 --duration 5m scenarios/quick-test.js

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: tests/load-testing/results/
```

---

## Next Steps

### After Running Tests

1. **Analyze Results**
   - Review performance metrics
   - Identify bottlenecks
   - Document findings

2. **Optimize**
   - Add database indexes
   - Optimize slow queries
   - Improve caching
   - Scale resources

3. **Re-test**
   - Run tests again
   - Verify improvements
   - Document new baselines

4. **Document**
   - Update performance documentation
   - Add metrics to monitoring
   - Set up alerts

5. **Update Linear**
   - Mark UNI-481 complete
   - Document performance baselines
   - Create follow-up issues for optimizations

---

## Resources

- **k6 Documentation**: https://k6.io/docs/
- **k6 Examples**: https://k6.io/docs/examples/
- **Performance Testing Guide**: https://k6.io/docs/test-types/
- **CI/CD Integration**: https://k6.io/docs/integrations/

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review k6 documentation
3. Check Linear issue UNI-481
4. Contact development team

---

**Status**: Ready to Execute ✅
**Last Updated**: 2026-02-11
**Linear**: UNI-481
