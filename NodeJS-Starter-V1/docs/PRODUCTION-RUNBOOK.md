# Production Operations Runbook

Complete operational guide for managing CCW-Online ERP in production.

**Target Audience:** DevOps Engineers, SREs, Operations Team
**Last Updated:** January 14, 2026
**Version:** 1.0

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Common Operations](#common-operations)
3. [Monitoring & Alerts](#monitoring--alerts)
4. [Incident Response](#incident-response)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Emergency Procedures](#emergency-procedures)
8. [Escalation](#escalation)

---

## System Overview

### Architecture

```
                   [Users]
                      │
                      ▼
              [Load Balancer]
                      │
                      ▼
           [Nginx Ingress Controller]
                   /     \
                  /       \
                 ▼         ▼
          [Frontend]   [Backend API]
           (2-10 pods)  (2-10 pods)
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
          [PostgreSQL]  [Redis]   [Celery Workers]
           (StatefulSet) (1 pod)   (2-8 pods)
```

### Key Components

| Component | Type | Replicas | Auto-Scaling |
|-----------|------|----------|--------------|
| Frontend | Deployment | 2-10 | Yes (HPA) |
| Backend API | Deployment | 2-10 | Yes (HPA) |
| Celery Worker | Deployment | 2-8 | Yes (HPA) |
| Celery Beat | Deployment | 1 | No |
| PostgreSQL | StatefulSet | 1 | No |
| Redis | Deployment | 1 | No |
| Prometheus | Deployment | 1 | Optional |
| Grafana | Deployment | 1 | Optional |

### Resource URLs

- **Frontend:** https://your-domain.com
- **API:** https://api.your-domain.com
- **Grafana:** https://grafana.your-domain.com
- **Prometheus:** https://prometheus.your-domain.com

### Data Storage

- **PostgreSQL Data:** `/var/lib/postgresql/data` (PVC: 10Gi)
- **Redis Data:** `/data` (PVC: 5Gi)

---

## Common Operations

### Viewing Logs

**Backend Logs:**
```bash
# All backend pods
kubectl logs -l component=backend -n ccw-erp --tail=100 -f

# Specific pod
kubectl logs backend-7b5d8f9c-abc12 -n ccw-erp --tail=100 -f

# Previous pod instance (after crash)
kubectl logs backend-7b5d8f9c-abc12 -n ccw-erp --previous
```

**Frontend Logs:**
```bash
kubectl logs -l component=frontend -n ccw-erp --tail=100 -f
```

**Celery Worker Logs:**
```bash
# All workers
kubectl logs -l component=celery-worker -n ccw-erp --tail=100 -f

# Celery Beat (scheduler)
kubectl logs -l component=celery-beat -n ccw-erp --tail=100 -f
```

**Database Logs:**
```bash
kubectl logs postgres-0 -n ccw-erp --tail=100 -f
```

**Filtering Logs:**
```bash
# Errors only
kubectl logs -l component=backend -n ccw-erp | grep ERROR

# Specific time range (requires timestamp in logs)
kubectl logs -l component=backend -n ccw-erp --since=1h

# Export to file
kubectl logs -l component=backend -n ccw-erp --since=24h > backend-logs-$(date +%Y%m%d).log
```

### Checking Pod Status

**All Pods:**
```bash
kubectl get pods -n ccw-erp
```

**Detailed Pod Information:**
```bash
kubectl describe pod backend-7b5d8f9c-abc12 -n ccw-erp
```

**Pod Events:**
```bash
kubectl get events -n ccw-erp --sort-by='.lastTimestamp'
```

**Resource Usage:**
```bash
# Current usage
kubectl top pods -n ccw-erp

# Sorted by memory
kubectl top pods -n ccw-erp --sort-by=memory

# Sorted by CPU
kubectl top pods -n ccw-erp --sort-by=cpu
```

### Scaling Manually

**Scale Backend:**
```bash
# Scale up
kubectl scale deployment/backend --replicas=5 -n ccw-erp

# Scale down
kubectl scale deployment/backend --replicas=2 -n ccw-erp

# Verify
kubectl get deployment/backend -n ccw-erp
```

**Disable HPA Temporarily:**
```bash
# Delete HPA (temporarily)
kubectl delete hpa backend-hpa -n ccw-erp

# Manual scaling will work now
kubectl scale deployment/backend --replicas=10 -n ccw-erp

# Re-enable HPA
kubectl apply -f k8s/hpa.yaml
```

### Restarting Services

**Rolling Restart (Zero Downtime):**
```bash
# Backend
kubectl rollout restart deployment/backend -n ccw-erp

# Frontend
kubectl rollout restart deployment/frontend -n ccw-erp

# Celery workers
kubectl rollout restart deployment/celery-worker -n ccw-erp
```

**Force Delete Pod (if stuck):**
```bash
kubectl delete pod backend-7b5d8f9c-abc12 -n ccw-erp --force --grace-period=0
```

### Updating Configuration

**Update ConfigMap:**
```bash
# Edit directly
kubectl edit configmap ccw-erp-config -n ccw-erp

# Or apply from file
kubectl apply -f k8s/configmap.yaml

# Restart pods to pick up changes
kubectl rollout restart deployment/backend -n ccw-erp
kubectl rollout restart deployment/frontend -n ccw-erp
```

**Update Secrets:**
```bash
# Edit directly (base64 encoded)
kubectl edit secret ccw-erp-secrets -n ccw-erp

# Or recreate
kubectl delete secret ccw-erp-secrets -n ccw-erp
kubectl apply -f k8s/secret.yaml

# Restart pods
kubectl rollout restart deployment/backend -n ccw-erp
```

### Deploying Updates

**Deploy New Version:**
```bash
# Update image tag in deployment
kubectl set image deployment/backend backend=your-registry/backend:v1.1.0 -n ccw-erp

# Or apply updated manifest
kubectl apply -f k8s/backend-deployment.yaml

# Watch rollout progress
kubectl rollout status deployment/backend -n ccw-erp

# Check rollout history
kubectl rollout history deployment/backend -n ccw-erp
```

**Rollback Deployment:**
```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n ccw-erp

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=3 -n ccw-erp

# Verify
kubectl rollout status deployment/backend -n ccw-erp
```

### Database Operations

**Access Database:**
```bash
# Connect to PostgreSQL
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres ccw_erp

# Run single query
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres -d ccw_erp -c "SELECT COUNT(*) FROM orders;"
```

**Database Backup:**
```bash
# Create backup
kubectl exec postgres-0 -n ccw-erp -- pg_dump -U postgres ccw_erp > backup-$(date +%Y%m%d-%H%M%S).sql

# Create compressed backup
kubectl exec postgres-0 -n ccw-erp -- pg_dump -U postgres ccw_erp | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup to pod and copy out
kubectl exec postgres-0 -n ccw-erp -- pg_dump -U postgres ccw_erp -f /tmp/backup.sql
kubectl cp ccw-erp/postgres-0:/tmp/backup.sql ./backup-$(date +%Y%m%d).sql
```

**Database Restore:**
```bash
# Restore from backup (DANGEROUS - will overwrite data)
kubectl cp ./backup.sql ccw-erp/postgres-0:/tmp/backup.sql
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres ccw_erp < /tmp/backup.sql

# Or in one command
kubectl exec -i postgres-0 -n ccw-erp -- psql -U postgres ccw_erp < backup.sql
```

**Run Database Migrations:**
```bash
# One-time migration job
kubectl apply -f k8s/jobs/migration-job.yaml

# Watch progress
kubectl logs -f job/migration-job -n ccw-erp

# Check completion
kubectl get jobs -n ccw-erp
```

### Redis Operations

**Access Redis:**
```bash
# Connect to Redis CLI
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli

# Run single command
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli PING
```

**Redis Commands:**
```bash
# Inside Redis CLI:
INFO                  # Server info
DBSIZE                # Number of keys
KEYS pattern          # List keys (use with caution in production)
GET key               # Get value
DEL key               # Delete key
FLUSHALL              # Clear all data (DANGEROUS)

# Monitor commands in real-time
MONITOR               # See all commands (high overhead)
```

**Clear Celery Queue:**
```bash
# Clear all tasks
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli FLUSHDB

# Then restart Celery workers
kubectl rollout restart deployment/celery-worker -n ccw-erp
kubectl rollout restart deployment/celery-beat -n ccw-erp
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

**Application Metrics:**
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (percentage)
- Active WebSocket connections
- Celery queue length

**Infrastructure Metrics:**
- CPU usage (by pod)
- Memory usage (by pod)
- Pod count (current vs desired)
- Pod restart count
- Network I/O

**Business Metrics:**
- Orders per hour
- Revenue per day
- Customer satisfaction score
- Inventory turnover
- Agent decision rate

### Accessing Monitoring

**Grafana Dashboards:**
```
URL: https://grafana.your-domain.com
Credentials: (stored in password manager)

Dashboards:
1. Application Performance
2. Infrastructure Health
3. Business Metrics
4. AI Agent Performance
```

**Prometheus Queries:**
```
URL: https://prometheus.your-domain.com

Useful queries:
- Request rate: rate(http_requests_total[5m])
- Error rate: rate(http_requests_total{status=~"5.."}[5m])
- Pod count: kube_deployment_status_replicas{deployment="backend"}
- Memory usage: container_memory_usage_bytes{pod=~"backend.*"}
```

### Alert Response

When an alert fires, follow this process:

1. **Acknowledge Alert** - Confirm you've received it
2. **Check Severity** - Critical, Warning, or Info
3. **Review Grafana** - Check relevant dashboards
4. **Check Logs** - Look for errors or anomalies
5. **Take Action** - Follow troubleshooting procedures below
6. **Document** - Record incident details
7. **Follow Up** - Post-mortem if needed

---

## Incident Response

### Severity Levels

**P0 - Critical (Response Time: Immediate)**
- Complete service outage
- Data loss occurring
- Security breach

**P1 - High (Response Time: 15 minutes)**
- Partial service outage
- Major feature unavailable
- Significant performance degradation

**P2 - Medium (Response Time: 1 hour)**
- Minor feature issues
- Moderate performance issues
- Non-critical errors

**P3 - Low (Response Time: 1 business day)**
- Cosmetic issues
- Enhancement requests
- Documentation errors

### Incident Response Workflow

```
Alert Fires → Acknowledge → Assess → Respond → Resolve → Document
```

**1. Acknowledge:**
- Acknowledge alert in monitoring system
- Post in team Slack channel: "Investigating P1 incident: High error rate"

**2. Assess:**
- Check Grafana dashboards
- Review recent deployments/changes
- Check pod status and logs
- Determine impact and scope

**3. Respond:**
- Take immediate action (restart, scale, rollback)
- Update team on progress
- Escalate if needed

**4. Resolve:**
- Verify issue is resolved
- Monitor for 15-30 minutes
- Mark alert as resolved

**5. Document:**
- Create incident report
- Document root cause
- Note action items for prevention

---

## Troubleshooting

### Issue: High Error Rate

**Symptoms:**
- Error rate > 5%
- Many 500 errors in logs
- Users reporting errors

**Diagnosis:**
```bash
# Check backend logs for errors
kubectl logs -l component=backend -n ccw-erp --tail=200 | grep ERROR

# Check recent deployments
kubectl rollout history deployment/backend -n ccw-erp

# Check database connectivity
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres -c "SELECT 1"

# Check Redis connectivity
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli PING
```

**Solutions:**

**1. Database Connection Issues:**
```bash
# Check connection pool
kubectl logs -l component=backend -n ccw-erp | grep "connection pool"

# Restart backend to reset connections
kubectl rollout restart deployment/backend -n ccw-erp
```

**2. Recent Bad Deployment:**
```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n ccw-erp

# Monitor error rate
# Watch Grafana dashboard for 5-10 minutes
```

**3. External API Failures:**
```bash
# Check logs for external API errors
kubectl logs -l component=backend -n ccw-erp | grep -i "xero\|shopify\|sendgrid"

# If external API is down, consider:
# - Disabling non-critical integrations temporarily
# - Implementing circuit breaker (if not already)
```

### Issue: High Response Time

**Symptoms:**
- p95 latency > 2s
- Users reporting slow performance
- Grafana shows high response times

**Diagnosis:**
```bash
# Check CPU usage
kubectl top pods -n ccw-erp --sort-by=cpu

# Check memory usage
kubectl top pods -n ccw-erp --sort-by=memory

# Check HPA status
kubectl get hpa -n ccw-erp

# Check database slow queries
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres -d ccw_erp -c "
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

**Solutions:**

**1. Need More Resources:**
```bash
# Scale up manually
kubectl scale deployment/backend --replicas=10 -n ccw-erp

# Check if HPA is at max
kubectl get hpa backend-hpa -n ccw-erp

# If at max, temporarily increase max replicas
kubectl patch hpa backend-hpa -n ccw-erp --patch '{"spec":{"maxReplicas":15}}'
```

**2. Database Bottleneck:**
```bash
# Add read replicas (if configured)
# Optimize slow queries (post-incident)
# Increase connection pool size (restart required)

# Temporary: Scale up PostgreSQL resources
kubectl edit statefulset postgres -n ccw-erp
# Increase CPU/memory limits
```

**3. Redis Issues:**
```bash
# Check Redis memory
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli INFO memory

# If memory full, clear unnecessary keys
# Or increase Redis memory limit
kubectl edit deployment redis -n ccw-erp
```

### Issue: Pods Crashing

**Symptoms:**
- Pods in CrashLoopBackOff state
- High restart count
- Service intermittently unavailable

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n ccw-erp

# Get crash details
kubectl describe pod backend-7b5d8f9c-abc12 -n ccw-erp

# Check logs from crashed pod
kubectl logs backend-7b5d8f9c-abc12 -n ccw-erp --previous

# Check events
kubectl get events -n ccw-erp --sort-by='.lastTimestamp' | grep backend
```

**Solutions:**

**1. Out of Memory (OOMKilled):**
```bash
# Increase memory limit
kubectl edit deployment backend -n ccw-erp
# Update: spec.template.spec.containers[0].resources.limits.memory

# Or patch directly
kubectl patch deployment backend -n ccw-erp --patch '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "limits": {
              "memory": "4Gi"
            }
          }
        }]
      }
    }
  }
}'
```

**2. Application Error on Startup:**
```bash
# Check logs for startup errors
kubectl logs backend-7b5d8f9c-abc12 -n ccw-erp --previous | head -50

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Invalid configuration

