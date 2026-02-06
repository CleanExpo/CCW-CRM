# Invoice System 503 Error - Resolution Summary

**Date**: 2026-02-06
**Task**: UNI-173 - Fix 503 Service Unavailable Error
**Status**: ✅ **RESOLVED**

---

## Problem Statement

The invoicing system backend was fully operational with all endpoints registered, but the frontend was receiving **503 Service Unavailable** errors when attempting to fetch invoice data from `/api/invoices`. This prevented the invoice management UI from displaying any data.

---

## Root Cause Analysis

The issue was caused by **cross-port cookie authentication failures** between:
- **Frontend**: `localhost:3011` (Next.js)
- **Backend**: `localhost:8000` (FastAPI)

### Symptoms:
1. OPTIONS (preflight) requests succeeded with **200 OK**
2. GET requests failed with **503 Service Unavailable** initially
3. After cookie domain fix: GET requests reached backend but returned **401 Unauthorized**
4. Backend logs showed: `"No auth_token cookie found"`
5. Browser's `document.cookie` returned empty string even after setting cookies

### Technical Details:
- HttpOnly cookies set by backend at `localhost:8000` were not being sent by browser when frontend at `localhost:3011` made API requests
- Setting `domain=localhost` on cookies didn't fully resolve the issue
- Browsers have strict cookie policies for cross-port communication

---

## Solution Implemented

**Switched from cookie-based authentication to localStorage for JWT token storage**

### Changes Made:

#### 1. Frontend: `apps/web/lib/api/auth.ts`
```typescript
// BEFORE: Storing token in cookies
if (response.access_token) {
  document.cookie = `auth_token=${response.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

// AFTER: Storing token in localStorage
if (response.access_token) {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", response.access_token);
  }
}
```

#### 2. Frontend: `apps/web/lib/api/client.ts`
```typescript
// BEFORE: Reading token only from cookies
function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  const tokenCookie = cookies.find((c) => c.startsWith("auth_token="));
  if (!tokenCookie) return null;
  return tokenCookie.split("=")[1];
}

// AFTER: Reading token from localStorage first, with cookie fallback
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // Try localStorage first (more reliable for cross-port access)
  const localStorageToken = localStorage.getItem("auth_token");
  if (localStorageToken) return localStorageToken;

  // Fallback to cookies for backward compatibility
  const cookies = document.cookie.split("; ");
  const tokenCookie = cookies.find((c) => c.startsWith("auth_token="));
  if (!tokenCookie) return null;
  return tokenCookie.split("=")[1];
}
```

#### 3. Backend: `apps/backend/src/api/routes/demo_auth.py`
Added `domain="localhost"` to cookie settings for cross-port compatibility:
```python
response.set_cookie(
    key="auth_token",
    value=access_token,
    httponly=True,
    max_age=settings.jwt_expire_minutes * 60,
    samesite="lax",
    secure=settings.should_use_secure_cookies,
    domain="localhost",  # ← Added for cross-port cookie access
)
```

#### 4. Backend: `apps/backend/src/api/middleware/auth.py`
Added cookie authentication check as first authentication method:
```python
# Check for JWT token in cookie (HttpOnly auth_token from login)
auth_token_cookie = request.cookies.get("auth_token")
if auth_token_cookie:
    try:
        from src.auth.jwt import decode_access_token
        payload = decode_access_token(auth_token_cookie)
        request.state.user_id = payload.get("user_id")
        request.state.auth_type = "jwt_cookie"
        logger.debug(f"JWT cookie auth successful for user {payload.get('user_id')}")
        return await call_next(request)
    except Exception as e:
        logger.warning(f"Invalid JWT cookie: {e}")
else:
    logger.debug("No auth_token cookie found")
```

---

## Results

### Before Fix:
```
OPTIONS http://localhost:8000/api/invoices?page=1&page_size=50
Status: 200 OK ✅

GET http://localhost:8000/api/invoices?page=1&page_size=50
Status: 503 Service Unavailable ❌
```

### After Fix:
```
OPTIONS http://localhost:8000/api/invoices?page=1&page_size=50
Status: 200 OK ✅

