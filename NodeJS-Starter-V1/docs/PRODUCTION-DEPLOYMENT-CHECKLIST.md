# Production Deployment Checklist

Complete pre-deployment checklist for deploying CCW-Online ERP to production Kubernetes.

**Target Date:** _____________
**Deployment Lead:** _____________
**Backup Contact:** _____________

---

## Pre-Deployment (1-2 Weeks Before)

### Infrastructure Setup

- [ ] **Kubernetes Cluster Provisioned**
  - [ ] Cluster version: 1.28+ confirmed
  - [ ] Node pool configured (min 3 nodes recommended)
  - [ ] Node resources: 4 CPU, 16GB RAM minimum per node
  - [ ] Auto-scaling enabled on node pool
  - [ ] Cluster access configured (kubectl context)

- [ ] **Storage Configuration**
  - [ ] StorageClass configured for dynamic provisioning
  - [ ] Persistent volume support confirmed (minimum 30GB)
  - [ ] Backup solution configured for volumes

- [ ] **Networking**
  - [ ] LoadBalancer service type supported
  - [ ] External IP allocation configured
  - [ ] Network policies supported (optional but recommended)

- [ ] **Add-ons Installed**
  - [ ] Nginx Ingress Controller v1.10.0+
  - [ ] cert-manager v1.14.0+ (for TLS)
  - [ ] Metrics Server (for HPA)
  - [ ] cluster-autoscaler (optional, for node scaling)

### DNS Configuration

- [ ] **Domain Names Registered**
  - [ ] Production domain: `your-domain.com`
  - [ ] API domain: `api.your-domain.com`
  - [ ] Prometheus: `prometheus.your-domain.com`
  - [ ] Grafana: `grafana.your-domain.com`

- [ ] **DNS Records Created**
  - [ ] A/CNAME records pointing to Ingress LoadBalancer IP
  - [ ] TTL set appropriately (300s recommended for initial deployment)
  - [ ] DNS propagation verified (use `dig` or `nslookup`)

### Docker Images

- [ ] **Images Built**
  - [ ] Backend image built with production Dockerfile
  - [ ] Frontend image built with production Dockerfile
  - [ ] Images tagged with version (e.g., v1.0.0)
  - [ ] Images scanned for vulnerabilities

- [ ] **Registry**
  - [ ] Container registry configured (DockerHub, GCR, ECR, ACR)
  - [ ] Images pushed to registry
  - [ ] Registry credentials configured in Kubernetes
  - [ ] Pull secrets created if using private registry

### Secrets & Configuration

- [ ] **Environment Variables**
  - [ ] All production environment variables documented
  - [ ] `.env.production` file created (DO NOT COMMIT)
  - [ ] Variables reviewed for correctness

- [ ] **Secrets Created**
  - [ ] Database password (strong, 32+ characters)
  - [ ] Redis password
  - [ ] JWT secret key (secure random string)
  - [ ] OpenAI API key
  - [ ] Anthropic API key
  - [ ] Integration credentials (Xero, Shopify, SendGrid, ElevenLabs)
  - [ ] All secrets base64 encoded
  - [ ] `k8s/secret.yaml` updated with production secrets

- [ ] **ConfigMap Updated**
  - [ ] Domain names updated in `k8s/configmap.yaml`
  - [ ] CORS origins configured
  - [ ] Frontend URL configured
  - [ ] Database URL configured

### Database Setup

- [ ] **Production Database**
  - [ ] PostgreSQL 15+ with pgvector extension
  - [ ] Database created
  - [ ] Admin user created
  - [ ] Application user created with limited privileges
  - [ ] Connection tested from local machine

- [ ] **Database Migrations**
  - [ ] Alembic migrations reviewed
  - [ ] Migration dry-run completed
  - [ ] Rollback plan documented

- [ ] **Initial Data**
  - [ ] Seed data prepared (if needed)
  - [ ] Import scripts tested
  - [ ] Data validation queries prepared

### External Services

- [ ] **Xero Integration**
  - [ ] Production credentials obtained
  - [ ] OAuth app configured
  - [ ] Webhook endpoints registered
  - [ ] Connection tested

- [ ] **Shopify Integration**
  - [ ] Production store access
  - [ ] API credentials configured
  - [ ] Webhooks configured
  - [ ] Connection tested

- [ ] **SendGrid**
  - [ ] Production API key
  - [ ] Domain verification completed
  - [ ] SPF/DKIM/DMARC records configured
  - [ ] Test email sent successfully

- [ ] **ElevenLabs**
  - [ ] Production API key
  - [ ] Voice models configured
  - [ ] Usage limits reviewed
  - [ ] Test synthesis successful

### Monitoring Setup

- [ ] **Prometheus**
  - [ ] Alert rules reviewed and customized
  - [ ] Retention period configured (30 days)
  - [ ] Storage size allocated (20GB recommended)