# Verify configuration
kubectl get configmap ccw-erp-config -n ccw-erp -o yaml
kubectl get secret ccw-erp-secrets -n ccw-erp -o jsonpath='{.data}' | base64 -d
```

**3. Failed Health Checks:**
```bash
# Check probe configuration
kubectl get deployment backend -n ccw-erp -o yaml | grep -A 10 "livenessProbe\|readinessProbe"

# If probes too aggressive, adjust:
kubectl edit deployment backend -n ccw-erp
# Increase: initialDelaySeconds, periodSeconds, timeoutSeconds
```

### Issue: HPA Not Scaling

**Symptoms:**
- Load increasing but pods not scaling
- HPA showing "unknown" for metrics
- Pods at 100% CPU but no scale-up

**Diagnosis:**
```bash
# Check HPA status
kubectl get hpa -n ccw-erp

# Describe HPA
kubectl describe hpa backend-hpa -n ccw-erp

# Check metrics server
kubectl get deployment metrics-server -n kube-system

# Check if metrics available
kubectl top pods -n ccw-erp
```

**Solutions:**

**1. Metrics Server Not Running:**
```bash
# Check metrics server
kubectl get pods -n kube-system | grep metrics-server

# If not running, install
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

**2. HPA Thresholds Not Met:**
```bash
# Check current metrics vs targets
kubectl get hpa backend-hpa -n ccw-erp

# If close to threshold but not scaling, lower threshold
kubectl patch hpa backend-hpa -n ccw-erp --patch '
{
  "spec": {
    "metrics": [{
      "type": "Resource",
      "resource": {
        "name": "cpu",
        "target": {
          "type": "Utilization",
          "averageUtilization": 60
        }
      }
    }]
  }
}'
```