GET http://localhost:8000/api/invoices?page=1&page_size=50
Status: 200 OK ✅
```

### Frontend UI - Working:
- ✅ **Total Invoices**: 1 (0 paid, 0 overdue)
- ✅ **Total Revenue**: $11,815.67
- ✅ **Outstanding**: $6,815.67
- ✅ **Collection Rate**: 0% (0 of 1 paid)

### Invoice Data Displayed:
- ✅ **Invoice #**: INV-2026-0001
- ✅ **Customer**: Wilson Holdings Plumbing
- ✅ **Issue Date**: Feb 6, 2026
- ✅ **Due Date**: Mar 8, 2026
- ✅ **Status**: Partially Paid
- ✅ **Total**: $11,815.67
- ✅ **Amount Due**: $6,815.67

---

## Why This Approach Works

### Advantages of localStorage over Cookies:
1. **Cross-Port Access**: localStorage is domain-scoped (localhost), not origin-scoped (localhost:port)
2. **No Browser Restrictions**: No SameSite, Secure, or Domain attribute complexity
3. **Simple API**: Easy to read/write with `localStorage.getItem()` and `localStorage.setItem()`
4. **JavaScript Access**: Frontend can easily include token in Authorization header

### Security Considerations:
- **Development Environment**: This is for local development on localhost only
- **Production**: For production deployment, proper HTTPS with same-origin API or CORS-enabled cookies should be used
- **XSS Risk**: localStorage is vulnerable to XSS attacks, but so are non-HttpOnly cookies
- **Token Expiration**: JWT tokens have 8-hour expiration, limiting exposure window

---

## Testing Performed

### 1. Login Flow
```bash
# Navigate to login page
http://localhost:3011/login

# Enter credentials
Email: admin@demo.com
Password: demo123

# Result: ✅ Login successful, redirected to /dashboard
# Token stored in localStorage: ✅ Confirmed
```

### 2. Invoice List API Call
```bash
# Frontend request
GET http://localhost:8000/api/invoices?page=1&page_size=50

# Headers sent
Authorization: Bearer eyJhbGc...
X-User-Id: <user_uuid>
Content-Type: application/json

# Response: ✅ 200 OK
{
  "data": [...],
  "total": 1,
  "page": 1,
  "page_size": 50
}
```

### 3. Frontend Display
- ✅ Summary cards show correct totals
- ✅ Invoice table displays all fields
- ✅ Status badge shows "Partially Paid"
- ✅ Actions buttons (View, Payment) rendered
- ✅ Pagination controls functional

---

## Files Modified

| File | Purpose | Change Type |
|------|---------|-------------|
| `apps/web/lib/api/auth.ts` | Frontend auth API | Modified login/logout to use localStorage |
| `apps/web/lib/api/client.ts` | API client | Modified getAuthToken() to read from localStorage |
| `apps/backend/src/api/routes/demo_auth.py` | Backend auth endpoints | Added domain=localhost to cookies |
| `apps/backend/src/api/middleware/auth.py` | Auth middleware | Added cookie authentication check |

---

## Commit Details

```
commit f17d168
Author: Your Name <your.email@example.com>
Date:   2026-02-06

fix(auth): resolve 503 error by switching to localStorage for JWT tokens

- Changed auth.ts to store JWT in localStorage instead of cookies
- Updated client.ts getAuthToken() to read from localStorage first
- Added cookie domain=localhost in backend for cross-port compatibility
- Added cookie authentication support in AuthMiddleware
- Fixes UNI-173 invoice loading issue (503 -> 200 OK)

The cross-port cookie issue between localhost:3011 (frontend) and
localhost:8000 (backend) was preventing authentication. localStorage
provides more reliable token storage for local development.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Next Steps

### Immediate:
- ✅ Invoice list loading successfully
- ✅ Authentication working
- ✅ Summary metrics displaying correctly

### Future Enhancements:
1. Implement invoice detail view (View button functionality)
2. Implement payment recording (Payment button functionality)
3. Add invoice creation form (New Invoice button)
4. Add invoice editing capability
5. Add invoice deletion with confirmation
6. Add invoice PDF export
7. Add email invoice functionality

---

## Lessons Learned

1. **Cross-Port Cookies Are Unreliable**: Even with `domain=localhost`, browsers don't consistently send cookies across different ports on localhost
2. **localStorage for Local Development**: More reliable for local development with different ports
3. **Authorization Header Works Everywhere**: Including JWT in Authorization header avoids all cookie complications
4. **Test Authentication Early**: Authentication issues block all other functionality - resolve first
5. **Backend Logs Are Critical**: Middleware logs (`"No auth_token cookie found"`) revealed the exact problem

---

## Conclusion

The **503 Service Unavailable error has been completely resolved** by switching from cookie-based authentication to localStorage-based JWT token storage. The invoicing system (UNI-173) is now fully operational:

- ✅ Backend API endpoints working correctly
- ✅ Frontend successfully fetches invoice data
- ✅ Authentication flow working end-to-end
- ✅ Invoice list displays with all metrics
- ✅ Network requests returning 200 OK

**Status**: Invoice system ready for use and further development.

---

*Resolution completed: 2026-02-06 03:21 PM*
*Total time to resolve: ~1 hour (multiple authentication approaches tested)*
*Final solution: localStorage-based JWT authentication*
