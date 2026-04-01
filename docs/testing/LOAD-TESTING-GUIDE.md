# Load Testing Guide for CCW Online ERP

## Overview

This guide covers load testing for the CCW Online ERP system, with a focus on the newly implemented AI features (semantic search, recommendations, AP2 integration, and autonomous development).

## Tools

### Locust

Locust is used for HTTP load testing with real user simulation.

**Install**:
```bash
pip install locust
```

## Running Load Tests

### 1. Basic Load Test (All AI Features)

Tests all AI features with realistic user behavior:

```bash
cd apps/backend/tests/load
locust -f locustfile_ai_features.py --host=http://localhost:8000
```

Then open http://localhost:8089 in your browser to configure:
- **Number of users**: Start with 10, ramp up to 1000
- **Spawn rate**: 10 users/second
- **Host**: http://localhost:8000

Click "Start Swarming" to begin the test.

### 2. Focused Load Tests

Test specific features in isolation:

#### Search Only
```bash
locust -f locustfile_ai_features.py SearchOnlyUser --host=http://localhost:8000
```

#### Recommendations Only
```bash
locust -f locustfile_ai_features.py RecommendationOnlyUser --host=http://localhost:8000
```

#### AP2 Only
```bash
locust -f locustfile_ai_features.py AP2OnlyUser --host=http://localhost:8000
```

### 3. Headless Mode (CI/CD)

Run tests without the web UI:

```bash
locust -f locustfile_ai_features.py \
    --host=http://localhost:8000 \
    --users 1000 \
    --spawn-rate 10 \
    --run-time 10m \
    --headless \
    --html=load_test_report.html
```

This will:
- Spawn 1000 users at 10 users/second
- Run for 10 minutes
- Generate an HTML report

## Performance Targets

### Critical Endpoints

| Endpoint | Target (p95) | Acceptable (p95) |
|----------|--------------|------------------|
| Semantic Search | <500ms | <1000ms |
| Hybrid Search | <500ms | <1000ms |
| Similar Products | <200ms | <500ms |
| Frequently Bought Together | <200ms | <500ms |
| Personalized Recommendations | <200ms | <500ms |
| AP2 Intent Mandate | <1000ms | <2000ms |
| AP2 Voice Session | <1000ms | <2000ms |

### Success Criteria

1. **Response Times**: 95% of requests meet target response times
2. **Error Rate**: <1% error rate under normal load (100-500 users)
3. **Throughput**: Handle 1000 concurrent users with <5% error rate
4. **Stability**: No memory leaks or performance degradation over 1-hour test

## Test Scenarios

### AIFeatureUser (Default)

Simulates a typical user with mixed usage:
- 40% Search operations
- 30% Recommendation views
- 20% AP2 interactions
- 10% Autonomous dev monitoring

**Wait time**: 1-5 seconds between requests

### SearchOnlyUser

Simulates heavy search usage:
- 60% Semantic search
- 40% Hybrid search

**Wait time**: 0.5-2 seconds (more aggressive)

### RecommendationOnlyUser

Simulates recommendation browsing:
- 50% Similar products
- 30% Frequently bought together
- 20% Personalized recommendations

**Wait time**: 0.5-2 seconds

### AP2OnlyUser

Simulates AP2 payment and voice commerce:
- 60% Intent mandate creation
- 30% Voice session creation
- 10% Connection status checks

**Wait time**: 1-3 seconds

## Interpreting Results

### Locust Web UI

