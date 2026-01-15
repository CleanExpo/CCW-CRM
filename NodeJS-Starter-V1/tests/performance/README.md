# Performance Testing with k6

This directory contains load testing scripts using [k6](https://k6.io), a modern load testing tool.

## Installation

### Windows
```bash
winget install k6 --source winget
```

### macOS
```bash
brew install k6
```

### Linux
```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

See [k6 installation docs](https://k6.io/docs/get-started/installation/) for other platforms.

## Test Scenarios

### 1. Baseline Test (`baseline-test.js`)
**Purpose**: Establish performance baseline under normal conditions

**Load**: 50 concurrent users for 3 minutes

**Thresholds**:
- p95 response time: < 300ms
- p99 response time: < 500ms
- Error rate: < 0.5%

**Run**:
```bash
k6 run tests/performance/baseline-test.js
```

### 2. Load Test (`load-test.js`)
**Purpose**: Validate performance under expected load

**Load**: Ramp up to 100 concurrent users over 5 minutes

**Thresholds**:
- p95 response time: < 500ms
- p99 response time: < 1000ms
- Error rate: < 1%
- Success rate: > 99%

**Run**:
```bash
k6 run tests/performance/load-test.js
```

### 3. Stress Test (`stress-test.js`)
**Purpose**: Find system breaking point and performance degradation

**Load**: Gradually increase to 200 concurrent users over 10 minutes

**Thresholds**:
- p95 response time: < 1000ms
- p99 response time: < 2000ms
- Error rate: < 5%
- Max 50 timeouts

**Run**:
```bash
k6 run tests/performance/stress-test.js
```

### 4. Spike Test (`spike-test.js`)
**Purpose**: Test auto-scaling and recovery from sudden traffic surges

**Load**: Sudden spike from 0 to 500 users, sustain, then drop

**Thresholds**:
- p95 response time: < 3000ms
- p99 response time: < 5000ms
- Error rate: < 10%
- Recovery time: < 2000ms (p95)

**Run**:
```bash
k6 run tests/performance/spike-test.js
```

## Environment Variables

Configure test targets using environment variables:

```bash
# Backend API URL (default: http://localhost:8000)
export BASE_URL=https://api.yourapp.com

# Frontend URL (default: http://localhost:3000)
export WEB_URL=https://yourapp.com

# Run test with custom URLs
k6 run -e BASE_URL=https://staging-api.yourapp.com tests/performance/load-test.js
```

## Output Formats

### Console Output (default)
```bash
k6 run tests/performance/load-test.js
```

### JSON Output
```bash
k6 run --out json=results.json tests/performance/load-test.js
```

### CSV Output
```bash
k6 run --out csv=results.csv tests/performance/load-test.js
```

### Cloud Output (k6 Cloud)
```bash
k6 login cloud --token YOUR_K6_CLOUD_TOKEN
k6 run --out cloud tests/performance/load-test.js
```

### InfluxDB + Grafana
```bash
# Send metrics to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/load-test.js

# View in Grafana dashboard
```

## Interpreting Results

### Key Metrics

**http_req_duration**: Time from request start to response end
- `avg`: Average response time
- `p(95)`: 95th percentile (95% of requests faster than this)
- `p(99)`: 99th percentile (99% of requests faster than this)
- `max`: Slowest request

**http_req_failed**: Percentage of failed HTTP requests
- Goal: < 1% for normal operations

**vus**: Number of virtual users
- Active concurrent users during test

**iterations**: Total number of test iterations completed

### Pass/Fail Criteria

Tests pass if all thresholds are met:
- ✅ All threshold checks show "✓"
- ❌ Failed checks show "✗" and test exits with error code 99

### Example Output
```
     ✓ health check status is 200
     ✓ PRD generation status is 200 or 202
     ✗ PRD generation response time < 1000ms

     checks.........................: 98.50%  ✓ 985   ✗ 15
     data_received..................: 1.2 MB  20 kB/s
     data_sent......................: 580 kB  9.7 kB/s
     http_req_duration..............: avg=450ms min=120ms med=380ms max=1.2s p(90)=720ms p(95)=850ms
     http_req_failed................: 0.50%   ✓ 5     ✗ 995
     iterations.....................: 1000    16.67/s
     vus............................: 100     min=0   max=100
```

## CI/CD Integration

Load tests run automatically in CI for:
- ✅ Scheduled runs (weekly)
- ✅ Manual triggers
- ⚠️  Not on every PR (too resource intensive)

See `.github/workflows/performance-testing.yml`

## Best Practices

### Before Running Tests

1. **Start services**: Ensure backend and frontend are running
   ```bash
   # Backend
   cd apps/backend && uv run uvicorn src.api.main:app

   # Frontend
   cd apps/web && pnpm run build && pnpm start
   ```

2. **Use production build**: Test against optimized builds, not dev mode

3. **Isolate environment**: Run on dedicated test infrastructure

4. **Baseline first**: Always run baseline test before other scenarios

### During Tests

1. **Monitor resources**: Watch CPU, memory, disk I/O
2. **Check logs**: Look for errors in application logs
3. **Database**: Monitor connection pools, query performance

### After Tests

1. **Analyze trends**: Compare results over time
2. **Identify bottlenecks**: Review slowest endpoints
3. **Fix regressions**: Address performance degradations immediately
4. **Update thresholds**: Adjust based on SLAs and user expectations

## Troubleshooting

### High Error Rates
- Check application logs for exceptions
- Verify database connections
- Check network connectivity

### High Response Times
- Profile backend code for slow operations
- Check database query performance
- Review caching strategies
- Monitor CPU/memory usage

### Connection Timeouts
- Increase server timeout settings
- Check firewall rules
- Verify network bandwidth

### Inconsistent Results
- Run multiple times and average
- Check for background processes
- Ensure stable network connection

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/api-load-testing/)
- [k6 Cloud](https://k6.io/cloud/)