- [ ] **Grafana**
  - [ ] Admin password changed from default
  - [ ] User accounts created for team
  - [ ] Dashboards reviewed
  - [ ] Data sources configured

- [ ] **Alert Notifications**
  - [ ] Email notifications configured
  - [ ] Slack integration configured (optional)
  - [ ] PagerDuty integration configured (optional)
  - [ ] Test alerts verified

### Security Review

- [ ] **TLS/SSL**
  - [ ] cert-manager ClusterIssuer configured
  - [ ] Let's Encrypt production issuer (not staging)
  - [ ] Certificate generation tested

- [ ] **Access Control**
  - [ ] Kubernetes RBAC configured
  - [ ] Service accounts created with minimal permissions
  - [ ] Network policies defined (optional)

- [ ] **Secrets Management**
  - [ ] Secrets not committed to git (verified)
  - [ ] External secrets manager considered (Vault, Sealed Secrets)
  - [ ] Secrets rotation plan documented

- [ ] **Container Security**
  - [ ] Images scanned for vulnerabilities
  - [ ] Non-root users configured (already in Dockerfiles)
  - [ ] Resource limits set to prevent resource exhaustion

---

## Deployment Day

### Pre-Deployment Validation (30 minutes)

- [ ] **Run Pre-Deployment Checks**
  ```bash
  ./scripts/pre-deployment-check.sh
  ```
  - [ ] All checks passed
  - [ ] Issues addressed

- [ ] **Verify Cluster Access**
  ```bash
  kubectl cluster-info
  kubectl get nodes
  kubectl get ns
  ```

- [ ] **Verify Images Available**
  ```bash
  docker pull your-registry/backend:v1.0.0
  docker pull your-registry/frontend:v1.0.0
  ```

### Backup Current State (if updating)

- [ ] **Database Backup**
  ```bash
  # If updating existing deployment
  kubectl exec -it postgres-0 -n ccw-erp -- pg_dump -U postgres ccw_erp > backup-$(date +%Y%m%d-%H%M%S).sql
  ```

- [ ] **Export Current Kubernetes Resources**
  ```bash
  kubectl get all -n ccw-erp -o yaml > k8s-backup-$(date +%Y%m%d-%H%M%S).yaml
  ```

### Initial Deployment (1-2 hours)

- [ ] **Deploy Infrastructure Components**
  ```bash
  # Deploy in order
  kubectl apply -f k8s/namespace.yaml
  kubectl apply -f k8s/configmap.yaml
  kubectl apply -f k8s/secret.yaml
  kubectl apply -f k8s/persistent-volumes.yaml
  ```
  - [ ] Namespace created
  - [ ] ConfigMap created
  - [ ] Secrets created
  - [ ] PVCs bound

- [ ] **Deploy Stateful Services**
  ```bash
  kubectl apply -f k8s/postgres-statefulset.yaml
  kubectl wait --for=condition=ready pod/postgres-0 -n ccw-erp --timeout=300s

  kubectl apply -f k8s/redis-deployment.yaml
  kubectl wait --for=condition=ready pod -l component=redis -n ccw-erp --timeout=300s
  ```
  - [ ] PostgreSQL running and healthy
  - [ ] Redis running and healthy

- [ ] **Run Database Migrations**
  ```bash
  # One-time migration job
  kubectl apply -f k8s/jobs/migration-job.yaml
  kubectl wait --for=condition=complete job/migration-job -n ccw-erp --timeout=600s
  kubectl logs job/migration-job -n ccw-erp
  ```
  - [ ] Migrations completed successfully
  - [ ] No errors in logs

- [ ] **Deploy Application Services**
  ```bash
  kubectl apply -f k8s/backend-deployment.yaml
  kubectl apply -f k8s/celery-worker-deployment.yaml
  kubectl apply -f k8s/frontend-deployment.yaml
  kubectl apply -f k8s/ingress.yaml
  ```
  - [ ] Backend pods running (wait for startup probe)
  - [ ] Celery worker pods running
  - [ ] Celery beat pod running
  - [ ] Frontend pods running
  - [ ] Ingress configured

- [ ] **Deploy Auto-Scaling**
  ```bash
  kubectl apply -f k8s/hpa.yaml
  ```
  - [ ] HPAs created
  - [ ] Metrics available

- [ ] **Deploy Monitoring**
  ```bash
  ./scripts/deploy-monitoring.sh
  ```
  - [ ] Prometheus running
  - [ ] Grafana running
  - [ ] Metrics being collected

### Post-Deployment Verification (30 minutes)

- [ ] **Health Checks**
  ```bash
  # Backend health
  curl https://api.your-domain.com/health

  # Frontend health
  curl https://your-domain.com
  ```
  - [ ] All health checks returning 200 OK
  - [ ] All dependencies reporting healthy

