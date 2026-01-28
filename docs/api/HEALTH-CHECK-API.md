# Health Check API Documentation

## Overview

The Health Check API provides endpoints for monitoring the health and readiness of the CCW-Online ERP backend service. These endpoints are designed for use by monitoring systems, load balancers, and container orchestration platforms (Kubernetes, Docker Swarm, etc.).

**Base URL**: `http://localhost:8000` (development) or your production domain

---

## Endpoints

### 1. Main Health Check

**Endpoint**: `GET /health`

**Description**: Comprehensive health check that verifies both API responsiveness and database connectivity.

**Response** (Success - 200 OK):
```json
{
  "api": "healthy",
  "database": "healthy",
  "timestamp": "2026-01-17T19:49:04.875595",
  "status": "healthy",
  "version": "1.0.0"
}
```

**Response** (Degraded - 200 OK):
```json
{
  "api": "healthy",
  "database": "unhealthy: connection refused",
  "timestamp": "2026-01-17T19:49:04.875595",
  "status": "degraded"
}
```

**Use Cases**:
- General health monitoring
- Load balancer health checks
- Monitoring dashboards
- Alerting systems

**Example Request**:
```bash
curl http://localhost:8000/health
```

---

### 2. Database Health Check

**Endpoint**: `GET /health/database`

**Description**: Database-specific health check that verifies the ability to connect to and query the PostgreSQL database.

**Response** (Success - 200 OK):
```json
{
  "status": "healthy",
  "message": "Database connection successful",
  "timestamp": "2026-01-17T19:49:12.934927"
}
```

**Response** (Failure - 503 Service Unavailable):
```json
{
  "detail": "Database connection failed: connection refused"
}
```

**Use Cases**:
- Database-specific monitoring
- Troubleshooting database connectivity issues
- Pre-deployment verification
- Database migration checks

**Example Request**:
```bash
curl http://localhost:8000/health/database
```

---

### 3. Routes Health Check

**Endpoint**: `GET /health/routes`

**Description**: Verifies that the API routing system is functioning correctly. This endpoint being reachable indicates that FastAPI routing is working.

**Response** (Success - 200 OK):
```json
{
  "status": "healthy",
  "message": "API routes are responding",
  "timestamp": "2026-01-17T19:49:14.626103"
}
```

**Use Cases**:
- Verify API routing configuration
- Troubleshoot routing issues
- Pre-deployment checks
- Integration testing

**Example Request**:
```bash
curl http://localhost:8000/health/routes
```

---

### 4. Readiness Check

**Endpoint**: `GET /ready`

**Description**: Kubernetes/container orchestration readiness probe. Checks all critical dependencies (currently: database) before marking the service as ready to receive traffic.

**Response** (Ready - 200 OK):
```json
{
  "status": "ready",
  "message": "All dependencies are ready",
  "timestamp": "2026-01-17T19:49:16.282620"
}
```

**Response** (Not Ready - 503 Service Unavailable):
```json
{
  "detail": "Database not ready: connection refused"
}
```

**Use Cases**:
- Kubernetes readiness probes
- Container orchestration health checks
- Load balancer readiness checks
- Deployment verification

**Example Request**:
```bash
curl http://localhost:8000/ready
```

---

## Kubernetes Configuration

### Liveness Probe

Use the main health check endpoint for liveness probes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe

Use the readiness endpoint for readiness probes:

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## Docker Compose Health Check

Add health checks to your `docker-compose.yml`:

```yaml
services:
  backend:
    image: ccw-erp-backend:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## Load Balancer Configuration

### AWS Application Load Balancer (ALB)

```
Health Check Path: /health
Health Check Interval: 30 seconds
Healthy Threshold: 2
Unhealthy Threshold: 3
Timeout: 5 seconds
Success Codes: 200
```

### NGINX Upstream Health Check

```nginx
upstream backend {
    server backend1:8000 max_fails=3 fail_timeout=30s;
    server backend2:8000 max_fails=3 fail_timeout=30s;
}

