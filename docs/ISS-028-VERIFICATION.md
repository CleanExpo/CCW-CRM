# ISS-028 VERIFICATION — Security Penetration Testing

**Status**: ⏳ READY FOR TESTING
**Date**: February 2, 2026
**Related Issues**: ISS-024 (Security Audit), ISS-025 (Secrets), ISS-026 (Firewall), ISS-027 (Rate Limiting)

---

## Implementation Summary

ISS-028 validates security penetration testing readiness and provides comprehensive testing procedures for OWASP Top 10 vulnerabilities, authentication security, API security, network security, SQL injection, XSS, CSRF, rate limiting validation, and complete security validation before production deployment.

**Penetration Testing Scope:**
- OWASP Top 10 (2021) validation
- Authentication and authorization testing
- SQL injection testing (automated + manual)
- XSS and CSRF testing
- API security testing (rate limiting, input validation, authentication bypass)
- Network security testing (port scanning, service enumeration)
- Session management testing
- Access control testing
- Dependency vulnerability scanning
- Configuration security review
- Reporting and re-testing procedures

---

## Files Status

### Created (1):
1. **scripts/verify-penetration-testing.sh** - Penetration testing readiness verification (700+ lines)

### Required Documentation (To Be Created):
1. **docs/PENETRATION_TESTING_REPORT.md** - Final penetration testing findings report
2. **docs/SECURITY_FINDINGS_TEMPLATE.md** - Template for documenting findings

---

## Verification Categories (17)

1. Penetration Testing Tools Availability - nmap, nikto, sqlmap, OWASP ZAP, curl, jq
2. Security Audit Completion - ISS-024 pre-requisite, 0 critical issues
3. Authentication Security Testing Readiness - bcrypt, JWT, rate limiting
4. SQL Injection Protection Validation - SQLAlchemy ORM, no string formatting
5. XSS Protection Validation - React auto-escaping, no dangerouslySetInnerHTML, CSP
6. CSRF Protection Validation - SameSite cookies, CSRF tokens
7. API Security Testing Readiness - Rate limiting, auth middleware, input validation
8. Network Security Testing Readiness - Firewall, SSL/TLS configuration
9. Session Management Testing Readiness - Secure cookies, session expiration
10. Access Control Testing Readiness - RBAC, authorization checks
11. Dependency Vulnerability Scanning - npm audit, pip-audit
12. Penetration Testing Documentation - Testing guide, findings template
13. Test Environment Readiness - Application running, test database
14. OWASP Top 10 Testing Checklist - All 10 categories covered
15. Penetration Testing Methodology - 6-phase approach
16. Pre-Testing Security Checklist - All ISS-024-027 complete
17. Penetration Testing Commands - Ready-to-use commands for all tests

---

## Penetration Testing Methodology

### Phase 1: Reconnaissance (2-4 hours)

**Objective**: Gather information about the target system

**Activities**:
```bash
# 1. Port Scanning
nmap -sV -sC -p- localhost -oN nmap-scan.txt

# 2. Service Enumeration
nmap -sV -A localhost -oN nmap-detailed.txt

# 3. Technology Fingerprinting
whatweb http://localhost:8000
curl -I http://localhost:8000

# 4. Directory Discovery
gobuster dir -u http://localhost:8000 -w /usr/share/wordlists/dirb/common.txt -o gobuster-results.txt
ffuf -u http://localhost:8000/FUZZ -w /usr/share/wordlists/dirb/common.txt

# 5. API Endpoint Discovery
curl http://localhost:8000/docs  # FastAPI automatic docs
curl http://localhost:8000/openapi.json  # OpenAPI spec
```

**Deliverables**:
- Network topology diagram
- Open ports and services list
- Technology stack documentation
- API endpoint inventory

---

### Phase 2: Vulnerability Assessment (4-6 hours)

**Objective**: Identify potential vulnerabilities

**Automated Scanning**:
```bash
# 1. OWASP ZAP Automated Scan
zap-cli quick-scan http://localhost:8000
zap-cli quick-scan --self-contained --start-options '-config api.disablekey=true' http://localhost:8000

# 2. Nikto Web Server Scanner
nikto -h http://localhost:8000 -o nikto-report.html -Format html

# 3. Nuclei Vulnerability Scanner
nuclei -u http://localhost:8000 -t /path/to/nuclei-templates/

# 4. Frontend Dependency Scanning
cd apps/web && npm audit --audit-level=moderate

# 5. Backend Dependency Scanning
cd apps/backend && pip-audit
```

**Manual Code Review**:
- Review authentication implementation
- Check authorization logic
- Validate input validation
- Examine error handling
- Review logging and monitoring

**Deliverables**:
- Automated scan reports (OWASP ZAP, Nikto, Nuclei)
- Dependency vulnerability report
- Code review findings
- Initial vulnerability list