- [ ] **Database Connectivity**
  ```bash
  kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres -c "SELECT 1"
  ```
  - [ ] Database accessible
  - [ ] Tables created

- [ ] **Redis Connectivity**
  ```bash
  kubectl exec -it deployment/redis -n ccw-erp -- redis-cli ping
  ```
  - [ ] Redis responding

- [ ] **Celery Workers**
  ```bash
  kubectl logs -l component=celery-worker -n ccw-erp --tail=50
  ```
  - [ ] Workers connected to broker
  - [ ] No errors in logs

- [ ] **Ingress & TLS**
  ```bash
  curl -I https://your-domain.com
  curl -I https://api.your-domain.com
  ```
  - [ ] TLS certificate valid
  - [ ] HTTP redirects to HTTPS
  - [ ] All domains resolving correctly

### Functional Testing (1 hour)

- [ ] **User Authentication**
  - [ ] Login page loads
  - [ ] User can log in
  - [ ] Session persists
  - [ ] Logout works

- [ ] **Core Workflows**
  - [ ] Create new order
  - [ ] View orders list
  - [ ] Create quote
  - [ ] Convert quote to order
  - [ ] Update inventory
  - [ ] View dashboard
  - [ ] Real-time updates working

- [ ] **AI Features**
  - [ ] Chat functionality working
  - [ ] AI insights generating
  - [ ] Agent decisions visible
  - [ ] Auto-execution working (if enabled)

- [ ] **Integrations**
  - [ ] Xero sync working (if configured)
  - [ ] Shopify webhooks receiving (if configured)
  - [ ] SendGrid emails sending
  - [ ] ElevenLabs voice generation working

### Monitoring Verification (15 minutes)

- [ ] **Grafana Dashboards**
  - [ ] Application Performance dashboard showing data
  - [ ] Infrastructure Health dashboard showing data
  - [ ] Business Metrics dashboard showing data
  - [ ] AI Agent Performance dashboard showing data

- [ ] **Prometheus Targets**
  - [ ] All targets Up (no Down targets)
  - [ ] Metrics scraping successfully

- [ ] **Alert Rules**
  - [ ] Alert rules loaded
  - [ ] No alerts firing (unless expected)

- [ ] **Test Alert**
  - [ ] Send test alert
  - [ ] Confirm receipt via configured channels

---

## Post-Deployment (First 24 Hours)

### Monitoring & Observation

- [ ] **Hour 1: Intensive Monitoring**
  - [ ] Watch pod logs for errors
  - [ ] Monitor CPU/memory usage
  - [ ] Check error rates in Grafana
  - [ ] Verify no alerts firing

- [ ] **Hour 6: Performance Check**
  - [ ] Review response times
  - [ ] Check database connection pool
  - [ ] Verify Celery queue not backing up
  - [ ] Review resource utilization

- [ ] **Hour 24: Full Review**
  - [ ] Review all metrics
  - [ ] Check for any patterns or anomalies
  - [ ] Verify auto-scaling behavior
  - [ ] Review alert history

### Load Testing (Optional but Recommended)

- [ ] **Run Load Tests**
  ```bash
  cd load-tests
  k6 run scenarios/smoke-test.js
  k6 run scenarios/load-test.js
  k6 run scenarios/stress-test.js
  ```
  - [ ] Smoke test passed
  - [ ] Load test passed
  - [ ] System handled expected load
  - [ ] Auto-scaling triggered appropriately

- [ ] **Review Load Test Results**
  - [ ] Response times acceptable (p95 < 1s)
  - [ ] Error rate acceptable (< 1%)
  - [ ] No resource exhaustion
  - [ ] Pods scaled up/down correctly

### Performance Tuning

- [ ] **Review Metrics**
  - [ ] CPU usage patterns
  - [ ] Memory usage patterns
  - [ ] Request latency
  - [ ] Database query performance

- [ ] **Adjust Resources** (if needed)
  - [ ] Update resource requests/limits
  - [ ] Adjust HPA thresholds
  - [ ] Tune database connection pool
  - [ ] Optimize slow queries

### Documentation

- [ ] **Update Documentation**
  - [ ] Production URLs documented
  - [ ] Access credentials stored securely (password manager)
  - [ ] Deployment notes captured
  - [ ] Known issues documented

- [ ] **Runbook Updates**
  - [ ] Common operations documented
  - [ ] Troubleshooting procedures updated
  - [ ] Contact information current
  - [ ] Escalation procedures defined

### Team Handoff

- [ ] **Operations Team Briefed**
  - [ ] Architecture overview presented
  - [ ] Monitoring dashboards explained
  - [ ] Alert response procedures reviewed
  - [ ] Escalation contacts provided

- [ ] **Access Provisioned**
  - [ ] Kubernetes access granted to ops team
  - [ ] Grafana accounts created
  - [ ] VPN access configured (if applicable)
  - [ ] Emergency access procedures documented

