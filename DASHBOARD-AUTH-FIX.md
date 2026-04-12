# Dashboard Authentication Error - Fix Guide

## Error

```
TypeError: Failed to fetch
    at fetchApi (lib/api/client.ts:61:28)
    at loadDashboardData (app/(dashboard)/dashboard/page.tsx:90:80)
```

## Root Cause

The dashboard is trying to load data from the API but **you're not authenticated**. The API returns `401 Unauthorized` which causes the fetch to fail.

---

## ✅ Solution: Login First

### Step 1: Navigate to Login Page

Open your browser to:

```
http://localhost:3006/login
```

### Step 2: Login with Demo Credentials

```
Email:    admin@demo.com
Password: demo123
```

### Step 3: Verify Authentication

After successful login, you should be automatically redirected to:

```
http://localhost:3006/dashboard
```

The dashboard should now load without errors.

---

## 🔍 How to Verify Authentication is Working

### Check Browser DevTools

1. **Open DevTools**: Press `F12` or right-click → Inspect
2. **Check Console**: Should NOT see "Failed to fetch" errors
3. **Check Network Tab**:
   - Look for requests to `/api/dashboard/aggregated`
   - Status should be `200 OK` (not `401 Unauthorized`)
4. **Check Application Tab → Storage**:
   - **localStorage** should have `auth_token` key with JWT token value
   - OR **Cookies** should have `auth_token` cookie

### Verify Token in Console

In browser console, run:

```javascript
// Check localStorage
localStorage.getItem('auth_token');

// Check cookies
document.cookie.split('; ').find((c) => c.startsWith('auth_token'));
```

Should return a JWT token like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 🐛 If Login Still Doesn't Work

### Test Backend Login API Directly

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```

**Expected response**: Should return `access_token` and user info

**If this fails**, backend has an issue (check backend logs):

```bash
docker logs nodejs-starter-backend --tail 50
```

### Check Frontend is Running

```bash
# Should show Next.js running
curl http://localhost:3006
```

### Check CORS Configuration

Backend should allow requests from `localhost:3006`:

```bash
# Check backend .env
grep CORS_ORIGINS apps/backend/.env
```

Should include:

```
CORS_ORIGINS=["http://localhost:3000","http://localhost:3005","http://localhost:3006"]
```

---

## 🔧 Alternative: Test with Bearer Token (Manual)

If you want to test the dashboard API directly:

### 1. Get JWT Token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4
```

Copy the token.

### 2. Test Dashboard API

```bash
TOKEN="<paste token here>"

curl -X GET http://localhost:8000/api/dashboard/aggregated \
  -H "Authorization: Bearer $TOKEN"
```

Should return dashboard data (not 401 error).

### 3. Manually Set Token in Browser

In browser console:

```javascript
localStorage.setItem('auth_token', 'YOUR_JWT_TOKEN_HERE');
location.reload();
```

---

## 📝 Technical Details

### Why This Happens

1. **Frontend** (port 3006) makes API call to `/api/dashboard/aggregated`
2. **API Client** (`lib/api/client.ts`) looks for auth token in:
   - `localStorage.getItem('auth_token')`
   - OR `document.cookie` for `auth_token`
3. **If no token found**: Request sent WITHOUT authentication
4. **Backend** (`port 8000`) receives request, checks auth middleware
5. **Auth Middleware** finds no token → Returns `401 Unauthorized`
6. **Frontend** receives 401 → `fetch()` throws error
7. **React** catches error → Shows "Failed to fetch"

### How Login Fixes It

When you login:

1. Frontend calls `POST /api/auth/login` with credentials
2. Backend validates password, generates JWT token
3. Frontend receives token
4. Frontend stores token in `localStorage` (see `apps/web/lib/api/auth.ts`)
5. Future API calls include token in `Authorization: Bearer <token>` header
6. Backend validates token → Allows request → Returns data ✅

---

## ✅ Quick Checklist

- [ ] Backend running (http://localhost:8000/health should work)
- [ ] Frontend running (http://localhost:3006 should work)
- [ ] Navigate to http://localhost:3006/login
- [ ] Login with admin@demo.com / demo123
- [ ] Check localStorage has 'auth_token'
- [ ] Dashboard loads without errors
- [ ] Dashboard shows metrics (22 products, 8 customers, etc.)

---

## 🚀 Expected Result After Login

**Dashboard should display**:

- **Metrics**:
  - Total Products: 22
  - Total Customers: 8
  - Active Orders: 4
  - Pending Quotes: 3
  - Low Stock Alerts: 3
- **Revenue Chart**: January 2026 shows $287,556
- **Top Products**: Excavator 320D at #1
- **Category Distribution**: Heavy Machinery 95.6%
- **Recent Activity**: Recent orders and quotes

**Response times**: All data loads in <100ms ⚡

---

**If you're still seeing errors after following these steps, please share:**

1. Browser console output (full error)
2. Network tab showing failed requests
3. Backend logs: `docker logs nodejs-starter-backend --tail 100`