**3. HPA at Maximum Replicas:**
```bash
# Increase max replicas temporarily
kubectl patch hpa backend-hpa -n ccw-erp --patch '{"spec":{"maxReplicas":20}}'
```

### Issue: Database Connection Pool Exhausted

**Symptoms:**
- "Connection pool exhausted" errors
- "Too many connections" errors
- Timeouts on database operations

**Diagnosis:**
```bash
# Check current connections
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres -c "
SELECT count(*) as active_connections,
       max_conn,
       max_conn - count(*) as remaining_connections
FROM pg_stat_activity,
     (SELECT setting::int as max_conn FROM pg_settings WHERE name='max_connections') mc
GROUP BY max_conn;
"

# Check connections by application
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres -c "
SELECT application_name, count(*)
FROM pg_stat_activity
GROUP BY application_name
ORDER BY count(*) DESC;
"
```

**Solutions:**

**1. Increase Connection Pool:**
```bash
# Update backend configuration
kubectl edit configmap ccw-erp-config -n ccw-erp
# Increase: DATABASE_POOL_SIZE

# Restart backend
kubectl rollout restart deployment/backend -n ccw-erp
```

**2. Fix Connection Leaks:**
```bash
# Restart backend to close stale connections
kubectl rollout restart deployment/backend -n ccw-erp

# Monitor for leaks (post-incident)
# Check application code for proper connection handling
```