---

## Post-Deployment (First Week)

### Daily Monitoring

- [ ] **Day 1**
  - [ ] Morning: Review overnight metrics
  - [ ] Afternoon: Check for any issues
  - [ ] Evening: Review daily summary

- [ ] **Day 2-7** (Repeat daily)
  - [ ] Review error rates
  - [ ] Check resource utilization
  - [ ] Monitor auto-scaling behavior
  - [ ] Review any alerts that fired
  - [ ] Check database performance

### Optimization

- [ ] **Performance Analysis**
  - [ ] Identify slow endpoints
  - [ ] Review database query performance
  - [ ] Analyze Celery task performance
  - [ ] Check WebSocket connection stability

- [ ] **Resource Optimization**
  - [ ] Fine-tune resource requests/limits based on actual usage
  - [ ] Adjust HPA parameters if needed
  - [ ] Optimize database connection pool
  - [ ] Review and optimize Redis usage

- [ ] **Cost Optimization**
  - [ ] Review cloud costs
  - [ ] Identify opportunities to reduce waste
  - [ ] Consider reserved instances (if cloud provider supports)
  - [ ] Optimize storage usage

### Backup & Disaster Recovery

- [ ] **Backup Verification**
  - [ ] Confirm automated backups running
  - [ ] Test backup restoration
  - [ ] Document restore procedure
  - [ ] Verify backup retention policy

- [ ] **Disaster Recovery Plan**
  - [ ] RTO (Recovery Time Objective) defined
  - [ ] RPO (Recovery Point Objective) defined
  - [ ] Failover procedures documented
  - [ ] DR drill scheduled

---

## Rollback Plan (If Issues Arise)

### Immediate Rollback

If critical issues are discovered:

```bash
# 1. Revert to previous deployment
kubectl rollout undo deployment/backend -n ccw-erp
kubectl rollout undo deployment/frontend -n ccw-erp
kubectl rollout undo deployment/celery-worker -n ccw-erp

# 2. Restore database (if migrations were run)
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres ccw_erp < backup-YYYYMMDD-HHMMSS.sql

# 3. Verify rollback
kubectl rollout status deployment/backend -n ccw-erp
kubectl rollout status deployment/frontend -n ccw-erp

# 4. Check health
curl https://api.your-domain.com/health
```

### Post-Rollback

- [ ] Investigate root cause
- [ ] Fix issues in staging environment
- [ ] Re-test thoroughly
- [ ] Schedule new deployment

---

## Sign-Off

### Deployment Complete

- [ ] All checklist items completed
- [ ] No critical issues identified
- [ ] Monitoring in place and working
- [ ] Team briefed and ready
- [ ] Documentation updated

**Deployment Lead Signature:** _________________ **Date:** _______

**Operations Lead Signature:** _________________ **Date:** _______

**CTO/Tech Lead Signature:** _________________ **Date:** _______

---

## Appendix A: Quick Reference Commands

### Check Pod Status
```bash
kubectl get pods -n ccw-erp
kubectl describe pod <pod-name> -n ccw-erp
kubectl logs -f <pod-name> -n ccw-erp
```

### Check Service Status
```bash
kubectl get svc -n ccw-erp
kubectl describe svc <service-name> -n ccw-erp
```

### Check Ingress Status
```bash
kubectl get ingress -n ccw-erp
kubectl describe ingress ccw-erp-ingress -n ccw-erp
```

### Check HPA Status
```bash
kubectl get hpa -n ccw-erp
kubectl describe hpa backend-hpa -n ccw-erp
```

### Scale Manually
```bash
kubectl scale deployment/backend --replicas=5 -n ccw-erp
```

### Port Forward for Testing
```bash
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp
kubectl port-forward svc/frontend-service 3000:3000 -n ccw-erp
```

### Database Access
```bash
kubectl exec -it postgres-0 -n ccw-erp -- psql -U postgres ccw_erp
```

### Redis Access
```bash
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli
```

---

## Appendix B: Emergency Contacts

| Role | Name | Phone | Email | Availability |
|------|------|-------|-------|--------------|
| Deployment Lead | | | | |
| Operations Lead | | | | |
| Database Admin | | | | |
| DevOps Engineer | | | | |
| CTO/Tech Lead | | | | |

---

## Appendix C: Important URLs

| Service | URL | Credentials Location |
|---------|-----|---------------------|
| Production Frontend | https://your-domain.com | N/A |
| Production API | https://api.your-domain.com | N/A |
| Grafana | https://grafana.your-domain.com | Password Manager |
| Prometheus | https://prometheus.your-domain.com | Password Manager |
| Container Registry | | Password Manager |
| Cloud Provider Console | | Password Manager |

---

*Last Updated: January 14, 2026*
*Version: 1.0*