The Locust web UI (http://localhost:8089) shows:

1. **Statistics Tab**:
   - Request count
   - Failure rate
   - Average/min/max response times
   - Requests per second
   - Percentiles (50th, 66th, 75th, 80th, 90th, 95th, 98th, 99th, 100th)

2. **Charts Tab**:
   - Total Requests per Second
   - Response Times (percentiles over time)
   - Number of Users

3. **Failures Tab**:
   - Error messages
   - Frequency of each error

4. **Exceptions Tab**:
   - Python exceptions that occurred

### Key Metrics to Watch

1. **Response Time (p95)**: Should stay below targets even as user count increases
2. **Requests per Second**: Should scale linearly with user count
3. **Failure Rate**: Should remain <1% under normal load
4. **Response Time Stability**: Should not degrade significantly over time

### Common Issues

#### High Response Times

**Symptoms**: p95 response times exceed targets

**Possible Causes**:
- Database query performance (missing indexes)
- Insufficient connection pool size
- CPU/memory bottleneck
- Network latency
- External API slowness (OpenAI embeddings)

**Solutions**:
- Review slow query logs
- Add database indexes
- Increase connection pool size
- Profile code for bottlenecks
- Cache frequently accessed data

#### High Error Rate

**Symptoms**: >1% of requests fail

**Possible Causes**:
- Connection pool exhaustion
- Database deadlocks
- Memory exhaustion
- Timeout errors
- Validation errors with test data

**Solutions**:
- Check error messages in Failures tab
- Review application logs
- Increase timeouts if appropriate
- Fix data validation issues
- Increase resource limits

#### Memory Leaks

**Symptoms**: Performance degrades over time, eventually crashes

**Possible Causes**:
- Unclosed database connections
- Unclosed HTTP sessions
- Growing cache without eviction
- Circular references

**Solutions**:
- Monitor memory usage over time
- Use memory profiler (memory-profiler)
- Review connection management code
- Implement cache eviction policies

## Load Testing Best Practices

### 1. Start Small

Begin with 10-50 users and gradually increase:
```bash
# Start
Users: 10, Spawn rate: 1

# After 5 minutes
Users: 50, Spawn rate: 5

# After 10 minutes
Users: 100, Spawn rate: 10

# Continue scaling
Users: 500, Spawn rate: 10
Users: 1000, Spawn rate: 10
```

### 2. Monitor System Resources

While load testing, monitor:
- CPU usage (should stay <80%)
- Memory usage (should be stable, no growth)
- Database connections (should not max out)
- Network bandwidth
- Disk I/O

**Tools**:
```bash
# CPU and memory
htop

# Database connections (PostgreSQL)
SELECT count(*) FROM pg_stat_activity;

# Network
iftop

# Docker stats
docker stats
```

### 3. Use Realistic Data

The load test uses realistic:
- Search queries (construction equipment terms)
- Multiple languages (en, zh-CN, es, pt, ar)
- Product IDs from seed data
- Customer IDs from seed data

### 4. Test Different Scenarios

Run separate tests for:
- Normal usage (100-500 users)
- Peak load (1000+ users)
- Sustained load (1-hour test)
- Spike test (sudden jump from 100 to 1000 users)

### 5. Automate in CI/CD

Add to your CI pipeline:
```yaml
# Example GitHub Actions
- name: Load Test
  run: |
    docker-compose up -d
    sleep 30  # Wait for services to start
    locust -f tests/load/locustfile_ai_features.py \
      --host=http://localhost:8000 \
      --users 100 \
      --spawn-rate 10 \
      --run-time 5m \
      --headless \
      --html=load_test_report.html

    # Upload report as artifact

    # Fail if error rate > 5%
```

## Troubleshooting

### "Connection refused" errors

**Problem**: Cannot connect to backend

**Solution**: Ensure backend is running on http://localhost:8000

```bash
cd apps/backend
uv run uvicorn src.api.main:app --reload
```

### "Rate limit exceeded" errors

**Problem**: Too many requests hitting rate limiter

**Solution**:
- Reduce spawn rate
- Increase rate limits for testing
- Add `X-Test-Mode` header to bypass rate limits in test environment

### "Database connection pool exhausted"

**Problem**: All database connections in use

**Solution**: Increase connection pool size in `database.py`:

```python
engine = create_async_engine(
    settings.database_url,
    pool_size=50,  # Increase from default
    max_overflow=100,  # Increase from default
)
```

### "OpenAI API rate limit"

**Problem**: Hitting OpenAI API rate limits during search

**Solution**:
- Use cached embeddings (precomputed)
- Request rate limit increase from OpenAI
- Use demo mode for load testing (mocked responses)

## Performance Optimization Tips

### 1. Database Indexes

Ensure critical indexes exist:

```sql
-- Product embeddings vector search
CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector
ON product_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Customer interactions
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer
ON customer_product_interactions(customer_id, created_at DESC);

-- Search queries
CREATE INDEX IF NOT EXISTS idx_search_queries_created
ON search_queries(created_at DESC);
```

### 2. Caching Strategy

Implement Redis caching for:
- Search results (60s TTL)
- Product recommendations (300s TTL)
- Product embeddings (3600s TTL)

```python
# Example caching
@cache(ttl=60)
async def semantic_search(...):
    # ...
```

### 3. Connection Pooling

Configure appropriate pool sizes:

```python
# Database
pool_size = 50  # Concurrent connections
max_overflow = 100  # Additional connections during peak

# HTTP (for OpenAI, Ollama)
connector = aiohttp.TCPConnector(limit=100)
```

### 4. Async All the Way

Ensure all I/O operations are async:
- Database queries (SQLAlchemy async)
- HTTP requests (httpx/aiohttp)
- Redis operations (aioredis)
- OpenAI API calls (async client)

### 5. Query Optimization

Use EXPLAIN ANALYZE to find slow queries:

```sql
EXPLAIN ANALYZE
SELECT p.*, pe.embedding <=> $1 as distance
FROM products p
JOIN product_embeddings pe ON p.id = pe.product_id
WHERE pe.language_code = 'en'
ORDER BY distance
LIMIT 20;
```

## Advanced Testing

### Stress Testing

Find breaking point:

```bash
locust -f locustfile_ai_features.py \
    --host=http://localhost:8000 \
    --users 5000 \
    --spawn-rate 100 \
    --run-time 30m \
    --headless
```

### Spike Testing

Test sudden traffic increase:

```bash
# Start with 100 users, manually increase to 1000 in web UI
# Observe recovery time and error rate
```

### Endurance Testing

Test stability over extended period:

```bash
locust -f locustfile_ai_features.py \
    --host=http://localhost:8000 \
    --users 500 \
    --spawn-rate 10 \
    --run-time 4h \
    --headless \
    --html=endurance_report.html
```

Monitor for:
- Memory leaks (memory should remain stable)
- Performance degradation (response times should not increase)
- Error accumulation (error rate should remain constant)

## Resources

- [Locust Documentation](https://docs.locust.io/)
- [Load Testing Best Practices](https://www.nginx.com/blog/load-testing-best-practices/)
- [Database Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

## Next Steps

After load testing:
1. Review HTML report
2. Identify bottlenecks
3. Optimize code/queries
4. Re-test to verify improvements
5. Document performance baselines
6. Set up monitoring alerts based on results