---

### Phase 3: Exploitation (Controlled) (6-8 hours)

**Objective**: Validate vulnerabilities through controlled exploitation

#### A. SQL Injection Testing

```bash
# 1. Automated SQLMap Scan
sqlmap -u "http://localhost:8000/api/products?search=test" --batch --level=5 --risk=3

# 2. Manual SQL Injection Tests
# Test basic SQL injection
curl -X GET "http://localhost:8000/api/products?search=' OR '1'='1"

# Test UNION-based injection
curl -X GET "http://localhost:8000/api/products?search=1' UNION SELECT NULL,NULL,NULL--"

# Test time-based blind injection
curl -X GET "http://localhost:8000/api/products?search=1' AND SLEEP(5)--"

# Test Boolean-based blind injection
curl -X GET "http://localhost:8000/api/products?search=1' AND 1=1--"
curl -X GET "http://localhost:8000/api/products?search=1' AND 1=2--"
```

**Expected Result**: All SQL injection attempts should fail (SQLAlchemy ORM protection)

#### B. XSS Testing

```bash
# 1. Reflected XSS
curl -X GET "http://localhost:8000/api/products?search=<script>alert('XSS')</script>"

# 2. Stored XSS
curl -X POST http://localhost:8000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "<script>alert(\"XSS\")</script>",
    "description": "<img src=x onerror=alert(1)>"
  }'

# 3. DOM-based XSS (manual browser testing)
# Navigate to: http://localhost:3000/products?id=<script>alert('XSS')</script>
```

**Expected Result**: All XSS attempts should be escaped (React auto-escaping)

#### C. Authentication & Authorization Testing

```bash
# 1. Brute Force Login (should be rate limited)
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/demo-auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@demo.com","password":"wrong'$i'"}'
done
# Expected: 429 Too Many Requests after 5 attempts

# 2. JWT Token Testing
# Test with invalid token
curl -X GET http://localhost:8000/api/products \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 Unauthorized

# Test with expired token
curl -X GET http://localhost:8000/api/products \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1MTYyMzkwMjJ9.invalid"
# Expected: 401 Unauthorized

# 3. Authorization Bypass Testing
# Attempt to access admin endpoint without admin role
curl -X GET http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN"
# Expected: 403 Forbidden

# 4. Password Reset Testing
# Test password reset rate limiting (3/hour)
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/demo-auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
done
# Expected: 429 Too Many Requests after 3 attempts
```

#### D. CSRF Testing

```bash
# 1. Test state-changing operations without proper headers
curl -X POST http://localhost:8000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product"}' \
  --referer "http://malicious-site.com"

# Expected: Request should fail (SameSite cookies, Origin validation)

# 2. Test with missing Origin header
curl -X POST http://localhost:8000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Product"}'

# Expected: Should fail if Origin validation is enforced
```

#### E. API Security Testing

```bash
# 1. Test Rate Limiting
# Should return 429 after limit exceeded
for i in {1..150}; do
  curl -X GET http://localhost:8000/api/products \
    -H "Authorization: Bearer $TOKEN"
done

# 2. Test Input Validation
# Invalid email format
curl -X POST http://localhost:8000/api/demo-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"test123"}'
# Expected: 422 Unprocessable Entity

# Oversized input
curl -X POST http://localhost:8000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"'$(python3 -c 'print("A"*10000)')'","price":100}'
# Expected: 422 Unprocessable Entity or 400 Bad Request

# 3. Test CORS
curl -X OPTIONS http://localhost:8000/api/products \
  -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Expected: CORS headers should restrict unauthorized origins

# 4. Test Mass Assignment
curl -X POST http://localhost:8000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":100,"is_admin":true}'
# Expected: is_admin field should be ignored/rejected
```

**Deliverables**:
- Proof of concept for each finding
- Screenshots/logs of successful exploits
- Failed exploitation attempts (documenting protections)
- Severity classification (Critical, High, Medium, Low)

---

### Phase 4: Post-Exploitation (Simulated) (2-4 hours)

**Objective**: Assess potential impact of successful attacks