**3. Increase PostgreSQL max_connections:**
```bash
# Access PostgreSQL config
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres -c "
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();
"

# Or edit postgresql.conf and restart
```

### Issue: Celery Queue Backing Up

**Symptoms:**
- Celery queue length > 1000
- Tasks taking long time to process
- Users reporting delayed actions

**Diagnosis:**
```bash
# Check queue length
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli LLEN celery

# Check worker status
kubectl logs -l component=celery-worker -n ccw-erp --tail=50

# Check number of workers
kubectl get pods -l component=celery-worker -n ccw-erp
```

**Solutions:**

**1. Scale Up Workers:**
```bash
# Manual scale
kubectl scale deployment/celery-worker --replicas=8 -n ccw-erp

# Or increase HPA max
kubectl patch hpa celery-worker-hpa -n ccw-erp --patch '{"spec":{"maxReplicas":12}}'
```

**2. Clear Old Tasks:**
```bash
# Only if tasks are stuck/invalid
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli DEL celery

# Restart Celery workers
kubectl rollout restart deployment/celery-worker -n ccw-erp
```

**3. Identify Slow Tasks:**
```bash
# Check logs for slow tasks
kubectl logs -l component=celery-worker -n ccw-erp | grep "Task.*succeeded in"

# Optimize slow tasks (post-incident)
```

