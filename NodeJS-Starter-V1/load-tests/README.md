# Load Testing Suite

Comprehensive load testing for CCW-Online ERP using [k6](https://k6.io/).

---

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Test Scenarios](#test-scenarios)
4. [Running Tests](#running-tests)
5. [Interpreting Results](#interpreting-results)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Installation

### Install k6

**macOS:**
```bash
brew install k6
```

**Windows (Chocolatey):**
```powershell
choco install k6
```

**Windows (Manual):**
Download from [k6 releases](https://github.com/grafana/k6/releases)

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Verify Installation:**
```bash
k6 version
```

---

## Configuration

### Environment Variables

Set these environment variables before running tests:

```bash
# Required
export BASE_URL="https://api.your-domain.com"
export FRONTEND_URL="https://your-domain.com"

# Test user credentials
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="your-test-password"

# Optional - Docker image tags (for validation)
export BACKEND_IMAGE="your-registry/ccw-erp-backend:v1.0.0"
export FRONTEND_IMAGE="your-registry/ccw-erp-frontend:v1.0.0"
```

**Windows PowerShell:**
```powershell
$env:BASE_URL="https://api.your-domain.com"
$env:FRONTEND_URL="https://your-domain.com"
$env:TEST_USER_EMAIL="test@example.com"
$env:TEST_USER_PASSWORD="your-test-password"
```

### Configuration File

Edit `config.js` to customize:
- Performance thresholds
- Test data (product IDs, customer IDs, etc.)
- Think time (delays between actions)

---

## Test Scenarios

### 1. Smoke Test (`smoke-test.js`)

**Purpose:** Minimal load to verify basic functionality
**Duration:** 1 minute
**Users:** 1-5 concurrent users

**When to run:**
- After every deployment
- Before running larger tests
- To verify system is responding

**Run:**
```bash
npm run test:smoke
# or
k6 run scenarios/smoke-test.js
```

**Expected Results:**
- All requests should succeed (0% error rate)
- Response times should be fast (p95 < 1s)
- All health checks pass

---

### 2. Load Test (`load-test.js`)

**Purpose:** Test under normal expected load
**Duration:** 10 minutes
**Users:** Ramp from 0 to 100 concurrent users

**When to run:**
- Before production deployment
- After significant code changes
- To verify capacity

**Run:**
```bash
npm run test:load
# or
k6 run scenarios/load-test.js
```

**User Scenarios:**
- 40% - Browse products and orders
- 30% - Create and manage quotes
- 20% - Order management workflow
- 10% - Dashboard and reporting

**Expected Results:**
- Error rate < 1%
- p95 response time < 1s
- p99 response time < 2s
- System remains stable throughout
- HPA may trigger if load exceeds configured thresholds

---

### 3. Stress Test (`stress-test.js`)

**Purpose:** Find the system's breaking point
**Duration:** 15 minutes
**Users:** Ramp from 0 to 250+ concurrent users

**When to run:**
- To determine maximum capacity
- To identify bottlenecks
- Before major events (Black Friday, etc.)

**Run:**
```bash
npm run test:stress
# or
k6 run scenarios/stress-test.js
```

**Expected Results:**
- Error rate < 20% (acceptable during stress)
- HPA should trigger multiple scale-ups
- Identify at what point performance degrades significantly
- System should recover during ramp-down

**What to Monitor:**
- CPU and memory usage
- Number of pods (HPA scaling)
- Database connection pool
- Redis memory usage
- Response time degradation point

---

### 4. Spike Test (`spike-test.js`)

**Purpose:** Test sudden traffic spikes
**Duration:** 5 minutes
**Users:** Sudden spike from 10 to 200 users

**When to run:**
- To verify HPA response time
- To test system stability under sudden load
- After HPA configuration changes

**Run:**
```bash
npm run test:spike
# or
k6 run scenarios/spike-test.js
```

**Expected Behavior:**
1. Initial spike shows increased latency (pods scaling)
2. After 30-60s, HPA adds pods
3. Performance improves as pods come online
4. System remains stable throughout
5. After spike ends, pods scale down (5-10 min delay)

**Expected Results:**
- Some increased latency during initial spike (acceptable)
- Error rate < 15%
- HPA triggers within 60 seconds
- Performance recovers as pods scale

---

### 5. Soak Test (`soak-test.js`)

**Purpose:** Test stability over extended period
**Duration:** 1 hour
**Users:** 50 concurrent users (constant load)

**When to run:**
- Before major releases
- To identify memory leaks
- To verify long-term stability

**Run:**
```bash
npm run test:soak
# or
k6 run scenarios/soak-test.js
```

**What to Monitor:**
- Memory usage trend (should be flat)
- Response time trend (should be flat)
- Error rate (should remain low)
- Connection pool (no leaks)

**Signs of Problems:**
- Gradually increasing memory usage (memory leak)
- Increasing response times (performance degradation)
- Connection pool exhaustion
- Growing error rates

---

## Running Tests

### Basic Usage

```bash
# Run a specific test
k6 run scenarios/smoke-test.js

# Run with custom duration
k6 run --duration 5m scenarios/load-test.js

# Run with custom VUs
k6 run --vus 50 --duration 2m scenarios/load-test.js

# Run and output to JSON
k6 run --out json=results.json scenarios/load-test.js

# Run and send metrics to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 scenarios/load-test.js
```

### With Environment Variables

```bash
# Linux/Mac
BASE_URL=https://api.your-domain.com \
TEST_USER_EMAIL=test@example.com \
TEST_USER_PASSWORD=password \
k6 run scenarios/load-test.js

# Windows
$env:BASE_URL="https://api.your-domain.com"; k6 run scenarios/load-test.js
```

### Run All Tests Sequentially

```bash
npm run test:all
```

This runs: smoke → load → stress

---

## Interpreting Results

### Key Metrics

**HTTP Request Duration:**
- `http_req_duration` - Time from request start to end
- `http_req_waiting` - Time waiting for response
- `http_req_sending` - Time sending request
- `http_req_receiving` - Time receiving response

**HTTP Requests:**
- `http_reqs` - Total number of requests
- `http_req_failed` - Percentage of failed requests

**Virtual Users:**
- `vus` - Current number of active VUs
- `vus_max` - Maximum number of VUs

**Iterations:**
- `iterations` - Number of times the default function executed

### Example Output

```
     ✓ products list success
     ✓ create order success
     ✓ order detail success

     checks.........................: 98.50% ✓ 9850 ✗ 150
     data_received..................: 15 MB  25 kB/s
     data_sent......................: 5.2 MB  8.7 kB/s
     http_req_duration..............: avg=324ms  min=45ms med=287ms max=2.1s p(95)=845ms p(99)=1.2s
     http_req_failed................: 1.50%  ✓ 150  ✗ 9850
     http_reqs......................: 10000  16.67/s
     iterations.....................: 2500   4.17/s
     vus............................: 100    min=1   max=100
```

### What's Good?

- ✅ Error rate < 1%
- ✅ p95 response time < 1s
- ✅ All checks passing
- ✅ No timeouts

### What's Bad?

- ❌ Error rate > 5%
- ❌ p95 response time > 2s
- ❌ Checks failing
- ❌ Many timeouts
- ❌ 500 errors (server errors)

---

## Best Practices

### 1. Test Environment

- **Use production-like environment** - Same hardware, same configuration
- **Use realistic data** - Seed database with production-like data volume
- **Warm up first** - Run smoke test before load test
- **Clean up after** - Delete test data created during tests

### 2. Test Strategy

- **Start small** - Smoke → Load → Stress
- **Monitor during tests** - Watch Grafana dashboards
- **Run during low traffic** - Avoid impacting real users
- **Document results** - Keep history of test runs

### 3. Gradual Load Increase

```javascript
stages: [
  { duration: '2m', target: 20 },  // Ramp up slowly
  { duration: '3m', target: 50 },  // Continue ramping
  { duration: '2m', target: 50 },  // Hold steady
  { duration: '2m', target: 0 },   // Ramp down
]
```

### 4. Think Time

Add realistic pauses between actions:

```javascript
import { sleep } from 'k6';

export default function() {
  // Action 1
  http.get('...');
  sleep(3); // User reads page for 3 seconds

  // Action 2
  http.get('...');
  sleep(5); // User reads page for 5 seconds
}
```

### 5. Test Data

Use different test data for each VU:

```javascript
const productId = config.testData.productIds[__VU % config.testData.productIds.length];
```

---

## Troubleshooting

### Issue: All Requests Failing

**Symptoms:** 100% error rate, connection errors

**Causes:**
- Wrong BASE_URL
- API not accessible from test machine
- Firewall blocking requests
- Service not running

**Solutions:**
```bash
# Verify API is accessible
curl https://api.your-domain.com/health

# Check DNS resolution
nslookup api.your-domain.com

# Verify TLS certificate
curl -v https://api.your-domain.com/health
```

### Issue: Authentication Failures

**Symptoms:** 401 Unauthorized errors

**Causes:**
- Wrong test user credentials
- User account doesn't exist
- User account locked/disabled

**Solutions:**
```bash
# Test login manually
curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Verify credentials in environment variables
echo $TEST_USER_EMAIL
echo $TEST_USER_PASSWORD
```

### Issue: Timeouts

**Symptoms:** Many requests timeout

**Causes:**
- System overloaded
- Database bottleneck
- Slow external API calls

**Solutions:**
- Reduce concurrent users
- Check database slow query log
- Monitor Grafana for bottlenecks
- Increase request timeout:
  ```javascript
  http.get('...', { timeout: '60s' });
  ```

### Issue: High Error Rate During Spike

**Symptoms:** Many errors during sudden load increase

**Causes:**
- HPA not scaling fast enough
- Connection pool exhausted
- Resource limits too low

**Solutions:**
- Reduce spike intensity
- Pre-scale pods before test:
  ```bash
  kubectl scale deployment/backend --replicas=5 -n ccw-erp
  ```
- Increase connection pool size
- Adjust HPA behavior (lower threshold)

### Issue: k6 Out of Memory

**Symptoms:** k6 process crashes

**Causes:**
- Too many VUs for test machine
- Large response bodies
- Memory leak in test script

**Solutions:**
- Use k6 cloud instead
- Run distributed tests
- Reduce VUs
- Discard response bodies:
  ```javascript
  http.get('...', { responseType: 'none' });
  ```

---

## k6 Cloud (Optional)

For larger tests, use k6 Cloud:

```bash
# Sign up at k6.io
k6 login cloud

# Run test in cloud
k6 cloud run scenarios/load-test.js
```

**Benefits:**
- Run from multiple geographic locations
- Higher load generation capacity
- Built-in result visualization
- Historical test comparison

---

## Grafana Integration

Monitor load tests in real-time using Grafana:

1. **Open Grafana** during test run
2. **Navigate to dashboards:**
   - Application Performance
   - Infrastructure Health
3. **Watch for:**
   - Response time trends
   - Error rate spikes
   - CPU/memory usage
   - Pod scaling events
   - Database metrics

**Recommended dashboard layout:**
- Left screen: k6 console output
- Right screen: Grafana dashboards

---

## Next Steps

After load testing:

1. **Document results** - Record performance baselines
2. **Identify bottlenecks** - Use Grafana to find slow components
3. **Tune resources** - Adjust CPU/memory limits based on actual usage
4. **Optimize code** - Fix slow endpoints
5. **Adjust HPA** - Fine-tune scaling thresholds
6. **Re-test** - Verify improvements

---

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/)
- [Grafana k6 Extension](https://github.com/grafana/xk6-dashboard)

---

*Last Updated: January 14, 2026*
*Version: 1.0*
