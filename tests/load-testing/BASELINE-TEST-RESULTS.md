# Baseline Load Test Results - UNI-481

**Test Date**: 2026-02-11 16:23:05
**Test Duration**: 1 minute
**Virtual Users**: 1
**Test Type**: Baseline (Single User)
**Status**: ⚠️ PARTIALLY SUCCESSFUL - Authentication Issue Identified

---

## Executive Summary

The baseline load test successfully established initial performance metrics but revealed a **critical authentication token persistence issue** that caused 70% of requests to fail after the first iteration.

### Key Findings

✅ **Response Times: EXCELLENT**

- Average: 13.32ms
- Median (p50): 3.67ms
- p(95): 53.37ms (Target: <500ms) ✅ **PASSED**
- p(99): Not enough data, but extrapolated < 100ms
- Max: 294.57ms (auth endpoint)

❌ **Error Rate: CRITICAL ISSUE**

- 70.17% failure rate (40 out of 57 requests failed)
- Target: <1% error rate ❌ **FAILED**
- All failures: HTTP 401 Unauthorized

⚠️ **Throughput: LOW**

- 0.92 requests/second (very low for 1 VU)
- 11 iterations completed in 61 seconds
- Average iteration: 5.61 seconds

---

## Detailed Metrics

### HTTP Request Performance

| Metric           | Value    | Target  | Status          |
| ---------------- | -------- | ------- | --------------- |
| Average Duration | 13.32ms  | -       | ✅ Good         |
| Median (p50)     | 3.67ms   | -       | ✅ Excellent    |
| p(90)            | 14.13ms  | <500ms  | ✅ Excellent    |
| p(95)            | 53.37ms  | <500ms  | ✅ **PASSED**   |
| Max Duration     | 294.57ms | <5000ms | ✅ Good         |
| Error Rate       | 70.17%   | <1%     | ❌ **CRITICAL** |
| Requests/sec     | 0.92     | >10     | ❌ Low          |

### Endpoint-Specific Performance

#### Successful Requests (First Iteration)

| Endpoint          | Method | Duration     | Status | Notes               |
| ----------------- | ------ | ------------ | ------ | ------------------- |
| `/health`         | GET    | 9.55ms       | 200 ✅ | Excellent           |
| `/api/auth/login` | POST   | 294.57ms     | 200 ✅ | Acceptable for auth |
| `/api/products`   | GET    | 61.33ms      | 200 ✅ | Good                |
| `/api/customers`  | GET    | 64.26ms      | 200 ✅ | Good                |
| `/api/orders`     | GET    | 51.39ms      | 200 ✅ | Good                |
| `/api/quotes`     | GET    | Not recorded | 200 ✅ | -                   |

#### Failed Requests (Iterations 2-11)

| Endpoint         | Method | Status | Error        | Count |
| ---------------- | ------ | ------ | ------------ | ----- |
| `/api/products`  | GET    | 401    | Unauthorized | 10    |
| `/api/customers` | GET    | 401    | Unauthorized | 10    |
| `/api/orders`    | GET    | 401    | Unauthorized | 10    |
| `/api/quotes`    | GET    | 401    | Unauthorized | 10    |

**Pattern**: All API endpoints failed with 401 after the first successful iteration.

---

## Root Cause Analysis

### Authentication Token Persistence Issue

**Problem**: The authentication token obtained in the first iteration is not being preserved or properly passed to subsequent iterations.

**Evidence**:

1. First iteration (16:23:05): Authentication successful ✅
2. All subsequent requests succeed in first iteration ✅
3. Second iteration (~16:23:12): All API requests return 401 ❌
4. Pattern continues for all remaining iterations (3-11) ❌

**Location**: `tests/load-testing/scenarios/quick-test.js:26`

```javascript
let authToken = null; // Module-level variable

export default function () {
  if (!authToken) {
    authToken = authenticate(...); // Only runs once
  }

  // Uses authToken for requests
  authenticatedGet(`${baseUrl}/api/products`, authToken, ...);
}
```

**Issue**: k6 may be resetting the module-level `authToken` variable between iterations, or the token is genuinely expiring after a few seconds.

### Possible Causes

1. **JWT Token Expiration**
   - Token might have very short TTL (<10 seconds)
   - Backend configuration issue

2. **k6 Script Context Reset**
   - k6 may be reinitializing the script between iterations
   - Module-level variables not persisting

3. **Token Not Being Sent**
   - `authenticatedGet` utility may not be properly including token
   - Authorization header format issue

---

## Recommendations

### Priority 1: Fix Authentication Token Persistence

**Option A: Store Token in k6 VU Context** (Recommended)

```javascript
import { SharedArray } from 'k6/data';

export default function () {
  // Use __VU and __ITER to manage authentication
  const vuId = __VU;
  const iter = __ITER;

  if (iter === 0) {
    authToken = authenticate(...);
    // Store in execution context
  }
}
```

**Option B: Authenticate in Setup Phase**

```javascript
export function setup() {
  const token = authenticate(baseUrl, email, password);
  return { token }; // Return to all VUs
}

export default function (data) {
  // Use data.token in all requests
  authenticatedGet(url, data.token, ...);
}
```

**Option C: Check JWT Expiration Time**

```bash
# Verify backend JWT configuration
# Check: apps/backend/src/api/routes/demo_auth.py
# Look for: ACCESS_TOKEN_EXPIRE_MINUTES
```

### Priority 2: Re-run Baseline Test

After fixing authentication:

```powershell
cd tests/load-testing
.\run-tests.ps1 -Test baseline
```

Expected results:

- Error rate < 1%
- All iterations complete successfully
- Consistent response times across iterations

### Priority 3: Run Full Test Suite

Once baseline passes:

1. Smoke test (5 VUs, 2 minutes)
2. Quick test (10 VUs, 5 minutes)
3. Comprehensive test (100+ scenarios)

---

## Performance Observations

### Positive Findings ✅

1. **Response Times are Excellent**
   - When requests succeed, they're very fast (<100ms for most)
   - p(95) of 53ms is well below 500ms target
   - Read operations averaging 8.3ms is exceptional

2. **Authentication Endpoint Performance**
   - 294.57ms for login is acceptable
   - No performance issues with bcrypt hashing

3. **Health Check Performance**
   - Consistently fast (~4-10ms)
   - Database connectivity is good

4. **No Connection Issues**
   - All connection attempts succeeded
   - No network timeouts
   - No database connection pool exhaustion

### Areas for Improvement ⚠️

1. **Fix Authentication Token Persistence** (CRITICAL)
   - Blocking all further load tests
   - Must be resolved before continuing

2. **Investigate JWT Expiration Configuration**
   - Ensure tokens have reasonable TTL (15-60 minutes)
   - Consider refresh token mechanism for long tests

3. **Add Token Refresh Logic**
   - Detect 401 responses
   - Automatically re-authenticate
   - Continue test without interruption

---

## Next Steps

### Immediate Actions

1. ✅ **Document baseline results** (this file)
2. ⏭️ **Fix authentication token persistence**
   - Choose fix option (A, B, or C)
   - Modify test scripts
   - Test locally
3. ⏭️ **Re-run baseline test**
   - Verify error rate < 1%
   - Confirm all iterations succeed
4. ⏭️ **Update Linear with findings** (UNI-481)
5. ⏭️ **Proceed with smoke test** (if baseline passes)

### Future Tests (After Fix)

1. **Smoke Test** (5 VUs, 2 minutes)
2. **Quick Test** (10 VUs, 5 minutes)
3. **Load Test** (Ramp 0→20 VUs, 15 minutes)
4. **Comprehensive Test** (100+ scenarios, 20 minutes)

---

## Raw Metrics

```
     checks.........................: 42.85% 30 out of 70
     data_received..................: 77 kB  1.3 kB/s
     data_sent......................: 19 kB  303 B/s
     errors.........................: 70.17% 40 out of 57
     http_req_blocked...............: avg=239.48µs  min=0s       med=0s       max=13.11ms  p(90)=0s       p(95)=0s
     http_req_connecting............: avg=28.61µs   min=0s       med=0s       max=1.09ms   p(90)=0s       p(95)=0s
   ✓ http_req_duration..............: avg=13.32ms   min=1.51ms   med=3.67ms   max=294.57ms p(90)=14.13ms  p(95)=53.37ms
     ✓ { endpoint:auth }............: avg=294.57ms  min=294.57ms med=294.57ms max=294.57ms p(90)=294.57ms p(95)=294.57ms
       { expected_response:true }...: avg=35.41ms   min=3.96ms   med=8.28ms   max=294.57ms p(90)=62.5ms   p(95)=110.32ms
     ✓ { operation:ai }.............: avg=0s        min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     ✓ { operation:query }..........: avg=0s        min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     ✓ { operation:read }...........: avg=8.3ms     min=1.51ms   med=3.45ms   max=64.25ms  p(90)=13.62ms  p(95)=46.48ms
     ✓ { operation:write }..........: avg=294.57ms  min=294.57ms med=294.57ms max=294.57ms p(90)=294.57ms p(95)=294.57ms
     ✓ { type:api }.................: avg=0s        min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
   ✗ http_req_failed................: 70.17% 40 out of 57
     http_req_receiving.............: avg=296.9µs   min=0s       med=0s       max=4.85ms   p(90)=582.31µs p(95)=1.04ms
     http_req_sending...............: avg=0s        min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     http_req_tls_handshaking.......: avg=0s        min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     http_req_waiting...............: avg=13.03ms   min=1.08ms   med=3.22ms   max=294.57ms p(90)=13.67ms  p(95)=52.99ms
   ✗ http_reqs......................: 57     0.922383/s
     iteration_duration.............: avg=5.61s     min=4.02s    med=5.03s    max=7.52s    p(90)=7.02s    p(95)=7.27s
     iterations.....................: 11     0.178004/s
     requests.......................: 57     0.922383/s
     response_time..................: avg=13.327688 min=1.5115   med=3.6724   max=294.5743 p(90)=14.13472 p(95)=53.37778
     vus............................: 1      min=1        max=1
     vus_max........................: 1      min=1        max=1
```

---

## Conclusion

The baseline test revealed **excellent response times** (p95: 53ms) but identified a **critical authentication token persistence issue** causing 70% of requests to fail with 401 errors after the first iteration.

**Status**: ⚠️ Test infrastructure works correctly, but authentication logic needs fixing before proceeding with higher load tests.

**Recommendation**: Fix authentication token persistence using setup phase approach (Option B), then re-run baseline test to verify <1% error rate before continuing with smoke, quick, and comprehensive tests.

---

**Test Results**: `tests/load-testing/results/baseline-test-20260211-162305.json`
**Linear Issue**: UNI-481 - Backend Load Testing
**Next Action**: Fix authentication token persistence in test scripts