---

## Maintenance Procedures

### Scheduled Maintenance Window

**Best practices:**
- Schedule during low-traffic hours (2-4 AM)
- Notify users 24-48 hours in advance
- Plan for 2-4 hour window
- Have rollback plan ready

**Maintenance Checklist:**
```bash
# 1. Pre-maintenance
- [ ] Announce maintenance window
- [ ] Create database backup
- [ ] Export current Kubernetes state
- [ ] Scale down non-critical services
- [ ] Disable alerts (temporarily)

# 2. During maintenance
- [ ] Perform updates
- [ ] Run database migrations
- [ ] Verify each change
- [ ] Monitor logs

# 3. Post-maintenance
- [ ] Verify all services running
- [ ] Run smoke tests
- [ ] Re-enable alerts
- [ ] Monitor for 30 minutes
- [ ] Announce completion
```

### Kubernetes Cluster Upgrade

```bash
# 1. Check current version
kubectl version --short

# 2. Drain nodes one by one
kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data

# 3. Upgrade node (cloud provider specific)
# GKE: gcloud container clusters upgrade ...
# EKS: aws eks update-cluster-version ...
# AKS: az aks upgrade ...

# 4. Uncordon node
kubectl uncordon node-1

# 5. Repeat for each node

# 6. Verify
kubectl get nodes
kubectl get pods -n ccw-erp
```

### Certificate Renewal

Certificates are auto-renewed by cert-manager, but if manual renewal needed:

```bash
# Check certificate expiry
kubectl get certificate -n ccw-erp

# Force renewal
kubectl delete secret ccw-erp-tls-cert -n ccw-erp
# cert-manager will recreate automatically

# Verify new certificate
kubectl get certificate -n ccw-erp
kubectl describe certificate ccw-erp-tls-cert -n ccw-erp
```

---

## Emergency Procedures

### Complete Service Outage

**Immediate Actions:**
1. Post in incident channel: "P0: Complete outage"
2. Check cluster status: `kubectl cluster-info`
3. Check all pods: `kubectl get pods -n ccw-erp`
4. Check Ingress: `kubectl get ingress -n ccw-erp`
5. Check external dependencies (DNS, LoadBalancer)

**Recovery Steps:**
```bash
# 1. Verify cluster access
kubectl cluster-info

# 2. Check pod status
kubectl get pods -n ccw-erp

# 3. Check for crashloops
kubectl get pods -n ccw-erp | grep -E "CrashLoop|Error|ImagePullBackOff"

# 4. Restart all services
kubectl rollout restart deployment/backend -n ccw-erp
kubectl rollout restart deployment/frontend -n ccw-erp
kubectl rollout restart deployment/celery-worker -n ccw-erp

# 5. Check Ingress
kubectl get ingress -n ccw-erp
kubectl describe ingress ccw-erp-ingress -n ccw-erp

# 6. Test endpoints
curl https://api.your-domain.com/health
curl https://your-domain.com
```

### Data Loss Incident

**DO NOT PANIC. Follow these steps carefully:**

1. **Stop all writes immediately**
```bash
# Scale backend to 0 (stops new writes)
kubectl scale deployment/backend --replicas=0 -n ccw-erp

# Put up maintenance page (if configured)
```