location /health {
    proxy_pass http://backend/health;
    proxy_connect_timeout 5s;
    proxy_read_timeout 5s;
}
```

---

## Monitoring Best Practices

### 1. Use Appropriate Endpoints

- **General monitoring**: Use `/health` for overall system health
- **Database-specific alerts**: Use `/health/database` for database issues
- **Deployment readiness**: Use `/ready` during deployments
- **Routing issues**: Use `/health/routes` for troubleshooting

### 2. Set Appropriate Timeouts

- Main health check: 5-10 seconds
- Database health check: 5 seconds
- Routes health check: 2-3 seconds
- Readiness check: 5 seconds

### 3. Configure Thresholds

- **Production**: 3 consecutive failures before marking unhealthy
- **Staging**: 2 consecutive failures
- **Development**: 1 failure (immediate notification)

### 4. Alert Escalation

```
Level 1 (Warning): 1 health check failure
Level 2 (Error): 3 consecutive failures
Level 3 (Critical): 5 consecutive failures or database unavailable
```

---

## Response Codes Summary

| Endpoint | Success | Failure |
|----------|---------|---------|
| `/health` | 200 (always returns 200, check status field) | N/A |
| `/health/database` | 200 | 503 |
| `/health/routes` | 200 | N/A |
| `/ready` | 200 | 503 |

---

## Testing Health Checks

### Manual Testing

```bash
# Test main health check
curl http://localhost:8000/health

# Test database health
curl http://localhost:8000/health/database

# Test routes health
curl http://localhost:8000/health/routes

# Test readiness
curl http://localhost:8000/ready

# Test all endpoints in sequence
for endpoint in health health/database health/routes ready; do
  echo "Testing /$endpoint:"
  curl -s http://localhost:8000/$endpoint | python -m json.tool
  echo ""
done
```

### Automated Testing with pytest

See `apps/backend/tests/smoke/test_smoke.py` for health check test examples:

```python
async def test_health_check(client: AsyncClient):
    """Test main health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "timestamp" in data
```

---

## Troubleshooting

### Health Check Returns "degraded"

**Symptom**: `/health` returns `status: "degraded"` with `database: "unhealthy"`

**Solutions**:
1. Check database connectivity: `docker compose ps postgres`
2. Verify database credentials in `.env`
3. Check database logs: `docker compose logs postgres`
4. Test database connection manually

### Health Check Timeout

**Symptom**: Health check request times out after 5-10 seconds

**Solutions**:
1. Check if backend is running: `docker compose ps backend`
2. Check backend logs: `docker compose logs backend`
3. Verify port 8000 is accessible
4. Check for high CPU/memory usage

### Readiness Check Fails

**Symptom**: `/ready` returns 503 Service Unavailable

**Solutions**:
1. Check database status (primary dependency)
2. Wait for application startup to complete
3. Check for initialization errors in backend logs
4. Verify all migrations have been applied

---

## Integration with Monitoring Tools

### Prometheus

```yaml
scrape_configs:
  - job_name: 'ccw-erp-backend'
    metrics_path: '/health'
    scrape_interval: 15s
    static_configs:
      - targets: ['backend:8000']
```

### Datadog

```yaml
init_config:

instances:
  - url: http://backend:8000/health
    name: ccw-erp-backend
    timeout: 5
```

### Nagios

```cfg
define service {
    use                     generic-service
    host_name               backend-server
    service_description     CCW ERP Health Check
    check_command           check_http!-p 8000 -u /health
    check_interval          5
}
```

---

## Changelog

### Version 1.0.0 (2026-01-17)

- ✅ Added comprehensive `/health` endpoint with database checks
- ✅ Added dedicated `/health/database` endpoint
- ✅ Added `/health/routes` endpoint for routing verification
- ✅ Enhanced `/ready` endpoint with dependency checks
- ✅ Added proper error handling and status codes
- ✅ Documented all endpoints with examples

---

## Support

For issues or questions:
- Check backend logs: `docker compose logs backend`
- Review API docs: `http://localhost:8000/docs`
- Report issues: GitHub Issues