**Activities**:
- Privilege escalation testing (user → admin)
- Data access validation (can user A access user B's data?)
- Lateral movement testing (compromised service → other services)
- Data exfiltration testing (can attacker download sensitive data?)

**Test Scenarios**:
```bash
# 1. Privilege Escalation
# Attempt to modify another user's data
curl -X PUT http://localhost:8000/api/orders/OTHER_USER_ORDER_ID \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}'
# Expected: 403 Forbidden

# 2. IDOR (Insecure Direct Object References)
# Attempt to access another user's order by ID
curl -X GET http://localhost:8000/api/orders/1 \
  -H "Authorization: Bearer $USER2_TOKEN"
# Expected: 403 Forbidden if order belongs to user1

# 3. Data Exfiltration
# Attempt to download all users (should require admin)
curl -X GET http://localhost:8000/api/users?page_size=10000 \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN"
# Expected: 403 Forbidden or pagination limit enforced
```

---

### Phase 5: Reporting (4-6 hours)

**Objective**: Document all findings with actionable recommendations

**Report Structure**:

```markdown
# Penetration Testing Report - CCW-Online ERP

## Executive Summary
- Testing period: [dates]
- Scope: [components tested]
- Critical findings: X
- High findings: X
- Medium findings: X
- Low findings: X

## Methodology
- Reconnaissance
- Vulnerability Assessment
- Exploitation (Controlled)
- Post-Exploitation (Simulated)

## Findings

### Finding 1: [Title]
**Severity**: Critical/High/Medium/Low
**OWASP Category**: A01, A02, etc.
**Affected Component**: [endpoint/feature]
**Description**: [detailed description]
**Proof of Concept**: [steps to reproduce]
**Impact**: [potential business/security impact]
**Recommendation**: [how to fix]
**References**: [CWE, CVE, OWASP links]

[Repeat for each finding]

## Positive Findings (Security Controls Working)
- Rate limiting prevents brute force attacks
- SQLAlchemy ORM prevents SQL injection
- React auto-escaping prevents XSS
- [etc.]

## Risk Summary
[Overall risk assessment and prioritization]

## Recommendations
1. Fix critical findings immediately
2. Address high findings before production
3. Plan remediation for medium/low findings
4. Re-test after fixes
```

**Deliverables**:
- Complete penetration testing report (PDF + Markdown)
- Executive summary (1-2 pages for stakeholders)
- Technical details (for developers)
- Remediation roadmap with timeline

---

### Phase 6: Re-testing (2-4 hours)

**Objective**: Validate that all vulnerabilities have been fixed

**Activities**:
```bash
# 1. Re-run all failed tests
# For each finding, repeat the proof of concept

# 2. Regression testing
# Ensure fixes didn't introduce new vulnerabilities

# 3. Re-run automated scans
zap-cli quick-scan http://localhost:8000
nikto -h http://localhost:8000
npm audit
pip-audit

# 4. Final validation
./scripts/verify-penetration-testing.sh
```

**Deliverables**:
- Re-testing report
- Updated vulnerability status (Fixed/Not Fixed/Partially Fixed)
- Final sign-off for production deployment

---

## OWASP Top 10 (2021) Testing Procedures

### A01: Broken Access Control

**Tests**:
- Horizontal privilege escalation (access another user's data)
- Vertical privilege escalation (user → admin)
- Bypass access control checks
- IDOR vulnerabilities

**Commands**:
```bash
# Test IDOR
curl -X GET http://localhost:8000/api/orders/1 -H "Authorization: Bearer $USER2_TOKEN"

# Test missing authorization
curl -X DELETE http://localhost:8000/api/products/1 -H "Authorization: Bearer $USER_TOKEN"
```

### A02: Cryptographic Failures

**Tests**:
- Password storage (should use bcrypt)
- JWT secret strength (should be 512-bit)
- SSL/TLS configuration
- Sensitive data encryption

**Commands**:
```bash
# Check SSL/TLS
nmap --script ssl-enum-ciphers -p 443 yourdomain.com

# Test weak passwords
curl -X POST http://localhost:8000/api/demo-auth/register \
  -d '{"email":"test@test.com","password":"123"}'
# Expected: Reject weak passwords
```

### A03: Injection

**Tests**:
- SQL injection (all input fields)
- NoSQL injection
- OS command injection
- LDAP injection

**Already covered in Phase 3 - SQL Injection Testing**

### A04: Insecure Design

**Tests**:
- Rate limiting effectiveness
- Account lockout after failed attempts
- Business logic flaws

**Already covered in Phase 3 - Authentication Testing**

### A05: Security Misconfiguration

**Tests**:
- Default credentials
- Debug mode in production
- Unnecessary features enabled
- Missing security headers
- Verbose error messages

**Commands**:
```bash
# Test debug mode
curl http://localhost:8000/api/nonexistent
# Should NOT show stack traces in production

# Test security headers
curl -I http://localhost:8000 | grep -i "x-frame-options\|strict-transport\|content-security"
```

### A06: Vulnerable and Outdated Components

**Tests**:
- Dependency vulnerability scanning
- Outdated frameworks/libraries
- Known CVEs

**Already covered in Phase 2 - Dependency Scanning**

### A07: Identification and Authentication Failures

**Tests**:
- Brute force protection
- Weak password policy
- Credential stuffing
- Session management

**Already covered in Phase 3 - Authentication Testing**

### A08: Software and Data Integrity Failures

**Tests**:
- Webhook signature verification
- CI/CD security
- Unsigned packages

**Commands**:
```bash
# Test webhook without signature
curl -X POST http://localhost:8000/api/webhooks/xero \
  -H "Content-Type: application/json" \
  -d '{"event":"invoice.created"}'
# Expected: 401 Unauthorized (missing/invalid signature)
```

### A09: Security Logging and Monitoring Failures

**Tests**:
- Security events logged
- Log tampering protection
- Monitoring and alerting

**Manual review of logs after attack attempts**

### A10: Server-Side Request Forgery (SSRF)

**Tests**:
- Internal network access via SSRF
- Cloud metadata access
- URL validation

**Commands**:
```bash
# Test SSRF (if URL input exists)
curl -X POST http://localhost:8000/api/fetch-url \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"http://169.254.169.254/latest/meta-data/"}'
# Expected: Request should be blocked
```

---

## Tools and Setup

### Required Tools

```bash
# 1. Install nmap (port scanning)
sudo apt-get install nmap

# 2. Install nikto (web server scanner)
sudo apt-get install nikto

# 3. Install OWASP ZAP (web app security testing)
# Download from: https://www.zaproxy.org/download/
# Or: snap install zaproxy --classic

# 4. Install sqlmap (SQL injection testing)
sudo apt-get install sqlmap

# 5. Install gobuster (directory brute-forcing)
sudo apt-get install gobuster

# 6. Install ffuf (fuzzing)
go install github.com/ffuf/ffuf@latest

# 7. Install nuclei (vulnerability scanner)
go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest

# 8. Install dependency scanners
npm install -g npm-audit
pip install pip-audit safety

# 9. Install jq (JSON processor)
sudo apt-get install jq

# 10. Install curl (HTTP client)
sudo apt-get install curl
```

### Wordlists

```bash
# Install common wordlists
sudo apt-get install wordlists

# Common locations:
# - /usr/share/wordlists/dirb/
# - /usr/share/wordlists/dirbuster/
# - /usr/share/seclists/
```

---

## Test Environment Setup

**CRITICAL**: NEVER test on production!

### Staging Environment

```bash
# 1. Clone production configuration
cp .env.production .env.staging

# 2. Use test database
export DATABASE_URL="postgresql://user:pass@localhost:5432/ccw_erp_test"

# 3. Use test secrets (not production secrets)
export JWT_SECRET_KEY="test_secret_key_not_for_production"

# 4. Enable debug mode (for testing only)
export DEBUG=true

# 5. Start application
pnpm dev
```

### Docker Isolated Environment

```bash
# Use Docker network isolation
docker-compose -f docker-compose.test.yml up -d
```

---

## Severity Classification

### Critical
- Remote code execution
- SQL injection with data access
- Authentication bypass
- Unauthorized data modification

**Action**: Fix immediately, do NOT deploy to production

### High
- Privilege escalation
- Stored XSS
- Sensitive data exposure
- CSRF on critical operations

**Action**: Fix before production deployment

### Medium
- Information disclosure
- Missing security headers
- Weak password policy
- Reflected XSS

**Action**: Fix within 30 days

### Low
- Verbose error messages
- Missing rate limiting on non-critical endpoints
- Outdated dependencies (no known exploits)

**Action**: Fix within 90 days

---

## Sign-off

**Penetration Testing**: ⏳ READY FOR TESTING
**Pre-requisites**: ✅ Complete (ISS-024, ISS-025, ISS-026, ISS-027)
**Testing Tools**: ⏳ Install required tools
**Test Environment**: ⏳ Set up staging environment
**Methodology**: ✅ 6-phase approach documented
**OWASP Top 10**: ✅ Testing procedures complete
**Commands**: ✅ Ready-to-use test commands provided
**Reporting**: ✅ Report template provided
**Production Ready**: ⏳ Pending penetration testing execution and re-testing

---

## Next Steps

1. **Install Tools** (30 min): Install nmap, OWASP ZAP, sqlmap, gobuster, ffuf, nuclei
2. **Set Up Test Environment** (15 min): Clone to staging, use test database
3. **Phase 1: Reconnaissance** (2-4 hours): Port scanning, service enumeration
4. **Phase 2: Vulnerability Assessment** (4-6 hours): Automated + manual scanning
5. **Phase 3: Exploitation** (6-8 hours): SQL injection, XSS, auth testing
6. **Phase 4: Post-Exploitation** (2-4 hours): Privilege escalation, IDOR
7. **Phase 5: Reporting** (4-6 hours): Document findings, recommendations
8. **Phase 6: Re-testing** (2-4 hours): Validate fixes, final sign-off

**Total Estimated Time**: 20-32 hours (1 week for dedicated security tester)

---

**End of ISS-028 Verification Document**