2. **Assess damage**
```bash
# Connect to database
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres ccw_erp

# Check data integrity
# Run queries to verify what data is missing/corrupted
```

3. **Restore from backup**
```bash
# Get latest backup
ls -lh backup-*.sql

# Restore (this will overwrite current data)
kubectl exec -i postgres-0 -n ccw-erp -- psql -U postgres ccw_erp < backup-YYYYMMDD-HHMMSS.sql
```

4. **Verify restoration**
```bash
# Verify data
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres ccw_erp
# Run validation queries
```

5. **Resume operations**
```bash
# Scale backend back up
kubectl scale deployment/backend --replicas=2 -n ccw-erp

# Monitor closely
kubectl logs -l component=backend -n ccw-erp -f
```

### Security Incident

**If suspicious activity detected:**

1. **Isolate affected systems**
```bash
# Scale down affected services
kubectl scale deployment/backend --replicas=0 -n ccw-erp

# Block network access (NetworkPolicy)
# Contact security team immediately
```

2. **Preserve evidence**
```bash
# Export all logs
kubectl logs -l component=backend -n ccw-erp --since=24h > security-incident-logs-$(date +%Y%m%d).log

# Export pod details
kubectl describe pods -n ccw-erp > security-incident-pods-$(date +%Y%m%d).txt

# Do NOT delete anything until security team reviews
```

3. **Follow security incident response plan**
- Contact security team
- Notify management
- Follow company security policies

---

## Escalation

### Escalation Matrix

| Severity | First Response | Escalate After | Escalate To |
|----------|---------------|----------------|-------------|
| P0 - Critical | Immediate | 15 minutes | On-call Manager |
| P1 - High | 15 minutes | 1 hour | Team Lead |
| P2 - Medium | 1 hour | 4 hours | Team Lead |
| P3 - Low | 1 business day | 2 business days | Team Lead |

### Contact Information

| Role | Name | Phone | Email | Availability |
|------|------|-------|-------|--------------|
| DevOps Lead | | | | 24/7 |
| Database Admin | | | | Business hours |
| Security Team | | | | 24/7 |
| CTO | | | | Emergency only |

### When to Escalate

Escalate immediately if:
- Unable to resolve within time limit
- Data loss or corruption suspected
- Security breach suspected
- Complete service outage > 15 minutes
- Impact to large number of users
- Unsure how to proceed

---

## Post-Incident Review

After resolving a P0 or P1 incident:

1. **Schedule post-mortem** - Within 48 hours
2. **Document timeline** - What happened when
3. **Identify root cause** - Why did it happen
4. **Action items** - How to prevent recurrence
5. **Share learnings** - Update runbook and team

**Post-Mortem Template:**
```
# Incident: [Brief description]
Date: [Date]
Duration: [Start time - End time]
Severity: [P0/P1/P2/P3]

## Timeline
- HH:MM - Alert fired
- HH:MM - Acknowledged
- HH:MM - Root cause identified
- HH:MM - Fix applied
- HH:MM - Resolved

## Root Cause
[What caused the incident]

## Resolution
[What was done to resolve it]

## Prevention
[Action items to prevent recurrence]

1. [ ] Update monitoring
2. [ ] Update runbook
3. [ ] Code fixes
4. [ ] Process improvements
```

---

## Appendix

### Useful Commands Cheat Sheet

```bash
# Quick status check
kubectl get all -n ccw-erp

# Resource usage
kubectl top pods -n ccw-erp

# Recent events
kubectl get events -n ccw-erp --sort-by='.lastTimestamp' | tail -20

# Pod logs
kubectl logs -l component=backend -n ccw-erp --tail=100 -f

# Describe pod
kubectl describe pod <pod-name> -n ccw-erp

# Execute command in pod
kubectl exec -it <pod-name> -n ccw-erp -- /bin/bash

# Port forward
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp

# Scale deployment
kubectl scale deployment/backend --replicas=5 -n ccw-erp

# Restart deployment
kubectl rollout restart deployment/backend -n ccw-erp

# Rollback deployment
kubectl rollout undo deployment/backend -n ccw-erp

# Update image
kubectl set image deployment/backend backend=your-registry/backend:v1.1.0 -n ccw-erp

# Database access
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres ccw_erp

# Redis access
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli
```

---

*Last Updated: January 14, 2026*
*Version: 1.0*
*Next Review: February 14, 2026*
